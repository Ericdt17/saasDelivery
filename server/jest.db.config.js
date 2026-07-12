'use strict';

/**
 * Jest configuration for real-database integration tests.
 *
 * These tests connect to an actual PostgreSQL instance and validate that
 * the SQL queries (aggregations, lookups, CRUD) behave correctly end-to-end.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npm run test:db:integration
 *
 * In CI this is run automatically in the backend-ci job where a Postgres
 * service container is already available.
 */

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/db/**/*.test.js'],
  setupFiles: ['<rootDir>/src/__tests__/setEnv.js'],
  // Do NOT reset mocks — we use real DB connections, not jest.fn()
  resetMocks: false,
  // Longer timeout for real network I/O
  testTimeout: 30000,
  // No coverage for DB tests (they cover postgres-queries.js, tracked separately)
  collectCoverage: false,
};
