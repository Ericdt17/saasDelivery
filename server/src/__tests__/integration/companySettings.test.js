'use strict';

process.env.AUTH_HEADER_FALLBACK = 'true';

const request = require('supertest');
const {
  createTestToken,
  createSuperAdminToken,
} = require('../helpers/createAuthToken');

const mockGetCompanySettings = jest.fn();
const mockUpsertCompanySettings = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  getCompanySettings: (...args) => mockGetCompanySettings(...args),
  upsertCompanySettings: (...args) => mockUpsertCompanySettings(...args),
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

const settingsRow = {
  id: 1,
  company_name: 'LivSight SA',
  legal_name: 'LivSight SA',
  tax_id: 'M0987654321',
  trade_register: 'RC/DLA/2019/B/100',
  address: 'Akwa, Douala',
  phone: '+237 600 00 00 00',
  email: 'hello@livsight.com',
  accent_color: '#1A73E8',
  logo_base64: null,
  stamp_base64: null,
  updated_at: '2026-09-26T00:00:00.000Z',
};

beforeEach(() => {
  mockGetCompanySettings.mockReset();
  mockUpsertCompanySettings.mockReset();
});

describe('GET /api/v1/settings/company', () => {
  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/v1/settings/company');
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/settings/company')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns defaults when row is missing', async () => {
    mockGetCompanySettings.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/v1/settings/company')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.company_name).toBe('LivSight');
    expect(res.body.data.accent_color).toBe('#4A9FD4');
  });

  it('returns stored company settings', async () => {
    mockGetCompanySettings.mockResolvedValueOnce(settingsRow);
    const res = await request(app)
      .get('/api/v1/settings/company')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.company_name).toBe('LivSight SA');
    expect(res.body.data.accent_color).toBe('#1A73E8');
  });
});

describe('PUT /api/v1/settings/company', () => {
  it('returns 400 when company_name is missing', async () => {
    const res = await request(app)
      .put('/api/v1/settings/company')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ address: 'x' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid accent_color', async () => {
    const res = await request(app)
      .put('/api/v1/settings/company')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ company_name: 'LivSight', accent_color: 'blue' });
    expect(res.status).toBe(400);
  });

  it('upserts and returns company settings', async () => {
    mockGetCompanySettings.mockResolvedValueOnce(settingsRow);
    mockUpsertCompanySettings.mockResolvedValueOnce(settingsRow);
    const res = await request(app)
      .put('/api/v1/settings/company')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        company_name: 'LivSight SA',
        legal_name: 'LivSight SA',
        tax_id: 'M0987654321',
        trade_register: 'RC/DLA/2019/B/100',
        address: 'Akwa, Douala',
        phone: '+237 600 00 00 00',
        email: 'hello@livsight.com',
        accent_color: '#1A73E8',
        logo_base64: null,
        stamp_base64: 'data:image/png;base64,STAMP',
      });
    expect(res.status).toBe(200);
    expect(res.body.data.company_name).toBe('LivSight SA');
    expect(res.body.data.tax_id).toBe('M0987654321');
    expect(res.body.data.trade_register).toBe('RC/DLA/2019/B/100');
    expect(res.body.data).not.toHaveProperty('signer_name');
    expect(res.body.data).not.toHaveProperty('signature_base64');
    expect(mockUpsertCompanySettings).toHaveBeenCalledWith(
      expect.objectContaining({
        company_name: 'LivSight SA',
        tax_id: 'M0987654321',
        trade_register: 'RC/DLA/2019/B/100',
        accent_color: '#1A73E8',
        stamp_base64: 'data:image/png;base64,STAMP',
      })
    );
  });
});
