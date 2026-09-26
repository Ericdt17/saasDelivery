'use strict';

process.env.HR_CHECKIN_RATE_MAX = '1000';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

const mockListEmployees = jest.fn();
const mockGetEmployeeById = jest.fn();
const mockCreateEmployee = jest.fn();
const mockUpdateEmployee = jest.fn();
const mockDeleteEmployee = jest.fn();
const mockEnrollEmployeeFace = jest.fn();
const mockGetEmployeeByEmailWithDescriptor = jest.fn();
const mockGetAttendanceByEmployeeAndDate = jest.fn();
const mockCreateAttendance = jest.fn();
const mockUpsertAttendance = jest.fn();
const mockListAttendances = jest.fn();
const mockSummarizeAttendances = jest.fn();
const mockGetCompanySettings = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  listEmployees: mockListEmployees,
  getEmployeeById: mockGetEmployeeById,
  createEmployee: mockCreateEmployee,
  updateEmployee: mockUpdateEmployee,
  deleteEmployee: mockDeleteEmployee,
  enrollEmployeeFace: mockEnrollEmployeeFace,
  getEmployeeByEmailWithDescriptor: mockGetEmployeeByEmailWithDescriptor,
  getAttendanceByEmployeeAndDate: mockGetAttendanceByEmployeeAndDate,
  createAttendance: mockCreateAttendance,
  upsertAttendance: mockUpsertAttendance,
  listAttendances: mockListAttendances,
  summarizeAttendances: mockSummarizeAttendances,
  getCompanySettings: mockGetCompanySettings,
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

jest.mock('../../lib/hrCheckin', () => {
  const actual = jest.requireActual('../../lib/hrCheckin');
  return {
    ...actual,
    getCheckInStatus: jest.fn(actual.getCheckInStatus),
  };
});

const mockNotifyHrCheckinAlert = jest.fn().mockResolvedValue(undefined);
jest.mock('../../lib/botAlerts', () => {
  const actual = jest.requireActual('../../lib/botAlerts');
  return {
    ...actual,
    notifyHrCheckinAlert: (...args) => mockNotifyHrCheckinAlert(...args),
  };
});

const mockRenderPayslipPdf = jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
jest.mock('../../lib/pdf/renderPayslipPdf', () => ({
  renderPayslipPdf: (...args) => mockRenderPayslipPdf(...args),
}));

const app = require('../../api/server');
const { resetHrCheckinRateLimit } = require('../../api/middleware/hrCheckinRateLimit');
const { getCheckInStatus, OFFICE_LAT, OFFICE_LNG } = require('../../lib/hrCheckin');

const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });

const employeeFixture = {
  id: 1,
  full_name: 'Jean Dupont',
  email: 'jean.dupont@example.com',
  phone: '690000000',
  poste: 'Livreur',
  salary_base: 150000,
  payroll_eligible_from: '2026-01-01',
  is_active: true,
  is_enrolled: false,
  enrolled_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function faceDescriptor128(fillOffset = 0) {
  return Array.from({ length: 128 }, (_, i) => i * 0.01 + fillOffset);
}

const enrolledEmployee = {
  ...employeeFixture,
  is_enrolled: true,
  enrolled_at: '2026-09-01T10:00:00.000Z',
  face_descriptor: faceDescriptor128(),
};

beforeEach(async () => {
  await resetHrCheckinRateLimit();
  mockNotifyHrCheckinAlert.mockClear();
  mockRenderPayslipPdf.mockClear();
  mockRenderPayslipPdf.mockResolvedValue(Buffer.from('%PDF-1.4 mock'));
  mockGetCompanySettings.mockResolvedValue(null);
  mockSendTextDm.mockReset();
  mockIsWhatsAppBotEnabled.mockReset();
  mockIsWhatsAppBotEnabled.mockReturnValue(true);
  process.env.PUBLIC_API_BASE_URL = 'http://api.test:3000';
  process.env.PAYSLIP_LINKS_FILE = require('path').join(
    require('os').tmpdir(),
    `payslip-links-hr-test-${process.pid}.json`
  );
  getCheckInStatus.mockImplementation(
    jest.requireActual('../../lib/hrCheckin').getCheckInStatus
  );
});

describe('GET /api/v1/hr/employees', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/hr/employees');
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with list and never includes face_descriptor', async () => {
    mockListEmployees.mockResolvedValueOnce([
      { ...employeeFixture, face_descriptor: faceDescriptor128() },
    ]);
    const res = await request(app)
      .get('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].full_name).toBe('Jean Dupont');
    expect(res.body.data[0]).not.toHaveProperty('face_descriptor');
  });
});

