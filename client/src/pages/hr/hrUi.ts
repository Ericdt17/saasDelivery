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
