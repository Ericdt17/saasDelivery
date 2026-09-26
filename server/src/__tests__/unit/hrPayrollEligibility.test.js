const {
  firstOfCurrentMonthDouala,
  firstOfNextMonthDouala,
  resolvePayrollEligibleFrom,
  isPayrollEligibleForMonth,
} = require('../../lib/hrPayrollEligibility');

describe('resolvePayrollEligibleFrom', () => {
  // 2026-09-26 12:00 UTC ≈ afternoon Douala (UTC+1)
  const lateSeptember = new Date('2026-09-26T12:00:00.000Z');

  it('defaults to first of current Douala month', () => {
    expect(resolvePayrollEligibleFrom({ now: lateSeptember })).toBe(
      '2026-09-01'
    );
    expect(firstOfCurrentMonthDouala(lateSeptember)).toBe('2026-09-01');
  });

  it('defers to first of next month when includeNextMonth is true', () => {
    expect(
      resolvePayrollEligibleFrom({
        includeNextMonth: true,
        now: lateSeptember,
      })
    ).toBe('2026-10-01');
    expect(firstOfNextMonthDouala(lateSeptember)).toBe('2026-10-01');
  });

  it('rolls year when deferring in December', () => {
    const dec = new Date('2026-12-15T12:00:00.000Z');
    expect(
      resolvePayrollEligibleFrom({ includeNextMonth: true, now: dec })
    ).toBe('2027-01-01');
  });
});

describe('isPayrollEligibleForMonth', () => {
  it('treats missing eligible_from as always eligible', () => {
    expect(isPayrollEligibleForMonth(null, 2026, 9)).toBe(true);
    expect(isPayrollEligibleForMonth(undefined, 2026, 9)).toBe(true);
  });

  it('includes from eligible month onward', () => {
    expect(isPayrollEligibleForMonth('2026-10-01', 2026, 9)).toBe(false);
    expect(isPayrollEligibleForMonth('2026-10-01', 2026, 10)).toBe(true);
    expect(isPayrollEligibleForMonth('2026-10-01', 2026, 11)).toBe(true);
  });

  it('accepts ISO timestamps by using the date prefix', () => {
    expect(isPayrollEligibleForMonth('2026-10-01T00:00:00.000Z', 2026, 10)).toBe(
      true
    );
  });
});
