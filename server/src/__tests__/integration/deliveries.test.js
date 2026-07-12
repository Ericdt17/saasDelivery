'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAllDeliveries = jest.fn();
const mockGetDeliveryById = jest.fn();
const mockCreateDelivery = jest.fn();
const mockUpdateDelivery = jest.fn();
const mockDeleteDelivery = jest.fn();
const mockGetDeliveryHistory = jest.fn();
const mockGetTariffByAgencyAndQuartier = jest.fn();
const mockSaveHistory = jest.fn();
const mockAdapterQuery = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: mockAdapterQuery, type: 'sqlite' },
  getAllDeliveries: mockGetAllDeliveries,
  getDeliveryById: mockGetDeliveryById,
  createDelivery: mockCreateDelivery,
  updateDelivery: mockUpdateDelivery,
  deleteDelivery: mockDeleteDelivery,
  getDeliveryHistory: mockGetDeliveryHistory,
  saveHistory: mockSaveHistory,
  getTariffByAgencyAndQuartier: mockGetTariffByAgencyAndQuartier,
  getAgencyByEmail: jest.fn(),
  createAgency: jest.fn(),
  getAllAgencies: jest.fn(),
  getAgencyById: jest.fn(),
  updateAgency: jest.fn(),
  deleteAgency: jest.fn(),
  getAllGroups: jest.fn(),
  getGroupById: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  getAllTariffs: jest.fn(),
  getTariffById: jest.fn(),
  createTariff: jest.fn(),
  updateTariff: jest.fn(),
  deleteTariff: jest.fn(),
  getDailyStats: jest.fn(),
  searchDeliveries: jest.fn(),
}));

const app = require('../../api/server');

// Agency-scoped token
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });

// Reusable fixtures
const deliveryFixture = {
  id: 10,
  phone: '612345678',
  items: '2 robes + 1 sac',
  amount_due: 15000,
  amount_paid: 0,
  delivery_fee: null,
  quartier: 'Bonapriso',
  status: 'pending',
  agency_id: 1,
  created_at: new Date().toISOString(),
  tariff_pending: true,
};

// ---------------------------------------------------------------------------
// GET /api/v1/deliveries
// ---------------------------------------------------------------------------
describe('GET /api/v1/deliveries', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/v1/deliveries');
    expect(res.status).toBe(401);
  });

  it('returns 200 with deliveries array for an authenticated agency', async () => {
    mockGetAllDeliveries.mockResolvedValueOnce({
      deliveries: [deliveryFixture],
      pagination: { total: 1, page: 1, limit: 50, totalPages: 1 },
    });
    const res = await request(app)
      .get('/api/v1/deliveries')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('passes agency_id filter from JWT to the DB query', async () => {
    mockGetAllDeliveries.mockResolvedValueOnce({ rows: [], total: 0 });
    await request(app)
      .get('/api/v1/deliveries')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(mockGetAllDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 1 })
    );
  });

  it('super admin can filter by any agency_id via query param', async () => {
    const superToken = createSuperAdminToken();
    mockGetAllDeliveries.mockResolvedValueOnce({ rows: [], total: 0 });
    await request(app)
      .get('/api/v1/deliveries?agency_id=5')
      .set('Authorization', `Bearer ${superToken}`);
    expect(mockGetAllDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 5 })
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/deliveries/:id
// ---------------------------------------------------------------------------
describe('GET /api/v1/deliveries/:id', () => {
  it('returns 404 when delivery does not exist', async () => {
    mockGetDeliveryById.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/v1/deliveries/999')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 200 with delivery data when found', async () => {
    mockGetDeliveryById.mockResolvedValueOnce(deliveryFixture);
    const res = await request(app)
      .get('/api/v1/deliveries/10')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/deliveries
// ---------------------------------------------------------------------------
describe('POST /api/v1/deliveries', () => {
  const validPayload = {
    phone: '690000001',
    items: '1 pantalon',
    amount_due: 12000,
    quartier: 'Makepe',
  };

  it('returns 401 without token', async () => {
    const res = await request(app)
      .post('/api/v1/deliveries')
      .send(validPayload);
    expect(res.status).toBe(401);
  });

  it('returns 400 when phone is missing', async () => {
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ items: '1 sac', amount_due: 5000 });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when items is missing', async () => {
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ phone: '690000001', amount_due: 5000 });
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount_due is negative', async () => {
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ ...validPayload, amount_due: -100 });
    expect(res.status).toBe(400);
  });

  it('returns 201 with new delivery on valid payload', async () => {
    mockCreateDelivery.mockResolvedValueOnce({ ...deliveryFixture, id: 11 });
    mockGetTariffByAgencyAndQuartier.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/v1/deliveries')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send(validPayload);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockCreateDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '690000001', agency_id: 1 })
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/deliveries/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/v1/deliveries/:id', () => {
  it('returns 404 when delivery is not found', async () => {
    mockGetDeliveryById.mockResolvedValueOnce(null);
    const res = await request(app)
      .delete('/api/v1/deliveries/999')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    mockGetDeliveryById.mockResolvedValueOnce(deliveryFixture);
    mockDeleteDelivery.mockResolvedValueOnce(true);
    const res = await request(app)
      .delete('/api/v1/deliveries/10')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
