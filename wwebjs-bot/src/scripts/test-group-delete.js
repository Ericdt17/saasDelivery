/**
 * Group Delete API Test Script
 * 
 * Tests both soft delete and hard delete functionalities for groups
 * 
 * Usage:
 *   node src/scripts/test-group-delete.js
 *   node src/scripts/test-group-delete.js http://localhost:3000
 *   node src/scripts/test-group-delete.js http://localhost:3000 5  (test with group ID 5)
 */

const BASE_URL = process.argv[2] || 'http://localhost:3000';
const TEST_GROUP_ID = process.argv[3] ? parseInt(process.argv[3]) : null;

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
  log(`🧪 ${name}`, 'cyan');
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

function logWarn(message) {
  log(`  ⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`  ℹ️  ${message}`, 'blue');
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

// Login and get auth cookie
async function login(cookieJar) {
  logTest('Step 1: Login');
  
  try {
    const { response, data, status } = await makeRequest('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
    }, cookieJar);

    if (status !== 200 || !data.success) {
      logFail(`Login failed: ${data.message || 'Unknown error'}`);
      return false;
    }

    if (!cookieJar.hasCookie('auth_token')) {
      logFail('Auth token cookie not set');
      return false;
    }

    logPass(`Logged in as: ${data.data.user.name} (${data.data.user.email})`);
    logInfo(`Role: ${data.data.user.role}`);
    return true;
  } catch (error) {
    logFail(`Login error: ${error.message}`);
    return false;
  }
}

// Get all groups
async function getGroups(cookieJar) {
  try {
    const { response, data, status } = await makeRequest('/api/v1/groups', {
      method: 'GET',
    }, cookieJar);

    if (status !== 200 || !data.success) {
      logFail(`Failed to get groups: ${data.message || 'Unknown error'}`);
      return null;
    }

    return Array.isArray(data.data) ? data.data : [];
  } catch (error) {
    logFail(`Error getting groups: ${error.message}`);
    return null;
  }
}

// Get specific group by ID
async function getGroupById(groupId, cookieJar) {
  try {
    const { response, data, status } = await makeRequest(`/api/v1/groups/${groupId}`, {
      method: 'GET',
    }, cookieJar);

    if (status === 404) {
      return null; // Group not found
    }

    if (status !== 200 || !data.success) {
      logFail(`Failed to get group: ${data.message || 'Unknown error'}`);
      return null;
    }

    return data.data;
  } catch (error) {
    logFail(`Error getting group: ${error.message}`);
    return null;
  }
}

// Soft delete group (sets is_active to false)
async function softDeleteGroup(groupId, cookieJar) {
  try {
    const { response, data, status } = await makeRequest(`/api/v1/groups/${groupId}`, {
      method: 'DELETE',
      // No permanent parameter = soft delete
    }, cookieJar);

    return { status, data };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// Hard delete group (permanently removes from database)
async function hardDeleteGroup(groupId, cookieJar) {
  try {
    const { response, data, status } = await makeRequest(`/api/v1/groups/${groupId}?permanent=true`, {
      method: 'DELETE',
    }, cookieJar);

    return { status, data };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// Main test function
async function runTests() {
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║           Group Delete API Test Script                     ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  log(`\n📍 Base URL: ${BASE_URL}`, 'cyan');
  log(`📧 Test Email: ${TEST_EMAIL}`, 'cyan');

  const cookieJar = new CookieJar();

  // Step 1: Login
  const loggedIn = await login(cookieJar);
  if (!loggedIn) {
    log('\n❌ Cannot proceed without authentication', 'red');
    process.exit(1);
  }

  // Step 2: Get groups
  logTest('Step 2: Get All Groups');
  const groups = await getGroups(cookieJar);
  if (!groups) {
    log('\n❌ Cannot proceed without groups list', 'red');
    process.exit(1);
  }

  logInfo(`Found ${groups.length} active group(s)`);
  if (groups.length > 0) {
    log('\n📋 Available groups:');
    groups.forEach((group, index) => {
      log(`   ${index + 1}. ID: ${group.id} | Name: ${group.name} | Active: ${group.is_active}`, 'blue');
    });
  } else {
    logWarn('No active groups found. Create a group first to test deletion.');
    process.exit(0);
  }

  // Step 3: Select group to test
  let testGroupId = TEST_GROUP_ID;
  if (!testGroupId) {
    // Use the first group if no ID provided
    testGroupId = groups[0].id;
    logWarn(`No group ID provided, using first group: ID ${testGroupId}`);
  }

  // Verify group exists
  const testGroup = await getGroupById(testGroupId, cookieJar);
  if (!testGroup) {
    logFail(`Group with ID ${testGroupId} not found`);
    process.exit(1);
  }

  logTest(`Step 3: Testing with Group ID ${testGroupId}`);
  logInfo(`Group Name: ${testGroup.name}`);
  logInfo(`Group WhatsApp ID: ${testGroup.whatsapp_group_id || 'N/A'}`);
  logInfo(`Is Active: ${testGroup.is_active}`);

  // Step 4: Test SOFT DELETE
  logTest('Step 4: Testing SOFT DELETE (is_active = false)');
  
  const softDeleteResult = await softDeleteGroup(testGroupId, cookieJar);
  
  if (softDeleteResult.status === 200) {
    logPass(`Soft delete successful: ${softDeleteResult.data.message}`);
    
    // Verify group is still in database but inactive
    await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit
    
    const groupAfterSoftDelete = await getGroupById(testGroupId, cookieJar);
    if (groupAfterSoftDelete) {
      logPass(`Group still exists in database (ID: ${groupAfterSoftDelete.id})`);
      logInfo(`Is Active: ${groupAfterSoftDelete.is_active} (should be false)`);
      
      if (groupAfterSoftDelete.is_active === false || groupAfterSoftDelete.is_active === 0) {
        logPass('Group is correctly marked as inactive ✅');
      } else {
        logFail('Group is still active (soft delete may have failed)');
      }
    } else {
      logFail('Group not found after soft delete (should still exist but inactive)');
    }

    // Check if group appears in active groups list
    const groupsAfterSoftDelete = await getGroups(cookieJar);
    const stillInList = groupsAfterSoftDelete.some(g => g.id === testGroupId);
    
    if (stillInList) {
      logFail('Group still appears in active groups list (should be filtered out)');
    } else {
      logPass('Group correctly excluded from active groups list ✅');
    }

  } else {
    logFail(`Soft delete failed: Status ${softDeleteResult.status}`);
    if (softDeleteResult.data) {
      logFail(`Error: ${softDeleteResult.data.message || JSON.stringify(softDeleteResult.data)}`);
    }
    if (softDeleteResult.error) {
      logFail(`Exception: ${softDeleteResult.error}`);
    }
  }

  // Step 5: Reactivate group for hard delete test (if we want to test hard delete)
  logTest('Step 5: Reactivating Group for Hard Delete Test');
  
  // Update group to active again (for testing hard delete)
  try {
    const { response, data, status } = await makeRequest(`/api/v1/groups/${testGroupId}`, {
      method: 'PUT',
      body: JSON.stringify({
        is_active: true,
      }),
    }, cookieJar);

    if (status === 200 && data.success) {
      logPass('Group reactivated for hard delete test');
    } else {
      logWarn(`Could not reactivate group: ${data.message || 'Unknown error'}`);
      logWarn('Skipping hard delete test');
      process.exit(0);
    }
  } catch (error) {
    logWarn(`Error reactivating group: ${error.message}`);
    logWarn('Skipping hard delete test');
    process.exit(0);
  }

  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 500));

  // Step 6: Test HARD DELETE
  logTest('Step 6: Testing HARD DELETE (permanent removal)');
  
  const hardDeleteResult = await hardDeleteGroup(testGroupId, cookieJar);
  
  if (hardDeleteResult.status === 200) {
    logPass(`Hard delete successful: ${hardDeleteResult.data.message}`);
    
    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify group is completely removed from database
    const groupAfterHardDelete = await getGroupById(testGroupId, cookieJar);
    if (groupAfterHardDelete) {
      logFail('Group still exists in database after hard delete (should be permanently removed)');
    } else {
      logPass('Group correctly removed from database ✅');
    }

    // Check if group appears in groups list
    const groupsAfterHardDelete = await getGroups(cookieJar);
    const stillInList = groupsAfterHardDelete.some(g => g.id === testGroupId);
    
    if (stillInList) {
      logFail('Group still appears in groups list after hard delete');
    } else {
      logPass('Group correctly excluded from groups list ✅');
    }

  } else {
    logFail(`Hard delete failed: Status ${hardDeleteResult.status}`);
    if (hardDeleteResult.data) {
      logFail(`Error: ${hardDeleteResult.data.message || JSON.stringify(hardDeleteResult.data)}`);
    }
    if (hardDeleteResult.error) {
      logFail(`Exception: ${hardDeleteResult.error}`);
    }
  }

  // Final summary
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║                    Test Complete                             ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  log('\n📝 Summary:', 'cyan');
  log('   • Soft delete sets is_active to false', 'blue');
  log('   • Hard delete permanently removes from database', 'blue');
  log('   • Both operations remove groups from active groups list', 'blue');
  log('\n✅ Test completed!\n', 'green');
}

// Check if fetch is available
if (typeof fetch === 'undefined') {
  log('❌ This script requires Node.js 18+ (for native fetch support)', 'red');
  process.exit(1);
}

// Run tests
runTests().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});









