/**
 * Dépenses générales de l'entreprise (saisies dashboard) — /api/v1/expenses.
 * Distinctes des dépenses opérationnelles de l'API livraisons et des
 * salaires RH ; imputées à un mois (effective_month) déduit du CA.
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

export type ExpenseCategory =
  | "loyer"
  | "energie_eau"
  | "internet_telephone"
  | "transport"
  | "materiel_equipement"
  | "marketing"
  | "administratif_legal"
  | "maintenance"
  | "autre";

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  loyer: "Loyer",
  energie_eau: "Énergie / Eau",
  internet_telephone: "Internet & téléphone",
  transport: "Transport",
  materiel_equipement: "Matériel & équipement",
  marketing: "Marketing",
  administratif_legal: "Administratif & légal",
  maintenance: "Maintenance",
  autre: "Autre",
};

export interface CompanyExpense {
  id: number;
  label: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  /** 1er du mois d'imputation (YYYY-MM-01). */
  effective_month: string;
  notes: string | null;
  /** Justificatif présent (l'image complète vient de getExpense). */
  has_receipt?: boolean;
  /** Image data URL — uniquement via getExpense(id). */
  receipt_base64?: string | null;
  source: "manual" | "system";
  created_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface ExpensesSummary {
  total: number;
  count: number;
  by_category: { category: ExpenseCategory; count: number; total: number }[];
}

export interface CreateExpensePayload {
  label: string;
  category: ExpenseCategory;
  amount: number;
  expense_date: string;
  effective_month: string;
  notes?: string | null;
  /** Image data URL (png/jpeg/webp) ; null pour retirer le justificatif. */
  receipt_base64?: string | null;
}

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
  data: Partial<CreateExpensePayload>
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
