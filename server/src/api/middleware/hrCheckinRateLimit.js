/**
 * Rate limit for public HR check-in endpoints (10 / IP / hour by default).
 * HR_CHECKIN_RATE_MAX overrides max (useful in tests).
 */

const rateLimit = require("express-rate-limit");
const { MemoryStore } = require("express-rate-limit");
const { CHECKIN_MESSAGES } = require("../../lib/hrCheckinMessages");

const store = new MemoryStore();

function resolveMax() {
  const n = Number(process.env.HR_CHECKIN_RATE_MAX);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

const hrCheckinRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: resolveMax,
  store,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      success: false,
      error: "Too many requests",
      message: CHECKIN_MESSAGES.RATE_LIMITED,
    });
  },
});

async function resetHrCheckinRateLimit() {
  await store.resetAll();
}

module.exports = {
  hrCheckinRateLimit,
  resetHrCheckinRateLimit,
};
