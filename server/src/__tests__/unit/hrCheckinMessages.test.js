'use strict';

const { CHECKIN_MESSAGES } = require('../../lib/hrCheckinMessages');

describe('CHECKIN_MESSAGES (employé-facing)', () => {
  it('exposes clear French copy for every public check-in case', () => {
    const keys = [
      'EMAIL_INVALID',
      'EMPLOYEE_NOT_FOUND',
      'EMPLOYEE_INACTIVE',
      'FACE_NOT_ENROLLED',
      'FACE_ALREADY_ENROLLED',
      'FACE_ENROLLED_OK',
      'FACE_MISMATCH',
      'OUT_OF_RANGE',
      'CLOSED',
      'ALREADY_CHECKED_IN',
      'RATE_LIMITED',
      'VALIDATION_FAILED',
    ];
    for (const key of keys) {
      expect(typeof CHECKIN_MESSAGES[key]).toBe('string');
      expect(CHECKIN_MESSAGES[key].length).toBeGreaterThan(20);
    }
  });

  it('tells the employee what to do when face is not recognized', () => {
    expect(CHECKIN_MESSAGES.FACE_MISMATCH).toMatch(/caméra/i);
    expect(CHECKIN_MESSAGES.FACE_MISMATCH).toMatch(/réessayez/i);
  });

  it('explains closed window without jargon', () => {
    expect(CHECKIN_MESSAGES.CLOSED).toMatch(/midi/i);
    expect(CHECKIN_MESSAGES.CLOSED).not.toMatch(/null|UTC|Douala time/i);
  });
});
