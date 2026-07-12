'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAllTariffs              = jest.fn();
const mockGetTariffsByAgency         = jest.fn();
const mockGetTariffById              = jest.fn();
const mockCreateTariff               = jest.fn();
const mockUpdateTariff               = jest.fn();
const mockDeleteTariff               = jest.fn();
const mockGetTariffByAgencyAndQuartier = jest.fn();
const mockAdapterQuery               = jest.fn();

jest.mock('../../db', () => ({
  adapter:                      { query: mockAdapterQuery, type: 'sqlite' },
  getAllTariffs:                 mockGetAllTariffs,
  getTariffsByAgency:           mockGetTariffsByAgency,
  getTariffById:                mockGetTariffById,
  createTariff:                 mockCreateTariff,
  updateTariff:                 mockUpdateTariff,
  deleteTariff:                 mockDeleteTariff,
  getTariffByAgencyAndQuartier: mockGetTariffByAgencyAndQuartier,
  // Stubs
  getAllDeliveries:   jest.fn(),
  getDeliveryById:   jest.fn(),
  createDelivery:    jest.fn(),
  updateDelivery:    jest.fn(),
  deleteDelivery:    jest.fn(),
  getDeliveryHistory:jest.fn(),
  saveHistory:       jest.fn(),
  getDeliveryStats:  jest.fn(),
  getAgencyByEmail:  jest.fn(),
  createAgency:      jest.fn(),
  getAllAgencies:     jest.fn(),
  getAgencyById:     jest.fn(),
  updateAgency:      jest.fn(),
  deleteAgency:      jest.fn(),
  getAllGroups:       jest.fn(),
  getGroupsByAgency: jest.fn(),
  getGroupById:      jest.fn(),
  createGroup:       jest.fn(),
  updateGroup:       jest.fn(),
  deleteGroup:       jest.fn(),
  hardDeleteGroup:   jest.fn(),
  searchDeliveries:  jest.fn(),
}));

const app        = require('../../api/server');
const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken  = createSuperAdminToken({ userId: 99, agencyId: null });

const tariffFixture = { id: 5, agency_id: 1, quartier: 'Akwa', tarif_amount: 1500 };

// ---------------------------------------------------------------------------
// GET /api/v1/tariffs
// ---------------------------------------------------------------------------

