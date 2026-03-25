'use strict';

/**
 * Priority 1 — Financial correctness tests
 *
 * Tests every status transition case defined in the PUT /deliveries/:id route:
 *   CAS 1  : → delivered         (tariff lookup, amount_paid = amount_due - fee)
 *   CAS 2  : → client_absent     (tariff lookup, amount_paid forced to 0)
 *   CAS 2.5: quartier change while already delivered (re-lookup tariff)
 *   CAS 3  : → failed            (fee zeroed, amount_paid zeroed / refunded)
 *   CAS 4  : → pickup            (fixed 1000 FCFA, amount_paid = amount_due - 1000)
 *   CAS 5  : → zone1             (fixed 500 FCFA, amount_paid = 0)
 *   CAS 6  : → zone2             (fixed 1000 FCFA, amount_paid = 0)
 *   CAS 7  : from zone1/zone2    (fee zeroed)
 *   CAS 8  : from delivered      (fee zeroed, amount_paid zeroed)
 *
 * Also covers POST /deliveries tariff logic at creation time.
 */

const request = require('supertest');
const { createTestToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetDeliveryById          = jest.fn();
const mockUpdateDelivery           = jest.fn();
const mockGetTariffByAgency        = jest.fn();
const mockSaveHistory              = jest.fn();
const mockCreateDelivery           = jest.fn();
const mockGetAllDeliveries         = jest.fn();

jest.mock('../../db', () => ({
  adapter:                      { query: jest.fn(), type: 'sqlite' },
  getDeliveryById:              mockGetDeliveryById,
  updateDelivery:               mockUpdateDelivery,
  getTariffByAgencyAndQuartier: mockGetTariffByAgency,
  saveHistory:                  mockSaveHistory,
  createDelivery:               mockCreateDelivery,
  getAllDeliveries:              mockGetAllDeliveries,
  getDeliveryHistory:           jest.fn(),
  deleteDelivery:               jest.fn(),
  getAgencyByEmail:             jest.fn(),
  createAgency:                 jest.fn(),
  getAllAgencies:                jest.fn(),
  getAgencyById:                jest.fn(),
  updateAgency:                 jest.fn(),
  deleteAgency:                 jest.fn(),
  getAllGroups:                  jest.fn(),
  getGroupById:                 jest.fn(),
  createGroup:                  jest.fn(),
  updateGroup:                  jest.fn(),
  deleteGroup:                  jest.fn(),
  getAllTariffs:                 jest.fn(),
  getTariffById:                jest.fn(),
  createTariff:                 jest.fn(),
  updateTariff:                 jest.fn(),
  deleteTariff:                 jest.fn(),
  getDailyStats:                jest.fn(),
  searchDeliveries:             jest.fn(),
}));

const app   = require('../../api/server');
const token = createTestToken({ userId: 1, agencyId: 1 });
const auth  = { Authorization: `Bearer ${token}` };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a pending delivery fixture with sensible defaults */
function makeDelivery(overrides = {}) {
  return {
    id: 10,
    phone: '690000001',
    items: '2 robes',
    amount_due: 15000,
    amount_paid: 0,
    delivery_fee: null,
    quartier: 'Akwa',
    status: 'pending',
    agency_id: 1,
    tariff_pending: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Sets up a tariff mock response for one call */
function mockTariff(amount) {
  mockGetTariffByAgency.mockResolvedValueOnce({ tarif_amount: amount });
}

/** No tariff exists in DB for this quartier */
function mockNoTariff() {
  mockGetTariffByAgency.mockResolvedValueOnce(null);
}

/**
 * Configures getDeliveryById for the typical PUT flow:
 *   call 1 → existing delivery (before update)
 *   call 2 → updated delivery (after update, used for the response)
 */
function mockGetDeliverySequence(before, afterOverrides = {}) {
  const after = { ...before, ...afterOverrides };
  mockGetDeliveryById
    .mockResolvedValueOnce(before)  // first call: existence check
    .mockResolvedValueOnce(after);  // second call: response after update
}

/** Returns the `updates` object that was passed to updateDelivery */
function capturedUpdates() {
  return mockUpdateDelivery.mock.calls[0][1];
}

// ---------------------------------------------------------------------------
// PUT /deliveries/:id — status transitions
// ---------------------------------------------------------------------------

describe('PUT /api/v1/deliveries/:id — status transitions', () => {

  // ── CAS 1: → delivered ───────────────────────────────────────────────────

  describe('CAS 1: pending → delivered', () => {
    it('applies tariff from quartier and calculates amount_paid = amount_due - fee', async () => {
      const delivery = makeDelivery({ amount_due: 15000, amount_paid: 0 });
      mockGetDeliverySequence(delivery, { status: 'delivered', delivery_fee: 1500, amount_paid: 13500 });
      mockTariff(1500);

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'delivered' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(1500);
      expect(updates.amount_paid).toBe(13500); // 15000 - 1500
      expect(updates.tariff_pending).toBe(false);
    });

    it('never makes amount_paid negative (fee > amount_due)', async () => {
      const delivery = makeDelivery({ amount_due: 500, amount_paid: 0 });
      mockGetDeliverySequence(delivery, { status: 'delivered', delivery_fee: 1000, amount_paid: 0 });
      mockTariff(1000);

      await request(app).put('/api/v1/deliveries/10').set(auth).send({ status: 'delivered' });

      expect(capturedUpdates().amount_paid).toBe(0);
    });

    it('subtracts tariff from partial payment already recorded', async () => {
      const delivery = makeDelivery({ amount_due: 15000, amount_paid: 8000 });
      mockGetDeliverySequence(delivery, { status: 'delivered', delivery_fee: 1500, amount_paid: 6500 });
      mockTariff(1500);

      await request(app).put('/api/v1/deliveries/10').set(auth).send({ status: 'delivered' });

      expect(capturedUpdates().amount_paid).toBe(6500); // 8000 - 1500
    });

    it('recalculates from amount_due when full payment already recorded', async () => {
      const delivery = makeDelivery({ amount_due: 15000, amount_paid: 15000 });
      mockGetDeliverySequence(delivery, { status: 'delivered', delivery_fee: 1500, amount_paid: 13500 });
      mockTariff(1500);

      await request(app).put('/api/v1/deliveries/10').set(auth).send({ status: 'delivered' });

      expect(capturedUpdates().amount_paid).toBe(13500); // amount_due - fee
    });

    it('allows the transition when no tariff is configured for that quartier', async () => {
      const delivery = makeDelivery();
      mockGetDeliverySequence(delivery, { status: 'delivered' });
      mockNoTariff();

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'delivered' });

      expect(res.status).toBe(200);
    });

    it('preserves an existing delivery_fee when no new tariff is available', async () => {
      const delivery = makeDelivery({ delivery_fee: 2000, amount_paid: 0, amount_due: 12000 });
      mockGetDeliverySequence(delivery, { status: 'delivered', delivery_fee: 2000, amount_paid: 10000 });

      await request(app).put('/api/v1/deliveries/10').set(auth).send({ status: 'delivered' });

      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(2000);
      expect(updates.amount_paid).toBe(10000); // 12000 - 2000
    });
  });

  // ── CAS 2: → client_absent ───────────────────────────────────────────────

  describe('CAS 2: pending → client_absent', () => {
    it('applies tariff from quartier but forces amount_paid to 0', async () => {
      const delivery = makeDelivery({ amount_due: 15000, amount_paid: 0 });
      mockGetDeliverySequence(delivery, { status: 'client_absent', delivery_fee: 1500, amount_paid: 0 });
      mockTariff(1500);

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'client_absent' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(1500);
      expect(updates.amount_paid).toBe(0);  // client did not pay
    });
  });

  // ── CAS 2.5: quartier change while already delivered ─────────────────────

  describe('CAS 2.5: quartier change while already delivered', () => {
    it('re-fetches tariff for new quartier and recalculates amount_paid', async () => {
      const delivery = makeDelivery({
        status: 'delivered',
        quartier: 'Akwa',
        delivery_fee: 1000,
        amount_due: 15000,
        amount_paid: 14000,
      });
      mockGetDeliverySequence(delivery, { quartier: 'Bonapriso', delivery_fee: 2000, amount_paid: 13000 });
      mockTariff(2000); // new quartier tariff

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ quartier: 'Bonapriso' }); // only quartier changes

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(2000);
      expect(updates.amount_paid).toBe(13000); // 15000 - 2000
    });
  });

  // ── CAS 3: → failed ──────────────────────────────────────────────────────

  describe('CAS 3: → failed', () => {
    it('zeroes delivery_fee and amount_paid when coming from pending', async () => {
      const delivery = makeDelivery({ amount_paid: 5000, delivery_fee: null });
      mockGetDeliverySequence(delivery, { status: 'failed', delivery_fee: 0, amount_paid: 0 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'failed' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(0);
      expect(updates.amount_paid).toBe(0);
    });

    it('zeroes delivery_fee and amount_paid when coming from delivered (full refund)', async () => {
      const delivery = makeDelivery({
        status: 'delivered',
        delivery_fee: 1500,
        amount_paid: 13500,
        amount_due: 15000,
      });
      mockGetDeliverySequence(delivery, { status: 'failed', delivery_fee: 0, amount_paid: 0 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'failed' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(0);
      expect(updates.amount_paid).toBe(0);
    });
  });

  // ── CAS 4: → pickup ──────────────────────────────────────────────────────

  describe('CAS 4: → pickup', () => {
    it('applies fixed 1000 FCFA tariff and calculates amount_paid = amount_due - 1000', async () => {
      const delivery = makeDelivery({ amount_due: 15000, amount_paid: 0 });
      mockGetDeliverySequence(delivery, { status: 'pickup', delivery_fee: 1000, amount_paid: 14000 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'pickup' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(1000);
      expect(updates.amount_paid).toBe(14000); // 15000 - 1000
    });

    it('clamps amount_paid to 0 when amount_due < 1000', async () => {
      const delivery = makeDelivery({ amount_due: 500, amount_paid: 0 });
      mockGetDeliverySequence(delivery, { status: 'pickup', delivery_fee: 1000, amount_paid: 0 });

      await request(app).put('/api/v1/deliveries/10').set(auth).send({ status: 'pickup' });

      expect(capturedUpdates().amount_paid).toBe(0);
    });
  });

  // ── CAS 5: → zone1 ───────────────────────────────────────────────────────

  describe('CAS 5: → present_ne_decroche_zone1', () => {
    it('applies fixed 500 FCFA tariff and forces amount_paid to 0', async () => {
      const delivery = makeDelivery({ amount_due: 15000, amount_paid: 0 });
      mockGetDeliverySequence(delivery, { status: 'present_ne_decroche_zone1', delivery_fee: 500, amount_paid: 0 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'present_ne_decroche_zone1' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(500);
      expect(updates.amount_paid).toBe(0);
    });
  });

  // ── CAS 6: → zone2 ───────────────────────────────────────────────────────

  describe('CAS 6: → present_ne_decroche_zone2', () => {
    it('applies fixed 1000 FCFA tariff and forces amount_paid to 0', async () => {
      const delivery = makeDelivery({ amount_due: 15000, amount_paid: 0 });
      mockGetDeliverySequence(delivery, { status: 'present_ne_decroche_zone2', delivery_fee: 1000, amount_paid: 0 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'present_ne_decroche_zone2' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(1000);
      expect(updates.amount_paid).toBe(0);
    });
  });

  // ── CAS 7: from zone1/zone2 ──────────────────────────────────────────────

  describe('CAS 7: from zone1/zone2 → pending', () => {
    it('cancels the zone tariff (delivery_fee → 0) when leaving zone1', async () => {
      const delivery = makeDelivery({
        status: 'present_ne_decroche_zone1',
        delivery_fee: 500,
        amount_paid: 0,
      });
      mockGetDeliverySequence(delivery, { status: 'pending', delivery_fee: 0 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'pending' });

      expect(res.status).toBe(200);
      expect(capturedUpdates().delivery_fee).toBe(0);
    });

    it('cancels the zone tariff (delivery_fee → 0) when leaving zone2', async () => {
      const delivery = makeDelivery({
        status: 'present_ne_decroche_zone2',
        delivery_fee: 1000,
        amount_paid: 0,
      });
      mockGetDeliverySequence(delivery, { status: 'pending', delivery_fee: 0 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'pending' });

      expect(res.status).toBe(200);
      expect(capturedUpdates().delivery_fee).toBe(0);
    });
  });

  // ── CAS 8: from delivered → pending ──────────────────────────────────────

  describe('CAS 8: from delivered → pending', () => {
    it('cancels the tariff and resets amount_paid to 0', async () => {
      const delivery = makeDelivery({
        status: 'delivered',
        delivery_fee: 1500,
        amount_paid: 13500,
        amount_due: 15000,
      });
      mockGetDeliverySequence(delivery, { status: 'pending', delivery_fee: 0, amount_paid: 0 });

      const res = await request(app)
        .put('/api/v1/deliveries/10')
        .set(auth)
        .send({ status: 'pending' });

      expect(res.status).toBe(200);
      const updates = capturedUpdates();
      expect(updates.delivery_fee).toBe(0);
      expect(updates.amount_paid).toBe(0);
    });
  });

  // ── tariff_pending flag lifecycle ─────────────────────────────────────────

  describe('tariff_pending flag', () => {
    it('is false after transitioning to delivered', async () => {
      const delivery = makeDelivery({ tariff_pending: true });
      mockGetDeliverySequence(delivery, { status: 'delivered', tariff_pending: false });
      mockTariff(1000);

      await request(app).put('/api/v1/deliveries/10').set(auth).send({ status: 'delivered' });

      expect(capturedUpdates().tariff_pending).toBe(false);
    });

    it('is false after transitioning to failed', async () => {
      const delivery = makeDelivery({ tariff_pending: true });
      mockGetDeliverySequence(delivery, { status: 'failed', tariff_pending: false });

      await request(app).put('/api/v1/deliveries/10').set(auth).send({ status: 'failed' });

      expect(capturedUpdates().tariff_pending).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// POST /deliveries — tariff logic at creation time
// ---------------------------------------------------------------------------

describe('POST /api/v1/deliveries — tariff logic at creation', () => {
  const base = { phone: '690000001', items: '2 robes', amount_due: 15000 };

  it('sets tariff_pending=true for pending delivery with quartier and no fee', async () => {
    // Pending deliveries do not call getTariffByAgencyAndQuartier — no tariff mock needed.
    mockCreateDelivery.mockResolvedValueOnce(11);
    mockGetDeliveryById.mockResolvedValueOnce(
      makeDelivery({ id: 11, quartier: 'Akwa', delivery_fee: null, tariff_pending: true })
    );

    const res = await request(app)
      .post('/api/v1/deliveries')
      .set(auth)
      .send({ ...base, quartier: 'Akwa' });

    expect(res.status).toBe(201);
    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ tariff_pending: true })
    );
  });

  it('applies fixed 1000 FCFA pickup tariff on creation and calculates amount_paid', async () => {
    mockCreateDelivery.mockResolvedValueOnce(12);
    mockGetDeliveryById.mockResolvedValueOnce(
      makeDelivery({ id: 12, status: 'pickup', delivery_fee: 1000, amount_paid: 14000 })
    );

    const res = await request(app)
      .post('/api/v1/deliveries')
      .set(auth)
      .send({ ...base, status: 'pickup' });

    expect(res.status).toBe(201);
    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_fee: 1000, amount_paid: 14000 })
    );
  });

  it('applies fixed 500 FCFA zone1 tariff and forces amount_paid to 0', async () => {
    mockCreateDelivery.mockResolvedValueOnce(13);
    mockGetDeliveryById.mockResolvedValueOnce(
      makeDelivery({ id: 13, status: 'present_ne_decroche_zone1', delivery_fee: 500, amount_paid: 0 })
    );

    const res = await request(app)
      .post('/api/v1/deliveries')
      .set(auth)
      .send({ ...base, status: 'present_ne_decroche_zone1' });

    expect(res.status).toBe(201);
    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_fee: 500, amount_paid: 0 })
    );
  });

  it('applies tariff from DB on creation when status=delivered', async () => {
    mockGetTariffByAgency.mockResolvedValueOnce({ tarif_amount: 1500 });
    mockCreateDelivery.mockResolvedValueOnce(14);
    mockGetDeliveryById.mockResolvedValueOnce(
      makeDelivery({ id: 14, status: 'delivered', delivery_fee: 1500, amount_paid: 13500 })
    );

    const res = await request(app)
      .post('/api/v1/deliveries')
      .set(auth)
      .send({ ...base, status: 'delivered', quartier: 'Akwa' });

    expect(res.status).toBe(201);
    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_fee: 1500, amount_paid: 13500 })
    );
  });

  it('forces amount_paid=0 on creation when status=client_absent', async () => {
    mockGetTariffByAgency.mockResolvedValueOnce({ tarif_amount: 1500 });
    mockCreateDelivery.mockResolvedValueOnce(15);
    mockGetDeliveryById.mockResolvedValueOnce(
      makeDelivery({ id: 15, status: 'client_absent', delivery_fee: 1500, amount_paid: 0 })
    );

    const res = await request(app)
      .post('/api/v1/deliveries')
      .set(auth)
      .send({ ...base, status: 'client_absent', quartier: 'Akwa' });

    expect(res.status).toBe(201);
    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ delivery_fee: 1500, amount_paid: 0 })
    );
  });
});
