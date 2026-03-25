'use strict';

const request = require('supertest');

// Mock heavy modules that server.js transitively requires but aren't needed for tests
jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  getAllDeliveries: jest.fn(),
  getDeliveryById: jest.fn(),
  createDelivery: jest.fn(),
  updateDelivery: jest.fn(),
  deleteDelivery: jest.fn(),
  getDeliveryHistory: jest.fn(),
  saveHistory: jest.fn(),
  getTariffByAgencyAndQuartier: jest.fn(),
  createAgency: jest.fn(),
  getAgencyByEmail: jest.fn(),
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

const app = require('../../api/server');

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body.service).toBe('delivery-bot-api');
  });
});

describe('GET /', () => {
  it('returns 200 with API info', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
  });
});
