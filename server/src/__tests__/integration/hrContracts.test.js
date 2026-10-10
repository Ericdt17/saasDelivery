'use strict';

process.env.HR_CHECKIN_RATE_MAX = '1000';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

const mockGetEmployeeById = jest.fn();
const mockGetAgencyById = jest.fn();
const mockGetCompanySettings = jest.fn();
const mockCreateHrContract = jest.fn();
const mockListHrContractsByEmployee = jest.fn();
const mockGetHrContractById = jest.fn();
const mockGetHrContractByToken = jest.fn();
const mockUpdateHrContract = jest.fn();
const mockCancelOpenHrContracts = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  listEmployees: jest.fn(),
  getEmployeeById: mockGetEmployeeById,
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
  getCompanySettings: mockGetCompanySettings,
  replaceSalaryFrom: jest.fn(),
  listEmployeeSalaryHistory: jest.fn(),
  listWorkplaces: jest.fn(),
  getWorkplaceById: jest.fn(),
  createWorkplace: jest.fn(),
  updateWorkplace: jest.fn(),
  deleteWorkplace: jest.fn(),
  createHrContract: mockCreateHrContract,
  listHrContractsByEmployee: mockListHrContractsByEmployee,
  getHrContractById: mockGetHrContractById,
  getHrContractByToken: mockGetHrContractByToken,
  updateHrContract: mockUpdateHrContract,
  cancelOpenHrContracts: mockCancelOpenHrContracts,
  listMerchantTerms: jest.fn(),
  getMerchantTermsById: jest.fn(),
  createMerchantTerms: jest.fn(),
  updateMerchantTerms: jest.fn(),
  deleteMerchantTerms: jest.fn(),
  getAgencyByEmail: jest.fn(),
  createAgency: jest.fn(),
  getAllAgencies: jest.fn(),
  getAgencyById: mockGetAgencyById,
  updateAgency: jest.fn(),
  deleteAgency: jest.fn(),
  findAgencyByCode: jest.fn(),
  getWaitlistEntries: jest.fn(),
  insertWaitlistEntry: jest.fn(),
  recruitmentListOpenJobs: jest.fn(),
  recruitmentGetJobOfferById: jest.fn(),
  recruitmentListAdminJobsWithCounts: jest.fn(),
}));

const mockSendTextDm = jest.fn();
const mockIsWhatsAppBotEnabled = jest.fn(() => true);
jest.mock('../../lib/whatsappBotClient', () => ({
  sendTextDm: (...args) => mockSendTextDm(...args),
  sendDocumentDm: jest.fn(),
  isWhatsAppBotEnabled: () => mockIsWhatsAppBotEnabled(),
  WhatsAppBotError: class WhatsAppBotError extends Error {
    constructor(message, { status = null, code } = {}) {
      super(message);
      this.name = 'WhatsAppBotError';
      this.status = status;
      this.code = code;
    }
  },
}));

const mockRenderHtmlPdf = jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
jest.mock('../../lib/pdf/renderPayslipPdf', () => ({
  renderPayslipPdf: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock')),
  renderHtmlPdf: (...args) => mockRenderHtmlPdf(...args),
}));

const app = require('../../api/server');
const { resetHrCheckinRateLimit } = require('../../api/middleware/hrCheckinRateLimit');

const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });

const VALID_TOKEN = 'a'.repeat(64);
const SIGNATURE_IMAGE = `data:image/png;base64,${'A'.repeat(200)}`;

const fullEmployee = {
  id: 1,
  full_name: 'Jean Dupont',
  email: 'jean.dupont@example.com',
  personal_email: null,
  phone: '690000000',
  poste: 'Livreur',
  salary_base: 150000,
  employee_type: 'livreur',
  date_of_birth: '1995-04-12',
  place_of_birth: 'Douala',
  gender: 'homme',
  nationality: 'Camerounaise',
  national_id: '123456789',
  address: 'Akwa, Douala',
  workplace_id: 2,
  workplace_name: 'Agence Akwa',
  emergency_contact_name: null,
  emergency_contact_phone: null,
  emergency_contact_relation: null,
  contract_kind: 'cdi',
  contract_start_date: '2026-10-01',
  contract_end_date: null,
  trial_period_days: 30,
  mission_description:
    'Intro générale.\n\n* mission un\n* mission deux',
  work_schedule: '8h00–17h00, pause 1h',
  is_active: true,
};