describe('POST /api/v1/hr/employees', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ full_name: 'Test', email: 'test@example.com' });
    expect(res.status).toBe(403);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ full_name: 'Jean Dupont' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('creates employee and returns 201 without face_descriptor', async () => {
    mockCreateEmployee.mockResolvedValueOnce(employeeFixture);
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        full_name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        phone: '690000000',
        poste: 'Livreur',
        salary_base: 150000,
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('jean.dupont@example.com');
    expect(res.body.data).not.toHaveProperty('face_descriptor');
    expect(mockCreateEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        payroll_eligible_from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      })
    );
    expect(mockCreateEmployee.mock.calls[0][0]).not.toHaveProperty(
      'include_next_month'
    );
  });

  it('defers payroll_eligible_from to next month when include_next_month is true', async () => {
    mockCreateEmployee.mockResolvedValueOnce({
      ...employeeFixture,
      payroll_eligible_from: '2026-10-01',
    });
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        full_name: 'Nouveau',
        email: 'nouveau@example.com',
        include_next_month: true,
      });
    expect(res.status).toBe(201);
    expect(mockCreateEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        payroll_eligible_from: expect.stringMatching(/^\d{4}-\d{2}-01$/),
      })
    );
    const eligible = mockCreateEmployee.mock.calls[0][0].payroll_eligible_from;
    const { resolvePayrollEligibleFrom } = require('../../lib/hrPayrollEligibility');
    expect(eligible).toBe(
      resolvePayrollEligibleFrom({ includeNextMonth: true })
    );
  });

  it('returns 409 when email is duplicated', async () => {
    const err = new Error('duplicate key value violates unique constraint');
    err.code = '23505';
    mockCreateEmployee.mockRejectedValueOnce(err);
    const res = await request(app)
      .post('/api/v1/hr/employees')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        full_name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
      });
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

describe('PATCH /api/v1/hr/employees/:id', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .patch('/api/v1/hr/employees/1')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ poste: 'Agent' });
    expect(res.status).toBe(403);
  });

  it('returns 404 when not found', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(null);
    const res = await request(app)
      .patch('/api/v1/hr/employees/999')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ poste: 'Agent' });
    expect(res.status).toBe(404);
  });

  it('updates and returns 200 without face_descriptor', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockUpdateEmployee.mockResolvedValueOnce({
      ...employeeFixture,
      poste: 'Agent',
      face_descriptor: faceDescriptor128(),
    });
    const res = await request(app)
      .patch('/api/v1/hr/employees/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ poste: 'Agent' });
    expect(res.status).toBe(200);
    expect(res.body.data.poste).toBe('Agent');
    expect(res.body.data).not.toHaveProperty('face_descriptor');
  });
});

describe('DELETE /api/v1/hr/employees/:id', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).delete('/api/v1/hr/employees/1');
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .delete('/api/v1/hr/employees/1')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 404 when employee not found', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(null);
    const res = await request(app)
      .delete('/api/v1/hr/employees/999')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(mockDeleteEmployee).not.toHaveBeenCalled();
  });

  it('soft-deletes employee (is_active false) and returns 200 without face_descriptor', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockDeleteEmployee.mockResolvedValueOnce({
      ...employeeFixture,
      is_active: false,
      face_descriptor: faceDescriptor128(),
    });
    const res = await request(app)
      .delete('/api/v1/hr/employees/1')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_active).toBe(false);
    expect(res.body.data).not.toHaveProperty('face_descriptor');
    expect(mockDeleteEmployee).toHaveBeenCalledWith(1);
  });
});

