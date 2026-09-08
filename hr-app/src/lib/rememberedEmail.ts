/**
 * Remember last check-in email (browser localStorage).
 * Optional `storage` injection keeps unit tests free of a real DOM.
 */

const STORAGE_KEY = "livsight.hr.checkin.email";

type KvStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

export function getRememberedEmail(storage?: KvStorage): string {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return "";
  try {
    return store.getItem(STORAGE_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function setRememberedEmail(email: string, storage?: KvStorage): void {
  const store = storage ?? (typeof localStorage !== "undefined" ? localStorage : null);
  if (!store) return;
  try {
    const next = email.trim();
    if (!next) {
      store.removeItem(STORAGE_KEY);
      return;
    }
    store.setItem(STORAGE_KEY, next);
  } catch {
    // private mode / blocked storage — ignore
  }
}

export { STORAGE_KEY };
