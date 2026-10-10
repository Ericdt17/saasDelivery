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
  type CreateExpensePayload,
} from "@/services/expenses";

export const expenseKeys = {
  all: ["expenses"] as const,
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
      data: Partial<CreateExpensePayload>;
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
