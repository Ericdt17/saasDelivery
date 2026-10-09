'use strict';

process.env.HR_CHECKIN_RATE_MAX = '1000';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

const mockListCompanyDocuments = jest.fn();
const mockGetCompanyDocumentById = jest.fn();
const mockCreateCompanyDocument = jest.fn();
const mockListCompanyDocumentVersions = jest.fn();
const mockGetCompanyDocumentVersionById = jest.fn();
const mockCreateCompanyDocumentVersion = jest.fn();
const mockUpdateCompanyDocumentVersionContent = jest.fn();
const mockPublishCompanyDocumentVersion = jest.fn();
const mockGetCurrentCompanyDocument = jest.fn();
const mockAcknowledgeCompanyDocumentVersion = jest.fn();
const mockGetCompanyDocumentAcknowledgement = jest.fn();
const mockListCompanyDocumentReadStatus = jest.fn();
const mockGetEmployeeByEmailWithDescriptor = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  listEmployees: jest.fn(),
  getEmployeeById: jest.fn(),
  createEmployee: jest.fn(),
  updateEmployee: jest.fn(),
  deleteEmployee: jest.fn(),
  enrollEmployeeFace: jest.fn(),
  getEmployeeByEmailWithDescriptor: mockGetEmployeeByEmailWithDescriptor,
  getAttendanceByEmployeeAndDate: jest.fn(),
  createAttendance: jest.fn(),
  upsertAttendance: jest.fn(),
  listAttendances: jest.fn(),
  summarizeAttendances: jest.fn(),
  getCompanySettings: jest.fn(),
  replaceSalaryFrom: jest.fn(),
  listEmployeeSalaryHistory: jest.fn(),
  listWorkplaces: jest.fn(),
  getWorkplaceById: jest.fn(),
  createWorkplace: jest.fn(),
  updateWorkplace: jest.fn(),
  deleteWorkplace: jest.fn(),
  createHrContract: jest.fn(),
  listHrContractsByEmployee: jest.fn(),
  getHrContractById: jest.fn(),
  getHrContractByToken: jest.fn(),
  updateHrContract: jest.fn(),
  cancelOpenHrContracts: jest.fn(),
  listCompanyDocuments: mockListCompanyDocuments,
  getCompanyDocumentById: mockGetCompanyDocumentById,
  createCompanyDocument: mockCreateCompanyDocument,
  listCompanyDocumentVersions: mockListCompanyDocumentVersions,
  getCompanyDocumentVersionById: mockGetCompanyDocumentVersionById,
  createCompanyDocumentVersion: mockCreateCompanyDocumentVersion,
  updateCompanyDocumentVersionContent: mockUpdateCompanyDocumentVersionContent,
  publishCompanyDocumentVersion: mockPublishCompanyDocumentVersion,
  getCurrentCompanyDocument: mockGetCurrentCompanyDocument,
  acknowledgeCompanyDocumentVersion: mockAcknowledgeCompanyDocumentVersion,
  getCompanyDocumentAcknowledgement: mockGetCompanyDocumentAcknowledgement,
  listCompanyDocumentReadStatus: mockListCompanyDocumentReadStatus,
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
const { resetHrCheckinRateLimit } = require('../../api/middleware/hrCheckinRateLimit');

const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });

const docRow = {
  id: 1,
  doc_type: 'internal_regulation',
  title: 'Règlement intérieur LivSight',
  slug: 'reglement-interieur-livsight',
  description: null,
  status: 'active',
  current_version_id: null,
  created_by: 99,
  created_at: '2026-10-06T08:00:00.000Z',
  updated_at: '2026-10-06T08:00:00.000Z',
  current_version_number: null,
  current_version_published_at: null,
};

const draftVersion = {
  id: 10,
  document_id: 1,
  version_number: 1,
  status: 'draft',
  content_md: '# Article 1\nTexte **important**.',
  created_by: 99,
  published_by: null,
  published_at: null,
  created_at: '2026-10-06T08:05:00.000Z',
  updated_at: '2026-10-06T08:05:00.000Z',
};

const activeEmployee = {
  id: 7,
  full_name: 'Jean Dupont',
  email: 'jean.dupont@example.com',
  is_active: true,
};

const currentPublished = {
  ...docRow,
  current_version_id: 10,
  version_id: 10,
  version_number: 2,
  content_md: '# Article 1\nContenu V2 avec <script>alert(1)</script>.',
  published_at: '2026-10-06T09:00:00.000Z',
};

beforeEach(async () => {
  await resetHrCheckinRateLimit();
  jest.clearAllMocks();
});

