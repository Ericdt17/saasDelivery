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
      return "En retard (½ j)";
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

/**
 * Recover YYYY-MM-DD from a JS Date that may be a timezone-shifted SQL DATE.
 * node-pg used to parse DATE as local midnight; JSON then emits previous UTC evening
 * (e.g. 2026-09-08 → 2026-09-07T22:00:00.000Z in UTC+2). UTC runners keep T00:00:00.000Z.
 */
function calendarDateFromPossiblyShiftedInstant(d: Date): string {
  const ms =
    d.getUTCHours() >= 12
      ? d.getTime() + 24 * 60 * 60 * 1000
      : d.getTime();
  const fixed = new Date(ms);
  const y = fixed.getUTCFullYear();
  const m = String(fixed.getUTCMonth() + 1).padStart(2, "0");
  const day = String(fixed.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Normalize attendance `date` from API (YYYY-MM-DD or ISO timestamp).
 * Timezone-independent — safe on UTC CI and local UTC+N machines.
 */
export function normalizeAttendanceDate(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const dateOnly = /^(\d{4}-\d{2}-\d{2})$/.exec(trimmed);
    if (dateOnly) return dateOnly[1];
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return calendarDateFromPossiblyShiftedInstant(parsed);
    }
    const prefix = /^(\d{4}-\d{2}-\d{2})/.exec(trimmed);
    return prefix ? prefix[1] : trimmed;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return calendarDateFromPossiblyShiftedInstant(value);
  }
  return String(value).slice(0, 10);
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

/** Current calendar month/year in Africa/Douala. */
export function currentMonthYearDouala(now = new Date()): {
  year: number;
  month: number;
} {
  const today = todayDateStringDouala(now);
  return {
    year: Number(today.slice(0, 4)),
    month: Number(today.slice(5, 7)),
  };
}

/** Value for `<input type="month">` (YYYY-MM). */
export function monthInputValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Parse YYYY-MM from a month input; null if invalid. */
export function parseMonthInput(
  value: string
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || month < 1 || month > 12) return null;
  return { year, month };
}

