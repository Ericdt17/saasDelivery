'use strict';

process.env.AUTH_HEADER_FALLBACK = 'true';

const request = require('supertest');
const { createSuperAdminToken, createTestToken } = require('../helpers/createAuthToken');
const { LivsightOpsError } = require('../../lib/livsightOps');

const mockFetchRevenueReport = jest.fn();
const mockFetchExpenseReport = jest.fn();

jest.mock('../../lib/livsightOps', () => {
  const actual = jest.requireActual('../../lib/livsightOps');
  return {
    ...actual,
    fetchRevenueReport: (...args) => mockFetchRevenueReport(...args),
    fetchExpenseReport: (...args) => mockFetchExpenseReport(...args),
  };
});

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  getCompanySettings: jest.fn(),
  upsertCompanySettings: jest.fn(),
  listEmployees: jest.fn(),
  getEmployeeById: jest.fn(),
  createEmployee: jest.fn(),
  updateEmployee: jest.fn(),
  deleteEmployee: jest.fn(),
  enrollEmployeeFace: jest.fn(),
  getEmployeeByEmailWithDescriptor: jest.fn(),
  getAttendanceByEmployeeAndDate: jest.fn(),
  createAttendance: jest.fn(),
  upsertAttendance: jest.fn(),
  listAttendances: jest.fn(),
  summarizeAttendances: jest.fn(),
  listMerchantTerms: jest.fn(),
  getMerchantTermsById: jest.fn(),
  createMerchantTerms: jest.fn(),
  updateMerchantTerms: jest.fn(),
  deleteMerchantTerms: jest.fn(),
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
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });

beforeEach(() => {
  mockFetchRevenueReport.mockReset();
  mockFetchExpenseReport.mockReset();
});

describe('GET /api/v1/ops-reports/revenue', () => {
  it('returns 403 for agency users', async () => {
    const res = await request(app)
      .get('/api/v1/ops-reports/revenue')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with report data', async () => {
    mockFetchRevenueReport.mockResolvedValueOnce({ net_revenue: 1000 });
    const res = await request(app)
      .get('/api/v1/ops-reports/revenue')
      .query({ start_date: '2026-09-01', end_date: '2026-09-30' })
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.net_revenue).toBe(1000);
  });

  it('returns a clear 502 when the ops API key is rejected', async () => {
    mockFetchRevenueReport.mockRejectedValueOnce(
      new LivsightOpsError('bad key', {
        status: 401,
        code: 'unauthorized',
      })
    );
    const res = await request(app)
      .get('/api/v1/ops-reports/revenue')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/Clé API LivSight ops invalide/i);
    expect(res.body.code).toBe('ops_unauthorized');
  });

  it('returns 503 when ops integration is not configured', async () => {
    mockFetchRevenueReport.mockRejectedValueOnce(
      new LivsightOpsError('missing config', { code: 'config' })
    );
    const res = await request(app)
      .get('/api/v1/ops-reports/revenue')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/pas configurée/i);
  });
});