const contractRow = {
  id: 10,
  employee_id: 1,
  status: 'generated',
  template_key: 'contrat_travail_v1',
  contract_date: '2026-10-05',
  document_file_name: 'Contrat-travail-Jean-Dupont-2026-10-05.pdf',
  document_sha256: 'b'.repeat(64),
  ready_for_signature_at: null,
  signature_token: null,
  signature_token_expires_at: null,
  signed_at: null,
  signature_consent: null,
  signed_document_sha256: null,
  declined_at: null,
  decline_reason: null,
  created_at: '2026-10-05T10:00:00.000Z',
  updated_at: '2026-10-05T10:00:00.000Z',
};

function futureDate(days = 10) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

const readyContract = {
  ...contractRow,
  status: 'ready_for_signature',
  signature_token: VALID_TOKEN,
  signature_token_expires_at: futureDate(),
  ready_for_signature_at: '2026-10-05T11:00:00.000Z',
  snapshot: {
    template_key: 'contrat_travail_v1',
    contract_date: '2026-10-05',
    employee: { id: 1, full_name: 'Jean Dupont', phone: '690000000' },
    company: { company_name: 'LivSight', legal_name: 'LIVSIGHT SARL' },
  },
  document_html:
    '<html><body><p>Contrat</p><span id="employee-signature-slot"></span></body></html>',
  document_pdf: Buffer.from('%PDF-1.4 original'),
  signed_pdf: null,
};

beforeEach(async () => {
  await resetHrCheckinRateLimit();
  jest.clearAllMocks();
  mockRenderHtmlPdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
  mockIsWhatsAppBotEnabled.mockReturnValue(true);
});

