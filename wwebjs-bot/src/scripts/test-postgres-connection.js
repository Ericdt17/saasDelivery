/**
 * Test Script: Verify API and Bot Use PostgreSQL
 * 
 * This script tests that:
 * 1. Database connection is working
 * 2. It's using PostgreSQL (not SQLite)
 * 3. Both API and Bot modules can access the same database
 * 4. Group CRUD operations work correctly
 */

const { adapter, createGroup, getGroupById, getAllGroups, updateGroup, deleteGroup } = require("../db");
const { getGroup } = require("../utils/group-manager");
const config = require("../config");

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(70));
  log(title, "bright");
  console.log("=".repeat(70));
}

function logTest(testName) {
  log(`\n🧪 ${testName}`, "cyan");
}

function logSuccess(message) {
  log(`   ✅ ${message}`, "green");
}

function logError(message) {
  log(`   ❌ ${message}`, "red");
}

function logWarning(message) {
  log(`   ⚠️  ${message}`, "yellow");
}

async function testDatabaseConnection() {
  logSection("TEST 1: Database Connection & Type");
  
  // Check configuration
  logTest("Checking database configuration...");
  const hasDatabaseUrl = !!process.env.DATABASE_URL;
  const dbType = adapter.type;
  
  log(`   Config DB_TYPE: ${config.DB_TYPE}`);
  log(`   DATABASE_URL set: ${hasDatabaseUrl ? "Yes" : "No"}`);
  log(`   Adapter type: ${dbType}`);
  
  if (dbType !== "postgres") {
    logError("Database type is not PostgreSQL!");
    logWarning("Expected: postgres");
    logWarning(`Got: ${dbType}`);
    logWarning("Make sure DATABASE_URL is set in .env file");
    return false;
  }
  
  logSuccess("Database type is PostgreSQL ✓");
  
    // Test connection
    logTest("Testing database connection...");
    try {
      if (dbType === "postgres") {
        const result = await adapter.query("SELECT NOW() as current_time, version() as version");
        // PostgreSQL query with LIMIT 1 returns the object directly
        const version = result?.version || (Array.isArray(result) && result[0]?.version);
        const currentTime = result?.current_time || (Array.isArray(result) && result[0]?.current_time);
        logSuccess("Connection successful!");
        if (version) log(`   PostgreSQL Version: ${version.substring(0, 60)}...`);
        if (currentTime) log(`   Current Time: ${currentTime}`);
      
      // Extract database info from connection string
      if (process.env.DATABASE_URL) {
        try {
          const url = new URL(process.env.DATABASE_URL);
          log(`   Host: ${url.hostname}`);
          log(`   Database: ${url.pathname.replace('/', '')}`);
          log(`   Port: ${url.port || 5432}`);
        } catch (e) {
          // Ignore parsing errors
        }
      }
    } else {
      logError("This test is for PostgreSQL only!");
      return false;
    }
  } catch (error) {
    logError(`Connection failed: ${error.message}`);
    return false;
  }
  
  return true;
}

