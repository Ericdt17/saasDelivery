'use strict';

module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/__tests__/**/*.test.js'],
  // Run setEnv.js BEFORE any module is loaded so env vars are visible to all imports
  setupFiles: ['<rootDir>/src/__tests__/setEnv.js'],
  // resetMocks clears both call history AND the mockResolvedValueOnce queue between tests,
  // preventing mock state from one test leaking into the next.
  resetMocks: true,
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/__tests__/**',
    '!src/scripts/**',
    '!src/seed-*.js',
    '!src/db/**',                       // DB layer is validated by real-DB tests (jest.db.config.js)
    '!src/lib/botAlerts.js',            // webhook alert sender — requires live webhook endpoint
    '!src/view-*.js',
    '!src/migrate-existing-data.js',
    '!src/test-*.js',
    '!src/test-postgres.js',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  // Thresholds apply to the scoped file list above.
  // Increase these as more tests are added.
  coverageThreshold: {
    global: {
      statements: 60,
      branches:   54,
      functions:  49,
      lines:      61,
    },
  },
  testTimeout: 10000,
};
