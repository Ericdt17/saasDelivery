/**
 * Date utility functions
 * Handles date formatting in local timezone (not UTC)
 */

/**
 * Format a date to YYYY-MM-DD string in local timezone
 * @param date - Date object or date string
 * @returns Date string in YYYY-MM-DD format (local timezone)
 */
export function formatDateLocal(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date in local timezone as YYYY-MM-DD
 * @returns Today's date string in YYYY-MM-DD format (local timezone)
 */
export function getTodayLocal(): string {
  return formatDateLocal(new Date());
}

/**
 * Get date range for a period (jour/semaine/mois) in local timezone
 * @param period - Period type
 * @returns Object with startDate and endDate in YYYY-MM-DD format (local timezone)
 */
export function getDateRangeLocal(period: "jour" | "semaine" | "mois"): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  switch (period) {
    case "jour":
      return {
        startDate: formatDateLocal(today),
        endDate: formatDateLocal(today),
      };
    case "semaine": {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      return {
        startDate: formatDateLocal(weekStart),
        endDate: formatDateLocal(today),
      };
    }
    case "mois": {
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      return {
        startDate: formatDateLocal(monthStart),
        endDate: formatDateLocal(today),
      };
    }
  }
}



