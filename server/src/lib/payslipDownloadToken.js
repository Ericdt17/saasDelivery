"use strict";

/**
 * Short payslip download links for WhatsApp (no login, no long token in the URL).
 *
 * Codes are alphanumeric only (A-Za-z0-9) so WhatsApp auto-links them.
 * Stored in a JSON file with expiry (default 7 days).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_TTL_SECONDS = 7 * 24 * 60 * 60;
const CODE_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const CODE_LENGTH = 10;

function linksFilePath() {
  return (
    process.env.PAYSLIP_LINKS_FILE ||
    path.join(process.cwd(), "data", "payslip-download-links.json")
  );
}

function publicApiBaseUrl() {
  const fromEnv = (process.env.PUBLIC_API_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const port = process.env.API_PORT || process.env.PORT || "3000";
  return `http://127.0.0.1:${port}`;
}

function readStore() {
  const file = linksFilePath();
  try {
    if (!fs.existsSync(file)) return {};
    const raw = fs.readFileSync(file, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store) {
  const file = linksFilePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

function randomCode() {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function pruneExpired(store, nowSec = Math.floor(Date.now() / 1000)) {
  let changed = false;
  for (const [code, row] of Object.entries(store)) {
    if (!row || typeof row.exp !== "number" || row.exp < nowSec) {
      delete store[code];
      changed = true;
    }
  }
  return changed;
}

/**
 * @param {{ employeeId: number, year: number, month: number, ttlSeconds?: number }} input
 * @returns {{ code: string, url: string, exp: number }}
 */
function createPayslipDownloadLink(input) {
  const employeeId = Number(input.employeeId);
  const year = Number(input.year);
  const month = Number(input.month);
  if (!Number.isInteger(employeeId) || employeeId < 1) {
    throw new Error("invalid employeeId");
  }
  if (!Number.isInteger(year) || year < 2020) {
    throw new Error("invalid year");
  }
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("invalid month");
  }
  const ttl =
    Number.isFinite(input.ttlSeconds) && input.ttlSeconds > 0
      ? Math.floor(input.ttlSeconds)
      : DEFAULT_TTL_SECONDS;
  const exp = Math.floor(Date.now() / 1000) + ttl;

  const store = readStore();
  pruneExpired(store);

  let code = randomCode();
  let guard = 0;
  while (store[code] && guard < 20) {
    code = randomCode();
    guard += 1;
  }

  store[code] = { employeeId, year, month, exp };
  writeStore(store);

  const url = `${publicApiBaseUrl()}/api/v1/hr/p/${code}`;
  return { code, url, exp };
}

/**
 * @param {string} code
 * @returns {{ ok: true, employeeId: number, year: number, month: number, exp: number }
 *   | { ok: false, error: string }}
 */
function resolvePayslipDownloadCode(code) {
  const key = String(code || "").trim();
  if (!/^[A-Za-z0-9]{6,32}$/.test(key)) {
    return { ok: false, error: "invalid_token" };
  }
  const store = readStore();
  const row = store[key];
  if (!row) {
    return { ok: false, error: "invalid_token" };
  }
  const now = Math.floor(Date.now() / 1000);
  if (typeof row.exp !== "number" || row.exp < now) {
    delete store[key];
    writeStore(store);
    return { ok: false, error: "expired" };
  }
  return {
    ok: true,
    employeeId: Number(row.employeeId),
    year: Number(row.year),
    month: Number(row.month),
    exp: Number(row.exp),
  };
}

/** @deprecated use createPayslipDownloadLink */
function buildPayslipDownloadUrl(input) {
  return createPayslipDownloadLink(input).url;
}

module.exports = {
  DEFAULT_TTL_SECONDS,
  CODE_LENGTH,
  createPayslipDownloadLink,
  resolvePayslipDownloadCode,
  buildPayslipDownloadUrl,
  publicApiBaseUrl,
  linksFilePath,
  // kept for older tests / gradual migration
  signPayslipDownloadToken: () => {
    throw new Error("signPayslipDownloadToken removed — use createPayslipDownloadLink");
  },
  verifyPayslipDownloadToken: resolvePayslipDownloadCode,
};