describe('POST /api/v1/hr/employees/:id/enroll', () => {
  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees/1/enroll')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ face_descriptor: faceDescriptor128() });
    expect(res.status).toBe(403);
  });

  it('returns 400 when face_descriptor is invalid', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees/1/enroll')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ face_descriptor: [1, 2, 3] });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when employee not found', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/v1/hr/employees/999/enroll')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ face_descriptor: faceDescriptor128() });
    expect(res.status).toBe(404);
  });

  it('enrolls face and returns 200 without face_descriptor', async () => {
    const enrolledAt = '2026-09-08T10:00:00.000Z';
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockEnrollEmployeeFace.mockResolvedValueOnce({
      ...employeeFixture,
      is_enrolled: true,
      enrolled_at: enrolledAt,
      face_descriptor: faceDescriptor128(),
    });
    const res = await request(app)
      .post('/api/v1/hr/employees/1/enroll')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ face_descriptor: faceDescriptor128() });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enrolled_at).toBe(enrolledAt);
    expect(res.body.data.is_enrolled).toBe(true);
    expect(res.body.data).not.toHaveProperty('face_descriptor');
    expect(mockEnrollEmployeeFace).toHaveBeenCalledWith(1, faceDescriptor128());
  });
});

describe('GET /api/v1/hr/checkin/verify-email', () => {
  it('returns 400 when email is missing', async () => {
    const res = await request(app).get('/api/v1/hr/checkin/verify-email');
    expect(res.status).toBe(400);
  });

  it('returns 404 when email is unknown', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/v1/hr/checkin/verify-email')
      .query({ email: 'unknown@example.com' });
    expect(res.status).toBe(404);
  });

  it('returns 200 for enrolled active employee without face_descriptor', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(enrolledEmployee);
    const res = await request(app)
      .get('/api/v1/hr/checkin/verify-email')
      .query({ email: 'jean.dupont@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.full_name).toBe('Jean Dupont');
    expect(res.body.data.is_enrolled).toBe(true);
    expect(res.body.data).not.toHaveProperty('face_descriptor');
    expect(res.body.data).not.toHaveProperty('salary_base');
    expect(typeof res.body.data.cost_late_day).toBe('number');
    expect(typeof res.body.data.cost_absent_day).toBe('number');
    expect(res.body.data.cost_late_day).toBeLessThanOrEqual(
      res.body.data.cost_absent_day
    );
  });

  it('returns 200 with is_enrolled false when face is not enrolled yet', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(employeeFixture);
    const res = await request(app)
      .get('/api/v1/hr/checkin/verify-email')
      .query({ email: 'jean.dupont@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.data.is_enrolled).toBe(false);
    expect(res.body.data).not.toHaveProperty('face_descriptor');
    expect(res.body.data.cost_absent_day).toBeGreaterThan(0);
  });
});

describe('POST /api/v1/hr/checkin/enroll', () => {
  it('self-enrolls an active employee without a face yet', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(employeeFixture);
    mockEnrollEmployeeFace.mockResolvedValueOnce({
      ...employeeFixture,
      is_enrolled: true,
      enrolled_at: '2026-09-08T08:00:00.000Z',
    });

    const res = await request(app)
      .post('/api/v1/hr/checkin/enroll')
      .send({
        email: 'jean.dupont@example.com',
        face_descriptor: faceDescriptor128(),
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.is_enrolled).toBe(true);
    expect(res.body.data).not.toHaveProperty('face_descriptor');
    expect(mockEnrollEmployeeFace).toHaveBeenCalledWith(1, faceDescriptor128());
  });

  it('returns 409 when face is already enrolled', async () => {
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(enrolledEmployee);
    const res = await request(app)
      .post('/api/v1/hr/checkin/enroll')
      .send({
        email: 'jean.dupont@example.com',
        face_descriptor: faceDescriptor128(),
      });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/déjà enregistré/i);
    expect(mockEnrollEmployeeFace).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/hr/checkin', () => {
  const checkinBody = {
    email: 'jean.dupont@example.com',
    face_descriptor: faceDescriptor128(),
    latitude: OFFICE_LAT,
    longitude: OFFICE_LNG,
  };

  it('returns 200 on happy path', async () => {
    getCheckInStatus.mockReturnValue('present');
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(enrolledEmployee);
    mockGetAttendanceByEmployeeAndDate.mockResolvedValueOnce(null);
    mockCreateAttendance.mockResolvedValueOnce({
      id: 10,
      employee_id: 1,
      date: '2026-09-08',
      check_in_time: '2026-09-08T07:00:00.000Z',
      status: 'present',
      face_verified: true,
      gps_verified: true,
    });

    const res = await request(app).post('/api/v1/hr/checkin').send(checkinBody);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.employee_name).toBe('Jean Dupont');
    expect(res.body.status).toBe('present');
    expect(res.body.check_in_time).toBeTruthy();
    expect(res.body).not.toHaveProperty('face_descriptor');
  });

  it('returns 400 on face mismatch', async () => {
    getCheckInStatus.mockReturnValue('present');
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(enrolledEmployee);

    const res = await request(app)
      .post('/api/v1/hr/checkin')
      .send({
        ...checkinBody,
        face_descriptor: faceDescriptor128(5),
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/visage n'a pas été reconnu/i);
  });

  it('returns 400 when GPS is out of range', async () => {
    getCheckInStatus.mockReturnValue('present');
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(enrolledEmployee);

    const res = await request(app)
      .post('/api/v1/hr/checkin')
      .send({
        ...checkinBody,
        latitude: OFFICE_LAT + 0.01,
        longitude: OFFICE_LNG,
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/bureau/i);
  });

  it('returns 400 when check-in is closed', async () => {
    getCheckInStatus.mockReturnValue(null);
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(enrolledEmployee);

    const res = await request(app).post('/api/v1/hr/checkin').send(checkinBody);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/terminé pour aujourd'hui/i);
  });

  it('returns 409 when already checked in today', async () => {
    getCheckInStatus.mockReturnValue('present');
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValueOnce(enrolledEmployee);
    mockGetAttendanceByEmployeeAndDate.mockResolvedValueOnce({
      id: 99,
      employee_id: 1,
      date: '2026-09-08',
      status: 'present',
    });

    const res = await request(app).post('/api/v1/hr/checkin').send(checkinBody);
    expect(res.status).toBe(409);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    process.env.HR_CHECKIN_RATE_MAX = '2';
    await resetHrCheckinRateLimit();
    mockGetEmployeeByEmailWithDescriptor.mockResolvedValue(null);

    await request(app)
      .get('/api/v1/hr/checkin/verify-email')
      .query({ email: 'a@example.com' });
    await request(app)
      .get('/api/v1/hr/checkin/verify-email')
      .query({ email: 'b@example.com' });
    const res = await request(app)
      .get('/api/v1/hr/checkin/verify-email')
      .query({ email: 'c@example.com' });

    expect(res.status).toBe(429);
    process.env.HR_CHECKIN_RATE_MAX = '1000';
    await resetHrCheckinRateLimit();
  });
});

describe('POST /api/v1/hr/checkin/client-error', () => {
  it('returns 202 without auth and notifies Discord', async () => {
    const res = await request(app)
      .post('/api/v1/hr/checkin/client-error')
      .send({
        kind: 'geo_denied',
        email: 'ada@example.com',
        message: 'Position refused',
        user_agent: 'TestAgent/1.0',
        detail: 'code=1',
      });

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(mockNotifyHrCheckinAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'geo_denied',
        email: 'ada@example.com',
        message: 'Position refused',
        path: '/api/v1/hr/checkin/client-error',
      })
    );
  });

  it('returns 400 for invalid kind', async () => {
    const res = await request(app)
      .post('/api/v1/hr/checkin/client-error')
      .send({ kind: 'not_a_real_kind' });
    expect(res.status).toBe(400);
    expect(mockNotifyHrCheckinAlert).not.toHaveBeenCalled();
  });
});

describe('GET /api/v1/hr/attendances', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/hr/attendances');
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 200 with filtered list and never includes face_descriptor', async () => {
    mockListAttendances.mockResolvedValueOnce([
      {
        id: 1,
        employee_id: 1,
        date: '2026-09-08',
        check_in_time: '2026-09-08T07:00:00.000Z',
        status: 'present',
        face_verified: true,
        gps_verified: true,
        latitude: 3.8721,
        longitude: 11.5137,
        full_name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        poste: 'Livreur',
        face_descriptor: faceDescriptor128(),
      },
    ]);
    const res = await request(app)
      .get('/api/v1/hr/attendances')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('present');
    expect(res.body.data[0]).not.toHaveProperty('face_descriptor');
    expect(mockListAttendances).toHaveBeenCalledWith(
      expect.objectContaining({ month: 9, year: 2026 })
    );
  });

  it('returns 400 when month is provided without year', async () => {
    const res = await request(app)
      .get('/api/v1/hr/attendances')
      .query({ month: 9 })
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/hr/attendances', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .send({ employee_id: 1, date: '2026-09-08', status: 'present' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${agencyToken}`)
      .send({ employee_id: 1, date: '2026-09-08', status: 'present' });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ employee_id: 1, status: 'absent' });
    expect(res.status).toBe(400);
  });

  it('creates a manual absent attendance via upsert', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockUpsertAttendance.mockResolvedValueOnce({
      id: 11,
      employee_id: 1,
      date: '2026-09-07',
      check_in_time: null,
      status: 'absent',
      face_verified: false,
      gps_verified: false,
      latitude: null,
      longitude: null,
      created_at: '2026-09-07T08:00:00.000Z',
      full_name: 'Jean Dupont',
      email: 'jean.dupont@example.com',
      poste: 'Livreur',
    });

    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ employee_id: 1, date: '2026-09-07', status: 'absent' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('absent');
    expect(mockUpsertAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: 1,
        date: '2026-09-07',
        status: 'absent',
        check_in_time: null,
        face_verified: false,
        gps_verified: false,
      })
    );
  });

  it('returns 404 when employee does not exist', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ employee_id: 99, date: '2026-09-08', status: 'present' });
    expect(res.status).toBe(404);
  });

  it('returns 400 when employee is inactive', async () => {
    mockGetEmployeeById.mockResolvedValueOnce({
      ...employeeFixture,
      is_active: false,
    });
    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ employee_id: 1, date: '2026-09-08', status: 'present' });
    expect(res.status).toBe(400);
  });

  it('creates a manual present attendance via upsert', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockUpsertAttendance.mockResolvedValueOnce({
      id: 10,
      employee_id: 1,
      date: '2026-09-08',
      check_in_time: '2026-09-08T08:00:00.000Z',
      status: 'present',
      face_verified: false,
      gps_verified: false,
      latitude: null,
      longitude: null,
      created_at: '2026-09-08T08:00:00.000Z',
      full_name: 'Jean Dupont',
      email: 'jean.dupont@example.com',
      poste: 'Livreur',
    });

    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ employee_id: 1, date: '2026-09-08', status: 'present' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('present');
    expect(res.body.data.face_verified).toBe(false);
    expect(res.body.data.gps_verified).toBe(false);
    expect(mockUpsertAttendance).toHaveBeenCalledWith(
      expect.objectContaining({
        employee_id: 1,
        date: '2026-09-08',
        status: 'present',
        face_verified: false,
        gps_verified: false,
        latitude: null,
        longitude: null,
      })
    );
  });

  it('overwrites an existing attendance for the same day', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockUpsertAttendance.mockResolvedValueOnce({
      id: 10,
      employee_id: 1,
      date: '2026-09-08',
      check_in_time: '2026-09-08T09:30:00.000Z',
      status: 'late',
      face_verified: false,
      gps_verified: false,
      latitude: null,
      longitude: null,
      created_at: '2026-09-08T07:00:00.000Z',
      full_name: 'Jean Dupont',
      email: 'jean.dupont@example.com',
      poste: 'Livreur',
    });

    const res = await request(app)
      .post('/api/v1/hr/attendances')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ employee_id: 1, date: '2026-09-08', status: 'late' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('late');
    expect(mockUpsertAttendance).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'late' })
    );
  });
});

