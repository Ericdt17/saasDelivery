/**
 * HR API — employees, enroll, attendances (super_admin)
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import type { ApiResponse } from "@/types/api";

const BASE = "/api/v1/hr";

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || response.message || fallback);
  }
  return response.data;
}

export interface HrEmployee {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  poste: string | null;
  salary_base: number | null;
  is_active: boolean;
  is_enrolled: boolean;
  enrolled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHrEmployeePayload {
  full_name: string;
  email: string;
  phone?: string | null;
  poste?: string | null;
  salary_base?: number | null;
}

export type UpdateHrEmployeePayload = Partial<CreateHrEmployeePayload> & {
  is_active?: boolean;
};

export interface HrAttendance {
  id: number;
  employee_id: number;
  date: string;
  check_in_time: string | null;
  status: "present" | "late" | "absent";
  face_verified: boolean;
  gps_verified: boolean;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
  full_name: string;
  email: string;
  poste: string | null;
}

export interface HrAttendanceSummary {
  employee_id: number;
  full_name: string;
  email: string;
  poste: string | null;
  days_present: number;
  days_late: number;
  days_absent: number;
  weekdays_elapsed: number;
}

export interface ListAttendancesParams {
  employee_id?: number;
  date?: string;
  month?: number;
  year?: number;
}

export interface ManualAttendancePayload {
  employee_id: number;
  date: string;
  status: "present" | "late" | "absent";
}

export async function listEmployees(): Promise<HrEmployee[]> {
  const res = await apiGet<HrEmployee[]>(`${BASE}/employees`);
  return unwrap(res, "Impossible de charger les employés");
}

export async function createEmployee(
  data: CreateHrEmployeePayload
): Promise<HrEmployee> {
  const res = await apiPost<HrEmployee>(`${BASE}/employees`, data);
  return unwrap(res, "Impossible de créer l'employé");
}

export async function updateEmployee(
  id: number,
  data: UpdateHrEmployeePayload
): Promise<HrEmployee> {
  const res = await apiPatch<HrEmployee>(`${BASE}/employees/${id}`, data);
  return unwrap(res, "Impossible de mettre à jour l'employé");
}

export async function deleteEmployee(id: number): Promise<HrEmployee> {
  const res = await apiDelete<HrEmployee>(`${BASE}/employees/${id}`);
  return unwrap(res, "Impossible de supprimer l'employé");
}

export async function enrollEmployeeFace(
  id: number,
  face_descriptor: number[]
): Promise<HrEmployee> {
  const res = await apiPost<HrEmployee>(`${BASE}/employees/${id}/enroll`, {
    face_descriptor,
  });
  return unwrap(res, "Impossible d'enregistrer le visage");
}

export async function listAttendances(
  params: ListAttendancesParams = {}
): Promise<HrAttendance[]> {
  const res = await apiGet<HrAttendance[]>(`${BASE}/attendances`, {
    employee_id: params.employee_id,
    date: params.date,
    month: params.month,
    year: params.year,
  });
  return unwrap(res, "Impossible de charger les présences");
}

export async function createManualAttendance(
  data: ManualAttendancePayload
): Promise<HrAttendance> {
  const res = await apiPost<HrAttendance>(`${BASE}/attendances`, data);
  return unwrap(res, "Impossible d'enregistrer la présence manuelle");
}

export async function getAttendancesSummary(params: {
  month: number;
  year: number;
}): Promise<HrAttendanceSummary[]> {
  const res = await apiGet<HrAttendanceSummary[]>(`${BASE}/attendances/summary`, {
    month: params.month,
    year: params.year,
  });
  return unwrap(res, "Impossible de charger le résumé des présences");
}
