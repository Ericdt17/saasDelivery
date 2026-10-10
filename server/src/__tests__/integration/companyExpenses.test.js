'use strict';

const request = require('supertest');
const { createTestToken, createSuperAdminToken } = require('../helpers/createAuthToken');

const mockListExpenseCategories = jest.fn();
const mockGetExpenseCategoryById = jest.fn();
const mockCreateExpenseCategory = jest.fn();
const mockUpdateExpenseCategory = jest.fn();
const mockDeleteExpenseCategory = jest.fn();
const mockListCompanyExpenses = jest.fn();
const mockGetCompanyExpenseById = jest.fn();
const mockCreateCompanyExpense = jest.fn();
const mockUpdateCompanyExpense = jest.fn();
const mockDeleteCompanyExpense = jest.fn();
const mockAddExpenseReceipts = jest.fn();
const mockDeleteExpenseReceipts = jest.fn();
const mockCountExpenseReceipts = jest.fn();
const mockSummarizeCompanyExpenses = jest.fn();

jest.mock('../../db', () => ({
  adapter: { query: jest.fn(), type: 'sqlite' },
  listExpenseCategories: mockListExpenseCategories,
  getExpenseCategoryById: mockGetExpenseCategoryById,
  createExpenseCategory: mockCreateExpenseCategory,
  updateExpenseCategory: mockUpdateExpenseCategory,
  deleteExpenseCategory: mockDeleteExpenseCategory,
  listCompanyExpenses: mockListCompanyExpenses,
  getCompanyExpenseById: mockGetCompanyExpenseById,
  createCompanyExpense: mockCreateCompanyExpense,
  updateCompanyExpense: mockUpdateCompanyExpense,
  deleteCompanyExpense: mockDeleteCompanyExpense,
  addExpenseReceipts: mockAddExpenseReceipts,
  deleteExpenseReceipts: mockDeleteExpenseReceipts,
  countExpenseReceipts: mockCountExpenseReceipts,
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

const loyerCategory = {
  id: 1,
  name: 'Loyer',
  requires_note: false,
  is_active: true,
  created_at: '2026-10-10T10:00:00.000Z',
  updated_at: '2026-10-10T10:00:00.000Z',
};

const autreCategory = {
  ...loyerCategory,
  id: 9,
  name: 'Autre',
  requires_note: true,
};

const expenseRow = {
  id: 1,
  label: 'Loyer bureau octobre',
  category_id: 1,
  category_name: 'Loyer',
  amount: 150000,
  expense_date: '2026-10-05',
  effective_month: '2026-10-01',
  notes: null,
  source: 'manual',
  created_by: 99,
  created_at: '2026-10-10T10:00:00.000Z',
  updated_at: '2026-10-10T10:00:00.000Z',
  receipt_count: 0,
  receipts: [],
};

const RECEIPT = `data:image/jpeg;base64,${'A'.repeat(400)}`;
const RECEIPT_PDF = `data:application/pdf;base64,${'B'.repeat(400)}`;

beforeEach(() => jest.clearAllMocks());

describe('catégories dynamiques (/api/v1/expenses/categories)', () => {
  it('rejects non super_admin', async () => {
    const res = await request(app)
      .get('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${agencyToken}`);
    expect(res.status).toBe(403);
  });

  it('lists categories (activeOnly supported)', async () => {
    mockListExpenseCategories.mockResolvedValue([loyerCategory, autreCategory]);
    const res = await request(app)
      .get('/api/v1/expenses/categories?active=true')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(mockListExpenseCategories).toHaveBeenCalledWith({ activeOnly: true });
    expect(res.body.data).toHaveLength(2);
  });

  it('creates a category with requires_note', async () => {
    mockCreateExpenseCategory.mockResolvedValue({
      ...loyerCategory,
      id: 10,
      name: 'Carburant groupe',
      requires_note: true,
    });
    const res = await request(app)
      .post('/api/v1/expenses/categories')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ name: 'Carburant groupe', requires_note: true });
    expect(res.status).toBe(201);
    expect(mockCreateExpenseCategory).toHaveBeenCalledWith({
      name: 'Carburant groupe',
      requires_note: true,
    });
  });

  it('soft-deactivates a category on DELETE', async () => {
    mockDeleteExpenseCategory.mockResolvedValue({
      ...loyerCategory,
      is_active: false,
    });
    const res = await request(app)
      .delete('/api/v1/expenses/categories/1')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.is_active).toBe(false);
  });
});

describe('/api/v1/expenses', () => {
  it('lists expenses with the monthly summary (category names)', async () => {
    mockListCompanyExpenses.mockResolvedValue([expenseRow]);
    mockSummarizeCompanyExpenses.mockResolvedValue({
      total: 150000,
      count: 1,
      by_category: [
        { category_id: 1, category_name: 'Loyer', count: 1, total: 150000 },
      ],
    });
    const res = await request(app)
      .get('/api/v1/expenses?year=2026&month=10')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.expenses[0].category_name).toBe('Loyer');
    expect(res.body.data.summary.by_category[0].category_name).toBe('Loyer');
  });

  it('creates an expense with multiple receipts and creator audit', async () => {
    mockGetExpenseCategoryById.mockResolvedValue(loyerCategory);
    mockCreateCompanyExpense.mockResolvedValue({
      ...expenseRow,
      receipt_count: 2,
    });
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'Loyer',
        category_id: 1,
        amount: 150000,
        expense_date: '2026-10-05',
        effective_month: '2026-10-01',
        receipts: [RECEIPT, RECEIPT_PDF],
      });
    expect(res.status).toBe(201);
    const payload = mockCreateCompanyExpense.mock.calls[0][0];
    expect(payload.category_id).toBe(1);
    expect(payload.receipts).toHaveLength(2);
    expect(payload.receipts[1]).toBe(RECEIPT_PDF);
    expect(payload.created_by).toBe(99);
  });

  it('rejects an unknown or inactive category', async () => {
    mockGetExpenseCategoryById.mockResolvedValue({
      ...loyerCategory,
      is_active: false,
    });
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'X',
        category_id: 1,
        amount: 10,
        expense_date: '2026-10-05',
        effective_month: '2026-10-01',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_category');
  });

  it('enforces requires_note from the category', async () => {
    mockGetExpenseCategoryById.mockResolvedValue(autreCategory);
    const noNote = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'Divers',
        category_id: 9,
        amount: 5000,
        expense_date: '2026-10-10',
        effective_month: '2026-10-01',
      });
    expect(noNote.status).toBe(400);
    expect(noNote.body.error).toBe('note_required');

    mockCreateCompanyExpense.mockResolvedValue(expenseRow);
    const withNote = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'Divers',
        category_id: 9,
        amount: 5000,
        expense_date: '2026-10-10',
        effective_month: '2026-10-01',
        notes: 'Achat de cartons',
      });
    expect(withNote.status).toBe(201);
  });

  it('rejects a malformed effective_month and >5 receipts', async () => {
    const badMonth = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'X',
        category_id: 1,
        amount: 10,
        expense_date: '2026-10-05',
        effective_month: '2026-10-15',
      });
    expect(badMonth.status).toBe(400);

    const tooMany = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'X',
        category_id: 1,
        amount: 10,
        expense_date: '2026-10-05',
        effective_month: '2026-10-01',
        receipts: Array(6).fill(RECEIPT),
      });
    expect(tooMany.status).toBe(400);
    expect(mockCreateCompanyExpense).not.toHaveBeenCalled();
  });

  it('rejects an unsupported receipt type (text)', async () => {
    const res = await request(app)
      .post('/api/v1/expenses')
      .set('Authorization', `Bearer ${superToken}`)
      .send({
        label: 'X',
        category_id: 1,
        amount: 10,
        expense_date: '2026-10-05',
        effective_month: '2026-10-01',
        receipts: ['data:text/plain;base64,AAAA'],
      });
    expect(res.status).toBe(400);
    expect(mockCreateCompanyExpense).not.toHaveBeenCalled();
  });

  it('returns receipts via GET /:id', async () => {
    mockGetCompanyExpenseById.mockResolvedValue({
      ...expenseRow,
      receipt_count: 1,
      receipts: [{ id: 7, image_base64: RECEIPT, created_at: '2026-10-10' }],
    });
    const res = await request(app)
      .get('/api/v1/expenses/1')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.receipts[0].image_base64).toBe(RECEIPT);
  });

  it('adds and removes receipts on PATCH, enforcing the cap', async () => {
    mockGetCompanyExpenseById.mockResolvedValue({
      ...expenseRow,
      receipts: [{ id: 7, image_base64: RECEIPT }],
    });
    mockGetExpenseCategoryById.mockResolvedValue(loyerCategory);
    mockCountExpenseReceipts.mockResolvedValue(1);
    mockUpdateCompanyExpense.mockResolvedValue(expenseRow);

    const res = await request(app)
      .patch('/api/v1/expenses/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ receipts_add: [RECEIPT], receipt_ids_remove: [7] });
    expect(res.status).toBe(200);
    expect(mockDeleteExpenseReceipts).toHaveBeenCalledWith(1, [7]);
    expect(mockAddExpenseReceipts).toHaveBeenCalledWith(1, [RECEIPT]);

    // 1 existant − 0 retiré + 5 ajoutés = 6 > 5 → refus
    const over = await request(app)
      .patch('/api/v1/expenses/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ receipts_add: Array(5).fill(RECEIPT) });
    expect(over.status).toBe(400);
    expect(over.body.error).toBe('too_many_receipts');
  });

  it('blocks switching to a note-required category without a note (merged state)', async () => {
    mockGetCompanyExpenseById.mockResolvedValue({ ...expenseRow, notes: null });
    mockGetExpenseCategoryById.mockResolvedValue(autreCategory);
    const res = await request(app)
      .patch('/api/v1/expenses/1')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ category_id: 9 });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('note_required');
    expect(mockUpdateCompanyExpense).not.toHaveBeenCalled();
  });

  it('hard-deletes an expense', async () => {
    mockDeleteCompanyExpense.mockResolvedValue({ id: 1 });
    const ok = await request(app)
      .delete('/api/v1/expenses/1')
      .set('Authorization', `Bearer ${superToken}`);
    expect(ok.status).toBe(200);
    expect(mockDeleteCompanyExpense).toHaveBeenCalledWith(1);
  });
});
