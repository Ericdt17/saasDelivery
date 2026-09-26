/**
 * LivSight delivery-ops integration client — pulls revenue/expense reports.
 * Auth is header-only (X-Api-Key), no JWT. Uses the /api/integrations/hr/*
 * endpoints; never call /api/reports/* (those need JWT user sessions).
 *
 * Env:
 *   LIVSIGHT_API_BASE_URL  e.g. http://localhost:8085 or https://gateway.livsight.com
 *   LIVSIGHT_API_KEY       integration secret (never commit it)
 *   LIVSIGHT_HR_API_KEY    accepted as fallback for LIVSIGHT_API_KEY
 */

const DEFAULT_TIMEOUT_MS = 10000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * @typedef {Object} RevenueDeliveryLine
 * @property {number} id
 * @property {"delivery"|"expedition"} type
 * @property {string} type_label
 * @property {string} client_name
 * @property {string} quartier
 * @property {string} status
 * @property {string} status_label
 * @property {string} date YYYY-MM-DD
 * @property {number} delivery_fee Whole XAF francs
 */

/**
 * @typedef {Object} ExpenseLine
 * @property {number} id
 * @property {string} expense_date YYYY-MM-DD
 * @property {string} person_name
 * @property {string} charge_name
 * @property {number} amount Whole XAF francs
 * @property {string} created_by_name
 * @property {string|null} note
 */

/**
 * @typedef {Object} ChargeTypeTotal
 * @property {string} charge_type_name
 * @property {number} count
 * @property {number} total_amount Whole XAF francs
 */

/**
 * @typedef {Object} PersonTotal
 * @property {string} person_name
 * @property {number} count
 * @property {number} total_amount Whole XAF francs
 */

/**
 * @typedef {Object} RevenueReport
 * @property {string} start_date
 * @property {string} end_date
 * @property {string} generated_at
 * @property {RevenueDeliveryLine[]} deliveries
 * @property {number} total_delivery_fees Agency revenue (delivery fees + expedition agency_main_fee)
 * @property {number} billed_count
 * @property {ExpenseLine[]} expenses
 * @property {number} total_expenses
 * @property {number} expense_count
 * @property {number} net_revenue total_delivery_fees - total_expenses
 * @property {ChargeTypeTotal[]} expenses_par_type
 */

/**
 * @typedef {Object} ExpenseReport
 * @property {string} start_date
 * @property {string} end_date
 * @property {string} generated_at
 * @property {ExpenseLine[]} expenses
 * @property {number} total_amount
 * @property {number} expense_count
 * @property {ChargeTypeTotal[]} par_charge_type
 * @property {PersonTotal[]} par_personne
 */

class LivsightOpsError extends Error {
  /**
   * @param {string} message
   * @param {{status?: number|null, code: string, body?: unknown}} opts
   */
  constructor(message, { status = null, code, body = undefined }) {
    super(message);
    this.name = "LivsightOpsError";
    this.status = status;
    this.code = code; // "config" | "bad_request" | "unauthorized" | "http" | "network" | "timeout"
    this.body = body;
  }
}

function config() {
  const baseUrl = (process.env.LIVSIGHT_API_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const apiKey = (
    process.env.LIVSIGHT_API_KEY ||
    process.env.LIVSIGHT_HR_API_KEY ||
    ""
  ).trim();
  return { baseUrl, apiKey };
}

function assertDateParam(name, value) {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new LivsightOpsError(
      `${name} must be a YYYY-MM-DD string, got: ${value}`,
      { code: "bad_request" }
    );
  }
  return value;
}

/**
 * @param {string} path
 * @param {Record<string, string|number|undefined>} params
 * @returns {Promise<any>}
 */
async function opsGet(path, params = {}) {
  const { baseUrl, apiKey } = config();
  if (!baseUrl) {
    throw new LivsightOpsError("LIVSIGHT_API_BASE_URL is not set", {
      code: "config",
    });
  }
  if (!apiKey) {
    throw new LivsightOpsError(
      "LIVSIGHT_API_KEY (or LIVSIGHT_HR_API_KEY) is not set",
      {
        code: "config",
      }
    );
  }

  const url = new URL(baseUrl + path);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }

  let res;
  try {
    res = await fetch(url, {
      headers: { "X-Api-Key": apiKey },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });
  } catch (err) {
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      throw new LivsightOpsError(
        `LivSight ops request timed out after ${DEFAULT_TIMEOUT_MS}ms: ${url.pathname}`,
        { code: "timeout" }
      );
    }
    throw new LivsightOpsError(
      `LivSight ops request failed: ${err.message}`,
      { code: "network" }
    );
  }

  if (!res.ok) {
    let body;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    if (res.status === 401) {
      throw new LivsightOpsError(
        "LivSight ops rejected the API key (401) — check LIVSIGHT_API_KEY",
        { status: 401, code: "unauthorized", body }
      );
    }
    if (res.status === 400) {
      throw new LivsightOpsError(
        `LivSight ops rejected the request (400): ${
          (body && (body.error || body.message)) || "invalid parameters"
        }`,
        { status: 400, code: "bad_request", body }
      );
    }
    throw new LivsightOpsError(
      `LivSight ops returned HTTP ${res.status} for ${url.pathname}`,
      { status: res.status, code: "http", body }
    );
  }

  return res.json();
}

/**
 * Fetch the revenue report (deliveries + expenses + net) for a date range.
 * Dates are optional; LivSight defaults to today when omitted.
 * @param {string} [startDate] YYYY-MM-DD
 * @param {string} [endDate] YYYY-MM-DD
 * @returns {Promise<RevenueReport>}
 */
async function fetchRevenueReport(startDate, endDate) {
  return opsGet("/api/integrations/hr/reports/revenue", {
    start_date: assertDateParam("startDate", startDate),
    end_date: assertDateParam("endDate", endDate),
  });
}

/**
 * Fetch the expense report for a date range, optionally filtered.
 * Dates are optional; LivSight defaults to today when omitted.
 * @param {string} [startDate] YYYY-MM-DD
 * @param {string} [endDate] YYYY-MM-DD
 * @param {number|string} [personId]
 * @param {number|string} [chargeTypeId]
 * @returns {Promise<ExpenseReport>}
 */
async function fetchExpenseReport(startDate, endDate, personId, chargeTypeId) {
  return opsGet("/api/integrations/hr/reports/expenses", {
    start_date: assertDateParam("startDate", startDate),
    end_date: assertDateParam("endDate", endDate),
    personId,
    chargeTypeId,
  });
}

module.exports = {
  LivsightOpsError,
  fetchRevenueReport,
  fetchExpenseReport,
};
