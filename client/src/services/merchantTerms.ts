/**
 * Merchant terms API — conditions marchands (super_admin)
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1/merchant-terms";

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || response.message || fallback);
  }
  return response.data;
}

export interface MerchantTerms {
  id: number;
  title: string;
  content: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateMerchantTermsPayload {
  title: string;
  content?: string | null;
  is_active?: boolean;
}

export type UpdateMerchantTermsPayload = Partial<CreateMerchantTermsPayload>;

export async function getMerchantTermsList(): Promise<MerchantTerms[]> {
  const res = await apiGet<MerchantTerms[]>(BASE);
  return unwrap(res, "Impossible de charger les conditions marchands");
}

export async function createMerchantTerms(
  data: CreateMerchantTermsPayload
): Promise<MerchantTerms> {
  const res = await apiPost<MerchantTerms>(BASE, data);
  return unwrap(res, "Impossible de créer les conditions");
}

export async function updateMerchantTerms(
  id: number,
  data: UpdateMerchantTermsPayload
): Promise<MerchantTerms> {
  const res = await apiPatch<MerchantTerms>(`${BASE}/${id}`, data);
  return unwrap(res, "Impossible de mettre à jour les conditions");
}

export async function deleteMerchantTerms(id: number): Promise<{ id: number }> {
  const res = await apiDelete<{ id: number }>(`${BASE}/${id}`);
  return unwrap(res, "Impossible de supprimer les conditions");
}
