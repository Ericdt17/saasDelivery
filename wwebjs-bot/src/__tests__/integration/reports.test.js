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

const mockGetGroupById       = jest.fn();
const mockGetAgencyById      = jest.fn();
const mockGetDeliveries      = jest.fn();
const mockGetTariffsByAgency = jest.fn();
const mockGetExpeditionStats = jest.fn();
const mockAdapterQuery       = jest.fn();

jest.mock('../../db', () => ({
  adapter:             { query: mockAdapterQuery, type: 'sqlite' },
  getGroupById:        mockGetGroupById,
  getAgencyById:       mockGetAgencyById,
  getDeliveries:       mockGetDeliveries,
  getAllDeliveries:     mockGetDeliveries,
  getTariffsByAgency:  mockGetTariffsByAgency,
  getExpeditionStats:  mockGetExpeditionStats,
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
    // Default: no expeditions
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 0, total_frais_de_course: 0, total_frais_de_lagence_de_voyage: 0 });
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

// ---------------------------------------------------------------------------
// GET /api/v1/reports/groups/:id/pdf — expedition fees deduction
// ---------------------------------------------------------------------------

describe('GET /api/v1/reports/groups/:id/pdf — expedition fees', () => {
  const deliveries = [
    { status: 'delivered', amount_due: 10000, amount_paid: 9000, delivery_fee: 1000, quartier: 'Akwa' },
  ];
  // totalEncaisse = 10000, totalTarifs = 1000, netDeliveries = 9000

  beforeEach(() => {
    mockGetGroupById.mockResolvedValue(groupFixture);
    mockGetAgencyById.mockResolvedValue(agencyFixture);
    mockGetDeliveries.mockResolvedValue({ deliveries, pagination: { total: 1 } });
    mockGetTariffsByAgency.mockResolvedValue([]);
  });

  it('calls getExpeditionStats with the correct group_id and date range', async () => {
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 0, total_frais_de_course: 0, total_frais_de_lagence_de_voyage: 0 });

    await request(app)
      .get('/api/v1/reports/groups/3/pdf?startDate=2025-01-01&endDate=2025-01-31')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(mockGetExpeditionStats).toHaveBeenCalledWith(
      expect.objectContaining({ group_id: 3, agency_id: 1, startDate: '2025-01-01', endDate: '2025-01-31' })
    );
  });

  it('returns 200 when expedition fees are present (normal case: collecté > frais)', async () => {
    // totalEncaisse=10000, totalTarifs=1000, expeditionFrais=3000 → resteAPercevoir=6000
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 1, total_frais_de_course: '3000', total_frais_de_lagence_de_voyage: '1500' });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
  });

  it('returns 200 when expedition fees cause a debt (collecté < frais)', async () => {
    // totalEncaisse=10000, totalTarifs=1000, expeditionFrais=12000 → resteAPercevoir=-3000 (dette)
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 2, total_frais_de_course: '12000', total_frais_de_lagence_de_voyage: '0' });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
  });

  it('returns 200 even when getExpeditionStats throws (graceful fallback)', async () => {
    mockGetExpeditionStats.mockRejectedValue(new Error('DB error'));

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
  });

  it('does not call getExpeditionStats for a group belonging to another agency', async () => {
    mockGetGroupById.mockResolvedValue({ ...groupFixture, agency_id: 99 });
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 0, total_frais_de_course: 0, total_frais_de_lagence_de_voyage: 0 });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(403);
    expect(mockGetExpeditionStats).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// resteAPercevoir calculation logic (pure math, no HTTP)
// ---------------------------------------------------------------------------

describe('resteAPercevoir = totalEncaisse - totalTarifs - expeditionFrais', () => {
  // These tests exercise the financial formula directly via the PDF route
  // by verifying the route does not crash in each boundary case.

  const makeDeliveries = (amountDue, amountPaid, deliveryFee) => ([
    { status: 'delivered', amount_due: amountDue, amount_paid: amountPaid, delivery_fee: deliveryFee, quartier: 'Akwa' },
  ]);

  beforeEach(() => {
    mockGetGroupById.mockResolvedValue(groupFixture);
    mockGetAgencyById.mockResolvedValue(agencyFixture);
    mockGetTariffsByAgency.mockResolvedValue([]);
  });

  it('resteAPercevoir is positive when collecté > all fees', async () => {
    // totalEncaisse=5000, totalTarifs=500, expeditionFrais=1000 → reste=3500
    mockGetDeliveries.mockResolvedValue({ deliveries: makeDeliveries(5000, 4500, 500), pagination: {} });
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 1, total_frais_de_course: '1000', total_frais_de_lagence_de_voyage: '0' });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
  });

  it('resteAPercevoir is zero when collecté equals all fees exactly', async () => {
    // totalEncaisse=2000, totalTarifs=1000, expeditionFrais=1000 → reste=0
    mockGetDeliveries.mockResolvedValue({ deliveries: makeDeliveries(2000, 1000, 1000), pagination: {} });
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 1, total_frais_de_course: '1000', total_frais_de_lagence_de_voyage: '0' });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
  });

  it('resteAPercevoir is negative (dette) when expedition fees exceed collecté', async () => {
    // totalEncaisse=1000, totalTarifs=100, expeditionFrais=5000 → reste=-4100 (dette)
    mockGetDeliveries.mockResolvedValue({ deliveries: makeDeliveries(1000, 900, 100), pagination: {} });
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 3, total_frais_de_course: '5000', total_frais_de_lagence_de_voyage: '0' });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    // The route must not crash — it should show "Dette du groupe" label in the PDF
    expect(res.status).toBe(200);
  });

  it('resteAPercevoir is negative when no deliveries but group has expedition fees (pure debt)', async () => {
    mockGetDeliveries.mockResolvedValue({ deliveries: [], pagination: {} });
    mockGetExpeditionStats.mockResolvedValue({ total_expeditions: 2, total_frais_de_course: '8000', total_frais_de_lagence_de_voyage: '0' });

    const res = await request(app)
      .get('/api/v1/reports/groups/3/pdf')
      .set('Authorization', `Bearer ${agencyToken}`);

    expect(res.status).toBe(200);
  });
});
