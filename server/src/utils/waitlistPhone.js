/**
 * Normalize and validate phone for the public waitlist.
 * Accepts E.164, Cameroon local (6XXXXXXXX), or 2376XXXXXXXX (no +).
 * Returns normalized E.164 string or null if invalid.
 */
function normalizeWaitlistPhone(input) {
  if (input === undefined || input === null) {
    return null;
  }
  const compact = String(input).trim().replace(/\s+/g, "");
  if (compact.length === 0) {
    return null;
  }

  // E.164: + then 1–15 digits (ITU-T)
  if (/^\+[1-9]\d{1,14}$/.test(compact)) {
    return compact;
  }

  // Cameroon local mobile: 9 digits starting with 6
  if (/^6\d{8}$/.test(compact)) {
    return `+237${compact}`;
  }

  // Cameroon with country code, no leading +
  if (/^2376\d{8}$/.test(compact)) {
    return `+${compact}`;
  }

  return null;
}

module.exports = { normalizeWaitlistPhone };
