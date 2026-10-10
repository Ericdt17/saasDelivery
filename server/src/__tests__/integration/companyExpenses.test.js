'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

const mockListCompanyExpenses = jest.fn();
const mockGetCompanyExpenseById = jest.fn();
const mockCreateCompanyExpense = jest.fn();
const mockUpdateCompanyExpense = jest.fn();
const mockDeleteCompanyExpense = jest.fn();
const mockSummarizeCompanyExpenses = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  listCompanyExpenses: mockListCompanyExpenses,
  getCompanyExpenseById: mockGetCompanyExpenseById,
  createCompanyExpense: mockCreateCompanyExpense,
  updateCompanyExpense: mockUpdateCompanyExpense,
  deleteCompanyExpense: mockDeleteCompanyExpense,
  summarizeCompanyExpenses: mockSummarizeCompanyExpenses,
  listEmployees: jest.fn(),
  getEmployeeById: jest.fn(),
  getEmployeeByEmailWithDescriptor: jest.fn(),
  getCompanySettings: jest.fn(),
  getAgencyById: jest.fn(),
  getAgencyByEmail: jest.fn(),
  getAllAgencies: jest.fn(),
  getWaitlistEntries: jest.fn(),
  insertWaitlistEntry: jest.fn(),
  recruitmentListOpenJobs: jest.fn(),
  listMerchantTerms: jest.fn(),
  listWorkplaces: jest.fn(),
}));

const app = require('../../api/server');

const agencyToken = createTestToken({ userId: 1, agencyId: 1 });
const superToken = createSuperAdminToken({ userId: 99, agencyId: null });

const expenseRow = {
  id: 1,
  label: 'Loyer bureau octobre',
  category: 'loyer',
  amount: 150000,
  expense_date: '2026-10-05',
  effective_month: '2026-10-01',
  notes: null,
  source: 'manual',
  created_by: 99,
  created_at: '2026-10-10T10:00:00.000Z',
  updated_at: '2026-10-10T10:00:00.000Z',
};

beforeEach(() => jest.clearAllMocks());

describe('/api/v1/expenses', () => {
  it('rejects non super_admin', async () => {
    const res = await request(app)
      .get('/api/v1/expenses?year=2026&month=10')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('lists expenses with the monthly summary', async () => {
    mockListCompanyExpenses.mockResolvedValue([expenseRow]);
    mockSummarizeCompanyExpenses.mockResolvedValue({
      total: 150000,
      count: 1,
      by_category: [{ category: 'loyer', count: 1, total: 150000 }],
    });
    const res = await request(app)
      .get('/api/v1/expenses?year=2026&month=10')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(mockListCompanyExpenses).toHaveBeenCalledWith({ year: 2026, month: 10 });
    expect(res.body.data.expenses).toHaveLength(1);
    expect(res.body.data.summary.total).toBe(150000);
  });

  it('creates an expense imputed to the chosen month with creator audit', async () => {
    mockCreateCompanyExpense.mockResolvedValue(expenseRow);
    // Facture de septembre saisie le 5 octobre → imputée à septembre.
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'Électricité septembre',
        category: 'energie_eau',
        amount: 42000,
        expense_date: '2026-10-05',
        effective_month: '2026-09-01',
      });
    expect(res.status).toBe(201);
    expect(mockCreateCompanyExpense).toHaveBeenCalledWith({
      label: 'Électricité septembre',
      category: 'energie_eau',
      amount: 42000,
      expense_date: '2026-10-05',
      effective_month: '2026-09-01',
      notes: null,
      created_by: 99,
    });
  });

  it('rejects an invalid category and a malformed effective_month', async () => {
    const bad = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'X',
        category: 'nourriture',
        amount: 10,
        expense_date: '2026-10-05',
        effective_month: '2026-10-01',
      });
    expect(bad.status).toBe(400);

    const badMonth = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'X',
        category: 'loyer',
        amount: 10,
        expense_date: '2026-10-05',
        effective_month: '2026-10-15',
      });
    expect(badMonth.status).toBe(400);
    expect(mockCreateCompanyExpense).not.toHaveBeenCalled();
  });

  it('updates an expense', async () => {
    mockGetCompanyExpenseById.mockResolvedValue(expenseRow);
    mockUpdateCompanyExpense.mockResolvedValue({ ...expenseRow, amount: 160000 });
    const res = await request(app)
      .patch('/api/v1/expenses/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ amount: 160000 });
    expect(res.status).toBe(200);
    expect(mockUpdateCompanyExpense).toHaveBeenCalledWith(1, { amount: 160000 });
    expect(res.body.data.amount).toBe(160000);
  });

  it('hard-deletes an expense and 404s on unknown id', async () => {
    mockDeleteCompanyExpense.mockResolvedValue({ id: 1 });
    const ok = await request(app)
      .delete('/api/v1/expenses/1')
      .set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
    expect(mockDeleteCompanyExpense).toHaveBeenCalledWith(1);

    mockDeleteCompanyExpense.mockResolvedValue(null);
    const missing = await request(app)
      .delete('/api/v1/expenses/999')
      .set('Authorization', `Bearer ${superToken}`);
    expect(missing.status).toBe(404);
  });
});
