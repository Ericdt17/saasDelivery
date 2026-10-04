/**
 * HR API — employees, enroll, attendances (super_admin)
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import { buildApiUrl } from "@/lib/api-config";
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
  /** YYYY-MM-01 — first month included in payroll mass. */
  payroll_eligible_from: string;
  /** Next scheduled rise/drop after the current Douala month, if any. */
  salary_scheduled?: {
    amount: number | null;
    effective_from: string;
  } | null;
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
  /** When true, payroll mass starts on the 1st of next Douala month. */
  include_next_month?: boolean;
}

export type UpdateHrEmployeePayload = Partial<CreateHrEmployeePayload> & {
  is_active?: boolean;
  /** When true, salary change applies this Douala month; default next month. */
  salary_apply_this_month?: boolean;
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

/** Mirrors server `payslipFileName` so preview URLs end with the real download name. */
export function buildPayslipFileName(
  employee: { id: number; full_name?: string | null },
  year: number,
  month: number
): string {
  const raw = String(employee.full_name || `employe-${employee.id}`)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const ym = `${year}-${String(month).padStart(2, "0")}`;
  return `Bulletin-paie-${raw || "employe"}-${ym}.pdf`;
}

export function getPayslipPdfUrl(
  employeeId: number,
  params: {
    month: number;
    year: number;
    download?: boolean;
    /** When set, path ends with this name so the PDF viewer download keeps it. */
    fileName?: string;
  }
): string {
  const qs = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
    download: params.download ? "true" : "false",
  });
  const path = params.fileName
    ? `${BASE}/employees/${employeeId}/payslip/${encodeURIComponent(params.fileName)}`
    : `${BASE}/employees/${employeeId}/payslip.pdf`;
  return buildApiUrl(`${path}?${qs}`);
}

async function fetchPayslipPdfBlob(
  employeeId: number,
  params: { month: number; year: number; download?: boolean; fileName?: string }
): Promise<{ blob: Blob; fileName: string }> {
  const url = getPayslipPdfUrl(employeeId, params);
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.error || data.message || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message || "Impossible de générer le bulletin de paie");
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const fileName =
    match?.[1] ||
    params.fileName ||
    `Bulletin-paie-${params.year}-${String(params.month).padStart(2, "0")}.pdf`;
  const blob = await response.blob();
  return { blob, fileName };
}

/**
 * Load PDF for in-page preview (blob URL — works despite X-Frame-Options on API).
 * Use dialog "Télécharger" (or downloadPayslipPdf) for the canonical filename.
 */
export async function previewPayslipPdf(
  employeeId: number,
  params: { month: number; year: number; fileName?: string }
): Promise<{ objectUrl: string; fileName: string }> {
  const { blob, fileName } = await fetchPayslipPdfBlob(employeeId, {
    ...params,
    download: false,
  });
  const file = new File([blob], fileName, { type: "application/pdf" });
  return { objectUrl: URL.createObjectURL(file), fileName };
}

/** Trigger browser download with the server filename. */
export async function downloadPayslipPdf(
  employeeId: number,
  params: { month: number; year: number; fileName?: string }
): Promise<void> {
  const { blob, fileName } = await fetchPayslipPdfBlob(employeeId, {
    ...params,
    download: true,
  });
  const objectUrl = URL.createObjectURL(
    new File([blob], fileName, { type: "application/pdf" })
  );
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export interface SendPayslipWhatsappResult {
  sent: boolean;
  recipient: string | null;
  message_id: string | null;
  filename: string;
}

/** Generate payslip PDF and send it as a WhatsApp DM to the employee. */
export async function sendPayslipWhatsapp(
  employeeId: number,
  params: { month: number; year: number }
): Promise<SendPayslipWhatsappResult> {
  const qs = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  const res = await apiPost<SendPayslipWhatsappResult>(
    `${BASE}/employees/${employeeId}/payslip/send-whatsapp?${qs}`
  );
  return unwrap(res, "Impossible d'envoyer le bulletin sur WhatsApp");
}

export async function listEmployees(params?: {
  year?: number;
  month?: number;
}): Promise<HrEmployee[]> {
  const qs = new URLSearchParams();
  if (params?.year != null && params?.month != null) {
    qs.set("year", String(params.year));
    qs.set("month", String(params.month));
  }
  const suffix = qs.toString() ? `?${qs}` : "";
  const res = await apiGet<HrEmployee[]>(`${BASE}/employees${suffix}`);
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
