/**
 * HR API — employees, enroll, attendances (super_admin)
 */

import { apiGet, apiPost, apiPatch, apiDelete } from "./api";
import { buildApiUrl } from "@/lib/api-config";
import { ApiError, type ApiResponse } from "@/types/api";

const BASE = "/api/v1/hr";

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || response.message || fallback);
  }
  return response.data;
}

export type HrEmployeeType = "livreur" | "agent";
export type HrContractKind = "cdi" | "cdd";
export type HrGender = "homme" | "femme";

export interface HrEmployee {
  id: number;
  full_name: string;
  email: string;
  personal_email: string | null;
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
  employee_type: HrEmployeeType | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  gender: HrGender | string | null;
  nationality: string | null;
  national_id: string | null;
  address: string | null;
  workplace_id: number | null;
  workplace_name?: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  work_schedule: string | null;
  contract_kind: HrContractKind | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  trial_period_days: number | null;
  mission_description: string | null;
  is_active: boolean;
  is_enrolled: boolean;
  enrolled_at: string | null;
  /** Latest work-contract / NDA status (roster list only). */
  contract_status?: HrContractStatus | null;
  nda_status?: HrContractStatus | null;
  created_at: string;
  updated_at: string;
}

export interface CreateHrEmployeePayload {
  full_name: string;
  email: string;
  personal_email?: string | null;
  phone?: string | null;
  poste?: string | null;
  salary_base?: number | null;
  /** When true, payroll mass starts on the 1st of next Douala month. */
  include_next_month?: boolean;
  employee_type?: HrEmployeeType | null;
  date_of_birth?: string | null;
  place_of_birth?: string | null;
  gender?: HrGender | null;
  nationality?: string | null;
  national_id?: string | null;
  address?: string | null;
  workplace_id?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relation?: string | null;
  work_schedule?: string | null;
  contract_kind?: HrContractKind | null;
  contract_start_date?: string | null;
  contract_end_date?: string | null;
  trial_period_days?: number | null;
  mission_description?: string | null;
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

export type HrContractStatus =
  | "generated"
  | "ready_for_signature"
  | "signed"
  | "declined"
  | "expired"
  | "cancelled";

/** Signable HR document kinds (server template families). */
export type HrDocumentType = "contrat" | "nda";

export const HR_DOCUMENT_TEMPLATE_KEYS: Record<HrDocumentType, string> = {
  contrat: "contrat_travail_v1",
  nda: "nda_v1",
};

export interface HrContract {
  id: number;
  employee_id: number;
  status: HrContractStatus;
  template_key: string;
  contract_date: string;
  document_file_name: string;
  document_sha256: string;
  ready_for_signature_at: string | null;
  signature_token_expires_at: string | null;
  signed_at: string | null;
  signature_consent: string | null;
  signed_document_sha256: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  has_signed_document: boolean;
  /** Public signing link — only while status is ready_for_signature. */
  signing_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface SendContractWhatsappResult {
  sent: boolean;
  recipient: string | null;
  message_id: string | null;
  signing_url: string;
  contract: HrContract;
  warning?: string | null;
}

export async function listEmployeeContracts(
  employeeId: number
): Promise<HrContract[]> {
  const res = await apiGet<HrContract[]>(
    `${BASE}/employees/${employeeId}/contracts`
  );
  return unwrap(res, "Impossible de charger les contrats");
}

/** French labels for the contract-required employee fields (422 errors). */
export const CONTRACT_FIELD_LABELS_FR: Record<string, string> = {
  full_name: "Nom complet",
  date_of_birth: "Date de naissance",
  place_of_birth: "Lieu de naissance",
  nationality: "Nationalité",
  national_id: "N° CNI / pièce d'identité",
  address: "Adresse",
  phone: "Téléphone",
  poste: "Poste",
  employee_type: "Type de personnel",
  contract_kind: "Type de contrat",
  contract_start_date: "Date de début du contrat",
  contract_end_date: "Date de fin du contrat (CDD)",
  trial_period_days: "Période d'essai (jours)",
  mission_description: "Missions",
  workplace_name: "Lieu de travail",
  work_schedule: "Horaires de travail",
  salary_base: "Salaire de base",
};

export function formatMissingContractFields(missing: string[]): string {
  const labels = missing.map((key) => CONTRACT_FIELD_LABELS_FR[key] || key);
  return `Champs manquants sur la fiche employé : ${labels.join(", ")}`;
}

/**
 * Generate the contract PDF from the employee's current data.
 * Throws with the French list of missing fields when employee data is
 * incomplete (HTTP 422 — the ApiError body carries `missing`).
 */
export async function generateEmployeeContract(
  employeeId: number,
  type: HrDocumentType = "contrat"
): Promise<HrContract> {
  try {
    const res = await apiPost<HrContract>(
      `${BASE}/employees/${employeeId}/contracts`,
      { type }
    );
    return unwrap(res, "Impossible de générer le document");
  } catch (err) {
    if (err instanceof ApiError && Array.isArray(err.data?.missing)) {
      throw new Error(
        formatMissingContractFields(err.data.missing as string[])
      );
    }
    throw err;
  }
}

export async function readyContractForSignature(
  contractId: number
): Promise<HrContract> {
  const res = await apiPost<HrContract>(
    `${BASE}/contracts/${contractId}/ready-for-signature`
  );
  return unwrap(res, "Impossible de préparer la signature");
}

export async function sendContractWhatsapp(
  contractId: number
): Promise<SendContractWhatsappResult> {
  const res = await apiPost<SendContractWhatsappResult>(
    `${BASE}/contracts/${contractId}/send-whatsapp`
  );
  return unwrap(res, "Impossible d'envoyer le lien de signature");
}

export async function cancelContract(contractId: number): Promise<HrContract> {
  const res = await apiPost<HrContract>(`${BASE}/contracts/${contractId}/cancel`);
  return unwrap(res, "Impossible d'annuler le contrat");
}

async function fetchContractPdfBlob(
  contractId: number,
  params?: { download?: boolean }
): Promise<{ blob: Blob; fileName: string }> {
  const qs = params?.download ? "?download=true" : "";
  const url = buildApiUrl(`${BASE}/contracts/${contractId}/document.pdf${qs}`);
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const data = await response.json();
      message = data.error || data.message || message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message || "Impossible de charger le contrat");
  }
  const disposition = response.headers.get("content-disposition") || "";
  const match = /filename="([^"]+)"/i.exec(disposition);
  const fileName = match?.[1] || `Contrat-${contractId}.pdf`;
  const blob = await response.blob();
  return { blob, fileName };
}

