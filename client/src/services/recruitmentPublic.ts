/**
 * Recruitment API — public landing (offres ouvertes, candidature)
 */

import { apiGet, apiPostMultipart } from "./api";
import type { ApiResponse } from "@/types/api";
import { ApiError } from "@/types/api";
import type { QuestionType } from "./recruitment";

const BASE = "/api/v1/recruitment";

export interface PublicJobOffer {
  id: number;
  title: string;
  type: string;
  description: string | null;
  location: string;
  slots: number;
}

export interface PublicJobQuestion {
  id: number;
  question_text: string;
  question_type: QuestionType;
  options: string[] | null;
  is_required: boolean;
  order_index: number;
}

export type TransportOption = "scooter" | "velo" | "voiture" | "apied";
export type AvailabilityOption = "plein" | "partiel" | "weekend";
export type EducationLevelOption = "bac" | "licence" | "master" | "doctorat";
export type SpokenLanguageOption = "francais" | "anglais";
export type YesNoOption = "oui" | "non";

export const SPOKEN_LANGUAGE_OPTIONS: {
  value: SpokenLanguageOption;
  label: string;
}[] = [
  { value: "francais", label: "Français" },
  { value: "anglais", label: "Anglais" },
];

export const YES_NO_OPTIONS: { value: YesNoOption; label: string }[] = [
  { value: "oui", label: "Oui" },
  { value: "non", label: "Non" },
];

export interface ApplyPayload {
  job_offer_id: number;
  full_name: string;
  phone: string;
  email: string;
  quartier: string;
  education_level: EducationLevelOption;
  field_of_study: string;
  school_name: string;
  languages: SpokenLanguageOption[];
  currently_employed: YesNoOption;
  in_other_company: YesNoOption;
  transport: TransportOption;
  availability: AvailabilityOption;
  photo: File;
  cv: File;
  cover_letter: File;
  answers: Array<{ question_id: number; answer_text: string }>;
}

export interface ApplyValidationField {
  field: string;
  messages: string[];
}

function unwrap<T>(response: ApiResponse<T>, fallback: string): T {
  if (!response.success || response.data === undefined) {
    throw new Error(response.error || response.message || fallback);
  }
  return response.data;
}

export async function getPublicJobs(): Promise<PublicJobOffer[]> {
  const res = await apiGet<PublicJobOffer[]>(`${BASE}/jobs`);
  const data = unwrap(res, "Impossible de charger les offres");
  return Array.isArray(data) ? data : [];
}

export async function getPublicJob(id: number): Promise<PublicJobOffer> {
  const res = await apiGet<PublicJobOffer>(`${BASE}/jobs/${id}`);
  return unwrap(res, "Offre introuvable ou fermée");
}

export async function getPublicJobQuestions(
  jobId: number
): Promise<PublicJobQuestion[]> {
  const res = await apiGet<PublicJobQuestion[]>(`${BASE}/jobs/${jobId}/questions`);
  const data = unwrap(res, "Impossible de charger les questions");
  return Array.isArray(data) ? data : [];
}

export async function submitApplication(
  payload: ApplyPayload
): Promise<{ id: number }> {
  const formData = new FormData();
  formData.append("job_offer_id", String(payload.job_offer_id));
  formData.append("full_name", payload.full_name.trim());
  formData.append("phone", payload.phone.trim());
  formData.append("email", payload.email.trim());
  formData.append("quartier", payload.quartier.trim());
  formData.append("education_level", payload.education_level);
  formData.append("field_of_study", payload.field_of_study.trim());
  formData.append("school_name", payload.school_name.trim());
  formData.append("languages", payload.languages.join(","));
  formData.append("currently_employed", payload.currently_employed);
  formData.append("in_other_company", payload.in_other_company);
  formData.append("transport", payload.transport);
  formData.append("availability", payload.availability);
  formData.append("answers", JSON.stringify(payload.answers));
  formData.append("photo", payload.photo);
  formData.append("cv", payload.cv);
  formData.append("cover_letter", payload.cover_letter);

  const res = await apiPostMultipart<{ id: number }>(`${BASE}/apply`, formData);
  return unwrap(res, "Impossible d'envoyer la candidature");
}

export function getApplyValidationFields(error: unknown): ApplyValidationField[] {
  if (!(error instanceof ApiError) || !error.data) return [];
  const invalidFields = error.data.invalidFields;
  if (!Array.isArray(invalidFields)) return [];
  return invalidFields.filter(
    (item): item is ApplyValidationField =>
      typeof item === "object" &&
      item !== null &&
      typeof (item as ApplyValidationField).field === "string"
  );
}
