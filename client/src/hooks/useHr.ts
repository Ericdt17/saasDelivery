/**
 * React Query hooks — module RH (super_admin)
 */

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  enrollEmployeeFace,
  listAttendances,
  getAttendancesSummary,
  createManualAttendance,
  listWorkplaces,
  createWorkplace,
  updateWorkplace,
  deleteWorkplace,
  listEmployeeContracts,
  generateEmployeeContract,
  readyContractForSignature,
  sendContractWhatsapp,
  cancelContract,
  listRegulations,
  createRegulation,
  getRegulation,
  createRegulationVersion,
  getRegulationVersion,
  updateRegulationVersion,
  publishRegulationVersion,
  getRegulationAcknowledgements,
  type CreateHrEmployeePayload,
  type UpdateHrEmployeePayload,
  type ListAttendancesParams,
  type ManualAttendancePayload,
  type HrDocumentType,
} from "@/services/hr";

export const hrKeys = {
  all: ["hr"] as const,
  employees: ["hr", "employees"] as const,
  employeesForMonth: (year: number, month: number) =>
    ["hr", "employees", year, month] as const,
  attendances: (filters: ListAttendancesParams) =>
    ["hr", "attendances", filters] as const,
  summary: (month: number, year: number) =>
    ["hr", "summary", month, year] as const,
  workplaces: ["hr", "workplaces"] as const,
  workplacesActive: ["hr", "workplaces", "active"] as const,
  contracts: (employeeId: number) =>
    ["hr", "contracts", employeeId] as const,
  regulations: ["hr", "regulations"] as const,
  regulation: (id: number) => ["hr", "regulations", id] as const,
  regulationVersion: (versionId: number) =>
    ["hr", "regulations", "version", versionId] as const,
  regulationAcks: (id: number, status: string) =>
    ["hr", "regulations", id, "acks", status] as const,
};

export function useHrEmployees(params?: { year?: number; month?: number }) {
  const year = params?.year;
  const month = params?.month;
  const scoped = year != null && month != null;
  const result = useQuery({
    queryKey: scoped
      ? hrKeys.employeesForMonth(year, month)
      : hrKeys.employees,
    queryFn: () =>
      listEmployees(scoped ? { year, month } : undefined),
    retry: 2,
    staleTime: 10000,
  });

  useEffect(() => {
    if (result.isError) {
      const msg = result.error instanceof Error ? result.error.message : "Erreur";
      toast.error("Erreur lors du chargement des employés", { description: msg });
    }
  }, [result.isError, result.error]);

  return result;
}

export function useCreateHrEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHrEmployeePayload) => createEmployee(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.employees });
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
      qc.invalidateQueries({ queryKey: ["hr", "summary"] });
      toast.success("Employé créé");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Création impossible",
      });
    },
  });
}

export function useUpdateHrEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateHrEmployeePayload }) =>
      updateEmployee(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.employees });
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
      qc.invalidateQueries({ queryKey: ["hr", "attendances"] });
      qc.invalidateQueries({ queryKey: ["hr", "summary"] });
      toast.success("Employé mis à jour");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Mise à jour impossible",
      });
    },
  });
}

export function useDeleteHrEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteEmployee(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.employees });
      qc.invalidateQueries({ queryKey: ["hr", "employees"] });
      qc.invalidateQueries({ queryKey: ["hr", "attendances"] });
      qc.invalidateQueries({ queryKey: ["hr", "summary"] });
      toast.success("Employé désactivé");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Suppression impossible",
      });
    },
  });
}

export function useEnrollHrEmployeeFace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      face_descriptor,
    }: {
      id: number;
      face_descriptor: number[];
    }) => enrollEmployeeFace(id, face_descriptor),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.employees });
      toast.success("Visage enregistré");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description: e instanceof Error ? e.message : "Enrollment impossible",
      });
    },
  });
}

export function useHrAttendances(filters: ListAttendancesParams) {
  const enabled =
    Boolean(filters.date) ||
    (filters.month != null && filters.year != null);
  const result = useQuery({
    queryKey: hrKeys.attendances(filters),
    queryFn: () => listAttendances(filters),
    enabled,
    retry: 2,
    staleTime: 10000,
  });

  useEffect(() => {
    if (result.isError) {
      const msg = result.error instanceof Error ? result.error.message : "Erreur";
      toast.error("Erreur lors du chargement des présences", { description: msg });
    }
  }, [result.isError, result.error]);

  return result;
}

export function useCreateManualAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: ManualAttendancePayload) => createManualAttendance(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr", "attendances"] });
      qc.invalidateQueries({ queryKey: ["hr", "summary"] });
      toast.success("Présence mise à jour");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description:
          e instanceof Error ? e.message : "Mise à jour impossible",
      });
    },
  });
}

export function useHrAttendancesSummary(month: number, year: number) {
  const result = useQuery({
    queryKey: hrKeys.summary(month, year),
    queryFn: () => getAttendancesSummary({ month, year }),
    enabled: Number.isFinite(month) && Number.isFinite(year),
    retry: 2,
    staleTime: 10000,
  });

  useEffect(() => {
    if (result.isError) {
      const msg = result.error instanceof Error ? result.error.message : "Erreur";
      toast.error("Erreur lors du chargement du résumé", { description: msg });
    }
  }, [result.isError, result.error]);

  return result;
}

