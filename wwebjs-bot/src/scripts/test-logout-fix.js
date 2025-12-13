/**
 * Test Logout Endpoint Fix
 * 
 * Verifies that /auth/logout works without a request body
 * and doesn't cause "Invalid JSON" or "ERR_HTTP_HEADERS_SENT" errors
 * 
 * Usage:
 *   node src/scripts/test-logout-fix.js
 *   node src/scripts/test-logout-fix.js http://localhost:3000
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';

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

async function testLogout() {
  log('\n🧪 Testing /auth/logout endpoint', 'cyan');
  log(`📍 Base URL: ${BASE_URL}\n`, 'cyan');

  try {
    // Test 1: Logout without body (most common case)
    log('Test 1: POST /api/v1/auth/logout without request body', 'blue');
    const response1 = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      // No body - this should work now
    });

    const data1 = await response1.json();
    const status1 = response1.status;

    if (status1 === 200 && data1.success) {
      log('  ✅ PASS - Logout without body returns 200', 'green');
      log(`  ✅ Response: ${JSON.stringify(data1)}`, 'green');
    } else {
      log(`  ❌ FAIL - Expected 200, got ${status1}`, 'red');
      log(`  ❌ Response: ${JSON.stringify(data1)}`, 'red');
      return false;
    }

    // Test 2: Logout with empty body
    log('\nTest 2: POST /api/v1/auth/logout with empty body', 'blue');
    const response2 = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '',
    });

    const data2 = await response2.json();
    const status2 = response2.status;

    if (status2 === 200 && data2.success) {
      log('  ✅ PASS - Logout with empty body returns 200', 'green');
      log(`  ✅ Response: ${JSON.stringify(data2)}`, 'green');
    } else {
      log(`  ❌ FAIL - Expected 200, got ${status2}`, 'red');
      log(`  ❌ Response: ${JSON.stringify(data2)}`, 'red');
      return false;
    }

    // Test 3: Logout with empty JSON object
    log('\nTest 3: POST /api/v1/auth/logout with empty JSON object', 'blue');
    const response3 = await fetch(`${BASE_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: '{}',
    });

    const data3 = await response3.json();
    const status3 = response3.status;

    if (status3 === 200 && data3.success) {
      log('  ✅ PASS - Logout with empty JSON object returns 200', 'green');
      log(`  ✅ Response: ${JSON.stringify(data3)}`, 'green');
    } else {
      log(`  ❌ FAIL - Expected 200, got ${status3}`, 'red');
      log(`  ❌ Response: ${JSON.stringify(data3)}`, 'red');
      return false;
    }

    // Test 4: Verify no "Invalid JSON" errors
    log('\nTest 4: Verify no "Invalid JSON" errors in response', 'blue');
    const allResponses = [data1, data2, data3];
    const hasInvalidJsonError = allResponses.some(
      (data) => data.error && data.error.includes('Invalid JSON')
    );

    if (!hasInvalidJsonError) {
      log('  ✅ PASS - No "Invalid JSON" errors', 'green');
    } else {
      log('  ❌ FAIL - Found "Invalid JSON" error', 'red');
      return false;
    }

    log('\n✅ All logout tests passed!', 'green');
    return true;
  } catch (error) {
    log(`\n❌ ERROR - ${error.message}`, 'red');
    if (error.message.includes('ERR_HTTP_HEADERS_SENT')) {
      log('  ❌ FAIL - "ERR_HTTP_HEADERS_SENT" error detected', 'red');
    }
    console.error(error);
    return false;
  }
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  log('❌ This script requires Node.js 18+ (for native fetch support)', 'red');
  process.exit(1);
}

// Run test
testLogout()
  .then((success) => {
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  });