describe('admin regulations CRUD', () => {
  it('rejects non super_admin', async () => {
    const res = await request(app)
      .get('/api/v1/hr/regulations')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('creates a regulation with a slug and creator audit', async () => {
    mockCreateCompanyDocument.mockResolvedValue(docRow);
    const res = await request(app)
      .post('/api/v1/hr/regulations')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ title: 'Règlement intérieur LivSight' });
    expect(res.status).toBe(201);
    const payload = mockCreateCompanyDocument.mock.calls[0][0];
    expect(payload.slug).toBe('reglement-interieur-livsight');
    expect(payload.created_by).toBe(99);
    expect(payload.doc_type).toBe('internal_regulation');
  });

  it('refuses a second open draft for the same document', async () => {
    mockGetCompanyDocumentById.mockResolvedValue(docRow);
    mockListCompanyDocumentVersions.mockResolvedValue([
      { ...draftVersion, status: 'draft' },
    ]);
    const res = await request(app)
      .post('/api/v1/hr/regulations/1/versions')
      .set('Authorization', `Bearer ${superToken}`)
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('draft_exists');
  });

  it('creates V2 seeded from the published V1 content', async () => {
    mockGetCompanyDocumentById.mockResolvedValue({
      ...docRow,
      current_version_id: 10,
    });
    mockListCompanyDocumentVersions.mockResolvedValue([
      { ...draftVersion, id: 10, status: 'published' },
    ]);
    mockGetCompanyDocumentVersionById.mockResolvedValue({
      ...draftVersion,
      id: 10,
      status: 'published',
      content_md: 'Contenu V1',
    });
    mockCreateCompanyDocumentVersion.mockResolvedValue({
      ...draftVersion,
      id: 11,
      version_number: 2,
      content_md: 'Contenu V1',
    });

    const res = await request(app)
      .post('/api/v1/hr/regulations/1/versions')
      .set('Authorization', `Bearer ${superToken}`)
      .send({});
    expect(res.status).toBe(201);
    expect(mockCreateCompanyDocumentVersion).toHaveBeenCalledWith({
      document_id: 1,
      content_md: 'Contenu V1',
      created_by: 99,
    });
    expect(res.body.data.version_label).toBe('V2.0');
  });

  it('refuses to edit a published version (immutable history)', async () => {
    mockGetCompanyDocumentVersionById.mockResolvedValue({
      ...draftVersion,
      status: 'published',
    });
    const res = await request(app)
      .patch('/api/v1/hr/regulation-versions/10')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ content_md: 'hack' });
    expect(res.status).toBe(409);
    expect(mockUpdateCompanyDocumentVersionContent).not.toHaveBeenCalled();
  });

  it('updates a draft version', async () => {
    mockGetCompanyDocumentVersionById.mockResolvedValue(draftVersion);
    mockUpdateCompanyDocumentVersionContent.mockResolvedValue({
      ...draftVersion,
      content_md: 'Nouveau contenu',
    });
    const res = await request(app)
      .patch('/api/v1/hr/regulation-versions/10')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ content_md: 'Nouveau contenu' });
    expect(res.status).toBe(200);
    expect(mockUpdateCompanyDocumentVersionContent).toHaveBeenCalledWith(
      10,
      'Nouveau contenu'
    );
  });

  it('publishes a draft and refuses to publish twice', async () => {
    mockGetCompanyDocumentVersionById.mockResolvedValue(draftVersion);
    mockPublishCompanyDocumentVersion.mockResolvedValue({
      ...draftVersion,
      status: 'published',
      published_at: '2026-10-06T09:00:00.000Z',
      published_by: 99,
    });
    const ok = await request(app)
      .post('/api/v1/hr/regulation-versions/10/publish')
      .set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
    expect(mockPublishCompanyDocumentVersion).toHaveBeenCalledWith(10, 99);
    expect(ok.body.data.status).toBe('published');

    mockGetCompanyDocumentVersionById.mockResolvedValue({
      ...draftVersion,
      status: 'published',
    });
    const again = await request(app)
      .post('/api/v1/hr/regulation-versions/10/publish')
      .set('Authorization', `Bearer ${superToken}`);
    expect(again.status).toBe(409);
  });

  it('renders a sanitised preview of a version', async () => {
    mockGetCompanyDocumentVersionById.mockResolvedValue({
      ...draftVersion,
      content_md: '# Titre\n**gras** <img src=x onerror=alert(1)>',
    });
    const res = await request(app)
      .get('/api/v1/hr/regulation-versions/10')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.content_html).toContain('<h1>Titre</h1>');
    expect(res.body.data.content_html).toContain('<strong>gras</strong>');
    // Raw HTML is escaped, never emitted as markup.
    expect(res.body.data.content_html).not.toContain('<img');
    expect(res.body.data.content_html).toContain('&lt;img');
  });
});

describe('admin read tracking', () => {
  it('derives read/not-read from the current version acknowledgements', async () => {
    mockGetCompanyDocumentById.mockResolvedValue({
      ...docRow,
      current_version_id: 10,
      current_version_number: 2,
      current_version_published_at: '2026-10-06T09:00:00.000Z',
    });
    mockListCompanyDocumentReadStatus.mockResolvedValue([
      { employee_id: 7, full_name: 'Jean Dupont', poste: 'Agent', acknowledged_at: '2026-10-06T14:32:00.000Z' },
      { employee_id: 8, full_name: 'Paul Doe', poste: 'Livreur', acknowledged_at: null },
      { employee_id: 9, full_name: 'Marie X', poste: 'Agent', acknowledged_at: '2026-10-06T15:04:00.000Z' },
    ]);

    const res = await request(app)
      .get('/api/v1/hr/regulations/1/acknowledgements')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.version.version_label).toBe('V2.0');
    expect(res.body.data.stats).toEqual({
      total_active_employees: 3,
      read: 2,
      not_read: 1,
      completion_pct: 66.7,
    });
    expect(res.body.data.employees).toHaveLength(3);

    const notRead = await request(app)
      .get('/api/v1/hr/regulations/1/acknowledgements?status=not_read')
      .set('Authorization', `Bearer ${superToken}`);
    expect(notRead.body.data.employees).toEqual([
      expect.objectContaining({ full_name: 'Paul Doe', status: 'not_read' }),
    ]);
  });
});

