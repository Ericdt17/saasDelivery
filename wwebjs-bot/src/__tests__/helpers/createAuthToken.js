'use strict';

/**
 * Creates a signed JWT directly (bypasses generateToken validation guards)
 * for use in integration tests.
 */
const jwt = require('jsonwebtoken');

function createTestToken(overrides = {}) {
  const payload = {
    userId: 1,
    agencyId: 1,
    email: 'test@agency.com',
    role: 'agency',
    ...overrides,
  };
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });
}

function createSuperAdminToken(overrides = {}) {
  return createTestToken({ agencyId: null, role: 'super_admin', ...overrides });
}

module.exports = { createTestToken, createSuperAdminToken };
