/**
 * Payroll eligibility — first-of-month date when an employee enters mass salary.
 * Africa/Douala calendar (same as check-in).
 */

const TIME_ZONE = "Africa/Douala";

/**
 * @param {Date} [now]
 * @returns {{ year: number, month: number }}
 */
function currentYearMonthDouala(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return { year, month };
}

/**
 * @param {number} year
 * @param {number} month 1–12
 * @returns {string} YYYY-MM-01
 */
function firstOfMonthIso(year, month) {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

/**
 * @param {Date} [now]
 * @returns {string} YYYY-MM-01 for current Douala month
 */
function firstOfCurrentMonthDouala(now = new Date()) {
  const { year, month } = currentYearMonthDouala(now);
  return firstOfMonthIso(year, month);
}

/**
 * @param {Date} [now]
 * @returns {string} YYYY-MM-01 for next Douala month
 */
function firstOfNextMonthDouala(now = new Date()) {
  const { year, month } = currentYearMonthDouala(now);
  if (month === 12) return firstOfMonthIso(year + 1, 1);
  return firstOfMonthIso(year, month + 1);
}

/**
 * Resolve payroll_eligible_from from the create/edit toggle.
 * @param {{ includeNextMonth?: boolean, now?: Date }} input
 * @returns {string} YYYY-MM-01
 */
function resolvePayrollEligibleFrom(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  if (input.includeNextMonth === true) {
    return firstOfNextMonthDouala(now);
  }
  return firstOfCurrentMonthDouala(now);
}

/**
 * @param {string|null|undefined} eligibleFrom YYYY-MM-DD or ISO
 * @param {number} year
 * @param {number} month 1–12
 * @returns {boolean}
 */
function isPayrollEligibleForMonth(eligibleFrom, year, month) {
  if (eligibleFrom == null || eligibleFrom === "") return true;
  const raw = String(eligibleFrom).slice(0, 10);
  const match = /^(\d{4})-(\d{2})/.exec(raw);
  if (!match) return true;
  const fromYear = Number(match[1]);
  const fromMonth = Number(match[2]);
  return year * 12 + month >= fromYear * 12 + fromMonth;
}

module.exports = {
  currentYearMonthDouala,
  firstOfMonthIso,
  firstOfCurrentMonthDouala,
  firstOfNextMonthDouala,
  resolvePayrollEligibleFrom,
  isPayrollEligibleForMonth,
};
