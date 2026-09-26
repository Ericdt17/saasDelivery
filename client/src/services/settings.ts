/**
 * App settings — company branding (super_admin)
 */

import { apiGet, apiPut } from "./api";
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
