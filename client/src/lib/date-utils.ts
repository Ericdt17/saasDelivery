/**
 * Date utility functions — local timezone YYYY-MM-DD ranges
 * (ported from parcoursAdmin for ops reports filters).
 */

export function formatDateLocal(date: Date | string): string {
  const d = typeof date === "string" ? parseLocalDate(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parse YYYY-MM-DD as a local calendar date (avoids UTC shift). */
export function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function getTodayLocal(): string {
  return formatDateLocal(new Date());
}

export type DateRangePreset =
  | "allPeriod"
  | "today"
  | "tomorrow"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "custom";

export interface DateRange {
  startDate: string;
  endDate: string;
}

export function getEmptyDateRange(): DateRange {
  return { startDate: "", endDate: "" };
}

export function isActiveDateRange(range: DateRange): boolean {
  return Boolean(range.startDate?.trim() && range.endDate?.trim());
}

export function getDefaultDateRange(): DateRange {
  return getDateRangeForPreset("today");
}

/**
 * @param planning forward-looking ranges (itinerary). Reports keep planning=false.
 */
export function getDateRangeForPreset(
  preset: DateRangePreset,
  planning = false
): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const periodEnd = (end: Date) => formatDateLocal(planning ? end : today);

  switch (preset) {
    case "allPeriod":
      return getEmptyDateRange();
    case "today":
      return {
        startDate: formatDateLocal(today),
        endDate: formatDateLocal(today),
      };
    case "tomorrow": {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return {
        startDate: formatDateLocal(tomorrow),
        endDate: formatDateLocal(tomorrow),
      };
    }
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return {
        startDate: formatDateLocal(yesterday),
        endDate: formatDateLocal(yesterday),
      };
    }
    case "thisWeek": {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return {
        startDate: formatDateLocal(weekStart),
        endDate: periodEnd(weekEnd),
      };
    }
    case "lastWeek": {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - 7);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return {
        startDate: formatDateLocal(weekStart),
        endDate: formatDateLocal(weekEnd),
      };
    }
    case "thisMonth": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return {
        startDate: formatDateLocal(monthStart),
        endDate: periodEnd(monthEnd),
      };
    }
    case "lastMonth": {
      const lastMonthStart = new Date(
        today.getFullYear(),
        today.getMonth() - 1,
        1
      );
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        startDate: formatDateLocal(lastMonthStart),
        endDate: formatDateLocal(lastMonthEnd),
      };
    }
    case "thisYear": {
      const yearStart = new Date(today.getFullYear(), 0, 1);
      const yearEnd = new Date(today.getFullYear(), 11, 31);
      return {
        startDate: formatDateLocal(yearStart),
        endDate: periodEnd(yearEnd),
      };
    }
    case "lastYear": {
      const lastYearStart = new Date(today.getFullYear() - 1, 0, 1);
      const lastYearEnd = new Date(today.getFullYear() - 1, 11, 31);
      return {
        startDate: formatDateLocal(lastYearStart),
        endDate: formatDateLocal(lastYearEnd),
      };
    }
    case "custom":
    default:
      return {
        startDate: formatDateLocal(today),
        endDate: formatDateLocal(today),
      };
  }
}

export function getPresetLabel(preset: DateRangePreset): string {
  const labels: Record<DateRangePreset, string> = {
    allPeriod: "Toute la période",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    yesterday: "Hier",
    thisWeek: "Cette semaine",
    lastWeek: "Semaine dernière",
    thisMonth: "Ce mois",
    lastMonth: "Mois dernier",
    thisYear: "Cette année",
    lastYear: "Année dernière",
    custom: "Personnalisé",
  };
  return labels[preset];
}

/** Calendar month of a range (from startDate, else endDate, else today). */
export function monthYearFromDateRange(range: DateRange): {
  year: number;
  month: number;
} {
  const ymd = range.startDate?.trim() || range.endDate?.trim() || getTodayLocal();
  const d = parseLocalDate(ymd);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/**
 * Full calendar month range for HR APIs (month-scoped).
 * Current month ends at today; past months use the last day of the month.
 */
export function getDateRangeForMonth(year: number, month: number): DateRange {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const isCurrent =
    year === today.getFullYear() && month === today.getMonth() + 1;
  return {
    startDate: formatDateLocal(monthStart),
    endDate: formatDateLocal(isCurrent ? today : monthEnd),
  };
}

/** Snap any picked range to its start month (HR attendance is month-based). */
export function snapDateRangeToMonth(range: DateRange): DateRange {
  const { year, month } = monthYearFromDateRange(range);
  return getDateRangeForMonth(year, month);
}