async function testGroupOperations() {
  logSection("TEST 2: Group CRUD Operations");
  
  const testGroupId = `test_group_${Date.now()}@g.us`;
  const testGroupName = `Test Group ${Date.now()}`;
  let createdGroupId = null;
  
  try {
    // CREATE
    logTest("Creating test group...");
    try {
      // Need to get an agency ID first
      const agenciesQuery = "SELECT id FROM agencies WHERE is_active = true LIMIT 1";
      const agenciesResult = await adapter.query(agenciesQuery);
      // PostgreSQL returns array, SQLite returns single object
      const agency = adapter.type === "postgres" 
        ? (Array.isArray(agenciesResult) ? agenciesResult[0] : agenciesResult)
        : agenciesResult;
      
      if (!agency || !agency.id) {
        logWarning("No active agencies found. Skipping group CRUD test.");
        logWarning("You can still test database connection and cross-module access.");
        return true; // Not a failure, just skip this test
      }
      
      const agencyId = agency.id;
      log(`   Using agency ID: ${agencyId}`);
      
      createdGroupId = await createGroup({
        agency_id: agencyId,
        whatsapp_group_id: testGroupId,
        name: testGroupName,
        is_active: true,
      });
      
      logSuccess(`Group created with ID: ${createdGroupId}`);
    } catch (error) {
      logError(`Failed to create group: ${error.message}`);
      return false;
    }
    
    // READ - Using getGroupById
    logTest("Reading group using getGroupById...");
    try {
      const group = await getGroupById(createdGroupId);
      if (group && group.whatsapp_group_id === testGroupId) {
        logSuccess(`Group found: ${group.name}`);
      } else {
        logError("Group not found or mismatch");
        return false;
      }
    } catch (error) {
      logError(`Failed to read group: ${error.message}`);
      return false;
    }
    
    // READ - Using getGroup (bot function)
    logTest("Reading group using getGroup (bot function)...");
    try {
      const group = await getGroup(testGroupId);
      if (group && group.whatsapp_group_id === testGroupId) {
        logSuccess(`Bot can read group: ${group.name} (DB ID: ${group.id})`);
      } else {
        logError("Bot cannot read group - this means bot won't find registered groups!");
        return false;
      }
    } catch (error) {
      logError(`Bot failed to read group: ${error.message}`);
      return false;
    }
    
    // UPDATE
    logTest("Updating group name...");
    try {
      const updatedName = `${testGroupName} - Updated`;
      await updateGroup(createdGroupId, { name: updatedName });
      const updatedGroup = await getGroupById(createdGroupId);
      if (updatedGroup.name === updatedName) {
        logSuccess(`Group updated: ${updatedGroup.name}`);
      } else {
        logError("Group update failed - name mismatch");
        return false;
      }
    } catch (error) {
      logError(`Failed to update group: ${error.message}`);
      return false;
    }
    
    // LIST - Using getAllGroups (API function)
    logTest("Listing all groups using getAllGroups (API function)...");
    try {
      const groups = await getAllGroups();
      // Ensure groups is an array
      const groupsArray = Array.isArray(groups) ? groups : [groups].filter(Boolean);
      const testGroup = groupsArray.find(g => g.id === createdGroupId);
      if (testGroup) {
        logSuccess(`API can list groups - found test group: ${testGroup.name}`);
        log(`   Total groups in database: ${groupsArray.length}`);
      } else {
        logError("API cannot find test group in list");
        return false;
      }
    } catch (error) {
      logError(`Failed to list groups: ${error.message}`);
      return false;
    }
    
    // DELETE (cleanup)
    logTest("Cleaning up test group...");
    try {
      await deleteGroup(createdGroupId);
      const deletedGroup = await getGroupById(createdGroupId);
      const isActive = adapter.type === "postgres" 
        ? deletedGroup?.is_active === false 
        : deletedGroup?.is_active === 0;
      
      if (isActive || !deletedGroup) {
        logSuccess("Test group deleted (soft delete - is_active set to false)");
      } else {
        logWarning("Group still active after delete (soft delete may work differently)");
      }
    } catch (error) {
      logError(`Failed to delete group: ${error.message}`);
      // Don't fail the test, just warn
    }
    
    return true;
  } catch (error) {
    logError(`Unexpected error in group operations: ${error.message}`);
    // Cleanup on error
    if (createdGroupId) {
      try {
        await deleteGroup(createdGroupId);
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    return false;
  }
}

async function testCrossModuleAccess() {
  logSection("TEST 3: Cross-Module Database Access");
  
  logTest("Verifying API and Bot modules use same database...");
  
  try {
    // Import bot's group manager (uses same adapter)
    const { getGroup: botGetGroup } = require("../utils/group-manager");
    
    // Get a real group from database
    const allGroupsResult = await getAllGroups();
    const allGroups = Array.isArray(allGroupsResult) ? allGroupsResult : [allGroupsResult].filter(Boolean);
    
    if (allGroups.length === 0) {
      logWarning("No groups in database to test with");
      logWarning("Create a group via dashboard first to test cross-module access");
      return true; // Not a failure, just no data
    }
    
    // Find an active group with whatsapp_group_id
    // Check is_active based on database type
    const testGroup = allGroups.find(g => {
      if (!g.whatsapp_group_id) return false;
      // PostgreSQL uses boolean, SQLite uses 1/0
      const isActive = adapter.type === "postgres" 
        ? g.is_active === true 
        : g.is_active === 1;
      return isActive;
    });
    
    if (!testGroup) {
      logWarning("No active groups with whatsapp_group_id found in database");
      logWarning("Note: getGroup() only finds groups where is_active = true");
      logWarning("Groups with is_active = false will not be found by the bot");
      // Test with inactive group to show the issue
      const inactiveGroup = allGroups.find(g => g.whatsapp_group_id);
      if (inactiveGroup) {
        log(`   Found inactive group: ${inactiveGroup.name} (is_active: ${inactiveGroup.is_active})`);
        logWarning("This group won't be found by bot because is_active is false");
      }
      return true; // Not a failure - just informational
    }
    
    const whatsappGroupId = testGroup.whatsapp_group_id;
    log(`   Testing with group: ${testGroup.name} (ID: ${testGroup.id})`);
    log(`   WhatsApp ID: ${whatsappGroupId}`);
    
    // API module can read
    logTest("API module reading group...");
    const apiGroup = await getGroupById(testGroup.id);
    if (!apiGroup) {
      logError("API module cannot read group by ID");
      return false;
    }
    logSuccess(`API found group: ${apiGroup.name}`);
    
    // Bot module can read
    logTest("Bot module reading group by WhatsApp ID...");
    const botGroup = await botGetGroup(whatsappGroupId);
    
    if (!botGroup) {
      logError("Bot module cannot read group by WhatsApp ID!");
      logError("This means the bot won't find groups registered via API!");
      logWarning("Check the getGroup() function query - it might have an issue");
      return false;
    }
    
    if (apiGroup.id === botGroup.id && apiGroup.whatsapp_group_id === botGroup.whatsapp_group_id) {
      logSuccess("API and Bot modules can access the same group!");
      log(`   Both found: ${apiGroup.name} (DB ID: ${apiGroup.id})`);
      return true;
    } else {
      logError("API and Bot modules see different data!");
      log(`   API group ID: ${apiGroup.id}`);
      log(`   Bot group ID: ${botGroup.id}`);
      return false;
    }
  } catch (error) {
    logError(`Cross-module test failed: ${error.message}`);
    console.error(error);
    return false;
  }
}

async function runAllTests() {
  console.clear();
  logSection("🧪 PostgreSQL Connection Test Suite");
  log("Testing that both API and Bot use PostgreSQL database", "cyan");
  
  const results = {
    connection: false,
    groupOperations: false,
    crossModule: false,
  };
  
  // Test 1: Connection
  results.connection = await testDatabaseConnection();
  if (!results.connection) {
    log("\n⚠️  Connection test failed. Stopping tests.", "yellow");
    process.exit(1);
  }
  
  // Test 2: Group Operations
  results.groupOperations = await testGroupOperations();
  
  // Test 3: Cross-Module Access
  results.crossModule = await testCrossModuleAccess();
  
  // Summary
  logSection("TEST SUMMARY");
  
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  
  logTest("Results:");
  log(`   Connection Test: ${results.connection ? "✅ PASSED" : "❌ FAILED"}`);
  log(`   Group Operations: ${results.groupOperations ? "✅ PASSED" : "❌ FAILED"}`);
  log(`   Cross-Module Access: ${results.crossModule ? "✅ PASSED" : "❌ FAILED"}`);
  
  console.log("\n" + "=".repeat(70));
  if (passed === total) {
    log(`✅ All tests passed! (${passed}/${total})`, "green");
    log("\n✅ Both API and Bot are correctly configured to use PostgreSQL!", "green");
    process.exit(0);
  } else {
    log(`❌ Some tests failed (${passed}/${total} passed)`, "red");
    log("\n⚠️  Please check the errors above and fix the issues.", "yellow");
    process.exit(1);
  }
}

// Run tests
runAllTests().catch((error) => {
  logError(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});

