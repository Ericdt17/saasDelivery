// Loaded by Jest before any module — sets env vars used by jwt.js, auth middleware, etc.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-for-jest-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '1h';
process.env.AUTH_HEADER_FALLBACK = 'true'; // allow Bearer token in tests (no browser cookie)