describe('GET /api/v1/hr/attendances/summary', () => {
  it('returns 400 without month/year', async () => {
    const res = await request(app)
      .get('/api/v1/hr/attendances/summary')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 200 with days_absent computed from weekdays elapsed', async () => {
    const { countWeekdaysElapsed } = jest.requireActual('../../lib/hrCheckin');
    const weekdays = countWeekdaysElapsed(2026, 9);

    mockSummarizeAttendances.mockResolvedValueOnce([
      {
        employee_id: 1,
        full_name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        poste: 'Livreur',
        days_present: 2,
        days_late: 1,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/hr/attendances/summary')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].days_present).toBe(2);
    expect(res.body.data[0].days_late).toBe(1);
    expect(res.body.data[0].days_absent).toBe(Math.max(0, weekdays - 3));
    expect(res.body.data[0].weekdays_elapsed).toBe(weekdays);
    expect(res.body.data[0]).not.toHaveProperty('face_descriptor');
  });
});

describe('GET /api/v1/hr/employees/:id/payslip.pdf', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app)
      .get('/api/v1/hr/employees/1/payslip.pdf')
      .query({ month: 9, year: 2026 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for agency user', async () => {
    const res = await request(app)
      .get('/api/v1/hr/employees/1/payslip.pdf')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('returns 400 without month/year', async () => {
    const res = await request(app)
      .get('/api/v1/hr/employees/1/payslip.pdf')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(400);
  });

  it('returns 404 when employee is missing', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/v1/hr/employees/999/payslip.pdf')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(404);
    expect(mockRenderPayslipPdf).not.toHaveBeenCalled();
  });

  it('returns PDF inline by default (preview)', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockSummarizeAttendances.mockResolvedValueOnce([
      {
        employee_id: 1,
        full_name: 'Jean Dupont',
        email: 'jean.dupont@example.com',
        poste: 'Livreur',
        days_present: 6,
        days_late: 0,
      },
    ]);

    const res = await request(app)
      .get('/api/v1/hr/employees/1/payslip.pdf')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^inline;/);
    expect(res.headers['content-disposition']).toMatch(/Bulletin-paie-Jean-Dupont-2026-09\.pdf/);
    expect(mockRenderPayslipPdf).toHaveBeenCalledTimes(1);
    expect(Buffer.isBuffer(res.body) || typeof res.body === 'object').toBe(true);
  });

  it('returns PDF as attachment when download=true', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockSummarizeAttendances.mockResolvedValueOnce([]);

    const res = await request(app)
      .get('/api/v1/hr/employees/1/payslip.pdf')
      .query({ month: 9, year: 2026, download: true })
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(mockRenderPayslipPdf).toHaveBeenCalledTimes(1);
  });
});