export function useHrWorkplaces(params?: { activeOnly?: boolean }) {
  const activeOnly = params?.activeOnly === true;
  return useQuery({
    queryKey: activeOnly ? hrKeys.workplacesActive : hrKeys.workplaces,
    queryFn: () => listWorkplaces({ activeOnly }),
    staleTime: 30000,
  });
}

export function useCreateHrWorkplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; is_active?: boolean }) =>
      createWorkplace(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hrKeys.workplaces });
      queryClient.invalidateQueries({ queryKey: hrKeys.workplacesActive });
      toast.success("Lieu de travail créé");
    },
    onError: (e: unknown) => {
      toast.error("Création impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useUpdateHrWorkplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: number;
      data: { name?: string; is_active?: boolean };
    }) => updateWorkplace(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hrKeys.workplaces });
      queryClient.invalidateQueries({ queryKey: hrKeys.workplacesActive });
      toast.success("Lieu de travail mis à jour");
    },
    onError: (e: unknown) => {
      toast.error("Mise à jour impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useHrEmployeeContracts(employeeId: number) {
  return useQuery({
    queryKey: hrKeys.contracts(employeeId),
    queryFn: () => listEmployeeContracts(employeeId),
    enabled: Number.isFinite(employeeId) && employeeId > 0,
    staleTime: 10000,
  });
}

export function useGenerateHrContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      employeeId,
      type,
    }: {
      employeeId: number;
      type?: HrDocumentType;
    }) => generateEmployeeContract(employeeId, type ?? "contrat"),
    onSuccess: (_data, { employeeId, type }) => {
      qc.invalidateQueries({ queryKey: hrKeys.contracts(employeeId) });
      toast.success(type === "nda" ? "NDA généré" : "Contrat généré");
    },
    onError: (e: unknown) => {
      toast.error("Génération impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useReadyHrContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: number) => readyContractForSignature(contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.contracts(employeeId) });
      toast.success("Lien de signature créé (valable 30 jours)");
    },
    onError: (e: unknown) => {
      toast.error("Préparation impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useSendHrContractWhatsapp(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: number) => sendContractWhatsapp(contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.contracts(employeeId) });
      toast.success("Lien de signature envoyé sur WhatsApp");
    },
    onError: (e: unknown) => {
      toast.error("Envoi impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useCancelHrContract(employeeId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contractId: number) => cancelContract(contractId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: hrKeys.contracts(employeeId) });
      toast.success("Contrat annulé");
    },
    onError: (e: unknown) => {
      toast.error("Annulation impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useDeleteHrWorkplace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteWorkplace(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: hrKeys.workplaces });
      queryClient.invalidateQueries({ queryKey: hrKeys.workplacesActive });
      toast.success("Lieu de travail désactivé");
    },
    onError: (e: unknown) => {
      toast.error("Désactivation impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

// ---------------------------------------------------------------------------
// Règlement intérieur
// ---------------------------------------------------------------------------

export function useHrRegulations() {
  return useQuery({
    queryKey: hrKeys.regulations,
    queryFn: () => listRegulations(),
    staleTime: 10000,
  });
}

export function useHrRegulation(id: number | null) {
  return useQuery({
    queryKey: hrKeys.regulation(id ?? 0),
    queryFn: () => getRegulation(id as number),
    enabled: id != null && id > 0,
    staleTime: 5000,
  });
}

export function useHrRegulationVersion(versionId: number | null) {
  return useQuery({
    queryKey: hrKeys.regulationVersion(versionId ?? 0),
    queryFn: () => getRegulationVersion(versionId as number),
    enabled: versionId != null && versionId > 0,
    staleTime: 0,
  });
}

export function useHrRegulationAcks(
  id: number | null,
  status: "all" | "read" | "not_read"
) {
  return useQuery({
    queryKey: hrKeys.regulationAcks(id ?? 0, status),
    queryFn: () => getRegulationAcknowledgements(id as number, status),
    enabled: id != null && id > 0,
    staleTime: 10000,
  });
}

function invalidateRegulations(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["hr", "regulations"] });
}

export function useCreateHrRegulation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; description?: string | null }) =>
      createRegulation(data),
    onSuccess: () => {
      invalidateRegulations(qc);
      toast.success("Règlement créé");
    },
    onError: (e: unknown) => {
      toast.error("Création impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useCreateHrRegulationVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (regulationId: number) =>
      createRegulationVersion(regulationId),
    onSuccess: () => {
      invalidateRegulations(qc);
      toast.success("Nouvelle version (brouillon) créée");
    },
    onError: (e: unknown) => {
      toast.error("Création impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function useUpdateHrRegulationVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      versionId,
      content_md,
    }: {
      versionId: number;
      content_md: string;
    }) => updateRegulationVersion(versionId, content_md),
    onSuccess: () => {
      invalidateRegulations(qc);
      toast.success("Brouillon enregistré");
    },
    onError: (e: unknown) => {
      toast.error("Enregistrement impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}

export function usePublishHrRegulationVersion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (versionId: number) => publishRegulationVersion(versionId),
    onSuccess: () => {
      invalidateRegulations(qc);
      toast.success("Version publiée — les employés devront en prendre connaissance");
    },
    onError: (e: unknown) => {
      toast.error("Publication impossible", {
        description: e instanceof Error ? e.message : "Erreur",
      });
    },
  });
}
