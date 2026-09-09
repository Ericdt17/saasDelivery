/**
 * Pure UI helpers for HR admin pages (testable without React).
 */

export type AttendanceStatus = "present" | "late" | "absent";

export function enrollmentBadgeLabel(isEnrolled: boolean): "Enregistré" | "En attente" {
  return isEnrolled ? "Enregistré" : "En attente";
}

export function enrollmentBadgeVariant(
  isEnrolled: boolean
): "default" | "secondary" {
  return isEnrolled ? "default" : "secondary";
}

export function attendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "Présent";
    case "late":
      return "En retard";
    case "absent":
      return "Absent";
    default:
      return status;
  }
}

export function attendanceStatusClassName(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "bg-green-600 hover:bg-green-600";
    case "late":
      return "bg-orange-500 hover:bg-orange-500";
    case "absent":
      return "bg-red-600 hover:bg-red-600";
    default:
      return "";
  }
}

export function formatCheckInTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function formatAttendanceDate(date: string): string {
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString("fr-FR", {
      dateStyle: "medium",
    });
  } catch {
    return date;
  }
}

export function formatSalary(salaryBase: number | null): string {
  if (salaryBase == null) return "—";
  return new Intl.NumberFormat("fr-FR").format(salaryBase);
}

export type EmployeeFormFields = {
  fullName: string;
  email: string;
  phone: string;
  poste: string;
  salaryBase: string;
  isActive: boolean;
};

export function buildEmployeeUpdatePayload(fields: EmployeeFormFields): {
  full_name: string;
  email: string;
  phone: string | null;
  poste: string | null;
  salary_base: number | null;
  is_active: boolean;
} {
  const salaryParsed =
    fields.salaryBase.trim() === "" ? NaN : Number(fields.salaryBase);
  return {
    full_name: fields.fullName.trim(),
    email: fields.email.trim(),
    phone: fields.phone.trim() || null,
    poste: fields.poste.trim() || null,
    salary_base:
      Number.isFinite(salaryParsed) ? Math.trunc(salaryParsed) : null,
    is_active: fields.isActive,
  };
}

/** True when neither face nor GPS was verified (admin manual entry). */
export function isManualAttendance(row: {
  face_verified: boolean;
  gps_verified: boolean;
}): boolean {
  return !row.face_verified && !row.gps_verified;
}

/** YYYY-MM-DD in Africa/Douala (matches server check-in calendar day). */
export function todayDateStringDouala(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Douala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/**
 * Show admin "mark present" when the employee has not checked in,
 * or checked in late (upgrade to present).
 */
export function canMarkPresentManually(
  status: AttendanceStatus | null | undefined
): boolean {
  return status == null || status === "absent" || status === "late";
}

export type DayEmployeeRow = {
  employee_id: number;
  full_name: string;
  email: string;
  poste: string | null;
  status: AttendanceStatus;
  check_in_time: string | null;
  face_verified: boolean;
  gps_verified: boolean;
  attendance_id: number | null;
};

export function buildDayAttendanceRows(
  employees: Array<{
    id: number;
    full_name: string;
    email: string;
    poste: string | null;
    is_active: boolean;
  }>,
  attendances: Array<{
    id: number;
    employee_id: number;
    status: AttendanceStatus;
    check_in_time: string | null;
    face_verified: boolean;
    gps_verified: boolean;
  }>
): DayEmployeeRow[] {
  const byEmployee = new Map(
    attendances.map((a) => [a.employee_id, a] as const)
  );
  return employees
    .filter((e) => e.is_active)
    .map((e) => {
      const a = byEmployee.get(e.id);
      return {
        employee_id: e.id,
        full_name: e.full_name,
        email: e.email,
        poste: e.poste,
        status: (a?.status ?? "absent") as AttendanceStatus,
        check_in_time: a?.check_in_time ?? null,
        face_verified: a?.face_verified ?? false,
        gps_verified: a?.gps_verified ?? false,
        attendance_id: a?.id ?? null,
      };
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name, "fr"));
}


