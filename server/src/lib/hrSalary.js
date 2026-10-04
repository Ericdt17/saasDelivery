'use strict';

/**
 * Effective-dated employee salary — rise/drop apply on a Douala first-of-month.
 * Default: next month. Optional: apply this month (corrections).
 */

const {
  firstOfCurrentMonthDouala,
  firstOfNextMonthDouala,
  firstOfMonthIso,
} = require('./hrPayrollEligibility');

/**
 * @param {{ applyThisMonth?: boolean, now?: Date }} [input]
 * @returns {string} YYYY-MM-01
 */
function resolveSalaryEffectiveFrom(input = {}) {
  const now = input.now instanceof Date ? input.now : new Date();
  if (input.applyThisMonth === true) {
    return firstOfCurrentMonthDouala(now);
  }
  return firstOfNextMonthDouala(now);
}

/**
 * @param {string|null|undefined} value
 * @returns {string|null} YYYY-MM-01 or null
 */
function normalizeEffectiveFrom(value) {
  if (value == null || value === '') return null;
  const raw = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})/.exec(raw);
  if (!match) return null;
  return firstOfMonthIso(Number(match[1]), Number(match[2]));
}

/**
 * Latest salary covering the given calendar month.
 * @param {Array<{ amount?: number|null, effective_from?: string|null }>|null|undefined} history
 * @param {number} year
 * @param {number} month 1–12
 * @param {number|null} [fallback]
 * @returns {number|null}
 */
function resolveSalaryForMonth(history, year, month, fallback = null) {
  const target = firstOfMonthIso(year, month);
  const rows = Array.isArray(history) ? history : [];
  let best = null;
  let bestFrom = null;
  for (const row of rows) {
    const from = normalizeEffectiveFrom(row?.effective_from);
    if (!from || from > target) continue;
    if (bestFrom == null || from > bestFrom) {
      bestFrom = from;
      best =
        row.amount == null || row.amount === ''
          ? null
          : Number(row.amount);
      if (best != null && !Number.isFinite(best)) best = null;
    }
  }
  if (bestFrom == null) {
    if (fallback == null || fallback === '') return null;
    const n = Number(fallback);
    return Number.isFinite(n) ? n : null;
  }
  return best;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
function salariesEqual(a, b) {
  const na = a == null || a === '' ? null : Number(a);
  const nb = b == null || b === '' ? null : Number(b);
  if (na == null && nb == null) return true;
  if (na == null || nb == null) return false;
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return na === nb;
}

/**
 * Next scheduled change after the current Douala month (if any).
 * @param {Array<{ amount?: number|null, effective_from?: string|null }>|null|undefined} history
 * @param {Date} [now]
 * @returns {{ amount: number|null, effective_from: string }|null}
 */
function findScheduledSalary(history, now = new Date()) {
  const currentStart = firstOfCurrentMonthDouala(now);
  const rows = Array.isArray(history) ? history : [];
  let best = null;
  for (const row of rows) {
    const from = normalizeEffectiveFrom(row?.effective_from);
    if (!from || from <= currentStart) continue;
    if (!best || from < best.effective_from) {
      const amount =
        row.amount == null || row.amount === ''
          ? null
          : Number(row.amount);
      best = {
        amount: amount != null && Number.isFinite(amount) ? amount : null,
        effective_from: from,
      };
    }
  }
  return best;
}

/**
 * @param {number} year
 * @param {number} month 1–12
 * @returns {{ year: number, month: number }}
 */
function previousYearMonth(year, month) {
  if (month <= 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

module.exports = {
  resolveSalaryEffectiveFrom,
  resolveSalaryForMonth,
  salariesEqual,
  findScheduledSalary,
  normalizeEffectiveFrom,
  previousYearMonth,
};
