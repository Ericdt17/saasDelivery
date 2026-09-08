'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

const mockListMerchantTerms = jest.fn();
const mockGetMerchantTermsById = jest.fn();
const mockCreateMerchantTerms = jest.fn();
const mockUpdateMerchantTerms = jest.fn();
const mockDeleteMerchantTerms = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  listMerchantTerms: mockListMerchantTerms,
  getMerchantTermsById: mockGetMerchantTermsById,
  createMerchantTerms: mockCreateMerchantTerms,
  updateMerchantTerms: mockUpdateMerchantTerms,
  deleteMerchantTerms: mockDeleteMerchantTerms,
  getAllDeliveries: jest.fn(),
  getDeliveries: jest.fn(),
  getDeliveryById: jest.fn(),
  createDelivery: jest.fn(),
  updateDelivery: jest.fn(),
  deleteDelivery: jest.fn(),
  getDeliveryHistory: jest.fn(),
  saveHistory: jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  getDeliveryStats: jest.fn(),
  getAllTariffs: jest.fn(),
  getTariffsByAgency: jest.fn(),
  getTariffById: jest.fn(),
  createTariff: jest.fn(),
  updateTariff: jest.fn(),
  deleteTariff: jest.fn(),
  getAllGroups: jest.fn(),
  getGroupsByAgency: jest.fn(),
  getGroupById: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  hardDeleteGroup: jest.fn(),
  searchDeliveries: jest.fn(),
  getAgencyByEmail: jest.fn(),
  createAgency: jest.fn(),
  getAllAgencies: jest.fn(),
  getAgencyById: jest.fn(),
  updateAgency: jest.fn(),
  deleteAgency: jest.fn(),
  findAgencyByCode: jest.fn(),
  getWaitlistEntries: jest.fn(),
  insertWaitlistEntry: jest.fn(),
  recruitmentListOpenJobs: jest.fn(),
  recruitmentGetJobOfferById: jest.fn(),
  recruitmentListAdminJobsWithCounts: jest.fn(),
}));

const app = require('../../api/server');
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });

const termsFixture = {
  id: 1,
  title: 'Conditions marchands 2026',
  content: 'Texte des conditions…',
  is_active: true,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('GET /api/v1/merchant-terms', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/merchant-terms');
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/merchant-terms')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with list for super admin', async () => {
    mockListMerchantTerms.mockResolvedValueOnce([termsFixture]);
    const res = await request(app)
      .get('/api/v1/merchant-terms')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('Conditions marchands 2026');
  });
});

describe('POST /api/v1/merchant-terms', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .post('/api/v1/merchant-terms')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ title: 'Test' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/v1/merchant-terms')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ content: 'Sans titre' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates merchant terms and returns 201', async () => {
    mockCreateMerchantTerms.mockResolvedValueOnce(termsFixture);
    const res = await request(app)
      .post('/api/v1/merchant-terms')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ title: 'Conditions marchands 2026', content: 'Texte…' });
    expect(res.status).toBe(201);
    expect(res.body.data.title).toBe('Conditions marchands 2026');
    expect(mockCreateMerchantTerms).toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/merchant-terms/:id', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .patch('/api/v1/merchant-terms/1')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ is_active: false });
    expect(res.status).toBe(403);
  });

  it('returns 404 when not found', async () => {
    mockGetMerchantTermsById.mockResolvedValueOnce(null);
    const res = await request(app)
      .patch('/api/v1/merchant-terms/999')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ is_active: false });
    expect(res.status).toBe(404);
  });

  it('updates and returns 200', async () => {
    mockGetMerchantTermsById.mockResolvedValueOnce(termsFixture);
    mockUpdateMerchantTerms.mockResolvedValueOnce({ ...termsFixture, is_active: false });
    const res = await request(app)
      .patch('/api/v1/merchant-terms/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ is_active: false });
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });
});

describe('DELETE /api/v1/merchant-terms/:id', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .delete('/api/v1/merchant-terms/1')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when not found', async () => {
    mockGetMerchantTermsById.mockResolvedValueOnce(null);
    const res = await request(app)
      .delete('/api/v1/merchant-terms/999')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it('deletes and returns 200', async () => {
    mockGetMerchantTermsById.mockResolvedValueOnce(termsFixture);
    mockDeleteMerchantTerms.mockResolvedValueOnce({ deleted: true, id: 1 });
    const res = await request(app)
      .delete('/api/v1/merchant-terms/1')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });
});