/** Load the contract PDF (signed version when available) for in-page preview. */
export async function previewContractPdf(
  contractId: number
): Promise<{ objectUrl: string; fileName: string }> {
  const { blob, fileName } = await fetchContractPdfBlob(contractId);
  const file = new File([blob], fileName, { type: "application/pdf" });
  return { objectUrl: URL.createObjectURL(file), fileName };
}

/** Trigger browser download of the contract PDF with the server filename. */
export async function downloadContractPdf(contractId: number): Promise<void> {
  const { blob, fileName } = await fetchContractPdfBlob(contractId, {
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

export interface HrWorkplace {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listWorkplaces(params?: {
  activeOnly?: boolean;
}): Promise<HrWorkplace[]> {
  const qs = params?.activeOnly ? "?active=true" : "";
  const res = await apiGet<HrWorkplace[]>(`${BASE}/workplaces${qs}`);
  return unwrap(res, "Impossible de charger les lieux de travail");
}

export async function createWorkplace(data: {
  name: string;
  is_active?: boolean;
}): Promise<HrWorkplace> {
  const res = await apiPost<HrWorkplace>(`${BASE}/workplaces`, data);
  return unwrap(res, "Impossible de créer le lieu de travail");
}

export async function updateWorkplace(
  id: number,
  data: { name?: string; is_active?: boolean }
): Promise<HrWorkplace> {
  const res = await apiPatch<HrWorkplace>(`${BASE}/workplaces/${id}`, data);
  return unwrap(res, "Impossible de mettre à jour le lieu de travail");
}

export async function deleteWorkplace(id: number): Promise<HrWorkplace> {
  const res = await apiDelete<HrWorkplace>(`${BASE}/workplaces/${id}`);
  return unwrap(res, "Impossible de désactiver le lieu de travail");
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

// ---------------------------------------------------------------------------
// Règlement intérieur — company documents, versions, acknowledgements
// ---------------------------------------------------------------------------

export type RegulationVersionStatus = "draft" | "published" | "archived";

export interface HrRegulation {
  id: number;
  doc_type: "internal_regulation" | "procedure" | "policy";
  title: string;
  slug: string;
  description: string | null;
  status: "active" | "archived";
  current_version_id: number | null;
  current_version_number: number | null;
  current_version_label: string | null;
  current_version_published_at: string | null;
  created_at: string;
  updated_at: string;
  stats?: {
    total_active_employees: number;
    read: number;
    not_read: number;
  } | null;
}

export interface HrRegulationVersion {
  id: number;
  document_id: number;
  version_number: number;
  version_label: string;
  status: RegulationVersionStatus;
  content_md?: string;
  content_html?: string;
  created_by: number | null;
  published_by: number | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  acknowledgement_count?: number;
}

export interface HrRegulationDetail extends HrRegulation {
  versions: HrRegulationVersion[];
}

export interface HrRegulationAckRow {
  employee_id: number;
  full_name: string;
  poste: string | null;
  status: "read" | "not_read";
  acknowledged_at: string | null;
}

export interface HrRegulationAcks {
  version: { id: number; version_label: string; published_at: string | null } | null;
  stats: {
    total_active_employees: number;
    read: number;
    not_read: number;
    completion_pct: number;
  } | null;
  employees: HrRegulationAckRow[];
}

export async function listRegulations(): Promise<HrRegulation[]> {
  const res = await apiGet<HrRegulation[]>(`${BASE}/regulations`);
  return unwrap(res, "Impossible de charger les règlements");
}

export async function createRegulation(data: {
  title: string;
  description?: string | null;
}): Promise<HrRegulation> {
  const res = await apiPost<HrRegulation>(`${BASE}/regulations`, data);
  return unwrap(res, "Impossible de créer le règlement");
}

export async function getRegulation(id: number): Promise<HrRegulationDetail> {
  const res = await apiGet<HrRegulationDetail>(`${BASE}/regulations/${id}`);
  return unwrap(res, "Impossible de charger le règlement");
}

export async function createRegulationVersion(
  regulationId: number,
  data?: { from_version_id?: number | null }
): Promise<HrRegulationVersion> {
  const res = await apiPost<HrRegulationVersion>(
    `${BASE}/regulations/${regulationId}/versions`,
    data ?? {}
  );
  return unwrap(res, "Impossible de créer la version");
}

export async function getRegulationVersion(
  versionId: number
): Promise<HrRegulationVersion> {
  const res = await apiGet<HrRegulationVersion>(
    `${BASE}/regulation-versions/${versionId}`
  );
  return unwrap(res, "Impossible de charger la version");
}

export async function updateRegulationVersion(
  versionId: number,
  content_md: string
): Promise<HrRegulationVersion> {
  const res = await apiPatch<HrRegulationVersion>(
    `${BASE}/regulation-versions/${versionId}`,
    { content_md }
  );
  return unwrap(res, "Impossible d'enregistrer le brouillon");
}

export async function publishRegulationVersion(
  versionId: number
): Promise<HrRegulationVersion> {
  const res = await apiPost<HrRegulationVersion>(
    `${BASE}/regulation-versions/${versionId}/publish`
  );
  return unwrap(res, "Impossible de publier la version");
}

export async function getRegulationAcknowledgements(
  regulationId: number,
  status: "all" | "read" | "not_read" = "all"
): Promise<HrRegulationAcks> {
  const res = await apiGet<HrRegulationAcks>(
    `${BASE}/regulations/${regulationId}/acknowledgements?status=${status}`
  );
  return unwrap(res, "Impossible de charger le suivi de lecture");
}