describe('GET /api/v1/tariffs', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/tariffs');
    expect(res.status).toBe(401);
  });

  it('returns agency tariffs scoped to the authenticated user', async () => {
    mockGetTariffsByAgency.mockResolvedValueOnce([tariffFixture]);

    const res = await request(app)
      .get('/api/v1/tariffs')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(mockGetTariffsByAgency).toHaveBeenCalledWith(1);
  });

  it('returns all tariffs for super admin', async () => {
    mockGetAllTariffs.mockResolvedValueOnce([tariffFixture]);

    const res = await request(app)
      .get('/api/v1/tariffs')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(mockGetAllTariffs).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/tariffs/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/tariffs/:id', () => {
  it('returns 404 when tariff does not exist', async () => {
    mockGetTariffById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/v1/tariffs/999')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when accessing another agency\'s tariff', async () => {
    mockGetTariffById.mockResolvedValueOnce({ ...tariffFixture, agency_id: 99 });

    const res = await request(app)
      .get('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with tariff data when authorized', async () => {
    mockGetTariffById.mockResolvedValueOnce(tariffFixture);

    const res = await request(app)
      .get('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.quartier).toBe('Akwa');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/tariffs
// ---------------------------------------------------------------------------

describe('POST /api/v1/tariffs', () => {
  const validPayload = { quartier: 'Bonapriso', tarif_amount: 2000 };

  it('returns 400 when quartier is missing', async () => {
    const res = await request(app)
      .post('/api/v1/tariffs')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ tarif_amount: 1500 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('returns 400 when tarif_amount is missing', async () => {
    const res = await request(app)
      .post('/api/v1/tariffs')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ quartier: 'Akwa' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when tarif_amount is negative', async () => {
    const res = await request(app)
      .post('/api/v1/tariffs')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ quartier: 'Akwa', tarif_amount: -500 });
    expect(res.status).toBe(400);
  });

  it('returns 409 when a tariff already exists for that quartier', async () => {
    mockGetTariffByAgencyAndQuartier.mockResolvedValueOnce(tariffFixture);

    const res = await request(app)
      .post('/api/v1/tariffs')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ quartier: 'Akwa', tarif_amount: 1500 });

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('returns 201 with the created tariff on valid payload', async () => {
    mockGetTariffByAgencyAndQuartier.mockResolvedValueOnce(null); // no duplicate
    mockCreateTariff.mockResolvedValueOnce(10);
    mockGetTariffById.mockResolvedValueOnce({ id: 10, agency_id: 1, ...validPayload });

    const res = await request(app)
      .post('/api/v1/tariffs')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockCreateTariff).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 1, quartier: 'Bonapriso', tarif_amount: 2000 })
    );
  });

  it('returns 403 when agency user tries to create for a different agency', async () => {
    const res = await request(app)
      .post('/api/v1/tariffs')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ agency_id: 99, quartier: 'Akwa', tarif_amount: 1500 });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/tariffs/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/tariffs/:id', () => {
  it('returns 404 when tariff does not exist', async () => {
    mockGetTariffById.mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/v1/tariffs/999')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ tarif_amount: 2000 });

    expect(res.status).toBe(404);
  });

  it('returns 403 when updating another agency\'s tariff', async () => {
    mockGetTariffById.mockResolvedValueOnce({ ...tariffFixture, agency_id: 99 });

    const res = await request(app)
      .put('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ tarif_amount: 2000 });

    expect(res.status).toBe(403);
  });

  it('returns 400 when no valid fields are provided', async () => {
    mockGetTariffById.mockResolvedValueOnce(tariffFixture);

    const res = await request(app)
      .put('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 400 when tarif_amount is negative', async () => {
    mockGetTariffById.mockResolvedValueOnce(tariffFixture);

    const res = await request(app)
      .put('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ tarif_amount: -100 });

    expect(res.status).toBe(400);
  });

  it('returns 409 when changing quartier conflicts with an existing tariff', async () => {
    mockGetTariffById.mockResolvedValueOnce(tariffFixture);
    // Conflict: another tariff already uses 'Bonapriso' for this agency
    mockGetTariffByAgencyAndQuartier.mockResolvedValueOnce({ id: 20, agency_id: 1, quartier: 'Bonapriso' });

    const res = await request(app)
      .put('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ quartier: 'Bonapriso' });

    expect(res.status).toBe(409);
  });

  it('returns 200 on a valid amount update', async () => {
    mockGetTariffById
      .mockResolvedValueOnce(tariffFixture)                              // existence check
      .mockResolvedValueOnce({ ...tariffFixture, tarif_amount: 2000 }); // after update

    const res = await request(app)
      .put('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ tarif_amount: 2000 });

    expect(res.status).toBe(200);
    expect(res.body.data.tarif_amount).toBe(2000);
    expect(mockUpdateTariff).toHaveBeenCalledWith(5, { tarif_amount: 2000 });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/tariffs/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/tariffs/:id', () => {
  it('returns 404 when tariff does not exist', async () => {
    mockGetTariffById.mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/v1/tariffs/999')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when deleting another agency\'s tariff', async () => {
    mockGetTariffById.mockResolvedValueOnce({ ...tariffFixture, agency_id: 99 });

    const res = await request(app)
      .delete('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 on successful deletion', async () => {
    mockGetTariffById.mockResolvedValueOnce(tariffFixture);

    const res = await request(app)
      .delete('/api/v1/tariffs/5')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockDeleteTariff).toHaveBeenCalledWith(5);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/tariffs/import
// ---------------------------------------------------------------------------

describe('POST /api/v1/tariffs/import', () => {
  it('returns 400 when no file is uploaded', async () => {
    const res = await request(app)
      .post('/api/v1/tariffs/import')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/no file/i);
  });

  it('returns 400 for an unsupported file format', async () => {
    const res = await request(app)
      .post('/api/v1/tariffs/import')
      .set('Authorization', `Bearer ${agencyToken}`)
      .attach('file', Buffer.from('hello'), { filename: 'data.txt', contentType: 'text/plain' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/unsupported/i);
  });

  it('creates new tariffs from a valid CSV', async () => {
    const csv = 'quartier,tarif_amount\nAkwa,1500\nMakepe,2000\n';
    // No existing tariffs → both rows get created
    mockGetTariffByAgencyAndQuartier.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/tariffs/import')
      .set('Authorization', `Bearer ${agencyToken}`)
      .attach('file', Buffer.from(csv), { filename: 'tariffs.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(2);
    expect(res.body.data.updated).toBe(0);
    expect(res.body.data.errors).toHaveLength(0);
  });

  it('updates existing tariffs when quartier already exists', async () => {
    const csv = 'quartier,tarif_amount\nAkwa,1800\n';
    mockGetTariffByAgencyAndQuartier.mockResolvedValueOnce({ id: 5, quartier: 'Akwa' });

    const res = await request(app)
      .post('/api/v1/tariffs/import')
      .set('Authorization', `Bearer ${agencyToken}`)
      .attach('file', Buffer.from(csv), { filename: 'tariffs.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.created).toBe(0);
    expect(res.body.data.updated).toBe(1);
    expect(mockUpdateTariff).toHaveBeenCalledWith(5, { tarif_amount: 1800 });
  });

  it('reports errors for rows with invalid tarif_amount', async () => {
    const csv = 'quartier,tarif_amount\nAkwa,notanumber\n';

    const res = await request(app)
      .post('/api/v1/tariffs/import')
      .set('Authorization', `Bearer ${agencyToken}`)
      .attach('file', Buffer.from(csv), { filename: 'tariffs.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.created).toBe(0);
  });

  it('reports errors for rows with missing quartier', async () => {
    const csv = 'quartier,tarif_amount\n,1500\n';

    const res = await request(app)
      .post('/api/v1/tariffs/import')
      .set('Authorization', `Bearer ${agencyToken}`)
      .attach('file', Buffer.from(csv), { filename: 'tariffs.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toHaveLength(1);
  });
});
