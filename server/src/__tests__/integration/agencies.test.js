'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAllAgencies    = jest.fn();
const mockGetAgencyById     = jest.fn();
const mockGetAgencyByEmail  = jest.fn();
const mockCreateAgency      = jest.fn();
const mockUpdateAgency      = jest.fn();
const mockDeleteAgency      = jest.fn();
const mockFindAgencyByCode  = jest.fn();
const mockAdapterQuery      = jest.fn();

jest.mock('../../db', () => ({
  adapter:            { query: mockAdapterQuery, type: 'sqlite' },
  getAllAgencies:      mockGetAllAgencies,
  getAgencyById:      mockGetAgencyById,
  getAgencyByEmail:   mockGetAgencyByEmail,
  createAgency:       mockCreateAgency,
  updateAgency:       mockUpdateAgency,
  deleteAgency:       mockDeleteAgency,
  findAgencyByCode:   mockFindAgencyByCode,
  // Stubs
  getAllDeliveries:              jest.fn(),
  getDeliveries:                jest.fn(),
  getDeliveryById:              jest.fn(),
  createDelivery:               jest.fn(),
  updateDelivery:               jest.fn(),
  deleteDelivery:               jest.fn(),
  getDeliveryHistory:           jest.fn(),
  saveHistory:                  jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  getDeliveryStats:             jest.fn(),
  getAllTariffs:                 jest.fn(),
  getTariffsByAgency:           jest.fn(),
  getTariffById:                jest.fn(),
  createTariff:                 jest.fn(),
  updateTariff:                 jest.fn(),
  deleteTariff:                 jest.fn(),
  getAllGroups:                  jest.fn(),
  getGroupsByAgency:            jest.fn(),
  getGroupById:                 jest.fn(),
  createGroup:                  jest.fn(),
  updateGroup:                  jest.fn(),
  deleteGroup:                  jest.fn(),
  hardDeleteGroup:              jest.fn(),
  searchDeliveries:             jest.fn(),
}));

const app        = require('../../api/server');
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken  = createSuperAdminToken({ userId: 99, agencyId: null });

const agencyFixture = {
  id: 1,
  name: 'Test Agency',
  email: 'agency@test.com',
  role: 'agency',
  is_active: true,
  agency_code: 'TEST',
};

// ---------------------------------------------------------------------------
// GET /api/v1/agencies/me
// ---------------------------------------------------------------------------

describe('GET /api/v1/agencies/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/agencies/me');
    expect(res.status).toBe(401);
  });

  it('returns 403 for super admin (no associated agency)', async () => {
    const res = await request(app)
      .get('/api/v1/agencies/me')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when agency not found', async () => {
    mockGetAgencyById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/v1/agencies/me')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with agency data for agency admin', async () => {
    mockGetAgencyById.mockResolvedValueOnce(agencyFixture);

    const res = await request(app)
      .get('/api/v1/agencies/me')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Test Agency');
    expect(mockGetAgencyById).toHaveBeenCalledWith(1);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/agencies  (super admin only)
// ---------------------------------------------------------------------------

describe('GET /api/v1/agencies', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/agencies');
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/agencies')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with all agencies for super admin', async () => {
    mockGetAllAgencies.mockResolvedValueOnce([agencyFixture]);

    const res = await request(app)
      .get('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(mockGetAllAgencies).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/agencies/:id  (super admin only)
// ---------------------------------------------------------------------------

describe('GET /api/v1/agencies/:id', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when agency not found', async () => {
    mockGetAgencyById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/v1/agencies/999')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 with agency data for super admin', async () => {
    mockGetAgencyById.mockResolvedValueOnce(agencyFixture);

    const res = await request(app)
      .get('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/agencies  (super admin only)
// ---------------------------------------------------------------------------

describe('POST /api/v1/agencies', () => {
  const validPayload = { name: 'New Agency', email: 'new@agency.com', password: 'pass1234' };

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send(validPayload);
    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ email: 'a@b.com', password: 'pass1234' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Test', password: 'pass1234' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Test', email: 'a@b.com' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid agency_code (too short)', async () => {
    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ...validPayload, agency_code: 'AB' }); // < 4 chars
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('returns 400 for invalid agency_code (special characters)', async () => {
    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ...validPayload, agency_code: 'AB-CD' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when agency_code already taken', async () => {
    mockFindAgencyByCode.mockResolvedValueOnce({ id: 5 }); // code taken

    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ...validPayload, agency_code: 'TAKEN' });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('returns 201 on valid payload without code', async () => {
    mockCreateAgency.mockResolvedValueOnce(10);
    mockGetAgencyById.mockResolvedValueOnce({ id: 10, ...validPayload });

    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockCreateAgency).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'New Agency', email: 'new@agency.com' })
    );
  });

  it('returns 201 on valid payload with a valid agency_code', async () => {
    mockFindAgencyByCode.mockResolvedValueOnce(null); // code free
    mockCreateAgency.mockResolvedValueOnce(11);
    mockGetAgencyById.mockResolvedValueOnce({ id: 11, ...validPayload, agency_code: 'NEWCO' });

    const res = await request(app)
      .post('/api/v1/agencies')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ ...validPayload, agency_code: 'newco' }); // lowercase → normalised to NEWCO

    expect(res.status).toBe(201);
    // code normalised to uppercase before the lookup
    expect(mockFindAgencyByCode).toHaveBeenCalledWith('NEWCO');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/agencies/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/agencies/:id', () => {
  it('returns 403 when agency user tries to update another agency', async () => {
    const res = await request(app)
      .put('/api/v1/agencies/99')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'Hacked' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when agency does not exist', async () => {
    mockGetAgencyById.mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/v1/agencies/999')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Updated' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when no valid fields are provided', async () => {
    mockGetAgencyById.mockResolvedValueOnce(agencyFixture);

    const res = await request(app)
      .put('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({}); // no fields

    expect(res.status).toBe(400);
  });

  it('returns 409 when agency_code conflicts with another agency (super admin)', async () => {
    mockGetAgencyById.mockResolvedValueOnce(agencyFixture);
    mockFindAgencyByCode.mockResolvedValueOnce({ id: 50 }); // conflict with a different agency

    const res = await request(app)
      .put('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ agency_code: 'CLASH' });

    expect(res.status).toBe(409);
  });

  it('returns 200 when agency admin updates allowed fields on own agency', async () => {
    mockGetAgencyById
      .mockResolvedValueOnce(agencyFixture)
      .mockResolvedValueOnce({ ...agencyFixture, name: 'Renamed' });

    const res = await request(app)
      .put('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'Renamed' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockUpdateAgency).toHaveBeenCalledWith(1, expect.objectContaining({ name: 'Renamed' }));
  });

  it('returns 200 when super admin updates restricted fields', async () => {
    mockGetAgencyById
      .mockResolvedValueOnce(agencyFixture)
      .mockResolvedValueOnce({ ...agencyFixture, is_active: false });

    const res = await request(app)
      .put('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(mockUpdateAgency).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ is_active: false })
    );
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/agencies/:id  (super admin only)
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/agencies/:id', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .delete('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when agency not found', async () => {
    mockGetAgencyById.mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/v1/agencies/999')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 200 on successful deletion', async () => {
    mockGetAgencyById.mockResolvedValueOnce(agencyFixture);

    const res = await request(app)
      .delete('/api/v1/agencies/1')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDeleteAgency).toHaveBeenCalledWith(1);
  });
});
