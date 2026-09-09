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
  type CreateHrEmployeePayload,
  type UpdateHrEmployeePayload,
  type ListAttendancesParams,
  type ManualAttendancePayload,
} from "@/services/hr";

export const hrKeys = {
  all: ["hr"] as const,
  employees: ["hr", "employees"] as const,
  attendances: (filters: ListAttendancesParams) =>
    ["hr", "attendances", filters] as const,
  summary: (month: number, year: number) =>
    ["hr", "summary", month, year] as const,
};

export function useHrEmployees() {
  const result = useQuery({
    queryKey: hrKeys.employees,
    queryFn: () => listEmployees(),
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
      toast.success("Présence enregistrée");
    },
    onError: (e: unknown) => {
      toast.error("Erreur", {
        description:
          e instanceof Error ? e.message : "Enregistrement impossible",
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