describe('POST /api/v1/hr/employees/:id/payslip/send-whatsapp', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app)
      .post('/api/v1/hr/employees/1/payslip/send-whatsapp')
      .query({ month: 9, year: 2026 });
    expect(res.status).toBe(401);
  });

  it('returns 503 when WhatsApp bot is disabled', async () => {
    mockIsWhatsAppBotEnabled.mockReturnValue(false);
    const res = await request(app)
      .post('/api/v1/hr/employees/1/payslip/send-whatsapp')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('whatsapp_disabled');
    expect(mockSendTextDm).not.toHaveBeenCalled();
  });

  it('returns 400 when employee has no phone', async () => {
    mockGetEmployeeById.mockResolvedValueOnce({
      ...employeeFixture,
      phone: null,
    });

    const res = await request(app)
      .post('/api/v1/hr/employees/1/payslip/send-whatsapp')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('phone_required');
    expect(mockSendTextDm).not.toHaveBeenCalled();
  });

  it('sends WhatsApp text DM with signed download link', async () => {
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockSendTextDm
      .mockResolvedValueOnce({
        messageId: 'msg-intro',
        recipient: '237690000000@c.us',
      })
      .mockResolvedValueOnce({
        messageId: 'msg-wa-1',
        recipient: '237690000000@c.us',
      });

    const res = await request(app)
      .post('/api/v1/hr/employees/1/payslip/send-whatsapp')
      .query({ month: 9, year: 2026 })
      .set('Authorization', `Bearer ${superToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      data: {
        sent: true,
        channel: 'whatsapp_link',
        message_id: 'msg-wa-1',
        recipient: '237690000000@c.us',
      },
    });
    expect(res.body.data.download_url).toMatch(
      /\/api\/v1\/hr\/p\/[A-Za-z0-9]+$/
    );
    expect(res.body.data.download_url).not.toMatch(/token=/);
    expect(mockSendTextDm).toHaveBeenCalledTimes(2);
    expect(mockSendTextDm.mock.calls[0][0].message).toContain('Bulletin de paie');
    expect(mockSendTextDm.mock.calls[0][0].message).not.toContain(
      res.body.data.download_url
    );
    expect(mockSendTextDm.mock.calls[1][0]).toEqual({
      recipientPhone: '690000000',
      message: res.body.data.download_url,
    });
  });
});

describe('GET /api/v1/hr/p/:code', () => {
  it('returns PDF for a valid short code (no auth)', async () => {
    const { createPayslipDownloadLink } = require('../../lib/payslipDownloadToken');
    const { code } = createPayslipDownloadLink({
      employeeId: 1,
      year: 2026,
      month: 9,
    });
    mockGetEmployeeById.mockResolvedValueOnce(employeeFixture);
    mockSummarizeAttendances.mockResolvedValueOnce([]);

    const res = await request(app).get(`/api/v1/hr/p/${code}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/^attachment;/);
    expect(mockRenderPayslipPdf).toHaveBeenCalledTimes(1);
  });

  it('returns 403 for unknown code', async () => {
    const res = await request(app).get('/api/v1/hr/p/noSuchCode1');
    expect(res.status).toBe(403);
  });
});
