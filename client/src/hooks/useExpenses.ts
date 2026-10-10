/**
 * React Query hooks — dépenses générales (super_admin)
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpensesSummary,
  listExpenseCategories,
  createExpenseCategory,
  updateExpenseCategory,
  deleteExpenseCategory,
  type CreateExpensePayload,
  type UpdateExpensePayload,
} from "@/services/expenses";

export const expenseKeys = {
  all: ["expenses"] as const,
  categories: ["expenses", "categories"] as const,
  categoriesActive: ["expenses", "categories", "active"] as const,
  month: (year: number, month: number) => ["expenses", year, month] as const,
  summary: (year: number, month: number) =>
    ["expenses", "summary", year, month] as const,
};

export function useExpenses(year: number, month: number) {
  return useQuery({
    queryKey: expenseKeys.month(year, month),
    queryFn: () => listExpenses({ year, month }),
    staleTime: 10000,
  });
}

export function useExpensesSummary(year: number, month: number) {
  return useQuery({
    queryKey: expenseKeys.summary(year, month),
    queryFn: () => getExpensesSummary({ year, month }),
    staleTime: 10000,
  });
}

function invalidate(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: expenseKeys.all });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateExpensePayload) => createExpense(data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Dépense enregistrée");
    },
    onError: (e: unknown) => {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: UpdateExpensePayload;
    }) => updateExpense(id, data),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Dépense modifiée");
    },
    onError: (e: unknown) => {
      toast.error("Modification impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteExpense(id),
    onSuccess: () => {
      invalidate(qc);
      toast.success("Dépense supprimée");
    },
    onError: (e: unknown) => {
      toast.error("Suppression impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

// --- Catégories dynamiques ---------------------------------------------

export function useExpenseCategories(params?: { activeOnly?: boolean }) {
  const activeOnly = params?.activeOnly === true;
  return useQuery({
    queryKey: activeOnly
      ? expenseKeys.categoriesActive
      : expenseKeys.categories,
    queryFn: () => listExpenseCategories({ activeOnly }),
    staleTime: 30000,
  });
}

function invalidateCategories(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: expenseKeys.categories });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; requires_note?: boolean }) =>
      createExpenseCategory(data),
    onSuccess: () => {
      invalidateCategories(qc);
      toast.success("Catégorie créée");
    },
    onError: (e: unknown) => {
      toast.error("Création impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; requires_note?: boolean; is_active?: boolean };
    }) => updateExpenseCategory(id, data),
    onSuccess: () => {
      invalidateCategories(qc);
      toast.success("Catégorie mise à jour");
    },
    onError: (e: unknown) => {
      toast.error("Mise à jour impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteExpenseCategory(id),
    onSuccess: () => {
      invalidateCategories(qc);
      toast.success("Catégorie désactivée");
    },
    onError: (e: unknown) => {
      toast.error("Désactivation impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}
