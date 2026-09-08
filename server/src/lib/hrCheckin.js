/**
 * HR check-in pure helpers — face match, GPS office radius, Douala time window.
 *
 * Office GPS defaults = Hippodrome Yaoundé. Override in .env for local testing:
 *   HR_OFFICE_LAT / HR_OFFICE_LNG / HR_OFFICE_RADIUS_M
 *   HR_CHECKIN_IGNORE_TIME=true — skip Douala hours (always present)
 */

// Ensure .env is loaded even if this module is required before config.js
if (!process.env.DOCKER_CONTAINER && process.env.USE_ENV_FILE !== "false") {
  require("dotenv").config();
}

function envNumber(key, fallback) {
  const raw = process.env[key];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getOfficeLat() {
  return envNumber("HR_OFFICE_LAT", 3.8721);
}
function getOfficeLng() {
  return envNumber("HR_OFFICE_LNG", 11.5137);
}
function getOfficeRadiusM() {
  return envNumber("HR_OFFICE_RADIUS_M", 300);
}

/** @deprecated use getOfficeLat — kept for tests/compat */
const OFFICE_LAT = getOfficeLat();
const OFFICE_LNG = getOfficeLng();
const OFFICE_RADIUS_M = getOfficeRadiusM();
/** Euclidean threshold on L2-normalized MediaPipe landmark descriptors. */
const FACE_MATCH_THRESHOLD = 0.65;
const CHECKIN_TIMEZONE = "Africa/Douala";

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function isWithinOffice(lat, lon, radiusMeters = getOfficeRadiusM()) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return haversineMeters(getOfficeLat(), getOfficeLng(), lat, lon) <= radiusMeters;
}

function euclideanDistance(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
    return Number.POSITIVE_INFINITY;
  }
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = Number(a[i]) - Number(b[i]);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

function isFaceMatch(stored, incoming, threshold = FACE_MATCH_THRESHOLD) {
  if (!Array.isArray(stored) || !Array.isArray(incoming)) return false;
  if (stored.length !== 128 || incoming.length !== 128) return false;
  return euclideanDistance(stored, incoming) <= threshold;
}

function getDoualaParts(now = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: CHECKIN_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt
      .formatToParts(now)
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value])
  );
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Calendar date in Africa/Douala as YYYY-MM-DD */
function getDoualaDateString(now = new Date()) {
  const p = getDoualaParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * @returns {'present'|'late'|null} null when check-in is closed (>= 12:00 Douala)
 * Set HR_CHECKIN_IGNORE_TIME=true to always allow check-in as present (local testing).
 */
function getCheckInStatus(now = new Date()) {
  const ignore =
    process.env.HR_CHECKIN_IGNORE_TIME === "true" ||
    process.env.HR_CHECKIN_IGNORE_TIME === "1";
  if (ignore) return "present";

  const { hour, minute } = getDoualaParts(now);
  const minutes = hour * 60 + minute;
  if (minutes >= 12 * 60) return null;
  if (minutes < 8 * 60 + 30) return "present";
  return "late";
}

/**
 * Count Mon–Fri days in `year`/`month` (1–12) up to `asOfDate` (Douala calendar).
 * @param {number} year
 * @param {number} month 1–12
 * @param {Date|string} [asOfDate] Date or YYYY-MM-DD; default = today Douala
 */
function countWeekdaysElapsed(year, month, asOfDate) {
  const y = Number(year);
  const m = Number(month);
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return 0;
  }

  let asOf;
  if (asOfDate instanceof Date) {
    asOf = getDoualaDateString(asOfDate);
  } else if (typeof asOfDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(asOfDate)) {
    asOf = asOfDate;
  } else {
    asOf = getDoualaDateString(new Date());
  }

  const [asOfY, asOfM, asOfD] = asOf.split("-").map(Number);
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();

  let endDay;
  if (asOfY < y || (asOfY === y && asOfM < m)) {
    return 0;
  }
  if (asOfY > y || (asOfY === y && asOfM > m)) {
    endDay = lastDay;
  } else {
    endDay = Math.min(lastDay, asOfD);
  }

  let count = 0;
  for (let d = 1; d <= endDay; d++) {
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow >= 1 && dow <= 5) count += 1;
  }
  return count;
}

module.exports = {
  OFFICE_LAT,
  OFFICE_LNG,
  OFFICE_RADIUS_M,
  getOfficeLat,
  getOfficeLng,
  getOfficeRadiusM,
  FACE_MATCH_THRESHOLD,
  CHECKIN_TIMEZONE,
  haversineMeters,
  isWithinOffice,
  euclideanDistance,
  isFaceMatch,
  getDoualaParts,
  getDoualaDateString,
  getCheckInStatus,
  countWeekdaysElapsed,
};
