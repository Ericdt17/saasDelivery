'use strict';

const {
  resolveSalaryEffectiveFrom,
  resolveSalaryForMonth,
  salariesEqual,
  previousYearMonth,
} = require('../../lib/hrSalary');

describe('resolveSalaryEffectiveFrom', () => {
  const midOctober = new Date('2026-10-04T12:00:00.000Z');

  it('defaults to first of next Douala month (raise/drop deferred)', () => {
    expect(resolveSalaryEffectiveFrom({ now: midOctober })).toBe('2026-11-01');
    expect(
      resolveSalaryEffectiveFrom({ applyThisMonth: false, now: midOctober })
    ).toBe('2026-11-01');
  });

  it('uses first of current Douala month when applyThisMonth is true', () => {
    expect(
      resolveSalaryEffectiveFrom({ applyThisMonth: true, now: midOctober })
    ).toBe('2026-10-01');
  });

  it('rolls year when deferring in December', () => {
    const dec = new Date('2026-12-15T12:00:00.000Z');
    expect(resolveSalaryEffectiveFrom({ now: dec })).toBe('2027-01-01');
  });
});

describe('resolveSalaryForMonth', () => {
  const history = [
    { amount: 150000, effective_from: '2026-01-01' },
    { amount: 180000, effective_from: '2026-11-01' },
    { amount: 160000, effective_from: '2027-02-01' },
  ];

  it('picks the latest row on or before the month start', () => {
    expect(resolveSalaryForMonth(history, 2026, 10)).toBe(150000);
    expect(resolveSalaryForMonth(history, 2026, 11)).toBe(180000);
    expect(resolveSalaryForMonth(history, 2027, 1)).toBe(180000);
    expect(resolveSalaryForMonth(history, 2027, 2)).toBe(160000);
  });

  it('falls back when no history covers the month', () => {
    expect(resolveSalaryForMonth([], 2026, 10, 120000)).toBe(120000);
    expect(resolveSalaryForMonth(null, 2026, 10, null)).toBeNull();
  });

  it('accepts ISO timestamps on effective_from', () => {
    expect(
      resolveSalaryForMonth(
        [{ amount: 200000, effective_from: '2026-10-01T00:00:00.000Z' }],
        2026,
        10
      )
    ).toBe(200000);
  });
});

describe('previousYearMonth', () => {
  it('steps back one calendar month', () => {
    expect(previousYearMonth(2026, 11)).toEqual({ year: 2026, month: 10 });
    expect(previousYearMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
  });
});

describe('salariesEqual', () => {
  it('treats nullish and equal integers as equal', () => {
    expect(salariesEqual(null, null)).toBe(true);
    expect(salariesEqual(undefined, null)).toBe(true);
    expect(salariesEqual(150000, 150000)).toBe(true);
    expect(salariesEqual(150000, '150000')).toBe(true);
    expect(salariesEqual(150000, 180000)).toBe(false);
    expect(salariesEqual(150000, null)).toBe(false);
  });
});
