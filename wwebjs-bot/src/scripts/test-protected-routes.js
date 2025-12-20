/**
 * Test Protected Routes with Cookie Authentication
 * 
 * Verifies that all protected routes correctly receive req.user from cookies
 * 
 * Usage:
 *   node src/scripts/test-protected-routes.js
 *   node src/scripts/test-protected-routes.js http://localhost:3000
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

// Test credentials
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@livsight.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

// Cookie jar to simulate browser cookie storage
class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  parseSetCookie(setCookieHeader) {
    if (!setCookieHeader) return null;
    
    const parts = setCookieHeader.split(';').map(p => p.trim());
    const [nameValue] = parts;
    const [name, value] = nameValue.split('=');
    
    const cookie = {
      name,
      value,
      httpOnly: false,
      secure: false,
      sameSite: null,
      maxAge: null,
      path: '/',
    };

    for (const part of parts.slice(1)) {
      const lowerPart = part.toLowerCase();
      if (lowerPart === 'httponly') {
        cookie.httpOnly = true;
      } else if (lowerPart.startsWith('secure')) {
        cookie.secure = true;
      } else if (lowerPart.startsWith('samesite=')) {
        cookie.sameSite = part.split('=')[1].toLowerCase();
      } else if (lowerPart.startsWith('max-age=')) {
        cookie.maxAge = parseInt(part.split('=')[1], 10);
      } else if (lowerPart.startsWith('path=')) {
        cookie.path = part.split('=')[1];
      }
    }

    return cookie;
  }

  setCookie(setCookieHeader) {
    const cookie = this.parseSetCookie(setCookieHeader);
    if (cookie) {
      this.cookies.set(cookie.name, cookie);
    }
  }

  getCookieString() {
    const cookieStrings = [];
    for (const [name, cookie] of this.cookies) {
      cookieStrings.push(`${name}=${cookie.value}`);
    }
    return cookieStrings.join('; ');
  }

  hasCookie(name) {
    return this.cookies.has(name);
  }
}

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  log(`🧪 Test: ${name}`, 'cyan');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
}

function logPass(message) {
  log(`  ✅ ${message}`, 'green');
}

function logFail(message, details = null) {
  log(`  ❌ ${message}`, 'red');
  if (details) {
    log(`     ${details}`, 'yellow');
  }
}

const results = {
  passed: 0,
  failed: 0,
  total: 0,
};

function recordResult(passed, testName) {
  results.total++;
  if (passed) {
    results.passed++;
  } else {
    results.failed++;
  }
}

// Helper to make authenticated requests
async function makeRequest(endpoint, options = {}, cookieJar = null) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add cookies if cookie jar is provided
  if (cookieJar && cookieJar.getCookieString()) {
    headers['Cookie'] = cookieJar.getCookieString();
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Extract and store cookies from response
  if (cookieJar) {
    let setCookieHeaders = [];
    
    if (response.headers.raw && typeof response.headers.raw === 'function') {
      const rawHeaders = response.headers.raw();
      if (rawHeaders['set-cookie']) {
        setCookieHeaders = Array.isArray(rawHeaders['set-cookie']) 
          ? rawHeaders['set-cookie'] 
          : [rawHeaders['set-cookie']];
      }
    }
    
    if (setCookieHeaders.length === 0) {
      const setCookieHeader = response.headers.get('set-cookie');
      if (setCookieHeader) {
        setCookieHeaders = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
      }
    }
    
    for (const header of setCookieHeaders) {
      if (header && typeof header === 'string') {
        cookieJar.setCookie(header);
      }
    }
  }

  let data;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { response, data, status: response.status };
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function testLogin(cookieJar) {
  logTest('1. Login to Get Auth Cookie');
  
  try {
    const { response, data, status } = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    }, cookieJar);

    if (status === 200 && data.success && cookieJar.hasCookie('auth_token')) {
      logPass('Login successful, cookie received');
      logPass(`User: ${data.data.user.name} (${data.data.user.email})`);
      logPass(`Role: ${data.data.user.role}`);
      recordResult(true, 'Login');
      return true;
    } else {
      logFail('Login failed or no cookie received');
      recordResult(false, 'Login');
      return false;
    }
  } catch (error) {
    logFail('Login request failed', error.message);
    recordResult(false, 'Login');
    return false;
  }
}

async function testStatsRoute(cookieJar) {
  logTest('2. Test /api/v1/stats/daily (Protected Route)');
  
  if (!cookieJar || !cookieJar.hasCookie('auth_token')) {
    logFail('Skipping - no auth cookie available');
    return false;
  }

  try {
    const { response, data, status } = await makeRequest('/api/v1/stats/daily', {
      method: 'GET',
    }, cookieJar);

    if (status === 200 && data.success) {
      logPass('Stats route accessible with cookie');
      logPass(`Response received: ${JSON.stringify(data).substring(0, 100)}...`);
      recordResult(true, 'Stats route');
      return true;
    } else if (status === 401) {
      logFail('Stats route returned 401 - authentication failed');
      logFail(`Response: ${JSON.stringify(data)}`);
      recordResult(false, 'Stats route');
      return false;
    } else {
      logFail(`Unexpected status: ${status}`, JSON.stringify(data));
      recordResult(false, 'Stats route');
      return false;
    }
  } catch (error) {
    logFail('Stats route test failed', error.message);
    recordResult(false, 'Stats route');
    return false;
  }
}

async function testDeliveriesRoute(cookieJar) {
  logTest('3. Test /api/v1/deliveries (Protected Route)');
  
  if (!cookieJar || !cookieJar.hasCookie('auth_token')) {
    logFail('Skipping - no auth cookie available');
    return false;
  }

  try {
    const { response, data, status } = await makeRequest('/api/v1/deliveries?page=1&limit=5', {
      method: 'GET',
    }, cookieJar);

    if (status === 200 && data.success) {
      logPass('Deliveries route accessible with cookie');
      logPass(`Received ${data.data?.length || 0} deliveries`);
      recordResult(true, 'Deliveries route');
      return true;
    } else if (status === 401) {
      logFail('Deliveries route returned 401 - authentication failed');
      logFail(`Response: ${JSON.stringify(data)}`);
      recordResult(false, 'Deliveries route');
      return false;
    } else {
      logFail(`Unexpected status: ${status}`, JSON.stringify(data));
      recordResult(false, 'Deliveries route');
      return false;
    }
  } catch (error) {
    logFail('Deliveries route test failed', error.message);
    recordResult(false, 'Deliveries route');
    return false;
  }
}

async function testGroupsRoute(cookieJar) {
  logTest('4. Test /api/v1/groups (Protected Route)');
  
  if (!cookieJar || !cookieJar.hasCookie('auth_token')) {
    logFail('Skipping - no auth cookie available');
    return false;
  }

  try {
    const { response, data, status } = await makeRequest('/api/v1/groups', {
      method: 'GET',
    }, cookieJar);

    if (status === 200 && data.success) {
      logPass('Groups route accessible with cookie');
      logPass(`Received ${data.data?.length || 0} groups`);
      recordResult(true, 'Groups route');
      return true;
    } else if (status === 401) {
      logFail('Groups route returned 401 - authentication failed');
      logFail(`Response: ${JSON.stringify(data)}`);
      recordResult(false, 'Groups route');
      return false;
    } else {
      logFail(`Unexpected status: ${status}`, JSON.stringify(data));
      recordResult(false, 'Groups route');
      return false;
    }
  } catch (error) {
    logFail('Groups route test failed', error.message);
    recordResult(false, 'Groups route');
    return false;
  }
}

async function testAgenciesRoute(cookieJar) {
  logTest('5. Test /api/v1/agencies (Protected Route - Super Admin)');
  
  if (!cookieJar || !cookieJar.hasCookie('auth_token')) {
    logFail('Skipping - no auth cookie available');
    return false;
  }

  try {
    const { response, data, status } = await makeRequest('/api/v1/agencies', {
      method: 'GET',
    }, cookieJar);

    if (status === 200 && data.success) {
      logPass('Agencies route accessible with cookie (super admin)');
      logPass(`Received ${data.data?.length || 0} agencies`);
      recordResult(true, 'Agencies route');
      return true;
    } else if (status === 401) {
      logFail('Agencies route returned 401 - authentication failed');
      recordResult(false, 'Agencies route');
      return false;
    } else if (status === 403) {
      logPass('Agencies route returned 403 - correct (requires super admin)');
      logPass('This is expected if user is not super admin');
      recordResult(true, 'Agencies route authorization');
      return true;
    } else {
      logFail(`Unexpected status: ${status}`, JSON.stringify(data));
      recordResult(false, 'Agencies route');
      return false;
    }
  } catch (error) {
    logFail('Agencies route test failed', error.message);
    recordResult(false, 'Agencies route');
    return false;
  }
}

async function testProtectedRouteWithoutCookie() {
  logTest('6. Test Protected Route Without Cookie (Should Return 401)');
  
  const emptyCookieJar = new CookieJar();

  try {
    const { response, data, status } = await makeRequest('/api/v1/stats/daily', {
      method: 'GET',
    }, emptyCookieJar);

    if (status === 401) {
      logPass('Protected route correctly returns 401 without cookie');
      recordResult(true, 'Protected route 401');
      return true;
    } else {
      logFail(`Expected 401, got ${status}`, JSON.stringify(data));
      recordResult(false, 'Protected route 401');
      return false;
    }
  } catch (error) {
    logFail('Protected route 401 test failed', error.message);
    recordResult(false, 'Protected route 401');
    return false;
  }
}

async function testAuthMe(cookieJar) {
  logTest('7. Test /api/v1/auth/me (Verify req.user is populated)');
  
  if (!cookieJar || !cookieJar.hasCookie('auth_token')) {
    logFail('Skipping - no auth cookie available');
    return false;
  }

  try {
    const { response, data, status } = await makeRequest('/api/v1/auth/me', {
      method: 'GET',
    }, cookieJar);

    if (status === 200 && data.success && data.data?.user) {
      logPass('Auth me route works with cookie');
      logPass(`User ID: ${data.data.user.id}`);
      logPass(`Email: ${data.data.user.email}`);
      logPass(`Role: ${data.data.user.role}`);
      recordResult(true, 'Auth me');
      return true;
    } else {
      logFail(`Auth me failed: ${status}`, JSON.stringify(data));
      recordResult(false, 'Auth me');
      return false;
    }
  } catch (error) {
    logFail('Auth me test failed', error.message);
    recordResult(false, 'Auth me');
    return false;
  }
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runAllTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║     Protected Routes Cookie Authentication Test            ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  log(`\n📍 Base URL: ${BASE_URL}`, 'cyan');
  log(`📧 Test Email: ${TEST_EMAIL}`, 'cyan');

  const cookieJar = new CookieJar();

  // Step 1: Login
  const loginSuccess = await testLogin(cookieJar);
  if (!loginSuccess) {
    log('\n❌ Login failed. Cannot continue with protected route tests.', 'red');
    process.exit(1);
  }

  // Step 2-7: Test all protected routes
  await testAuthMe(cookieJar);
  await testStatsRoute(cookieJar);
  await testDeliveriesRoute(cookieJar);
  await testGroupsRoute(cookieJar);
  await testAgenciesRoute(cookieJar);
  await testProtectedRouteWithoutCookie();

  // Summary
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║                    Test Summary                              ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  log(`\n📊 Total Tests: ${results.total}`, 'cyan');
  log(`✅ Passed: ${results.passed}`, 'green');
  log(`❌ Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 'cyan');

  if (results.failed === 0) {
    log('\n🎉 All tests passed!', 'green');
    log('✅ All protected routes correctly use cookie authentication', 'green');
    log('✅ req.user is populated in all routes', 'green');
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Review the output above.', 'yellow');
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  log('❌ This script requires Node.js 18+ (for native fetch support)', 'red');
  process.exit(1);
}

// Run tests
runAllTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

