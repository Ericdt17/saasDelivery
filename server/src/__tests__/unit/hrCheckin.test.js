'use strict';

const {
  haversineMeters,
  isWithinOffice,
  euclideanDistance,
  isFaceMatch,
  getCheckInStatus,
  getDoualaDateString,
  OFFICE_LAT,
  OFFICE_LNG,
} = require('../../lib/hrCheckin');

describe('haversineMeters / isWithinOffice', () => {
  it('treats Hippodrome coordinates as inside the office radius', () => {
    expect(isWithinOffice(OFFICE_LAT, OFFICE_LNG)).toBe(true);
    expect(haversineMeters(OFFICE_LAT, OFFICE_LNG, OFFICE_LAT, OFFICE_LNG)).toBeLessThan(1);
  });

  it('treats a point ~1km away as outside the 300m radius', () => {
    const farLat = OFFICE_LAT + 0.01;
    expect(haversineMeters(OFFICE_LAT, OFFICE_LNG, farLat, OFFICE_LNG)).toBeGreaterThan(300);
    expect(isWithinOffice(farLat, OFFICE_LNG)).toBe(false);
  });
});

describe('euclideanDistance / isFaceMatch', () => {
  function desc(fill) {
    return Array.from({ length: 128 }, () => fill);
  }

  it('returns 0 for identical descriptors and matches', () => {
    const a = desc(0.1);
    expect(euclideanDistance(a, a)).toBe(0);
    expect(isFaceMatch(a, a)).toBe(true);
  });

  it('rejects descriptors farther than 0.5', () => {
    const a = desc(0);
    const b = desc(1);
    expect(euclideanDistance(a, b)).toBeGreaterThan(0.5);
    expect(isFaceMatch(a, b)).toBe(false);
  });
});

describe('getCheckInStatus (Africa/Douala)', () => {
  // Douala is UTC+1 year-round (no DST)
  const prevIgnore = process.env.HR_CHECKIN_IGNORE_TIME;

  beforeEach(() => {
    delete process.env.HR_CHECKIN_IGNORE_TIME;
  });

  afterAll(() => {
    if (prevIgnore === undefined) delete process.env.HR_CHECKIN_IGNORE_TIME;
    else process.env.HR_CHECKIN_IGNORE_TIME = prevIgnore;
  });

  it('returns present before 08:30 Douala', () => {
    // 07:00 Douala = 06:00 UTC
    expect(getCheckInStatus(new Date('2026-09-08T06:00:00.000Z'))).toBe('present');
  });

  it('returns late from 08:30 Douala inclusive', () => {
    // 08:30 Douala = 07:30 UTC
    expect(getCheckInStatus(new Date('2026-09-08T07:30:00.000Z'))).toBe('late');
    // 09:00 Douala = 08:00 UTC
    expect(getCheckInStatus(new Date('2026-09-08T08:00:00.000Z'))).toBe('late');
  });

  it('returns null (closed) from 12:00 Douala inclusive', () => {
    // 12:00 Douala = 11:00 UTC
    expect(getCheckInStatus(new Date('2026-09-08T11:00:00.000Z'))).toBeNull();
  });

  it('returns present when HR_CHECKIN_IGNORE_TIME is set (local testing)', () => {
    process.env.HR_CHECKIN_IGNORE_TIME = 'true';
    expect(getCheckInStatus(new Date('2026-09-08T11:00:00.000Z'))).toBe('present');
  });

  it('returns Douala calendar date string', () => {
    // 2026-09-08 00:30 Douala = 2026-09-07 23:30 UTC → still 8 Sep Douala
    expect(getDoualaDateString(new Date('2026-09-07T23:30:00.000Z'))).toBe('2026-09-08');
  });
});

describe('countWeekdaysElapsed', () => {
  const { countWeekdaysElapsed } = require('../../lib/hrCheckin');

  it('counts Mon–Sat workdays through mid-month cutoff (Sept 2026 → 8th)', () => {
    // 1 Tue … 8 Tue → includes Sat 5, excludes Sun 6 → 7 days
    expect(countWeekdaysElapsed(2026, 9, '2026-09-08')).toBe(7);
  });

  it('counts all Mon–Sat days when asOf is after the month', () => {
    // Sep 2026: 22 Mon–Fri + 4 Saturdays = 26
    expect(countWeekdaysElapsed(2026, 9, '2026-10-01')).toBe(26);
  });

  it('returns 0 when asOf is before the month', () => {
    expect(countWeekdaysElapsed(2026, 9, '2026-08-31')).toBe(0);
  });
});

describe('countWeekdaysInMonth / estimateDayPenaltyRates', () => {
  const {
    countWeekdaysInMonth,
    estimateDayPenaltyRates,
  } = require('../../lib/hrCheckin');

  it('counts full-month Mon–Sat days', () => {
    expect(countWeekdaysInMonth(2026, 9)).toBe(26);
  });

  it('computes late = half absent day cost', () => {
    // 300000 / 26 ≈ 11538.46 → absent 11538, late 5769
    expect(estimateDayPenaltyRates(300000, 26)).toEqual({
      cost_late_day: 5769,
      cost_absent_day: 11538,
    });
  });
});