/** French label e.g. "septembre 2026". */
export function formatMonthLabelFr(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
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

/** True when admin can set this status (different from current). */
export function canSetAttendanceStatus(
  current: AttendanceStatus | null | undefined,
  target: AttendanceStatus
): boolean {
  const normalized = current ?? "absent";
  return normalized !== target;
}

/**
 * Mon–Sat YYYY-MM-DD dates in `year`/`month` up to `asOfDate` (inclusive).
 * Past months: all workdays. Future months: empty.
 */
export function listWorkdaysInMonth(
  year: number,
  month: number,
  asOfDate = todayDateStringDouala()
): string[] {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return [];
  }
  const [asOfY, asOfM, asOfD] = asOfDate.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  let endDay: number;
  if (asOfY < year || (asOfY === year && asOfM < month)) {
    return [];
  }
  if (asOfY > year || (asOfY === year && asOfM > month)) {
    endDay = lastDay;
  } else {
    endDay = Math.min(lastDay, asOfD);
  }

  const dates: string[] = [];
  for (let d = 1; d <= endDay; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (dow === 0) continue;
    dates.push(
      `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    );
  }
  return dates;
}

export type MonthDayAttendanceRow = {
  date: string;
  status: AttendanceStatus;
  check_in_time: string | null;
  face_verified: boolean;
  gps_verified: boolean;
  attendance_id: number | null;
};

/** One row per workday (elapsed), defaulting missing records to absent. */
export function buildEmployeeMonthDayRows(
  year: number,
  month: number,
  attendances: Array<{
    id: number;
    date: string;
    status: AttendanceStatus;
    check_in_time: string | null;
    face_verified: boolean;
    gps_verified: boolean;
  }>,
  asOfDate = todayDateStringDouala()
): MonthDayAttendanceRow[] {
  const byDate = new Map(
    attendances.map((a) => [normalizeAttendanceDate(a.date), a] as const)
  );
  return listWorkdaysInMonth(year, month, asOfDate)
    .map((date) => {
      const a = byDate.get(date);
      return {
        date,
        status: (a?.status ?? "absent") as AttendanceStatus,
        check_in_time: a?.check_in_time ?? null,
        face_verified: a?.face_verified ?? false,
        gps_verified: a?.gps_verified ?? false,
        attendance_id: a?.id ?? null,
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
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

export type HrDashboardStats = {
  activeCount: number;
  presentToday: number;
  /** Rounded percent 0–100, or null when no workdays elapsed. */
  attendanceRatePct: number | null;
  lateDaysMonth: number;
  /** Sum of salary_base for active employees. */
  basePayroll: number;
  /**
   * Estimated pay due this month: present=1 day, late=0.5 day, absent=0.
   * Null when no workdays have elapsed yet.
   */
  estimatedPayroll: number | null;
};

/** Late days count as half a paid day toward estimated payroll. */
export const LATE_PAY_FACTOR = 0.5;

/**
 * Estimated pay for the month (full Mon–Sat month as basis):
 * base salary minus penalties for recorded absences / lates.
 * Null when the month has no workdays.
 */
export function estimateEmployeePayDue(input: {
  salaryBase: number | null;
  daysPresent: number;
  daysLate: number;
  workdaysInMonth: number;
  daysAbsent?: number;
  /** @deprecated ignored — kept for call-site compatibility during rename */
  weekdaysElapsed?: number;
}): number | null {
  const penalties = estimateEmployeePenalties(input);
  if (penalties == null) return null;
  const salary = input.salaryBase ?? 0;
  if (salary <= 0) return 0;
  return Math.max(0, Math.round(salary - penalties));
}

/**
 * Unpaid portion of base salary on a full-month day rate:
 * absent = full day, late = half day.
 * Null when the month has no workdays.
 */
export function estimateEmployeePenalties(input: {
  salaryBase: number | null;
  daysPresent: number;
  daysLate: number;
  workdaysInMonth: number;
  daysAbsent?: number;
  weekdaysElapsed?: number;
}): number | null {
  const breakdown = estimateEmployeePenaltyBreakdown(input);
  return breakdown?.total ?? null;
}

export type EmployeePenaltyBreakdown = {
  /** Half-day deductions for late check-ins. */
  late: number;
  /** Full-day deductions for absences. */
  absent: number;
  total: number;
};

/**
 * Mon–Sat workdays in a full calendar month (1–12).
 */
export function countWorkdaysInMonth(year: number, month: number): number {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return 0;
  }
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    if (new Date(Date.UTC(year, month - 1, d)).getUTCDay() !== 0) count += 1;
  }
  return count;
}

/**
 * Unit costs for 1 late day / 1 absent day this month (employee-facing).
 */
export function estimateDayPenaltyRates(input: {
  salaryBase: number | null;
  workdaysInMonth: number;
}): { costLateDay: number; costAbsentDay: number } | null {
  if (input.workdaysInMonth <= 0) return null;
  const salary = input.salaryBase ?? 0;
  if (salary <= 0) return { costLateDay: 0, costAbsentDay: 0 };
  const dayRate = salary / input.workdaysInMonth;
  return {
    costLateDay: Math.round(dayRate * LATE_PAY_FACTOR),
    costAbsentDay: Math.round(dayRate),
  };
}

export function formatDayPenaltyRateLines(
  rates: { costLateDay: number; costAbsentDay: number } | null
): string[] {
  if (rates == null) {
    return [
      "1 jour de retard = —",
      "1 jour d'absence = —",
    ];
  }
  return [
    `1 jour de retard = ${formatPayrollAmount(rates.costLateDay)}`,
    `1 jour d'absence = ${formatPayrollAmount(rates.costAbsentDay)}`,
  ];
}

/**
 * Penalty amounts on full-month day rates (same as "coût d'un jour").
 * Null when the month has no workdays.
 */
export function estimateEmployeePenaltyBreakdown(input: {
  salaryBase: number | null;
  daysPresent: number;
  daysLate: number;
  workdaysInMonth: number;
  daysAbsent?: number;
  /** Used only to infer daysAbsent when not provided. */
  weekdaysElapsed?: number;
}): EmployeePenaltyBreakdown | null {
  if (input.workdaysInMonth <= 0) return null;
  const salary = input.salaryBase ?? 0;
  if (salary <= 0) return { late: 0, absent: 0, total: 0 };

  const elapsed = input.weekdaysElapsed;
  const daysAbsent =
    input.daysAbsent ??
    (elapsed != null
      ? Math.max(0, elapsed - input.daysPresent - input.daysLate)
      : 0);
  const dayRate = salary / input.workdaysInMonth;
  const late = Math.round(dayRate * LATE_PAY_FACTOR * input.daysLate);
  const absent = Math.round(dayRate * daysAbsent);
  return { late, absent, total: late + absent };
}

/** Lines for map-style display: "Pénalité retard = …". */
export function formatPenaltyBreakdownLines(
  breakdown: EmployeePenaltyBreakdown | null
): string[] {
  if (breakdown == null) {
    return [
      "Pénalité retard = —",
      "Pénalité absence = —",
      "Total pénalités = —",
    ];
  }
  return [
    `Pénalité retard = ${formatPayrollAmount(breakdown.late)}`,
    `Pénalité absence = ${formatPayrollAmount(breakdown.absent)}`,
    `Total pénalités = ${formatPayrollAmount(breakdown.total)}`,
  ];
}

export function buildHrDashboardStats(input: {
  employees: Array<{
    id: number;
    is_active: boolean;
    salary_base?: number | null;
  }>;
  todayAttendances: Array<{
    employee_id: number;
    status: AttendanceStatus;
  }>;
  monthSummary: Array<{
    employee_id?: number;
    days_present: number;
    days_late: number;
    days_absent?: number;
    weekdays_elapsed: number;
  }>;
  /** Full Mon–Sat days in the selected month (payroll / penalties basis). */
  workdaysInMonth: number;
}): HrDashboardStats {
  const activeEmployees = input.employees.filter((e) => e.is_active);
  const activeIds = new Set(activeEmployees.map((e) => Number(e.id)));
  const activeCount = activeIds.size;

  const presentToday = input.todayAttendances.filter(
    (a) =>
      activeIds.has(Number(a.employee_id)) &&
      (a.status === "present" || a.status === "late")
  ).length;

  let presentLateDays = 0;
  let weekdaysElapsedSum = 0;
  let lateDaysMonth = 0;
  for (const row of input.monthSummary) {
    if (
      row.employee_id == null ||
      !activeIds.has(Number(row.employee_id))
    ) {
      continue;
    }
    presentLateDays += row.days_present + row.days_late;
    weekdaysElapsedSum += row.weekdays_elapsed;
    lateDaysMonth += row.days_late;
  }

  const attendanceRatePct =
    weekdaysElapsedSum > 0
      ? Math.round((presentLateDays / weekdaysElapsedSum) * 100)
      : null;

  const basePayroll = activeEmployees.reduce(
    (sum, e) => sum + (e.salary_base ?? 0),
    0
  );

  const summaryByEmployee = new Map(
    input.monthSummary
      .filter((r) => r.employee_id != null)
      .map((r) => [Number(r.employee_id), r])
  );

  let estimatedPayroll: number | null = null;
  let anyWorkdays = false;
  let estimatedSum = 0;
  for (const emp of activeEmployees) {
    const row = summaryByEmployee.get(Number(emp.id));
    const due = estimateEmployeePayDue({
      salaryBase: emp.salary_base ?? null,
      daysPresent: row?.days_present ?? 0,
      daysLate: row?.days_late ?? 0,
      daysAbsent: row?.days_absent,
      weekdaysElapsed: row?.weekdays_elapsed,
      workdaysInMonth: input.workdaysInMonth,
    });
    if (due == null) continue;
    anyWorkdays = true;
    estimatedSum += due;
  }
  if (anyWorkdays) estimatedPayroll = estimatedSum;

  return {
    activeCount,
    presentToday,
    attendanceRatePct,
    lateDaysMonth,
    basePayroll,
    estimatedPayroll,
  };
}

export function formatAttendanceRatePct(pct: number | null): string {
  if (pct == null) return "—";
  return `${pct} %`;
}

export function formatPayrollAmount(amount: number | null): string {
  if (amount == null) return "—";
  return `${formatSalary(amount)} F`;
}

export type EmployeeDetailStats = {
  daysPresent: number;
  daysLate: number;
  daysAbsent: number;
  weekdaysElapsed: number;
  attendanceRatePct: number | null;
  salaryBase: number;
  estimatedPay: number | null;
  /** Base salary minus estimated pay (absences + half late days). */
  penalties: number | null;
  penaltyLate: number | null;
  penaltyAbsent: number | null;
};

export function buildEmployeeDetailStats(input: {
  salaryBase: number | null;
  summary: {
    days_present: number;
    days_late: number;
    days_absent: number;
    weekdays_elapsed: number;
  } | null;
  /** Full Mon–Sat days in the selected month (payroll / penalties). */
  workdaysInMonth: number;
}): EmployeeDetailStats {
  const daysPresent = input.summary?.days_present ?? 0;
  const daysLate = input.summary?.days_late ?? 0;
  const weekdaysElapsed = input.summary?.weekdays_elapsed ?? 0;
  const daysAbsent =
    input.summary?.days_absent ??
    Math.max(0, weekdaysElapsed - daysPresent - daysLate);

  const attendanceRatePct =
    weekdaysElapsed > 0
      ? Math.round(((daysPresent + daysLate) / weekdaysElapsed) * 100)
      : null;

  const salaryBase = input.salaryBase ?? 0;
  const payInput = {
    salaryBase: input.salaryBase,
    daysPresent,
    daysLate,
    daysAbsent,
    weekdaysElapsed,
    workdaysInMonth: input.workdaysInMonth,
  };
  const estimatedPay = estimateEmployeePayDue(payInput);
  const breakdown = estimateEmployeePenaltyBreakdown(payInput);

  return {
    daysPresent,
    daysLate,
    daysAbsent,
    weekdaysElapsed,
    attendanceRatePct,
    salaryBase,
    estimatedPay,
    penalties: breakdown?.total ?? null,
    penaltyLate: breakdown?.late ?? null,
    penaltyAbsent: breakdown?.absent ?? null,
  };
}


