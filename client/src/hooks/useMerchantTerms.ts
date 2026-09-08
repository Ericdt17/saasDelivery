/**
 * React Query hooks — conditions marchands (super_admin)
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getMerchantTermsList,
  createMerchantTerms,
  updateMerchantTerms,
  deleteMerchantTerms,
  type CreateMerchantTermsPayload,
  type UpdateMerchantTermsPayload,
} from "@/services/merchantTerms";

export const merchantTermsKeys = {
  all: ["merchant-terms"] as const,
};

export function useMerchantTermsList() {
  const result = useQuery({
    queryKey: merchantTermsKeys.all,
    queryFn: () => getMerchantTermsList(),
    retry: 2,
    staleTime: 10000,
  });

  useEffect(() => {
    if (result.isError) {
      const msg = result.error instanceof Error ? result.error.message : "Erreur";
      toast.error("Erreur lors du chargement", { description: msg });
    }
  }, [result.isError, result.error]);

  return result;
}

export function useCreateMerchantTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMerchantTermsPayload) => createMerchantTerms(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: merchantTermsKeys.all });
      toast.success("Conditions créées");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Création impossible",
      });
    },
  });
}

export function useUpdateMerchantTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateMerchantTermsPayload }) =>
      updateMerchantTerms(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: merchantTermsKeys.all });
      toast.success("Conditions mises à jour");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Mise à jour impossible",
      });
    },
  });
}

export function useDeleteMerchantTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteMerchantTerms(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: merchantTermsKeys.all });
      toast.success("Conditions supprimées");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Suppression impossible",
      });
    },
  });
}
