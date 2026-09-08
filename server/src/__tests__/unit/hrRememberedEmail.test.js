'use strict';

const {
  getRememberedEmail,
  setRememberedEmail,
  STORAGE_KEY,
} = require('../../lib/hrRememberedEmail');

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

describe('hrRememberedEmail', () => {
  it('returns empty when nothing stored', () => {
    expect(getRememberedEmail(memoryStorage())).toBe('');
  });

  it('stores trimmed email under fixed key', () => {
    const storage = memoryStorage();
    setRememberedEmail('  jean.dupont@livsight.com  ', storage);
    expect(storage.getItem(STORAGE_KEY)).toBe('jean.dupont@livsight.com');
    expect(getRememberedEmail(storage)).toBe('jean.dupont@livsight.com');
  });

  it('clears when email is blank', () => {
    const storage = memoryStorage();
    setRememberedEmail('a@b.com', storage);
    setRememberedEmail('   ', storage);
    expect(getRememberedEmail(storage)).toBe('');
  });
});
