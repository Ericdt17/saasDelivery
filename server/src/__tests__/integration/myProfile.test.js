'use strict';

process.env.AUTH_HEADER_FALLBACK = 'true';

const request = require('supertest');
const {
  createTestToken,
  createSuperAdminToken,
} = require('../helpers/createAuthToken');

const mockGetAgencyById = jest.fn();
const mockUpdateAgencyProfile = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  getAgencyById: (...args) => mockGetAgencyById(...args),
  updateAgencyProfile: (...args) => mockUpdateAgencyProfile(...args),
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

const profileRow = {
  id: 99,
  name: 'Eric Djou',
  email: 'admin@livsight.com',
  role: 'super_admin',
  fonction: 'Directeur Général',
  signature_base64: 'data:image/png;base64,SIG',
  is_active: true,
};

beforeEach(() => {
  mockGetAgencyById.mockReset();
  mockUpdateAgencyProfile.mockReset();
});

describe('GET /api/v1/settings/me', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/settings/me')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns personal profile for super_admin', async () => {
    mockGetAgencyById.mockResolvedValueOnce(profileRow);
    const res = await request(app)
      .get('/api/v1/settings/me')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual({
      name: 'Eric Djou',
      email: 'admin@livsight.com',
      fonction: 'Directeur Général',
      signature_base64: 'data:image/png;base64,SIG',
    });
    expect(mockGetAgencyById).toHaveBeenCalledWith(99);
  });
});

describe('PATCH /api/v1/settings/me', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .patch('/api/v1/settings/me')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'X' });
    expect(res.status).toBe(403);
  });

  it('updates personal profile for super_admin', async () => {
    mockGetAgencyById.mockResolvedValueOnce(profileRow);
    mockUpdateAgencyProfile.mockResolvedValueOnce({
      ...profileRow,
      name: 'Eric Updated',
      fonction: 'CEO',
      signature_base64: null,
    });
    const res = await request(app)
      .patch('/api/v1/settings/me')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        name: 'Eric Updated',
        fonction: 'CEO',
        signature_base64: null,
      });
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Eric Updated');
    expect(res.body.data.fonction).toBe('CEO');
    expect(mockUpdateAgencyProfile).toHaveBeenCalledWith(
      99,
      expect.objectContaining({
        name: 'Eric Updated',
        fonction: 'CEO',
        signature_base64: null,
      })
    );
  });
});
