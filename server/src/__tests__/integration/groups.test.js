'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetAllGroups    = jest.fn();
const mockGetGroupsByAgency = jest.fn();
const mockGetGroupById    = jest.fn();
const mockCreateGroup     = jest.fn();
const mockUpdateGroup     = jest.fn();
const mockDeleteGroup     = jest.fn();
const mockHardDeleteGroup = jest.fn();
const mockAdapterQuery    = jest.fn();

jest.mock('../../db', () => ({
  adapter:            { query: mockAdapterQuery, type: 'sqlite' },
  getAllGroups:        mockGetAllGroups,
  getGroupsByAgency:  mockGetGroupsByAgency,
  getGroupById:       mockGetGroupById,
  createGroup:        mockCreateGroup,
  updateGroup:        mockUpdateGroup,
  deleteGroup:        mockDeleteGroup,
  hardDeleteGroup:    mockHardDeleteGroup,
  // Stubs
  getAllDeliveries:              jest.fn(),
  getDeliveryById:              jest.fn(),
  createDelivery:               jest.fn(),
  updateDelivery:               jest.fn(),
  deleteDelivery:               jest.fn(),
  getDeliveryHistory:           jest.fn(),
  saveHistory:                  jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  getDeliveryStats:             jest.fn(),
  getAgencyByEmail:             jest.fn(),
  createAgency:                 jest.fn(),
  getAllAgencies:                jest.fn(),
  getAgencyById:                jest.fn(),
  updateAgency:                 jest.fn(),
  deleteAgency:                 jest.fn(),
  getAllTariffs:                 jest.fn(),
  getTariffsByAgency:           jest.fn(),
  getTariffById:                jest.fn(),
  createTariff:                 jest.fn(),
  updateTariff:                 jest.fn(),
  deleteTariff:                 jest.fn(),
  searchDeliveries:             jest.fn(),
}));

const app         = require('../../api/server');
const agencyToken  = createTestToken({ userId: 1, agencyId: 1 });
const superToken   = createSuperAdminToken({ userId: 99, agencyId: null });

const groupFixture = {
  id: 7,
  agency_id: 1,
  name: 'Groupe Douala',
  whatsapp_group_id: '120363424120563204@g.us',
  is_active: true,
};

// ---------------------------------------------------------------------------
// GET /api/v1/groups
// ---------------------------------------------------------------------------

describe('GET /api/v1/groups', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/groups');
    expect(res.status).toBe(401);
  });

  it('returns groups scoped to the agency user', async () => {
    mockGetGroupsByAgency.mockResolvedValueOnce([groupFixture]);

    const res = await request(app)
      .get('/api/v1/groups')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockGetGroupsByAgency).toHaveBeenCalledWith(1, true);
  });

  it('returns all groups for super admin', async () => {
    mockGetAllGroups.mockResolvedValueOnce([groupFixture]);

    const res = await request(app)
      .get('/api/v1/groups')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(mockGetAllGroups).toHaveBeenCalledWith(true);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/groups/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/groups/:id', () => {
  it('returns 404 when group does not exist', async () => {
    mockGetGroupById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/v1/groups/999')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when accessing another agency\'s group', async () => {
    mockGetGroupById.mockResolvedValueOnce({ ...groupFixture, agency_id: 99 });

    const res = await request(app)
      .get('/api/v1/groups/7')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with group data when authorized', async () => {
    mockGetGroupById.mockResolvedValueOnce(groupFixture);

    const res = await request(app)
      .get('/api/v1/groups/7')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Groupe Douala');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/groups
// ---------------------------------------------------------------------------

describe('POST /api/v1/groups', () => {
  const validPayload = {
    name: 'Nouveau Groupe',
    whatsapp_group_id: '120363424120563999@g.us',
  };

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ whatsapp_group_id: '120363424120563999@g.us' });
    expect(res.status).toBe(400);
  });

  it('returns 400 when whatsapp_group_id is missing', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'Groupe Test' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for an invalid WhatsApp Group ID format', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'Groupe Test', whatsapp_group_id: 'not-a-valid-id' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/invalid whatsapp group id/i);
  });

  it('returns 409 when whatsapp_group_id already exists', async () => {
    // adapter.query returns an existing group → conflict
    mockAdapterQuery.mockResolvedValueOnce({ id: 7 });

    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send(validPayload);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('returns 201 with the created group on valid payload', async () => {
    mockAdapterQuery.mockResolvedValueOnce(null); // no existing group
    mockCreateGroup.mockResolvedValueOnce(8);
    mockGetGroupById.mockResolvedValueOnce({ id: 8, agency_id: 1, ...validPayload });

    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send(validPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(mockCreateGroup).toHaveBeenCalledWith(
      expect.objectContaining({ agency_id: 1, name: 'Nouveau Groupe' })
    );
  });

  it('returns 403 when agency user tries to create for a different agency', async () => {
    const res = await request(app)
      .post('/api/v1/groups')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ ...validPayload, agency_id: 99 });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/groups/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/groups/:id', () => {
  it('returns 404 when group does not exist', async () => {
    mockGetGroupById.mockResolvedValueOnce(null);

    const res = await request(app)
      .put('/api/v1/groups/999')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'Nouveau nom' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when updating another agency\'s group', async () => {
    mockGetGroupById.mockResolvedValueOnce({ ...groupFixture, agency_id: 99 });

    const res = await request(app)
      .put('/api/v1/groups/7')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'Nouveau nom' });

    expect(res.status).toBe(403);
  });

  it('returns 200 and updates name successfully', async () => {
    mockGetGroupById
      .mockResolvedValueOnce(groupFixture)
      .mockResolvedValueOnce({ ...groupFixture, name: 'Nouveau nom' });

    const res = await request(app)
      .put('/api/v1/groups/7')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ name: 'Nouveau nom' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Nouveau nom');
    expect(mockUpdateGroup).toHaveBeenCalledWith(7, { name: 'Nouveau nom' });
  });

  it('toggles is_active to false (soft disable)', async () => {
    mockGetGroupById
      .mockResolvedValueOnce(groupFixture)
      .mockResolvedValueOnce({ ...groupFixture, is_active: false });

    const res = await request(app)
      .put('/api/v1/groups/7')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ is_active: false });

    expect(res.status).toBe(200);
    expect(mockUpdateGroup).toHaveBeenCalledWith(7, { is_active: false });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/groups/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/groups/:id', () => {
  it('returns 404 when group does not exist', async () => {
    mockGetGroupById.mockResolvedValueOnce(null);

    const res = await request(app)
      .delete('/api/v1/groups/999')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when deleting another agency\'s group', async () => {
    mockGetGroupById.mockResolvedValueOnce({ ...groupFixture, agency_id: 99 });

    const res = await request(app)
      .delete('/api/v1/groups/7')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(403);
  });

  it('performs a soft delete (is_active → false) by default', async () => {
    mockGetGroupById.mockResolvedValueOnce(groupFixture);

    const res = await request(app)
      .delete('/api/v1/groups/7')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/soft delete|deactivated/i);
    expect(mockDeleteGroup).toHaveBeenCalledWith(7);
    expect(mockHardDeleteGroup).not.toHaveBeenCalled();
  });

  it('performs a hard delete when ?permanent=true is passed', async () => {
    mockGetGroupById.mockResolvedValueOnce(groupFixture);

    const res = await request(app)
      .delete('/api/v1/groups/7?permanent=true')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/permanent/i);
    expect(mockHardDeleteGroup).toHaveBeenCalledWith(7);
    expect(mockDeleteGroup).not.toHaveBeenCalled();
  });
});
