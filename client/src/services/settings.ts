/**
 * App settings — company branding + personal profile (super_admin)
 */

import { apiGet, apiPut, apiPatch } from "./api";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1/settings";

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || response.message || fallback);
  }
  return response.data;
}

export interface CompanySettings {
  company_name: string;
  legal_name: string;
  tax_id: string | null;
  trade_register: string | null;
  address: string;
  phone: string;
  email: string;
  accent_color: string;
  logo_base64: string | null;
  stamp_base64: string | null;
  updated_at: string | null;
}

export type UpdateCompanySettingsPayload = {
  company_name: string;
  legal_name?: string | null;
  tax_id?: string | null;
  trade_register?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  accent_color?: string;
  logo_base64?: string | null;
  stamp_base64?: string | null;
};

export interface MyProfile {
  name: string;
  email: string;
  fonction: string | null;
  signature_base64: string | null;
}

export type UpdateMyProfilePayload = {
  name: string;
  fonction?: string | null;
  signature_base64?: string | null;
};

export async function getCompanySettings(): Promise<CompanySettings> {
  const res = await apiGet<CompanySettings>(`${BASE}/company`);
  return unwrap(res, "Impossible de charger les paramètres société");
}

export async function updateCompanySettings(
  data: UpdateCompanySettingsPayload
): Promise<CompanySettings> {
  const res = await apiPut<CompanySettings>(`${BASE}/company`, data);
  return unwrap(res, "Impossible d'enregistrer les paramètres société");
}

export async function getMyProfile(): Promise<MyProfile> {
  const res = await apiGet<MyProfile>(`${BASE}/me`);
  return unwrap(res, "Impossible de charger le profil");
}

export async function updateMyProfile(
  data: UpdateMyProfilePayload
): Promise<MyProfile> {
  const res = await apiPatch<MyProfile>(`${BASE}/me`, data);
  return unwrap(res, "Impossible d'enregistrer le profil");
}
