'use strict';

/**
 * Keep in sync with hr-app/src/lib/rememberedEmail.ts (storage injection API).
 */
const STORAGE_KEY = 'livsight.hr.checkin.email';

function getRememberedEmail(storage) {
  if (!storage) return '';
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return (raw && String(raw).trim()) || '';
  } catch {
    return '';
  }
}

function setRememberedEmail(email, storage) {
  if (!storage) return;
  try {
    const next = String(email || '').trim();
    if (!next) {
      storage.removeItem(STORAGE_KEY);
      return;
    }
    storage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore
  }
}

module.exports = { STORAGE_KEY, getRememberedEmail, setRememberedEmail };
