'use strict';

const request = require('supertest');
const { createTestToken } = require('../helpers/createAuthToken');

// ---------------------------------------------------------------------------
// Mocks — must come before any require of the app
// ---------------------------------------------------------------------------

const mockAdapterQuery = jest.fn();
const mockGetAgencyByEmail = jest.fn();
const mockCreateAgency = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: mockAdapterQuery, type: 'sqlite' },
  getAgencyByEmail: mockGetAgencyByEmail,
  createAgency: mockCreateAgency,
  // Unused by auth routes but required by other routers mounted on the app
  getAllDeliveries: jest.fn(),
  getDeliveryById: jest.fn(),
  createDelivery: jest.fn(),
  updateDelivery: jest.fn(),
  deleteDelivery: jest.fn(),
  getDeliveryHistory: jest.fn(),
  saveHistory: jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  getAllAgencies: jest.fn(),
  getAgencyById: jest.fn(),
  updateAgency: jest.fn(),
  deleteAgency: jest.fn(),
  getAllGroups: jest.fn(),
  getGroupById: jest.fn(),
  createGroup: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  getAllTariffs: jest.fn(),
  getTariffById: jest.fn(),
  createTariff: jest.fn(),
  updateTariff: jest.fn(),
  deleteTariff: jest.fn(),
  getDailyStats: jest.fn(),
  searchDeliveries: jest.fn(),
}));

jest.mock('../../utils/password', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  SALT_ROUNDS: 10,
}));

const { comparePassword } = require('../../utils/password');
const app = require('../../api/server');

// Shared test agency fixture
const testAgency = {
  id: 1,
  name: 'Test Agency',
  email: 'admin@agency.com',
  password_hash: '$2b$10$hashedpassword',
  role: 'agency',
  is_active: true,
};

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/login', () => {
  it('returns 400 for missing email', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for invalid email format', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'secret123' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('returns 400 for password shorter than 6 characters', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@agency.com', password: '123' });
    expect(res.status).toBe(400);
  });

  it('returns 401 when agency is not found', async () => {
    mockAdapterQuery.mockResolvedValueOnce(null);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'unknown@agency.com', password: 'secret123' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication failed');
  });

  it('returns 401 for wrong password', async () => {
    mockAdapterQuery.mockResolvedValueOnce(testAgency);
    comparePassword.mockResolvedValueOnce(false);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testAgency.email, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for disabled account', async () => {
    mockAdapterQuery.mockResolvedValueOnce({ ...testAgency, is_active: false });
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testAgency.email, password: 'secret123' });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Account disabled');
  });

  it('returns 200 + sets auth_token cookie on valid credentials', async () => {
    mockAdapterQuery.mockResolvedValueOnce(testAgency);
    comparePassword.mockResolvedValueOnce(true);
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: testAgency.email, password: 'secret123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testAgency.email);
    const cookie = res.headers['set-cookie']?.[0] || '';
    expect(cookie).toMatch(/auth_token=/);
    expect(cookie).toMatch(/HttpOnly/i);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/signup
// ---------------------------------------------------------------------------
describe('POST /api/v1/auth/signup', () => {
  const validSignup = {
    name: 'New Agency',
    email: 'new@agency.com',
    password: 'secret123',
    agency_code: 'AGCD',
  };

  it('returns 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'a@b.com', password: 'secret123' });
    expect(res.status).toBe(400);
  });

  it('returns 409 when email is already taken', async () => {
    mockGetAgencyByEmail.mockResolvedValueOnce(testAgency);
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(validSignup);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Conflict');
  });

  it('returns 201 and sets cookie on successful signup', async () => {
    mockGetAgencyByEmail.mockResolvedValueOnce(null);
    mockCreateAgency.mockResolvedValueOnce(42);
    const res = await request(app)
      .post('/api/v1/auth/signup')
      .send(validSignup);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.role).toBe('agency');
    const cookie = res.headers['set-cookie']?.[0] || '';
    expect(cookie).toMatch(/auth_token=/);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------
describe('GET /api/v1/auth/me', () => {
  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('returns 200 with user data for a valid token', async () => {
    mockAdapterQuery.mockResolvedValueOnce(testAgency);
    const token = createTestToken({ email: testAgency.email });
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(testAgency.email);
  });

  it('returns 401 when the account no longer exists in the DB', async () => {
    mockAdapterQuery.mockResolvedValueOnce(null);
    const token = createTestToken();
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