describe('POST /api/v1/hr/employees/:id/contracts', () => {
  it('rejects non super_admin', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when employee is missing', async () => {
    mockGetEmployeeById.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
  });

  it('returns 422 with the list of missing contract fields', async () => {
    mockGetEmployeeById.mockResolvedValue({
      ...fullEmployee,
      national_id: null,
      work_schedule: '',
    });
    mockGetCompanySettings.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('missing_fields');
    expect(res.body.missing).toEqual(
      expect.arrayContaining(['national_id', 'work_schedule'])
    );
  });

  it('requires contract_end_date for CDD', async () => {
    mockGetEmployeeById.mockResolvedValue({
      ...fullEmployee,
      contract_kind: 'cdd',
      contract_end_date: null,
    });
    mockGetCompanySettings.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(422);
    expect(res.body.missing).toContain('contract_end_date');
  });

  it('generates the contract, cancels open ones, and freezes the snapshot', async () => {
    mockGetEmployeeById.mockResolvedValue(fullEmployee);
    mockGetCompanySettings.mockResolvedValue({
      company_name: 'LivSight',
      legal_name: 'LIVSIGHT TEST SARL',
      trade_register: 'RCCM-TEST-123',
      tax_id: 'NIU-TEST-456',
      signer_name: 'M. Signataire Test',
      signer_role: 'Directeur',
      signature_base64: null,
      stamp_base64: null,
    });
    mockCancelOpenHrContracts.mockResolvedValue([]);
    mockCreateHrContract.mockResolvedValue(contractRow);
    // « Mon profil » of the generating admin (id 99) carries a personal stamp.
    mockGetAgencyById.mockResolvedValue({
      id: 99,
      name: 'Admin Test',
      fonction: 'Gérant',
      signature_base64: 'U0lHUFJPRklM',
      stamp_base64: 'U1RBTVBQUk9GSUw=',
    });

    const res = await request(app)
      .post('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(201);
    expect(mockGetAgencyById).toHaveBeenCalledWith(99);
    expect(res.body.data.status).toBe('generated');
    expect(mockCancelOpenHrContracts).toHaveBeenCalledWith(1, 'contrat_travail_v1');

    const payload = mockCreateHrContract.mock.calls[0][0];
    expect(payload.employee_id).toBe(1);
    expect(payload.template_key).toBe('contrat_travail_v1');
    expect(payload.document_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(payload.document_file_name).toMatch(/^Contrat-travail-Jean-Dupont-/);
    // All placeholders resolved and employee data interpolated.
    expect(payload.document_html).not.toMatch(/\{\{[\w.]+\}\}/);
    expect(payload.document_html).toContain('Jean Dupont');
    expect(payload.document_html).toContain('150');
    expect(payload.document_html).toContain('employee-signature-slot');
    expect(payload.snapshot.employee.full_name).toBe('Jean Dupont');
    // Multi-line missions render as structured HTML (paragraphs + bullets).
    expect(payload.document_html).toContain('<li>mission un</li>');
    expect(payload.document_html).toContain('<li>mission deux</li>');
    // Company/gérant data flows from super-admin settings, like payslips.
    expect(payload.snapshot.company.legal_name).toBe('LIVSIGHT TEST SARL');
    expect(payload.document_html).toContain('LIVSIGHT TEST SARL');
    expect(payload.document_html).toContain('RCCM-TEST-123');
    expect(payload.document_html).toContain('NIU-TEST-456');
    expect(payload.document_html).toContain('M. Signataire Test');
    expect(payload.document_html).toContain('Directeur');
    // Profile signature/stamp (Mon profil) injected into the employer block.
    expect(payload.document_html).toContain('U1RBTVBQUk9GSUw=');
    expect(payload.document_html).toContain('U0lHUFJPRklM');
    expect(payload.snapshot.signer.stamp_base64).toBe('U1RBTVBQUk9GSUw=');
  });
});

describe('POST /api/v1/hr/employees/:id/contracts (type: nda)', () => {
  it('generates the NDA without requiring contract-only fields', async () => {
    // No salary/work schedule/contract dates — the NDA must not need them.
    mockGetEmployeeById.mockResolvedValue({
      ...fullEmployee,
      salary_base: null,
      work_schedule: null,
      workplace_name: null,
      contract_kind: null,
      contract_start_date: null,
      trial_period_days: null,
      mission_description: null,
      employee_type: null,
      phone: null,
    });
    mockGetCompanySettings.mockResolvedValue(null);
    mockCancelOpenHrContracts.mockResolvedValue([]);
    mockCreateHrContract.mockResolvedValue({
      ...contractRow,
      template_key: 'nda_v1',
    });

    const res = await request(app)
      .post('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ type: 'nda' });

    expect(res.status).toBe(201);
    // Only same-type open documents are cancelled.
    expect(mockCancelOpenHrContracts).toHaveBeenCalledWith(1, 'nda_v1');
    const payload = mockCreateHrContract.mock.calls[0][0];
    expect(payload.template_key).toBe('nda_v1');
    expect(payload.document_file_name).toMatch(/^NDA-Jean-Dupont-/);
    expect(payload.document_html).toContain('Accord de confidentialité');
    expect(payload.document_html).not.toMatch(/\{\{[\w.]+\}\}/);
  });

  it('still requires identity fields for the NDA', async () => {
    mockGetEmployeeById.mockResolvedValue({
      ...fullEmployee,
      national_id: null,
      date_of_birth: null,
    });
    mockGetCompanySettings.mockResolvedValue(null);
    const res = await request(app)
      .post('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ type: 'nda' });
    expect(res.status).toBe(422);
    expect(res.body.missing).toEqual(
      expect.arrayContaining(['national_id', 'date_of_birth'])
    );
  });

  it('exposes the NDA title on the public signing summary', async () => {
    mockGetHrContractByToken.mockResolvedValue({
      ...readyContract,
      template_key: 'nda_v1',
    });
    const res = await request(app).get(`/api/v1/hr/sign/${VALID_TOKEN}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.data.document_title).toBe('Accord de confidentialité (NDA)');
  });
});

describe('POST /api/v1/hr/contracts/:id/ready-for-signature', () => {
  it('issues a single-use signing token with 30-day expiry', async () => {
    mockGetHrContractById.mockResolvedValue({ ...contractRow, snapshot: {} });
    mockUpdateHrContract.mockImplementation(async (id, updates) => ({
      ...contractRow,
      ...updates,
    }));

    const res = await request(app)
      .post('/api/v1/hr/contracts/10/ready-for-signature')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    const updates = mockUpdateHrContract.mock.calls[0][1];
    expect(updates.status).toBe('ready_for_signature');
    expect(updates.signature_token).toMatch(/^[a-f0-9]{64}$/);
    const ttlMs =
      new Date(updates.signature_token_expires_at).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(29 * 24 * 60 * 60 * 1000);
    expect(res.body.data.signing_url).toContain(`/api/v1/hr/sign/${updates.signature_token}`);
  });

  it('rejects when the contract is already signed', async () => {
    mockGetHrContractById.mockResolvedValue({
      ...contractRow,
      status: 'signed',
      snapshot: {},
    });
    const res = await request(app)
      .post('/api/v1/hr/contracts/10/ready-for-signature')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/v1/hr/contracts/:id/send-whatsapp', () => {
  it('issues a token and sends the signing link', async () => {
    mockGetHrContractById.mockResolvedValue({ ...contractRow, snapshot: {} });
    mockGetEmployeeById.mockResolvedValue(fullEmployee);
    mockUpdateHrContract.mockImplementation(async (id, updates) => ({
      ...contractRow,
      ...updates,
    }));
    mockSendTextDm.mockResolvedValue({ recipient: '690000000', messageId: 'm1' });

    const res = await request(app)
      .post('/api/v1/hr/contracts/10/send-whatsapp')
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.sent).toBe(true);
    expect(mockSendTextDm).toHaveBeenCalledTimes(2);
    const linkMessage = mockSendTextDm.mock.calls[1][0].message;
    expect(linkMessage).toContain('/api/v1/hr/sign/');
  });

  it('fails when the employee has no phone', async () => {
    mockGetHrContractById.mockResolvedValue({ ...contractRow, snapshot: {} });
    mockGetEmployeeById.mockResolvedValue({ ...fullEmployee, phone: null });
    const res = await request(app)
      .post('/api/v1/hr/contracts/10/send-whatsapp')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('phone_required');
  });
});

describe('public signing flow', () => {
  it('serves the signing page HTML', async () => {
    const res = await request(app).get(`/api/v1/hr/sign/${VALID_TOKEN}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Signer le contrat');
  });

  it('returns 404 for an unknown token', async () => {
    mockGetHrContractByToken.mockResolvedValue(null);
    const res = await request(app).get(`/api/v1/hr/sign/${VALID_TOKEN}/summary`);
    expect(res.status).toBe(404);
  });

  it('auto-expires a stale token with 410', async () => {
    mockGetHrContractByToken.mockResolvedValue({
      ...readyContract,
      signature_token_expires_at: '2020-01-01T00:00:00.000Z',
    });
    mockUpdateHrContract.mockResolvedValue({ ...contractRow, status: 'expired' });

    const res = await request(app).get(`/api/v1/hr/sign/${VALID_TOKEN}/summary`);
    expect(res.status).toBe(410);
    expect(mockUpdateHrContract).toHaveBeenCalledWith(10, {
      status: 'expired',
      signature_token: null,
    });
  });

  it('returns the public summary without leaking the token', async () => {
    mockGetHrContractByToken.mockResolvedValue(readyContract);
    const res = await request(app).get(`/api/v1/hr/sign/${VALID_TOKEN}/summary`);
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready_for_signature');
    expect(res.body.data.employee_name).toBe('Jean Dupont');
    expect(res.body.data.company_name).toBe('LIVSIGHT SARL');
    expect(JSON.stringify(res.body)).not.toContain(VALID_TOKEN);
  });

  it('serves the contract PDF for review', async () => {
    mockGetHrContractByToken.mockResolvedValue(readyContract);
    const res = await request(app).get(
      `/api/v1/hr/sign/${VALID_TOKEN}/document.pdf`
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('requires consent and a signature image to sign', async () => {
    mockGetHrContractByToken.mockResolvedValue(readyContract);
    const res = await request(app)
      .post(`/api/v1/hr/sign/${VALID_TOKEN}/sign`)
      .send({ consent: false, signature_image: SIGNATURE_IMAGE });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('consent_required');
  });

  it('rejects an invalid signature image', async () => {
    mockGetHrContractByToken.mockResolvedValue(readyContract);
    const res = await request(app)
      .post(`/api/v1/hr/sign/${VALID_TOKEN}/sign`)
      .send({ consent: true, signature_image: 'not-an-image' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_signature_image');
  });

  it('signs the contract: injects signature, appends attestation, blocks re-signing', async () => {
    mockGetHrContractByToken.mockResolvedValue(readyContract);
    mockUpdateHrContract.mockImplementation(async (id, updates) => ({
      ...readyContract,
      ...updates,
    }));

    const res = await request(app)
      .post(`/api/v1/hr/sign/${VALID_TOKEN}/sign`)
      .send({ consent: true, signature_image: SIGNATURE_IMAGE });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('signed');

    const signedHtml = mockRenderHtmlPdf.mock.calls[0][0];
    expect(signedHtml).toContain(SIGNATURE_IMAGE);
    expect(signedHtml).toContain('Attestation de signature électronique');
    expect(signedHtml).toContain(readyContract.document_sha256);

    const updates = mockUpdateHrContract.mock.calls[0][1];
    expect(updates.status).toBe('signed');
    expect(updates.signature_consent).toBe('Lu et approuvé');
    // Token is kept read-only so the employee can still download the signed PDF.
    expect(updates).not.toHaveProperty('signature_token');
    expect(updates.signed_document_sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(Buffer.isBuffer(updates.signed_pdf)).toBe(true);
  });

  it('still serves the signed PDF via the link after signing', async () => {
    mockGetHrContractByToken.mockResolvedValue({
      ...readyContract,
      status: 'signed',
      signed_at: '2026-10-05T12:00:00.000Z',
      signed_pdf: Buffer.from('%PDF-1.4 signed'),
    });
    const res = await request(app).get(
      `/api/v1/hr/sign/${VALID_TOKEN}/document.pdf`
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.body.toString()).toContain('signed');
  });

  it('declines the contract with a reason', async () => {
    mockGetHrContractByToken.mockResolvedValue(readyContract);
    mockUpdateHrContract.mockImplementation(async (id, updates) => ({
      ...readyContract,
      ...updates,
    }));

    const res = await request(app)
      .post(`/api/v1/hr/sign/${VALID_TOKEN}/decline`)
      .send({ reason: 'Les conditions ne conviennent pas' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('declined');
    const updates = mockUpdateHrContract.mock.calls[0][1];
    expect(updates.status).toBe('declined');
    expect(updates.decline_reason).toBe('Les conditions ne conviennent pas');
  });

  it('rejects decline without a reason', async () => {
    mockGetHrContractByToken.mockResolvedValue(readyContract);
    const res = await request(app)
      .post(`/api/v1/hr/sign/${VALID_TOKEN}/decline`)
      .send({ reason: '' });
    expect(res.status).toBe(400);
  });

  it('refuses to sign a contract that is not ready_for_signature', async () => {
    mockGetHrContractByToken.mockResolvedValue({
      ...readyContract,
      status: 'signed',
    });
    const res = await request(app)
      .post(`/api/v1/hr/sign/${VALID_TOKEN}/sign`)
      .send({ consent: true, signature_image: SIGNATURE_IMAGE });
    expect(res.status).toBe(409);
  });
});

describe('GET /api/v1/hr/employees/:id/contracts', () => {
  it('lists contract metadata with signing_url for ready contracts', async () => {
    mockListHrContractsByEmployee.mockResolvedValue([
      {
        ...contractRow,
        status: 'ready_for_signature',
        signature_token: VALID_TOKEN,
        signature_token_expires_at: futureDate(),
      },
    ]);
    const res = await request(app)
      .get('/api/v1/hr/employees/1/contracts')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].signing_url).toContain(`/sign/${VALID_TOKEN}`);
    expect(res.body.data[0].signature_token).toBeUndefined();
  });
});
