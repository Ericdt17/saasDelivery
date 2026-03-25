'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetDeliveryStats = jest.fn();
const mockAdapterQuery     = jest.fn();

jest.mock('../../db', () => ({
  adapter:            { query: mockAdapterQuery, type: 'sqlite' },
  getDeliveryStats:   mockGetDeliveryStats,
  // Stubs for other routes mounted on the app
  getAllDeliveries:              jest.fn(),
  getDeliveryById:              jest.fn(),
  createDelivery:               jest.fn(),
  updateDelivery:               jest.fn(),
  deleteDelivery:               jest.fn(),
  getDeliveryHistory:           jest.fn(),
  saveHistory:                  jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  getAgencyByEmail:             jest.fn(),
  createAgency:                 jest.fn(),
  getAllAgencies:                jest.fn(),
  getAgencyById:                jest.fn(),
  updateAgency:                 jest.fn(),
  deleteAgency:                 jest.fn(),
  getAllGroups:                  jest.fn(),
  getGroupsByAgency:            jest.fn(),
  getGroupById:                 jest.fn(),
  createGroup:                  jest.fn(),
  updateGroup:                  jest.fn(),
  deleteGroup:                  jest.fn(),
  hardDeleteGroup:              jest.fn(),
  getAllTariffs:                 jest.fn(),
  getTariffsByAgency:           jest.fn(),
  getTariffById:                jest.fn(),
  createTariff:                 jest.fn(),
  updateTariff:                 jest.fn(),
  deleteTariff:                 jest.fn(),
  searchDeliveries:             jest.fn(),
}));

const app        = require('../../api/server');
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken  = createSuperAdminToken({ userId: 99, agencyId: null });

const statsFixture = {
  total: 10,
  delivered: 6,
  failed: 1,
  pending: 2,
  pickup: 1,
  total_collected: 90000,
  total_remaining: 10000,
  total_due: 100000,
};

// ---------------------------------------------------------------------------
// GET /api/v1/stats/daily
// ---------------------------------------------------------------------------

describe('GET /api/v1/stats/daily', () => {

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/stats/daily');
    expect(res.status).toBe(401);
  });

  it('returns 400 for an invalid date format', async () => {
    const res = await request(app)
      .get('/api/v1/stats/daily?date=25-03-2026')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid date/i);
  });

  it('returns 400 for a non-existent date', async () => {
    const res = await request(app)
      .get('/api/v1/stats/daily?date=2026-13-99')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 200 with stats for a valid date', async () => {
    mockGetDeliveryStats.mockResolvedValueOnce(statsFixture);

    const res = await request(app)
      .get('/api/v1/stats/daily?date=2026-03-25')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(statsFixture);
    expect(res.body.date).toBe('2026-03-25');
  });

  it('returns 200 with today\'s date when no date is provided', async () => {
    mockGetDeliveryStats.mockResolvedValueOnce(statsFixture);

    const res = await request(app)
      .get('/api/v1/stats/daily')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('scopes stats to agency_id from JWT for agency users', async () => {
    mockGetDeliveryStats.mockResolvedValueOnce(statsFixture);

    await request(app)
      .get('/api/v1/stats/daily?date=2026-03-25')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(mockGetDeliveryStats).toHaveBeenCalledWith(
      '2026-03-25',
      1,        // agencyId from token
      null      // no group_id
    );
  });

  it('allows super admin to filter by any agency_id via query param', async () => {
    mockGetDeliveryStats.mockResolvedValueOnce(statsFixture);

    await request(app)
      .get('/api/v1/stats/daily?date=2026-03-25&agency_id=5')
      .set('Authorization', `Bearer ${superToken}`);

    expect(mockGetDeliveryStats).toHaveBeenCalledWith('2026-03-25', 5, null);
  });

  it('passes group_id filter through to the DB call', async () => {
    mockGetDeliveryStats.mockResolvedValueOnce(statsFixture);

    await request(app)
      .get('/api/v1/stats/daily?date=2026-03-25&group_id=3')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(mockGetDeliveryStats).toHaveBeenCalledWith('2026-03-25', 1, 3);
  });
});