describe('public employee reading + acknowledgement', () => {
  it('serves the reading page HTML', async () => {
    const res = await request(app).get('/api/v1/hr/reglement');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('PRISE DE CONNAISSANCE');
  });

  it('returns the current regulation with sanitised HTML and ack status', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValue(activeEmployee);
    mockGetCurrentCompanyDocument.mockResolvedValue(currentPublished);
    mockGetCompanyDocumentAcknowledgement.mockResolvedValue(null);

    const res = await request(app).get(
      '/api/v1/hr/reglement/current?email=jean.dupont@example.com'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.version_label).toBe('V2.0');
    expect(res.body.data.acknowledged).toBe(false);
    expect(res.body.data.content_html).not.toContain('<script>');
    expect(res.body.data.content_html).toContain('&lt;script&gt;');
  });

  it('rejects unknown or inactive employees', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValue({
      ...activeEmployee,
      is_active: false,
    });
    const res = await request(app).get(
      '/api/v1/hr/reglement/current?email=jean.dupont@example.com'
    );
    expect(res.status).toBe(404);
  });

  it('acknowledges the exact current version with ip and user-agent', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValue(activeEmployee);
    mockGetCurrentCompanyDocument.mockResolvedValue(currentPublished);
    mockAcknowledgeCompanyDocumentVersion.mockResolvedValue({
      id: 1,
      version_id: 10,
      employee_id: 7,
      acknowledged_at: '2026-10-06T14:32:00.000Z',
      already_acknowledged: false,
    });

    const res = await request(app)
      .post('/api/v1/hr/reglement/acknowledge')
      .set('User-Agent', 'TestBrowser/1.0')
      .send({ email: 'jean.dupont@example.com', version_id: 10 });

    expect(res.status).toBe(200);
    expect(res.body.data.acknowledged).toBe(true);
    const payload = mockAcknowledgeCompanyDocumentVersion.mock.calls[0][0];
    expect(payload.version_id).toBe(10);
    expect(payload.employee_id).toBe(7);
    expect(payload.user_agent).toBe('TestBrowser/1.0');
    expect(typeof payload.ip_address).toBe('string');
  });

  it('is idempotent when the version is already acknowledged', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValue(activeEmployee);
    mockGetCurrentCompanyDocument.mockResolvedValue(currentPublished);
    mockAcknowledgeCompanyDocumentVersion.mockResolvedValue({
      id: 1,
      version_id: 10,
      employee_id: 7,
      acknowledged_at: '2026-10-06T14:32:00.000Z',
      already_acknowledged: true,
    });

    const res = await request(app)
      .post('/api/v1/hr/reglement/acknowledge')
      .send({ email: 'jean.dupont@example.com', version_id: 10 });
    expect(res.status).toBe(200);
    expect(res.body.data.already_acknowledged).toBe(true);
  });

  it('rejects acknowledging an outdated version (new version published)', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValue(activeEmployee);
    // Current is version 11 now; client still shows version 10.
    mockGetCurrentCompanyDocument.mockResolvedValue({
      ...currentPublished,
      version_id: 11,
      version_number: 3,
    });
    const res = await request(app)
      .post('/api/v1/hr/reglement/acknowledge')
      .send({ email: 'jean.dupont@example.com', version_id: 10 });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('version_outdated');
    expect(mockAcknowledgeCompanyDocumentVersion).not.toHaveBeenCalled();
  });

  it('decorates verify-email with the regulation-to-read indicator', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValue({
      ...activeEmployee,
      salary_base: 100000,
    });
    mockGetCurrentCompanyDocument.mockResolvedValue(currentPublished);
    mockGetCompanyDocumentAcknowledgement.mockResolvedValue(null);

    const res = await request(app).get(
      '/api/v1/hr/checkin/verify-email?email=jean.dupont@example.com'
    );
    expect(res.status).toBe(200);
    expect(res.body.data.regulation).toEqual(
      expect.objectContaining({ to_read: true, version_label: 'V2.0' })
    );

    // Once acknowledged, the indicator flips off for that version.
    mockGetCompanyDocumentAcknowledgement.mockResolvedValue({
      id: 1,
      acknowledged_at: '2026-10-06T14:32:00.000Z',
    });
    const after = await request(app).get(
      '/api/v1/hr/checkin/verify-email?email=jean.dupont@example.com'
    );
    expect(after.body.data.regulation.to_read).toBe(false);
  });
});
