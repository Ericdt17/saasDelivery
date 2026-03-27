'use strict';

/**
 * Real-database integration tests — run against a live PostgreSQL instance.
 *
 * These tests validate the actual SQL queries in postgres-queries.js:
 *   - CRUD round-trips (insert → fetch → verify)
 *   - getDailyStats aggregations with known data
 *   - getTariffByAgencyAndQuartier lookup
 *
 * They are automatically skipped when DATABASE_URL is not set (local dev
 * without Postgres), and run in CI via the jest.db.config.js configuration.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const describeWithDb = HAS_DB ? describe : describe.skip;

// Only require the DB modules when DATABASE_URL is available to avoid
// the process.exit(1) in db/index.js during local unit-test runs.
let pool, queries;
if (HAS_DB) {
  const { createPostgresPool } = require('../../db/postgres');
  const createPostgresQueries  = require('../../db/postgres-queries');
  pool    = createPostgresPool();
  queries = createPostgresQueries(pool);
}

// ---------------------------------------------------------------------------
// Isolation helpers — all test rows use a unique prefix so teardown is safe.
// ---------------------------------------------------------------------------

const TEST_EMAIL_PREFIX  = 'jest_realdb_';
const TEST_PHONE_PREFIX  = 'TEST9';

async function cleanUp() {
  // Delete in FK-safe order
  await queries.query(`DELETE FROM reminder_targets WHERE reminder_id IN (SELECT id FROM reminders WHERE message LIKE $1)`, [`JEST_REMINDER_%`]);
  await queries.query(`DELETE FROM reminders WHERE message LIKE $1`,  [`JEST_REMINDER_%`]);
  await queries.query(`DELETE FROM agency_reminder_contacts WHERE label LIKE $1`,  [`JEST_REMINDER_%`]);
  await queries.query(`DELETE FROM deliveries WHERE phone LIKE $1`,  [`${TEST_PHONE_PREFIX}%`]);
  await queries.query(`DELETE FROM tariffs WHERE quartier LIKE $1`,   [`JEST_%`]);
  await queries.query(
    `DELETE FROM agencies WHERE email LIKE $1`,
    [`${TEST_EMAIL_PREFIX}%`]
  );
}

// ---------------------------------------------------------------------------

describeWithDb('PostgreSQL — real-database integration', () => {
  let agencyId;

  beforeAll(async () => {
    await cleanUp();

    // Seed a test agency used by all tests in this suite
    agencyId = await queries.createAgency({
      name:          'Jest Test Agency',
      email:         `${TEST_EMAIL_PREFIX}agency@jest.com`,
      password_hash: '$2b$10$fakehashforjestonly',
      role:          'agency',
      is_active:     true,
      agency_code:   'JEST',
    });
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  // ── Agency CRUD ────────────────────────────────────────────────────────────

  describe('Agency queries', () => {
    it('createAgency returns a numeric id', () => {
      expect(typeof agencyId).toBe('number');
      expect(agencyId).toBeGreaterThan(0);
    });

    it('getAgencyByEmail retrieves the created agency', async () => {
      const agency = await queries.getAgencyByEmail(`${TEST_EMAIL_PREFIX}agency@jest.com`);
      expect(agency).not.toBeNull();
      expect(agency.name).toBe('Jest Test Agency');
      expect(agency.role).toBe('agency');
      expect(agency.is_active).toBe(true);
    });

    it('getAgencyById retrieves the created agency', async () => {
      const agency = await queries.getAgencyById(agencyId);
      expect(agency).not.toBeNull();
      expect(agency.id).toBe(agencyId);
    });
  });

  // ── Tariff CRUD + lookup ───────────────────────────────────────────────────

  describe('Tariff queries', () => {
    let tariffId;

    it('createTariff returns a numeric id', async () => {
      tariffId = await queries.createTariff({
        agency_id:    agencyId,
        quartier:     'JEST_Akwa',
        tarif_amount: 1500,
      });
      expect(typeof tariffId).toBe('number');
      expect(tariffId).toBeGreaterThan(0);
    });

    it('getTariffByAgencyAndQuartier returns the correct tariff', async () => {
      const tariff = await queries.getTariffByAgencyAndQuartier(agencyId, 'JEST_Akwa');
      expect(tariff).not.toBeNull();
      expect(Number(tariff.tarif_amount)).toBe(1500);
      expect(tariff.agency_id).toBe(agencyId);
    });

    it('getTariffByAgencyAndQuartier returns null for unknown quartier', async () => {
      const tariff = await queries.getTariffByAgencyAndQuartier(agencyId, 'JEST_UnknownQuartier');
      expect(!tariff).toBe(true);
    });

    it('updateTariff changes the tarif_amount', async () => {
      await queries.updateTariff(tariffId, { tarif_amount: 2000 });
      const updated = await queries.getTariffByAgencyAndQuartier(agencyId, 'JEST_Akwa');
      expect(Number(updated.tarif_amount)).toBe(2000);
    });

    it('getTariffsByAgency returns all tariffs for the agency', async () => {
      const tariffs = await queries.getTariffsByAgency(agencyId);
      const jest_tariffs = tariffs.filter(t => t.quartier.startsWith('JEST_'));
      expect(jest_tariffs.length).toBeGreaterThanOrEqual(1);
    });

    it('deleteTariff removes the tariff', async () => {
      await queries.deleteTariff(tariffId);
      const gone = await queries.getTariffByAgencyAndQuartier(agencyId, 'JEST_Akwa');
      expect(!gone).toBe(true);
    });
  });

  // ── Delivery CRUD ─────────────────────────────────────────────────────────

  describe('Delivery queries', () => {
    let deliveryId;

    it('insertDelivery returns a numeric id', async () => {
      deliveryId = await queries.insertDelivery({
        phone:       `${TEST_PHONE_PREFIX}001`,
        items:       '2 robes',
        amount_due:  15000,
        amount_paid: 0,
        status:      'pending',
        quartier:    'JEST_Makepe',
        agency_id:   agencyId,
      });
      expect(typeof deliveryId).toBe('number');
      expect(deliveryId).toBeGreaterThan(0);
    });

    it('getDeliveryById retrieves the inserted delivery', async () => {
      const delivery = await queries.getDeliveryById(deliveryId);
      expect(delivery).not.toBeNull();
      expect(delivery.phone).toBe(`${TEST_PHONE_PREFIX}001`);
      expect(Number(delivery.amount_due)).toBe(15000);
      expect(delivery.status).toBe('pending');
    });

    it('updateDelivery persists status and financial changes', async () => {
      await queries.updateDelivery(deliveryId, {
        status:       'delivered',
        delivery_fee: 1500,
        amount_paid:  13500,
      });
      const updated = await queries.getDeliveryById(deliveryId);
      expect(updated.status).toBe('delivered');
      expect(Number(updated.delivery_fee)).toBe(1500);
      expect(Number(updated.amount_paid)).toBe(13500);
    });
  });

  // ── Reminders (contacts + scheduled reminders) ────────────────────────────

  describe('Reminders queries', () => {
    let contactId;
    let reminderId;

    it('createAgencyReminderContact creates a contact for the agency', async () => {
      contactId = await queries.createAgencyReminderContact({
        agency_id: agencyId,
        label: 'JEST_REMINDER_Chef',
        phone: '+237690999999',
        is_active: true,
      });
      expect(typeof contactId).toBe('number');
      expect(contactId).toBeGreaterThan(0);
    });

    it('getAgencyReminderContacts returns the contact', async () => {
      const contacts = await queries.getAgencyReminderContacts({ agency_id: agencyId, includeInactive: true });
      const found = contacts.find(c => c.id === contactId);
      expect(found).toBeTruthy();
      expect(found.label).toBe('JEST_REMINDER_Chef');
    });

    it('createReminder schedules a reminder', async () => {
      const sendAt = new Date(Date.now() + 60_000).toISOString();
      reminderId = await queries.createReminder({
        agency_id: agencyId,
        contact_id: contactId,
        message: 'JEST_REMINDER_Test message',
        send_at: sendAt,
        timezone: 'UTC',
        audience_mode: 'contacts',
        send_interval_min_sec: 60,
        send_interval_max_sec: 120,
        status: 'scheduled',
        created_by_user_id: null,
        targets: [{ target_type: 'contact', target_value: '237690999999' }],
      });
      expect(typeof reminderId).toBe('number');
      expect(reminderId).toBeGreaterThan(0);
    });

    it('getDueReminders returns reminders when send_at <= now', async () => {
      // Force send_at to the past
      await queries.query(`UPDATE reminders SET send_at = CURRENT_TIMESTAMP - INTERVAL '1 minute' WHERE id = $1`, [reminderId]);
      const due = await queries.getDueReminders({ limit: 10 });
      const found = due.find(r => r.id === reminderId);
      expect(found).toBeTruthy();
      expect(found.message).toBe('JEST_REMINDER_Test message');
    });
  });

  // ── getDailyStats SQL aggregations ────────────────────────────────────────

  describe('getDailyStats — SQL aggregations', () => {
    // We insert deliveries with a controlled date to make assertions deterministic.
    const TEST_DATE = '2000-01-01'; // far in the past — no accidental collisions

    beforeAll(async () => {
      // Insert a known set of deliveries on TEST_DATE using raw SQL (insertDelivery
      // defaults created_at to NOW(), so we set it explicitly here).
      const rows = [
        { phone: `${TEST_PHONE_PREFIX}S01`, status: 'delivered',    amount_due: 10000, amount_paid: 9000, delivery_fee: 1000 },
        { phone: `${TEST_PHONE_PREFIX}S02`, status: 'delivered',    amount_due: 20000, amount_paid: 18500, delivery_fee: 1500 },
        { phone: `${TEST_PHONE_PREFIX}S03`, status: 'failed',       amount_due: 5000,  amount_paid: 0,    delivery_fee: 0    },
        { phone: `${TEST_PHONE_PREFIX}S04`, status: 'pending',      amount_due: 8000,  amount_paid: 0,    delivery_fee: 0    },
        { phone: `${TEST_PHONE_PREFIX}S05`, status: 'pickup',       amount_due: 12000, amount_paid: 11000, delivery_fee: 1000 },
      ];

      for (const row of rows) {
        await queries.query(
          `INSERT INTO deliveries (phone, items, amount_due, amount_paid, delivery_fee, status, agency_id, created_at)
           VALUES ($1, 'jest items', $2, $3, $4, $5, $6, $7::date)`,
          [row.phone, row.amount_due, row.amount_paid, row.delivery_fee, row.status, agencyId, TEST_DATE]
        );
      }
    });

    it('counts deliveries by status correctly', async () => {
      const stats = await queries.getDailyStats(TEST_DATE, agencyId, null);
      expect(stats.total).toBe(5);
      expect(stats.delivered).toBe(2);
      expect(stats.failed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.pickup).toBe(1);
    });

    it('calculates total_due as sum of all amount_due', async () => {
      const stats = await queries.getDailyStats(TEST_DATE, agencyId, null);
      // 10000 + 20000 + 5000 + 8000 + 12000 = 55000
      expect(stats.total_due).toBe(55000);
    });

    it('calculates total_collected as sum of all amount_paid', async () => {
      const stats = await queries.getDailyStats(TEST_DATE, agencyId, null);
      // 9000 + 18500 + 0 + 0 + 11000 = 38500
      expect(stats.total_collected).toBe(38500);
    });

    it('calculates total_remaining as sum of (amount_due - amount_paid)', async () => {
      const stats = await queries.getDailyStats(TEST_DATE, agencyId, null);
      // (10000-9000) + (20000-18500) + (5000-0) + (8000-0) + (12000-11000) = 16500
      expect(stats.total_remaining).toBe(16500);
    });

    it('returns zeroes for a date with no deliveries', async () => {
      const stats = await queries.getDailyStats('1990-01-01', agencyId, null);
      expect(stats.total).toBe(0);
      expect(stats.total_due).toBe(0);
      expect(stats.total_collected).toBe(0);
    });

    it('scopes correctly by agency_id (different agency sees 0)', async () => {
      const stats = await queries.getDailyStats(TEST_DATE, 999999, null);
      expect(stats.total).toBe(0);
    });
  });
});
