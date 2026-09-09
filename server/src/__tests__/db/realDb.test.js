'use strict';

/**
 * Real-database integration tests — run against a live PostgreSQL instance.
 *
 * Validates agency query helpers still work after delivery vertical removal.
 * Automatically skipped when DATABASE_URL is not set.
 */

const HAS_DB = !!process.env.DATABASE_URL;
const describeWithDb = HAS_DB ? describe : describe.skip;

let pool, queries;
if (HAS_DB) {
  const { createPostgresPool } = require('../../db/postgres');
  const createPostgresQueries = require('../../db/postgres-queries');
  pool = createPostgresPool();
  queries = createPostgresQueries(pool);
}

const TEST_EMAIL_PREFIX = 'jest_realdb_';

async function cleanUp() {
  await queries.query(`DELETE FROM agencies WHERE email LIKE $1`, [
    `${TEST_EMAIL_PREFIX}%`,
  ]);
}

describeWithDb('PostgreSQL — real-database integration', () => {
  let agencyId;

  beforeAll(async () => {
    await cleanUp();
    agencyId = await queries.createAgency({
      name: 'Jest Test Agency',
      email: `${TEST_EMAIL_PREFIX}agency@jest.com`,
      password_hash: '$2b$10$fakehashforjestonly',
      role: 'agency',
      is_active: true,
      agency_code: 'JEST',
    });
  });

  afterAll(async () => {
    await cleanUp();
    await pool.end();
  });

  describe('Agency queries', () => {
    it('createAgency returns a numeric id', () => {
      expect(typeof agencyId).toBe('number');
      expect(agencyId).toBeGreaterThan(0);
    });

    it('getAgencyByEmail retrieves the created agency', async () => {
      const agency = await queries.getAgencyByEmail(
        `${TEST_EMAIL_PREFIX}agency@jest.com`
      );
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

    it('deleteAgency soft-deactivates the agency', async () => {
      await queries.deleteAgency(agencyId);
      const agency = await queries.getAgencyById(agencyId);
      expect(agency.is_active).toBe(false);
    });
  });
});
