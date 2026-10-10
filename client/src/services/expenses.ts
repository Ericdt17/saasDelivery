/**
 * Dépenses générales de l'entreprise (saisies dashboard) — /api/v1/expenses.
 * Distinctes des dépenses opérationnelles de l'API livraisons et des
 * salaires RH ; imputées à un mois (effective_month) déduit du CA.
 * Catégories dynamiques (gérées dans Paramètres) + justificatifs multiples.
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1/expenses";

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || response.message || fallback);
  }
  return response.data;
}

export interface ExpenseCategory {
  id: number;
  name: string;
  /** Une note est exigée à la saisie pour cette catégorie (ex. « Autre »). */
  requires_note: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseReceipt {
  id: number;
  image_base64: string;
  created_at: string;
}

export interface CompanyExpense {
  id: number;
  label: string;
  category_id: number;
  category_name: string;
  amount: number;
  expense_date: string;
  /** 1er du mois d'imputation (YYYY-MM-01). */
  effective_month: string;
  notes: string | null;
  /** Nombre de justificatifs (les images viennent de getExpense). */
  receipt_count: number;
  /** Justificatifs complets — uniquement via getExpense(id). */
  receipts?: ExpenseReceipt[];
  source: "manual" | "system";
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExpensesSummary {
  total: number;
  count: number;
  by_category: {
    category_id: number;
    category_name: string;
    count: number;
    total: number;
  }[];
}

export interface CreateExpensePayload {
  label: string;
  category_id: number;
  amount: number;
  expense_date: string;
  effective_month: string;
  notes?: string | null;
  /** Images data URL (png/jpeg/webp), 5 max. */
  receipts?: string[];
}

export interface UpdateExpensePayload
  extends Partial<Omit<CreateExpensePayload, "receipts">> {
  /** Nouveaux justificatifs à ajouter. */
  receipts_add?: string[];
  /** Ids de justificatifs existants à supprimer. */
  receipt_ids_remove?: number[];
}

export const MAX_RECEIPTS = 5;

// --- Catégories --------------------------------------------------------

export async function listExpenseCategories(params?: {
  activeOnly?: boolean;
}): Promise<ExpenseCategory[]> {
  const qs = params?.activeOnly ? "?active=true" : "";
  const res = await apiGet<ExpenseCategory[]>(`${BASE}/categories${qs}`);
  return unwrap(res, "Impossible de charger les catégories");
}

export async function createExpenseCategory(data: {
  name: string;
  requires_note?: boolean;
}): Promise<ExpenseCategory> {
  const res = await apiPost<ExpenseCategory>(`${BASE}/categories`, data);
  return unwrap(res, "Impossible de créer la catégorie");
}

export async function updateExpenseCategory(
  id: number,
  data: { name?: string; requires_note?: boolean; is_active?: boolean }
): Promise<ExpenseCategory> {
  const res = await apiPatch<ExpenseCategory>(`${BASE}/categories/${id}`, data);
  return unwrap(res, "Impossible de modifier la catégorie");
}

export async function deleteExpenseCategory(
  id: number
): Promise<ExpenseCategory> {
  const res = await apiDelete<ExpenseCategory>(`${BASE}/categories/${id}`);
  return unwrap(res, "Impossible de désactiver la catégorie");
}

// --- Dépenses ----------------------------------------------------------

export async function listExpenses(params: {
  year: number;
  month: number;
}): Promise<{ expenses: CompanyExpense[]; summary: ExpensesSummary }> {
  const res = await apiGet<{ expenses: CompanyExpense[]; summary: ExpensesSummary }>(
    `${BASE}?year=${params.year}&month=${params.month}`
  );
  return unwrap(res, "Impossible de charger les dépenses");
}

export async function getExpense(id: number): Promise<CompanyExpense> {
  const res = await apiGet<CompanyExpense>(`${BASE}/${id}`);
  return unwrap(res, "Impossible de charger la dépense");
}

export async function createExpense(
  data: CreateExpensePayload
): Promise<CompanyExpense> {
  const res = await apiPost<CompanyExpense>(BASE, data);
  return unwrap(res, "Impossible d'enregistrer la dépense");
}

export async function updateExpense(
  id: number,
  data: UpdateExpensePayload
): Promise<CompanyExpense> {
  const res = await apiPatch<CompanyExpense>(`${BASE}/${id}`, data);
  return unwrap(res, "Impossible de modifier la dépense");
}

export async function deleteExpense(id: number): Promise<void> {
  const res = await apiDelete<{ deleted: boolean }>(`${BASE}/${id}`);
  unwrap(res, "Impossible de supprimer la dépense");
}

export async function getExpensesSummary(params: {
  year: number;
  month: number;
}): Promise<ExpensesSummary> {
  const res = await apiGet<ExpensesSummary>(
    `${BASE}/summary?year=${params.year}&month=${params.month}`
  );
  return unwrap(res, "Impossible de charger le résumé des dépenses");
}
