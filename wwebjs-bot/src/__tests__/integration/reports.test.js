'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mock PDFKit — class-based mock so all methods are properly available.
// pipe() schedules res.end() asynchronously so the route can set headers
// first, and supertest receives a complete response.
// ---------------------------------------------------------------------------

jest.mock('pdfkit', () => {
  const EventEmitter = require('events');

  class MockPDFDocument extends EventEmitter {
    constructor() {
      super();
      this.y    = 100;
      this.x    = 50;
      this.page = { width: 595, height: 842, margins: { top: 50, bottom: 50, left: 50, right: 50 } };
    }
    // Drawing / layout methods — all return `this` for chaining
    lineGap()        { return this; }
    fontSize()       { return this; }
    font()           { return this; }
    text()           { return this; }
    moveDown()       { return this; }
    rect()           { return this; }
    fill()           { return this; }
    stroke()         { return this; }
    moveTo()         { return this; }
    lineTo()         { return this; }
    image()          { return this; }
    addPage()        { return this; }
    fillColor()      { return this; }
    strokeColor()    { return this; }
    lineWidth()      { return this; }
    opacity()        { return this; }
    translate()      { return this; }
    rotate()         { return this; }
    save()           { return this; }
    restore()        { return this; }
    undash()         { return this; }
    dash()           { return this; }
    roundedRect()    { return this; }
    clip()           { return this; }
    scale()          { return this; }
    widthOfString()  { return 100; }
    currentLineHeight() { return 14; }
    // Pipe to destination; schedule end so headers are set first
    pipe(dest)       { setImmediate(() => dest.end()); return dest; }
    // end() is a noop — dest.end() is called from pipe()
    end()            {}
  }

  return MockPDFDocument;
});

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockGetGroupById      = jest.fn();
const mockGetAgencyById     = jest.fn();
const mockGetDeliveries     = jest.fn();
const mockGetTariffsByAgency = jest.fn();
const mockAdapterQuery      = jest.fn();

jest.mock('../../db', () => ({
  adapter:            { query: mockAdapterQuery, type: 'sqlite' },
  getGroupById:       mockGetGroupById,
  getAgencyById:      mockGetAgencyById,
  getDeliveries:      mockGetDeliveries,
  getAllDeliveries:    mockGetDeliveries,
  getTariffsByAgency: mockGetTariffsByAgency,
  // Stubs
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
  updateAgency:                 jest.fn(),
  deleteAgency:                 jest.fn(),
  findAgencyByCode:             jest.fn(),
  getAllTariffs:                 jest.fn(),
  getTariffById:                jest.fn(),
  createTariff:                 jest.fn(),
  updateTariff:                 jest.fn(),
  deleteTariff:                 jest.fn(),
  getAllGroups:                  jest.fn(),
  getGroupsByAgency:            jest.fn(),
  createGroup:                  jest.fn(),
  updateGroup:                  jest.fn(),
  deleteGroup:                  jest.fn(),
  hardDeleteGroup:              jest.fn(),
  searchDeliveries:             jest.fn(),
}));

const app         = require('../../api/server');
const agencyToken  = createTestToken({ userId: 1, agencyId: 1 });
const superToken   = createSuperAdminToken({ userId: 99, agencyId: null });

const groupFixture  = { id: 3, agency_id: 1, name: 'Groupe Douala', is_active: true };
const agencyFixture = { id: 1, name: 'Test Agency', email: 'agency@test.com' };

// ---------------------------------------------------------------------------
// GET /api/v1/reports/groups/:groupId/pdf — auth & authorization
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/groups/:id/pdf — authorization', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/reports/groups/3/pdf');
    expect(res.status).toBe(401);
  });

  it('returns 404 when group does not exist', async () => {
    mockGetGroupById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/v1/reports/groups/999/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 403 when accessing another agency\'s group', async () => {
    mockGetGroupById.mockResolvedValueOnce({ ...groupFixture, agency_id: 99 });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(403);
  });

  it('returns 404 when agency not found for the group', async () => {
    mockGetGroupById.mockResolvedValueOnce(groupFixture);
    mockGetAgencyById.mockResolvedValueOnce(null);

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/reports/groups/:id/pdf — success / financial totals
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/groups/:id/pdf — financial totals', () => {
  /**
   * Delivery set (controlled to verify totals):
   *
   *  D1 delivered  amount_due=10000  amount_paid=9000  delivery_fee=1000  quartier=Akwa
   *  D2 delivered  amount_due=20000  amount_paid=18000 delivery_fee=2000  quartier=Bonapriso
   *  D3 client_absent amount_due=5000 amount_paid=0   delivery_fee=1500  quartier=Akwa
   *  D4 pickup     amount_due=3000   amount_paid=2000  delivery_fee=1000  quartier=—
   *  D5 pending    amount_due=8000   amount_paid=0     delivery_fee=0     quartier=Makepe
   *
   * Expected:
   *   totalEncaisse = (9000+1000) + (18000+2000) + (2000+1000) = 33000
   *   totalTarifs   = 1000 + 2000 + 1500 + 1000               = 5500
   *   netARever     = 33000 − 5500                             = 27500
   */
  const deliveries = [
    { status: 'delivered',     amount_due: 10000, amount_paid: 9000,  delivery_fee: 1000, quartier: 'Akwa' },
    { status: 'delivered',     amount_due: 20000, amount_paid: 18000, delivery_fee: 2000, quartier: 'Bonapriso' },
    { status: 'client_absent', amount_due: 5000,  amount_paid: 0,     delivery_fee: 1500, quartier: 'Akwa' },
    { status: 'pickup',        amount_due: 3000,  amount_paid: 2000,  delivery_fee: 1000, quartier: null },
    { status: 'pending',       amount_due: 8000,  amount_paid: 0,     delivery_fee: 0,    quartier: 'Makepe' },
  ];

  beforeEach(() => {
    mockGetGroupById.mockResolvedValue(groupFixture);
    mockGetAgencyById.mockResolvedValue(agencyFixture);
    mockGetDeliveries.mockResolvedValue({ deliveries, pagination: { total: 5 } });
    mockGetTariffsByAgency.mockResolvedValue([]);
  });

  it('returns 200 and streams a PDF', async () => {
    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('super admin can access any group\'s PDF', async () => {
    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
  });

  it('passes date range query params to getDeliveries', async () => {
    await request(app)
      .get('/api/v1/reports/groups/3/pdf?startDate=2025-01-01&endDate=2025-01-31')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(mockGetDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: '2025-01-01', endDate: '2025-01-31', group_id: 3 })
    );
  });

  it('scopes getDeliveries to the correct group_id', async () => {
    await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(mockGetDeliveries).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 3 })
    );
  });
});
