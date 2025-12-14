/**
 * Agencies Service
 * API calls for agency management (super admin only)
 */

import { apiGet, apiPost, apiPut, apiDelete } from "./api";

export interface Agency {
  id: number;
  name: string;
  email: string;
  agency_code: string | null;
  role: "agency" | "super_admin";
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAgencyRequest {
  name: string;
  email: string;
  password: string;
  role?: "agency" | "super_admin";
  is_active?: boolean;
  agency_code?: string | null;
}

export interface UpdateAgencyRequest {
  name?: string;
  email?: string;
  password?: string;
  role?: "agency" | "super_admin";
  is_active?: boolean;
  agency_code?: string | null;
}

/**
 * Get all agencies
 */
export async function getAgencies(): Promise<Agency[]> {
  const response = await apiGet<Agency[]>("/api/v1/agencies");
  if (response.success && response.data) {
    return Array.isArray(response.data) ? response.data : [];
  }
  return [];
}

/**
 * Get agency by ID
 */
export async function getAgencyById(id: number): Promise<Agency | null> {
  const response = await apiGet<Agency>(`/api/v1/agencies/${id}`);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Create new agency
 */
export async function createAgency(data: CreateAgencyRequest): Promise<Agency | null> {
  const response = await apiPost<Agency>("/api/v1/agencies", data);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Update agency
 */
export async function updateAgency(
  id: number,
  data: UpdateAgencyRequest
): Promise<Agency | null> {
  const response = await apiPut<Agency>(`/api/v1/agencies/${id}`, data);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Delete agency (soft delete)
 */
export async function deleteAgency(id: number): Promise<boolean> {
  const response = await apiDelete(`/api/v1/agencies/${id}`);
  return response.success;
}

/**
 * Generate a random agency code
 * Format: Alphanumeric, 6-8 characters
 * Pattern: Random uppercase letters and numbers
 * @returns {string} - Generated agency code
 */
export function generateAgencyCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  // Generate 6-8 character code
  const length = 6 + Math.floor(Math.random() * 3); // 6, 7, or 8 characters
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}



