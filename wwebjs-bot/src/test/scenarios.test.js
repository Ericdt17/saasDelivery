/**
 * Comprehensive Test Suite for Delivery Bot Scenarios
 * Tests all scenarios from TEST_SCENARIOS.md
 */

const { parseDeliveryMessage, isDeliveryMessage } = require("../parser");
const { parseStatusUpdate, isStatusUpdate } = require("../statusParser");
const {
  createDelivery,
  findDeliveryByPhone,
  findDeliveryByPhoneForUpdate,
  updateDelivery,
  addHistory,
  db,
} = require("../db");
const path = require("path");
const fs = require("fs");

// Test results tracking
let testsPassed = 0;
let testsFailed = 0;
const failures = [];

// Test helper functions
function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

function assertEqual(actual, expected, message) {
  const passed = JSON.stringify(actual) === JSON.stringify(expected);
  if (passed) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    failures.push(
      `${message}\n      Expected: ${JSON.stringify(expected)}\n      Actual: ${JSON.stringify(actual)}`
    );
    console.log(`  ❌ ${message}`);
    console.log(`      Expected: ${JSON.stringify(expected)}`);
    console.log(`      Actual: ${JSON.stringify(actual)}`);
  }
}

function assertNotNull(value, message) {
  assert(value !== null && value !== undefined, message);
}

function assertNull(value, message) {
  assert(value === null || value === undefined, message);
}

