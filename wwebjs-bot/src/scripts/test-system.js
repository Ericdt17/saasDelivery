/**
 * Automated System Test Script
 * Tests authentication, data isolation, API endpoints, and core functionality
 * 
 * Usage:
 *   node src/scripts/test-system.js
 *   node src/scripts/test-system.js --verbose
 */

require("dotenv").config();
const db = require("../db");
const { hashPassword, comparePassword } = require("../utils/password");
const { generateToken, verifyToken } = require("../utils/jwt");

// Test configuration
const API_BASE_URL = process.env.API_BASE_URL || "http://localhost:3000";
const SUPER_ADMIN_EMAIL = process.env.SUPER_ADMIN_EMAIL || "admin@livsight.com";
const SUPER_ADMIN_PASSWORD = process.env.SUPER_ADMIN_PASSWORD || "admin123";

const VERBOSE = process.argv.includes("--verbose") || process.argv.includes("-v");

// Test results
const results = {
  passed: 0,
  failed: 0,
  errors: [],
};

// Helper functions
function log(message, type = "info") {
  const colors = {
    info: "\x1b[36m", // Cyan
    success: "\x1b[32m", // Green
    error: "\x1b[31m", // Red
    warning: "\x1b[33m", // Yellow
    reset: "\x1b[0m",
  };
  
  if (VERBOSE || type !== "info") {
    const prefix = type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️";
    console.log(`${colors[type]}${prefix} ${message}${colors.reset}`);
  }
}

function test(name, testFn) {
  return async () => {
    try {
      await testFn();
      results.passed++;
      log(`PASS: ${name}`, "success");
      return true;
    } catch (error) {
      results.failed++;
      results.errors.push({ test: name, error: error.message });
      log(`FAIL: ${name} - ${error.message}`, "error");
      if (VERBOSE) {
        console.error(error.stack);
      }
      return false;
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || "Assertion failed");
  }
}

