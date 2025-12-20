/**
 * Tariffs Service
 * API calls for tariff management (pricing per quartier/neighborhood)
 */

import { apiGet, apiPost, apiPut, apiDelete } from "./api";

export interface Tariff {
  id: number;
  agency_id: number;
  quartier: string;
  tarif_amount: number;
  created_at: string;
  updated_at: string;
  agency_name?: string; // Optional, included when joined with agencies table
}

export interface CreateTariffRequest {
  agency_id?: number; // Optional for agency admins (auto-assigned), required for super admin
  quartier: string;
  tarif_amount: number;
}

export interface UpdateTariffRequest {
  quartier?: string;
  tarif_amount?: number;
}

/**
 * Get all tariffs (filtered by agency for agency admins, all for super admin)
 */
export async function getTariffs(): Promise<Tariff[]> {
  const response = await apiGet<Tariff[]>("/api/v1/tariffs");
  if (response.success && response.data) {
    return Array.isArray(response.data) ? response.data : [];
  }
  return [];
}

/**
 * Get tariff by ID
 */
export async function getTariffById(id: number): Promise<Tariff | null> {
  const response = await apiGet<Tariff>(`/api/v1/tariffs/${id}`);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Create new tariff
 */
export async function createTariff(data: CreateTariffRequest): Promise<Tariff | null> {
  const response = await apiPost<Tariff>("/api/v1/tariffs", data);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Update tariff
 */
export async function updateTariff(
  id: number,
  data: UpdateTariffRequest
): Promise<Tariff | null> {
  const response = await apiPut<Tariff>(`/api/v1/tariffs/${id}`, data);
  if (response.success && response.data) {
    return response.data;
  }
  return null;
}

/**
 * Delete tariff
 */
export async function deleteTariff(id: number): Promise<boolean> {
  const response = await apiDelete(`/api/v1/tariffs/${id}`);
  return response.success;
}

/**
 * Format tariff amount as currency
 */
export function formatTariffAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount) + " F";
}