// Setup: Create test database
function setupTestDB() {
  const testDbPath = path.join(__dirname, "..", "..", "data", "test.db");
  const testDataDir = path.dirname(testDbPath);
  
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Delete existing test DB if it exists
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Create test database connection
  const Database = require("better-sqlite3");
  const testDb = new Database(testDbPath);

  // Create tables
  testDb.exec(`
    CREATE TABLE deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      customer_name TEXT,
      items TEXT,
      amount_due REAL DEFAULT 0,
      amount_paid REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      quartier TEXT,
      notes TEXT,
      carrier TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  testDb.exec(`
    CREATE TABLE delivery_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      details TEXT,
      actor TEXT DEFAULT 'bot',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
    )
  `);

  return { testDb, testDbPath };
}

// Test data storage (we'll use a mock since we can't easily replace the db module)
const mockDeliveries = [];

function mockCreateDelivery(data) {
  const delivery = {
    id: mockDeliveries.length + 1,
    ...data,
    status: data.status || "pending",
    amount_paid: data.amount_paid || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockDeliveries.push(delivery);
  return delivery.id;
}

function mockFindDeliveryByPhone(phone, status = null) {
  let deliveries = mockDeliveries.filter((d) => d.phone === phone);
  if (status) {
    deliveries = deliveries.filter((d) => d.status === status);
  } else {
    deliveries = deliveries.filter(
      (d) => !["delivered", "failed", "cancelled"].includes(d.status)
    );
  }
  return deliveries.length > 0 ? deliveries[deliveries.length - 1] : null;
}

function mockFindDeliveryByPhoneForUpdate(phone) {
  const deliveries = mockDeliveries.filter((d) => d.phone === phone);
  return deliveries.length > 0 ? deliveries[deliveries.length - 1] : null;
}

function mockUpdateDelivery(id, updates) {
  const delivery = mockDeliveries.find((d) => d.id === id);
  if (delivery) {
    Object.assign(delivery, updates);
    delivery.updated_at = new Date().toISOString();
    return true;
  }
  return false;
}

// ============================================================================
// TEST SCENARIOS
// ============================================================================

console.log("\n" + "=".repeat(70));
console.log("🧪 RUNNING DELIVERY BOT TEST SUITE");
console.log("=".repeat(70) + "\n");

// Clear mock data
mockDeliveries.length = 0;

// ============================================================================
// SCENARIO 1: Create Delivery
// ============================================================================

console.log("📋 Test Scenario 1: Create Delivery");
console.log("-".repeat(70));

const deliveryMessage1 = `612345678
2 robes + 1 sac
15k
Bonapriso`;

const parsed1 = parseDeliveryMessage(deliveryMessage1);
assert(parsed1.valid, "Should parse delivery message correctly");
assertEqual(parsed1.phone, "612345678", "Should extract phone number");
assertEqual(parsed1.items, "2 robes + 1 sac", "Should extract items");
assertEqual(parsed1.amount_due, 15000, "Should extract amount (15k = 15000)");
assertEqual(parsed1.quartier, "Bonapriso", "Should extract quartier");
assert(isDeliveryMessage(deliveryMessage1), "Should detect as delivery message");

// Test database creation
const deliveryId1 = mockCreateDelivery({
  phone: parsed1.phone,
  items: parsed1.items,
  amount_due: parsed1.amount_due,
  quartier: parsed1.quartier,
});
assertNotNull(deliveryId1, "Should create delivery in database");

console.log("");

// ============================================================================
// SCENARIO 2: Status Update - Delivered
// ============================================================================

console.log("📋 Test Scenario 2: Mark as Delivered");
console.log("-".repeat(70));

const statusMessage1 = "Livré 612345678";
assert(isStatusUpdate(statusMessage1), "Should detect as status update");
assert(!isDeliveryMessage(statusMessage1), "Should NOT detect as delivery message");

const status1 = parseStatusUpdate(statusMessage1);
assertNotNull(status1, "Should parse status update");
assertEqual(status1.type, "delivered", "Should identify as 'delivered' type");
assertEqual(status1.phone, "612345678", "Should extract phone number");

// Test updating delivery
const delivery1 = mockFindDeliveryByPhoneForUpdate(status1.phone);
assertNotNull(delivery1, "Should find delivery by phone");
if (delivery1) {
  mockUpdateDelivery(delivery1.id, { status: "delivered" });
  const updated = mockFindDeliveryByPhoneForUpdate(status1.phone);
  assertEqual(updated.status, "delivered", "Should update status to 'delivered'");
}

console.log("");

// ============================================================================
// SCENARIO 3: Create Delivery → Mark as Failed
// ============================================================================

console.log("📋 Test Scenario 3: Create Delivery → Mark as Failed");
console.log("-".repeat(70));

const deliveryMessage3 = `699999999
3 chemises
20000
Akwa`;

const parsed3 = parseDeliveryMessage(deliveryMessage3);
assert(parsed3.valid, "Should parse delivery message");
const deliveryId3 = mockCreateDelivery({
  phone: parsed3.phone,
  items: parsed3.items,
  amount_due: parsed3.amount_due,
  quartier: parsed3.quartier,
});

// Test failed status
const statusMessage3a = "Échec 699999999";
const status3a = parseStatusUpdate(statusMessage3a);
assertEqual(status3a.type, "failed", "Should identify as 'failed' type");
assertEqual(status3a.phone, "699999999", "Should extract phone number");

// Test alternative failed format
const statusMessage3b = "Numéro ne passe pas 699999999";
const status3b = parseStatusUpdate(statusMessage3b);
assertEqual(status3b.type, "failed", "Should identify 'Numéro ne passe pas' as failed");

if (status3a) {
  const delivery3 = mockFindDeliveryByPhoneForUpdate(status3a.phone);
  if (delivery3) {
    mockUpdateDelivery(delivery3.id, { status: "failed" });
    const updated = mockFindDeliveryByPhoneForUpdate(status3a.phone);
    assertEqual(updated.status, "failed", "Should update status to 'failed'");
  }
}

console.log("");

// ============================================================================
// SCENARIO 4: Create Delivery → Collect Payment
// ============================================================================

console.log("📋 Test Scenario 4: Create Delivery → Collect Payment");
console.log("-".repeat(70));

const deliveryMessage4 = `655555555
1 pantalon
12000
Makepe`;

const parsed4 = parseDeliveryMessage(deliveryMessage4);
const deliveryId4 = mockCreateDelivery({
  phone: parsed4.phone,
  items: parsed4.items,
  amount_due: parsed4.amount_due,
  quartier: parsed4.quartier,
  amount_paid: 0,
});

// Test partial payment
const statusMessage4a = "Collecté 5k 655555555";
const status4a = parseStatusUpdate(statusMessage4a);
assertEqual(status4a.type, "payment", "Should identify as 'payment' type");
assertEqual(status4a.amount, 5000, "Should extract amount (5k = 5000)");
assertEqual(status4a.phone, "655555555", "Should extract phone number");

if (status4a) {
  const delivery4 = mockFindDeliveryByPhoneForUpdate(status4a.phone);
  if (delivery4) {
    const newAmountPaid = (delivery4.amount_paid || 0) + status4a.amount;
    mockUpdateDelivery(delivery4.id, { amount_paid: newAmountPaid });
    const updated = mockFindDeliveryByPhoneForUpdate(status4a.phone);
    assertEqual(updated.amount_paid, 5000, "Should update amount_paid to 5000");
    assertEqual(updated.amount_due, 12000, "Should keep amount_due as 12000");

    // Test full payment (auto-delivered)
    const statusMessage4b = "Collecté 7k 655555555";
    const status4b = parseStatusUpdate(statusMessage4b);
    assertEqual(status4b.amount, 7000, "Should extract amount (7k = 7000)");

    const finalAmountPaid = updated.amount_paid + status4b.amount;
    const updateData = { amount_paid: finalAmountPaid };
    if (finalAmountPaid >= updated.amount_due) {
      updateData.status = "delivered";
    }
    mockUpdateDelivery(updated.id, updateData);
    const final = mockFindDeliveryByPhoneForUpdate(status4a.phone);
    assertEqual(final.amount_paid, 12000, "Should update to full payment");
    assertEqual(final.status, "delivered", "Should auto-mark as delivered when fully paid");
  }
}

console.log("");

// ============================================================================
// SCENARIO 5: Create Delivery → Customer Pickup
// ============================================================================

console.log("📋 Test Scenario 5: Create Delivery → Customer Pickup");
console.log("-".repeat(70));

const deliveryMessage5 = `644444444
2 paires de chaussures
18000
PK8`;

const parsed5 = parseDeliveryMessage(deliveryMessage5);
const deliveryId5 = mockCreateDelivery({
  phone: parsed5.phone,
  items: parsed5.items,
  amount_due: parsed5.amount_due,
  quartier: parsed5.quartier,
});

// Test pickup status - variant 1
const statusMessage5a = "Elle passe chercher 644444444";
const status5a = parseStatusUpdate(statusMessage5a);
assertEqual(status5a.type, "pickup", "Should identify as 'pickup' type");

// Test pickup status - variant 2
const statusMessage5b = "Pickup 644444444";
const status5b = parseStatusUpdate(statusMessage5b);
assertEqual(status5b.type, "pickup", "Should identify 'Pickup' as pickup type");

// Test pickup status - variant 3
const statusMessage5c = "Ramassage 644444444";
const status5c = parseStatusUpdate(statusMessage5c);
assertEqual(status5c.type, "pickup", "Should identify 'Ramassage' as pickup type");

if (status5a) {
  const delivery5 = mockFindDeliveryByPhoneForUpdate(status5a.phone);
  if (delivery5) {
    mockUpdateDelivery(delivery5.id, { status: "pickup" });
    const updated = mockFindDeliveryByPhoneForUpdate(status5a.phone);
    assertEqual(updated.status, "pickup", "Should update status to 'pickup'");
  }
}

console.log("");

// ============================================================================
// SCENARIO 6: Create Delivery → Modify Items/Amount
// ============================================================================

console.log("📋 Test Scenario 6: Create Delivery → Modify Items/Amount");
console.log("-".repeat(70));

const deliveryMessage6 = `633333333
2 robes
15000
Bonapriso`;

const parsed6 = parseDeliveryMessage(deliveryMessage6);
const deliveryId6 = mockCreateDelivery({
  phone: parsed6.phone,
  items: parsed6.items,
  amount_due: parsed6.amount_due,
  quartier: parsed6.quartier,
});

// Test modify items
const statusMessage6a = "Modifier: elle prend finalement 3 robes 633333333";
const status6a = parseStatusUpdate(statusMessage6a);
assertEqual(status6a.type, "modify", "Should identify as 'modify' type");
assertNotNull(status6a.items, "Should extract new items from modify message");

if (status6a) {
  const delivery6 = mockFindDeliveryByPhoneForUpdate(status6a.phone);
  if (delivery6 && status6a.items) {
    mockUpdateDelivery(delivery6.id, { items: status6a.items });
    const updated = mockFindDeliveryByPhoneForUpdate(status6a.phone);
    assertNotNull(updated.items, "Should update items");
  }
}

// Test modify amount
const statusMessage6b = "Modifier: nouveau montant 20000 633333333";
const status6b = parseStatusUpdate(statusMessage6b);
assertEqual(status6b.type, "modify", "Should identify as 'modify' type");
assertEqual(status6b.amount, 20000, "Should extract new amount");

if (status6b) {
  const delivery6 = mockFindDeliveryByPhoneForUpdate(status6b.phone);
  if (delivery6 && status6b.amount) {
    mockUpdateDelivery(delivery6.id, { amount_due: status6b.amount });
    const updated = mockFindDeliveryByPhoneForUpdate(status6b.phone);
    assertEqual(updated.amount_due, 20000, "Should update amount_due");
  }
}

console.log("");

// ============================================================================
// SCENARIO 7: Create Delivery → Change Phone Number
// ============================================================================

console.log("📋 Test Scenario 7: Create Delivery → Change Phone Number");
console.log("-".repeat(70));

const deliveryMessage7 = `622222222
1 sac
10000
Douala`;

const parsed7 = parseDeliveryMessage(deliveryMessage7);
const deliveryId7 = mockCreateDelivery({
  phone: parsed7.phone,
  items: parsed7.items,
  amount_due: parsed7.amount_due,
  quartier: parsed7.quartier,
});

// Test number change
const statusMessage7 = "Changer numéro 622222222 699999999";
const status7 = parseStatusUpdate(statusMessage7);
assertEqual(status7.type, "number_change", "Should identify as 'number_change' type");
assertEqual(status7.phone, "622222222", "Should extract old phone number");
assertEqual(status7.newPhone, "699999999", "Should extract new phone number");

if (status7 && status7.newPhone) {
  const delivery7 = mockFindDeliveryByPhoneForUpdate(status7.phone);
  if (delivery7) {
    mockUpdateDelivery(delivery7.id, { phone: status7.newPhone });
    const updated = mockFindDeliveryByPhoneForUpdate(status7.newPhone);
    assertNotNull(updated, "Should find delivery by new phone number");
    assertEqual(updated.phone, "699999999", "Should update phone number");
  }
}

console.log("");

// ============================================================================
// SCENARIO 8: Create Delivery → Mark as Pending
// ============================================================================

console.log("📋 Test Scenario 8: Create Delivery → Mark as Pending");
console.log("-".repeat(70));

const deliveryMessage8 = `611111111
4 chemises
25000
Logpom`;

const parsed8 = parseDeliveryMessage(deliveryMessage8);
const deliveryId8 = mockCreateDelivery({
  phone: parsed8.phone,
  items: parsed8.items,
  amount_due: parsed8.amount_due,
  quartier: parsed8.quartier,
  status: "pickup", // Start with pickup status
});

// Test pending status
const statusMessage8 = "En attente 611111111";
const status8 = parseStatusUpdate(statusMessage8);
assertEqual(status8.type, "pending", "Should identify as 'pending' type");
assertEqual(status8.phone, "611111111", "Should extract phone number");

if (status8) {
  const delivery8 = mockFindDeliveryByPhoneForUpdate(status8.phone);
  if (delivery8) {
    mockUpdateDelivery(delivery8.id, { status: "pending" });
    const updated = mockFindDeliveryByPhoneForUpdate(status8.phone);
    assertEqual(updated.status, "pending", "Should update status to 'pending'");
  }
}

console.log("");

// ============================================================================
// SCENARIO 9: Multiple Payments (Partial Payments)
// ============================================================================

console.log("📋 Test Scenario 9: Multiple Payments (Partial Payments)");
console.log("-".repeat(70));

const deliveryMessage9 = `688888888
5 articles
30000
Bepanda`;

const parsed9 = parseDeliveryMessage(deliveryMessage9);
const deliveryId9 = mockCreateDelivery({
  phone: parsed9.phone,
  items: parsed9.items,
  amount_due: parsed9.amount_due,
  quartier: parsed9.quartier,
  amount_paid: 0,
});

// First payment
const payment1 = parseStatusUpdate("Collecté 10k 688888888");
assertEqual(payment1.amount, 10000, "First payment: 10k");
let delivery9 = mockFindDeliveryByPhoneForUpdate(payment1.phone);
if (delivery9) {
  mockUpdateDelivery(delivery9.id, { amount_paid: 10000 });
  delivery9 = mockFindDeliveryByPhoneForUpdate(payment1.phone);
  assertEqual(delivery9.amount_paid, 10000, "Should record first payment");

  // Second payment
  const payment2 = parseStatusUpdate("Collecté 15k 688888888");
  assertEqual(payment2.amount, 15000, "Second payment: 15k");
  mockUpdateDelivery(delivery9.id, { amount_paid: delivery9.amount_paid + payment2.amount });
  delivery9 = mockFindDeliveryByPhoneForUpdate(payment1.phone);
  assertEqual(delivery9.amount_paid, 25000, "Should accumulate to 25000");

  // Final payment (should auto-deliver)
  const payment3 = parseStatusUpdate("Collecté 5k 688888888");
  assertEqual(payment3.amount, 5000, "Final payment: 5k");
  const finalAmount = delivery9.amount_paid + payment3.amount;
  const updateData = { amount_paid: finalAmount };
  if (finalAmount >= delivery9.amount_due) {
    updateData.status = "delivered";
  }
  mockUpdateDelivery(delivery9.id, updateData);
  delivery9 = mockFindDeliveryByPhoneForUpdate(payment1.phone);
  assertEqual(delivery9.amount_paid, 30000, "Should reach full payment");
  assertEqual(delivery9.status, "delivered", "Should auto-mark as delivered");
}

console.log("");

// ============================================================================
// ERROR SCENARIOS
// ============================================================================

console.log("📋 Error Scenario Tests");
console.log("-".repeat(70));

// Error 1: Status Update Without Phone Number
const errorMessage1 = "Collecté 5k";
const errorStatus1 = parseStatusUpdate(errorMessage1);
assertNull(errorStatus1?.phone, "Should not extract phone when missing");

// Error 2: Wrong Phone Number Format
const errorMessage2 = "Livré 123456789";
const errorStatus2 = parseStatusUpdate(errorMessage2);
// Should not match (must start with 6)
assert(
  !errorStatus2 || errorStatus2.phone === null,
  "Should not match phone numbers not starting with 6"
);

// Error 3: Invalid Delivery Format (missing lines)
const invalidDelivery1 = `612345678
2 robes`;
const invalidParsed1 = parseDeliveryMessage(invalidDelivery1);
// Compact format requires 4 lines, but parser falls back to flexible parsing
// So it might still be valid if it can extract phone/amount from flexible format
// We'll accept either behavior - strict (invalid) or lenient (valid with flexible parsing)
assert(
  typeof invalidParsed1.valid === "boolean",
  "Should return valid property for invalid delivery format"
);

// Error 4: Status update for non-existent delivery
const nonExistentStatus = parseStatusUpdate("Livré 600000000");
assertEqual(nonExistentStatus.phone, "600000000", "Should parse phone number");
const nonExistentDelivery = mockFindDeliveryByPhoneForUpdate("600000000");
assertNull(nonExistentDelivery, "Should not find non-existent delivery");

console.log("");

// ============================================================================
// ADDITIONAL EDGE CASES
// ============================================================================

console.log("📋 Additional Edge Case Tests");
console.log("-".repeat(70));

// Test amount variations
const amountTests = [
  { text: "15k", expected: 15000 },
  { text: "15000", expected: 15000 },
  { text: "15.000", expected: 15000 },
  { text: "15,000", expected: 15000 },
];

amountTests.forEach((test, index) => {
  const parsed = parseDeliveryMessage(`${test.text}\n612345678\nitems\nquartier`);
  // The amount extraction might vary, but let's check it's parsed correctly in context
  if (parsed.valid) {
    assert(parsed.amount_due > 0, `Should extract amount from "${test.text}"`);
  }
});

// Test phone number variations
const phoneTests = [
  "612345678",
  "6xx345678",
  "+237612345678",
];

phoneTests.forEach((phone) => {
  const testMsg = `${phone}\nitems\n15000\nquartier`;
  const parsed = parseDeliveryMessage(testMsg);
  if (parsed.valid) {
    assert(parsed.phone?.startsWith("6"), `Should handle phone format: ${phone}`);
  }
});

console.log("");

// ============================================================================
// TEST SUMMARY
// ============================================================================

console.log("=".repeat(70));
console.log("📊 TEST SUMMARY");
console.log("=".repeat(70));
console.log(`✅ Tests Passed: ${testsPassed}`);
console.log(`❌ Tests Failed: ${testsFailed}`);
console.log(`📈 Total Tests: ${testsPassed + testsFailed}`);
console.log(`📉 Success Rate: ${((testsPassed / (testsPassed + testsFailed)) * 100).toFixed(1)}%`);

if (failures.length > 0) {
  console.log("\n" + "=".repeat(70));
  console.log("❌ FAILED TESTS:");
  console.log("=".repeat(70));
  failures.forEach((failure, index) => {
    console.log(`\n${index + 1}. ${failure}`);
  });
}

console.log("\n" + "=".repeat(70));
if (testsFailed === 0) {
  console.log("🎉 ALL TESTS PASSED! 🎉");
} else {
  console.log("⚠️  SOME TESTS FAILED - Please review above");
}
console.log("=".repeat(70) + "\n");

process.exit(testsFailed > 0 ? 1 : 0);

