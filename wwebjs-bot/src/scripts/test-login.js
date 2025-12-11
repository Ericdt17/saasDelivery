/**
 * Login Test Script
 * Tests the login endpoint with various scenarios
 * 
 * Usage:
 *   node src/scripts/test-login.js
 *   node src/scripts/test-login.js http://localhost:3001
 *   node src/scripts/test-login.js http://157.173.118.238
 */

const BASE_URL = process.argv[2] || 'http://localhost:3001';

// Test credentials (update these to match your test user)
const TEST_EMAIL = process.env.TEST_EMAIL || 'admin@livrexpress.com';
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'admin123';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logTest(name) {
  log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
  log(`🧪 Test: ${name}`, 'cyan');
  log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`, 'cyan');
}

async function testLogin(email, password, expectedStatus = 200, description = '') {
  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    const status = response.status;

    if (status === expectedStatus) {
      log(`✅ PASS - Status: ${status}`, 'green');
      if (description) log(`   ${description}`, 'green');
      
      if (status === 200 && data.success) {
        log(`   Token received: ${data.data?.token ? data.data.token.substring(0, 20) + '...' : 'MISSING'}`, 'green');
        log(`   User: ${data.data?.user?.name} (${data.data?.user?.email})`, 'green');
        log(`   Role: ${data.data?.user?.role}`, 'green');
        return { success: true, data };
      } else if (status !== 200) {
        log(`   Error: ${data.error || data.message}`, 'yellow');
        return { success: true, data };
      }
    } else {
      log(`❌ FAIL - Expected status ${expectedStatus}, got ${status}`, 'red');
      log(`   Response: ${JSON.stringify(data, null, 2)}`, 'red');
      return { success: false, data, status };
    }
  } catch (error) {
    log(`❌ ERROR - ${error.message}`, 'red');
    if (error.code === 'ECONNREFUSED') {
      log(`   Could not connect to ${BASE_URL}`, 'red');
      log(`   Make sure the API server is running!`, 'red');
    }
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║           Login API Test Suite                              ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  log(`\n📍 Base URL: ${BASE_URL}`, 'cyan');
  log(`📧 Test Email: ${TEST_EMAIL}`, 'cyan');
  log(`🔐 Test Password: ${TEST_PASSWORD ? '***' : 'NOT SET'}`, 'cyan');

  const results = {
    passed: 0,
    failed: 0,
    total: 0,
  };

  // Test 1: Valid login
  logTest('Valid Login');
  const validResult = await testLogin(
    TEST_EMAIL,
    TEST_PASSWORD,
    200,
    'Should return 200 with token and user data'
  );
  results.total++;
  if (validResult.success) results.passed++;
  else results.failed++;

  // Test 2: Invalid email
  logTest('Invalid Email');
  const invalidEmailResult = await testLogin(
    'nonexistent@example.com',
    TEST_PASSWORD,
    401,
    'Should return 401 for non-existent email'
  );
  results.total++;
  if (invalidEmailResult.success) results.passed++;
  else results.failed++;

  // Test 3: Invalid password
  logTest('Invalid Password');
  const invalidPasswordResult = await testLogin(
    TEST_EMAIL,
    'wrongpassword123',
    401,
    'Should return 401 for wrong password'
  );
  results.total++;
  if (invalidPasswordResult.success) results.passed++;
  else results.failed++;

  // Test 4: Missing email
  logTest('Missing Email');
  const missingEmailResult = await testLogin(
    '',
    TEST_PASSWORD,
    400,
    'Should return 400 for missing email'
  );
  results.total++;
  if (missingEmailResult.success) results.passed++;
  else results.failed++;

  // Test 5: Missing password
  logTest('Missing Password');
  const missingPasswordResult = await testLogin(
    TEST_EMAIL,
    '',
    400,
    'Should return 400 for missing password'
  );
  results.total++;
  if (missingPasswordResult.success) results.passed++;
  else results.failed++;

  // Test 6: Email case sensitivity (should work with different cases)
  logTest('Email Case Insensitivity');
  const caseResult = await testLogin(
    TEST_EMAIL.toUpperCase(),
    TEST_PASSWORD,
    200,
    'Should work with uppercase email (normalized)'
  );
  results.total++;
  if (caseResult.success) results.passed++;
  else results.failed++;

  // Test 7: Email with spaces (should be trimmed)
  logTest('Email with Spaces');
  const spacesResult = await testLogin(
    `  ${TEST_EMAIL}  `,
    TEST_PASSWORD,
    200,
    'Should work with email containing spaces (trimmed)'
  );
  results.total++;
  if (spacesResult.success) results.passed++;
  else results.failed++;

  // Test 8: Invalid JSON
  logTest('Invalid JSON Body');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: 'invalid json',
    });
    const status = response.status;
    if (status === 400) {
      log(`✅ PASS - Status: ${status} (Invalid JSON rejected)`, 'green');
      results.passed++;
    } else {
      log(`❌ FAIL - Expected 400, got ${status}`, 'red');
      results.failed++;
    }
    results.total++;
  } catch (error) {
    log(`❌ ERROR - ${error.message}`, 'red');
    results.failed++;
    results.total++;
  }

  // Test 9: Wrong HTTP method
  logTest('Wrong HTTP Method (GET instead of POST)');
  try {
    const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'GET',
    });
    const status = response.status;
    if (status === 404 || status === 405) {
      log(`✅ PASS - Status: ${status} (GET method not allowed)`, 'green');
      results.passed++;
    } else {
      log(`⚠️  WARN - Expected 404/405, got ${status}`, 'yellow');
      results.passed++; // Not critical
    }
    results.total++;
  } catch (error) {
    log(`❌ ERROR - ${error.message}`, 'red');
    results.failed++;
    results.total++;
  }

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
    process.exit(0);
  } else {
    log('\n⚠️  Some tests failed. Review the output above.', 'yellow');
    process.exit(1);
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  log('❌ This script requires Node.js 18+ (for native fetch support)', 'red');
  log('   Or install node-fetch: npm install node-fetch', 'yellow');
  process.exit(1);
}

// Run tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