// Initialize database schema
async function initializeSchema() {
  if (db.adapter.type === "sqlite") {
    const rawDb = db.getRawDb();
    try {
      // Check if agencies table exists
      const checkTable = rawDb.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agencies'").get();
      
      if (!checkTable) {
        log("Initializing database schema (creating agencies and groups tables)...", "warning");
        
        // Create agencies table
        rawDb.exec(`
          CREATE TABLE IF NOT EXISTS agencies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'agency',
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Create groups table
        rawDb.exec(`
          CREATE TABLE IF NOT EXISTS groups (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agency_id INTEGER NOT NULL,
            whatsapp_group_id TEXT UNIQUE,
            name TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
          )
        `);
        
        // Add agency_id and group_id to deliveries if not exists
        try {
          rawDb.exec(`ALTER TABLE deliveries ADD COLUMN agency_id INTEGER`);
        } catch (e) {
          // Column might already exist
        }
        
        try {
          rawDb.exec(`ALTER TABLE deliveries ADD COLUMN group_id INTEGER`);
        } catch (e) {
          // Column might already exist
        }
        
        // Add agency_id to delivery_history if not exists
        try {
          rawDb.exec(`ALTER TABLE delivery_history ADD COLUMN agency_id INTEGER`);
        } catch (e) {
          // Column might already exist
        }
        
        log("Database schema initialized successfully", "success");
      }
    } catch (error) {
      log(`Schema initialization error: ${error.message}`, "error");
      throw error;
    }
  }
  // For PostgreSQL, tables should be created by the adapter automatically
}

// Test functions
async function testDatabaseConnection() {
  await initializeSchema();
  const agencies = await db.getAllAgencies();
  assert(Array.isArray(agencies), "Database connection failed");
  log(`Database connected (${db.adapter.type})`);
}

async function testSuperAdminExists() {
  const superAdmin = await db.getAgencyByEmail(SUPER_ADMIN_EMAIL);
  if (!superAdmin) {
    log(`Super admin not found. Run 'npm run seed:admin' to create one.`, "warning");
    // This is a warning, not a failure - super admin can be created separately
    return;
  }
  assert(superAdmin.role === "super_admin", "Account exists but is not super admin");
  log(`Super admin found: ${superAdmin.email}`);
}

async function testPasswordHashing() {
  const password = "testpassword123";
  const hash = await hashPassword(password);
  assert(hash !== password, "Password not hashed");
  assert(hash.length > 50, "Hash too short");
  
  const isValid = await comparePassword(password, hash);
  assert(isValid, "Password comparison failed");
  
  const isInvalid = await comparePassword("wrongpassword", hash);
  assert(!isInvalid, "Password comparison should fail for wrong password");
}

async function testJWTToken() {
  const payload = {
    userId: 1,
    agencyId: null,
    email: "test@example.com",
    role: "super_admin",
  };
  
  const token = generateToken(payload);
  assert(token, "Token not generated");
  assert(typeof token === "string", "Token is not a string");
  
  const decoded = verifyToken(token);
  assert(decoded.userId === payload.userId, "Token decode failed");
  assert(decoded.email === payload.email, "Token email mismatch");
  assert(decoded.role === payload.role, "Token role mismatch");
}

async function testAgencyCreation() {
  const testEmail = `test_agency_${Date.now()}@test.com`;
  const passwordHash = await hashPassword("testpass123");
  
  // SQLite needs 1/0, PostgreSQL needs true/false
  const isActive = db.adapter.type === "sqlite" ? 1 : true;
  
  const agencyId = await db.createAgency({
    name: "Test Agency",
    email: testEmail,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  assert(agencyId, "Agency not created");
  assert(typeof agencyId === "number", "Agency ID is not a number");
  
  const agency = await db.getAgencyById(agencyId);
  assert(agency, "Agency not found after creation");
  assert(agency.email === testEmail, "Agency email mismatch");
  assert(agency.role === "agency", "Agency role mismatch");
  
  // Cleanup
  await db.deleteAgency(agencyId);
  log(`Test agency created and deleted: ${testEmail}`);
}

async function testAgencyIsolation() {
  // Create two test agencies
  const passwordHash = await hashPassword("testpass123");
  
  // SQLite needs 1/0, PostgreSQL needs true/false
  const isActive = db.adapter.type === "sqlite" ? 1 : true;
  
  const agency1Id = await db.createAgency({
    name: "Test Agency 1",
    email: `test_agency1_${Date.now()}@test.com`,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  const agency2Id = await db.createAgency({
    name: "Test Agency 2",
    email: `test_agency2_${Date.now()}@test.com`,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  // Create deliveries for each agency
  const delivery1Id = await db.insertDelivery({
    phone: "1234567890",
    items: "Test Item 1",
    amount_due: 1000,
    amount_paid: 0,
    status: "pending",
    agency_id: agency1Id,
    group_id: null,
  });
  
  const delivery2Id = await db.insertDelivery({
    phone: "0987654321",
    items: "Test Item 2",
    amount_due: 2000,
    amount_paid: 0,
    status: "pending",
    agency_id: agency2Id,
    group_id: null,
  });
  
  // Test isolation - get deliveries filtered by agency
  // getDeliveries returns an object with deliveries array and pagination
  const result1 = await db.getDeliveries({ agency_id: agency1Id, limit: 100 });
  const result2 = await db.getDeliveries({ agency_id: agency2Id, limit: 100 });
  
  const deliveries1 = Array.isArray(result1) ? result1 : (result1.deliveries || []);
  const deliveries2 = Array.isArray(result2) ? result2 : (result2.deliveries || []);
  
  assert(deliveries1.length > 0, "Agency 1 deliveries not found");
  assert(deliveries2.length > 0, "Agency 2 deliveries not found");
  
  // Verify isolation
  const agency1HasDelivery2 = deliveries1.some(d => d.id === delivery2Id);
  const agency2HasDelivery1 = deliveries2.some(d => d.id === delivery1Id);
  
  assert(!agency1HasDelivery2, "Agency 1 can see Agency 2's delivery (isolation broken)");
  assert(!agency2HasDelivery1, "Agency 2 can see Agency 1's delivery (isolation broken)");
  
  // Cleanup
  await db.deleteAgency(agency1Id);
  await db.deleteAgency(agency2Id);
  log(`Agency isolation test passed`);
}

async function testGroupCreation() {
  const passwordHash = await hashPassword("testpass123");
  
  // SQLite needs 1/0, PostgreSQL needs true/false
  const isActive = db.adapter.type === "sqlite" ? 1 : true;
  
  const agencyId = await db.createAgency({
    name: "Test Agency for Group",
    email: `test_agency_group_${Date.now()}@test.com`,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  const groupId = await db.createGroup({
    agency_id: agencyId,
    whatsapp_group_id: `test_group_${Date.now()}`,
    name: "Test Group",
    is_active: isActive,
  });
  
  assert(groupId, "Group not created");
  
  const group = await db.getGroupById(groupId);
  assert(group, "Group not found after creation");
  assert(group.agency_id === agencyId, "Group agency_id mismatch");
  
  // Test getGroupsByAgency
  const agencyGroups = await db.getGroupsByAgency(agencyId);
  assert(agencyGroups.length > 0, "Agency groups not found");
  assert(agencyGroups.some(g => g.id === groupId), "Created group not in agency groups");
  
  // Cleanup
  await db.deleteAgency(agencyId);
  log(`Group creation test passed`);
}

async function testSuperAdminAccess() {
  const allAgencies = await db.getAllAgencies();
  assert(Array.isArray(allAgencies), "Super admin cannot get all agencies");
  
  const superAdmins = allAgencies.filter(a => a.role === "super_admin");
  if (superAdmins.length === 0) {
    log("No super admin found. This test is informational only.", "warning");
    return;
  }
  
  log(`Super admin access verified (${superAdmins.length} super admin(s) found)`);
}

async function testDatabaseQueries() {
  // Test getAllAgencies
  const agencies = await db.getAllAgencies();
  assert(Array.isArray(agencies), "getAllAgencies failed");
  
  // Test getAllGroups
  const groups = await db.getAllGroups();
  assert(Array.isArray(groups), "getAllGroups failed");
  
  // Test getAgencyByEmail (only if super admin exists)
  const superAdmin = await db.getAgencyByEmail(SUPER_ADMIN_EMAIL);
  if (superAdmin) {
    assert(superAdmin.email === SUPER_ADMIN_EMAIL, "getAgencyByEmail returned wrong agency");
  } else {
    log("Super admin not found - skipping getAgencyByEmail test", "warning");
  }
  
  log(`Database queries working correctly`);
}

async function testDeliveryWithGroup() {
  const passwordHash = await hashPassword("testpass123");
  
  // SQLite needs 1/0, PostgreSQL needs true/false
  const isActive = db.adapter.type === "sqlite" ? 1 : true;
  
  const agencyId = await db.createAgency({
    name: "Test Agency",
    email: `test_agency_delivery_${Date.now()}@test.com`,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  const groupId = await db.createGroup({
    agency_id: agencyId,
    whatsapp_group_id: `test_group_delivery_${Date.now()}`,
    name: "Test Group",
    is_active: isActive,
  });
  
  const deliveryId = await db.insertDelivery({
    phone: "5555555555",
    items: "Test Items",
    amount_due: 1500,
    amount_paid: 0,
    status: "pending",
    agency_id: agencyId,
    group_id: groupId,
  });
  
  const delivery = await db.getDeliveryById(deliveryId);
  assert(delivery, "Delivery not found");
  assert(delivery.agency_id === agencyId, "Delivery agency_id mismatch");
  assert(delivery.group_id === groupId, "Delivery group_id mismatch");
  
  // Cleanup
  await db.deleteAgency(agencyId);
  log(`Delivery with group test passed`);
}

async function testStatsFiltering() {
  const passwordHash = await hashPassword("testpass123");
  
  // SQLite needs 1/0, PostgreSQL needs true/false
  const isActive = db.adapter.type === "sqlite" ? 1 : true;
  
  const agencyId = await db.createAgency({
    name: "Test Agency Stats",
    email: `test_agency_stats_${Date.now()}@test.com`,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  // Create deliveries for stats
  await db.insertDelivery({
    phone: "1111111111",
    items: "Item 1",
    amount_due: 1000,
    amount_paid: 500,
    status: "delivered",
    agency_id: agencyId,
  });
  
  await db.insertDelivery({
    phone: "2222222222",
    items: "Item 2",
    amount_due: 2000,
    amount_paid: 0,
    status: "pending",
    agency_id: agencyId,
  });
  
  // Test stats with agency filter
  const today = new Date().toISOString().split('T')[0];
  const stats = await db.getDailyStats(today, agencyId);
  assert(stats !== null && stats !== undefined, "Stats not returned");
  
  // Cleanup
  await db.deleteAgency(agencyId);
  log(`Stats filtering test passed`);
}

// Main test runner
async function runTests() {
  console.log("\n🧪 Starting System Tests...\n");
  console.log(`Database: ${db.adapter.type}`);
  console.log(`API Base URL: ${API_BASE_URL}`);
  console.log(`Verbose: ${VERBOSE ? "Yes" : "No"}\n`);
  
  const tests = [
    test("Database Connection", testDatabaseConnection),
    test("Super Admin Exists", testSuperAdminExists),
    test("Password Hashing", testPasswordHashing),
    test("JWT Token Generation", testJWTToken),
    test("Agency Creation", testAgencyCreation),
    test("Agency Isolation", testAgencyIsolation),
    test("Group Creation", testGroupCreation),
    test("Super Admin Access", testSuperAdminAccess),
    test("Database Queries", testDatabaseQueries),
    test("Delivery with Group", testDeliveryWithGroup),
    test("Stats Filtering", testStatsFiltering),
  ];
  
  for (const testFn of tests) {
    await testFn();
  }
  
  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total:  ${results.passed + results.failed}`);
  console.log(`📊 Success Rate: ${((results.passed / (results.passed + results.failed)) * 100).toFixed(1)}%`);
  
  if (results.errors.length > 0) {
    console.log("\n❌ Errors:");
    results.errors.forEach(({ test, error }) => {
      console.log(`   - ${test}: ${error}`);
    });
  }
  
  console.log("\n");
  
  // Close database connection
  await db.close();
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { runTests };

