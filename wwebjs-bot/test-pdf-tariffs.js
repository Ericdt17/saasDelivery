/**
 * Test Suite for PDF Tariffs Calculation
 * Tests that the PDF correctly calculates and groups tariffs:
 * - Fixed status tariffs (pickup, zone1, zone2) are separated
 * - Quartier-based tariffs use standard tariffs when all match
 * - Modified tariffs are preserved in totals
 * - Total calculations are accurate
 */

const db = require("./src/db");
const bcrypt = require("bcrypt");

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

function assertEqual(actual, expected, message, tolerance = 0.01) {
  const actualNum = parseFloat(actual) || 0;
  const expectedNum = parseFloat(expected) || 0;
  const passed = Math.abs(actualNum - expectedNum) < tolerance;
  
  if (passed) {
    testsPassed++;
    console.log(`  ✅ ${message}`);
  } else {
    testsFailed++;
    failures.push(
      `${message}\n      Expected: ${expectedNum}\n      Actual: ${actualNum}`
    );
    console.log(`  ❌ ${message}`);
    console.log(`      Expected: ${expectedNum}`);
    console.log(`      Actual: ${actualNum}`);
  }
}

// Helper to create test agency
async function createTestAgency() {
  const passwordHash = await bcrypt.hash("testpass123", 10);
  const isActive = process.env.DATABASE_URL ? true : 1;
  
  const agencyId = await db.createAgency({
    name: `Test Agency PDF ${Date.now()}`,
    email: `test_pdf_agency_${Date.now()}@test.com`,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  return agencyId;
}

// Helper to create test group
async function createTestGroup(agencyId) {
  const groupId = await db.createGroup({
    name: `Test Group PDF ${Date.now()}`,
    agency_id: agencyId,
  });
  
  return groupId;
}

// Helper to create test tariff
async function createTestTariff(agencyId, quartier, tarifAmount) {
  const tariffId = await db.createTariff({
    agency_id: agencyId,
    quartier: quartier,
    tarif_amount: tarifAmount,
  });
  
  return tariffId;
}

// Helper to create test delivery
async function createTestDelivery(agencyId, groupId, options = {}) {
  const deliveryId = await db.insertDelivery({
    phone: options.phone || `555${Date.now()}`,
    items: options.items || "Test Items",
    amount_due: options.amount_due || 140000,
    amount_paid: options.amount_paid || 0,
    status: options.status || "pending",
    quartier: options.quartier || null,
    agency_id: agencyId,
    group_id: groupId,
    delivery_fee: options.delivery_fee || null,
  });
  
  return deliveryId;
}

// Simulate PDF tariff calculation logic
function calculatePDFTariffs(deliveries, standardTariffs) {
  // Filter deliveries that have tariffs applied
  const deliveriesWithTariffs = deliveries.filter(
    (d) => d.status === "delivered" || d.status === "client_absent" || 
           d.status === "pickup" || d.status === "present_ne_decroche_zone1" || 
           d.status === "present_ne_decroche_zone2"
  );

  // Separate fixed-status deliveries
  const fixedStatusTarifs = {
    pickup: { label: "Au bureau", count: 0, total: 0, fixedTariff: 1000 },
    present_ne_decroche_zone1: { label: "CPCNDP Z1", count: 0, total: 0, fixedTariff: 500 },
    present_ne_decroche_zone2: { label: "CPCNDP Z2", count: 0, total: 0, fixedTariff: 1000 },
  };

  const tarifsParQuartier = {};
  let totalTarifs = 0;

  // Calculate totals and group deliveries
  deliveriesWithTariffs.forEach((delivery) => {
    const deliveryFee = parseFloat(delivery.delivery_fee) || 0;
    totalTarifs += deliveryFee;

    // Handle fixed-status deliveries separately
    if (delivery.status === "pickup" || delivery.status === "present_ne_decroche_zone1" || 
        delivery.status === "present_ne_decroche_zone2") {
      if (fixedStatusTarifs[delivery.status]) {
        fixedStatusTarifs[delivery.status].count += 1;
        fixedStatusTarifs[delivery.status].total += deliveryFee;
      }
    } 
    // Group quartier-based deliveries (delivered, client_absent only) by quartier
    else if ((delivery.status === "delivered" || delivery.status === "client_absent") && 
             delivery.quartier && deliveryFee > 0) {
      if (!tarifsParQuartier[delivery.quartier]) {
        tarifsParQuartier[delivery.quartier] = {
          quartier: delivery.quartier,
          count: 0,
          total: 0,
          deliveryFees: [],
        };
      }
      tarifsParQuartier[delivery.quartier].count += 1;
      tarifsParQuartier[delivery.quartier].total += deliveryFee;
      tarifsParQuartier[delivery.quartier].deliveryFees.push(deliveryFee);
    }
  });

  // Update tarifsParQuartier to use standard tariffs ONLY if all delivery_fee match
  Object.keys(tarifsParQuartier).forEach((quartier) => {
    const quartierData = tarifsParQuartier[quartier];
    const standardTariff = standardTariffs[quartier];
    
    if (standardTariff !== undefined) {
      // Check if all delivery_fee values match the standard tariff
      const allMatchStandard = quartierData.deliveryFees.every(
        fee => Math.abs(fee - standardTariff) < 0.01
      );
      
      if (allMatchStandard) {
        // All deliveries use standard tariff
        quartierData.standardTariff = standardTariff;
        quartierData.total = standardTariff * quartierData.count;
      } else {
        // Some deliveries have modified tariffs, use the real total
        const avgTariff = quartierData.total / quartierData.count;
        quartierData.standardTariff = Math.round(avgTariff * 100) / 100;
      }
    } else {
      // No standard tariff, use calculated average
      const avgTariff = quartierData.total / quartierData.count;
      quartierData.standardTariff = Math.round(avgTariff * 100) / 100;
    }
    delete quartierData.deliveryFees;
  });

  return {
    fixedStatusTarifs,
    tarifsParQuartier,
    totalTarifs,
  };
}

// Test 1: Fixed status tariffs are separated
async function testFixedStatusSeparation() {
  console.log("\nTEST 1: Fixed status tariffs are separated");
  
  const agencyId = await createTestAgency();
  const groupId = await createTestGroup(agencyId);
  
  // Create deliveries with fixed statuses
  const d1 = await createTestDelivery(agencyId, groupId, {
    status: "pickup",
    delivery_fee: 1000,
    quartier: "Kotto", // Should not affect grouping
  });
  const d2 = await createTestDelivery(agencyId, groupId, {
    status: "pickup",
    delivery_fee: 1000,
    quartier: "Bonapriso", // Should not affect grouping
  });
  const d3 = await createTestDelivery(agencyId, groupId, {
    status: "present_ne_decroche_zone1",
    delivery_fee: 500,
    quartier: "Kotto",
  });
  const d4 = await createTestDelivery(agencyId, groupId, {
    status: "present_ne_decroche_zone2",
    delivery_fee: 1000,
    quartier: "Bonapriso",
  });

  // Get deliveries
  const deliveries = await db.getDeliveries({ group_id: groupId, limit: 100 });
  const deliveryList = Array.isArray(deliveries.deliveries) ? deliveries.deliveries : [];

  const result = calculatePDFTariffs(deliveryList, {});
  
  // Verify fixed status tariffs are separated
  assert(result.fixedStatusTarifs.pickup.count === 2, "Pickup count should be 2");
  assertEqual(result.fixedStatusTarifs.pickup.total, 2000, "Pickup total should be 2000");
  
  assert(result.fixedStatusTarifs.present_ne_decroche_zone1.count === 1, "Zone1 count should be 1");
  assertEqual(result.fixedStatusTarifs.present_ne_decroche_zone1.total, 500, "Zone1 total should be 500");
  
  assert(result.fixedStatusTarifs.present_ne_decroche_zone2.count === 1, "Zone2 count should be 1");
  assertEqual(result.fixedStatusTarifs.present_ne_decroche_zone2.total, 1000, "Zone2 total should be 1000");
  
  // Verify quartier tariffs are empty (no delivered/client_absent)
  assert(Object.keys(result.tarifsParQuartier).length === 0, "Quartier tariffs should be empty");
  
  // Cleanup
  await db.deleteGroup(groupId);
  await db.deleteAgency(agencyId);
}

// Test 2: Quartier tariffs use standard when all match
async function testQuartierStandardTariffs() {
  console.log("\nTEST 2: Quartier tariffs use standard when all match");
  
  const agencyId = await createTestAgency();
  const groupId = await createTestGroup(agencyId);
  
  // Create standard tariffs
  await createTestTariff(agencyId, "Kotto", 1000);
  await createTestTariff(agencyId, "Bonapriso", 1500);
  
  // Create deliveries with standard tariffs
  const d1 = await createTestDelivery(agencyId, groupId, {
    status: "delivered",
    delivery_fee: 1000,
    quartier: "Kotto",
  });
  const d2 = await createTestDelivery(agencyId, groupId, {
    status: "delivered",
    delivery_fee: 1000,
    quartier: "Kotto",
  });
  const d3 = await createTestDelivery(agencyId, groupId, {
    status: "client_absent",
    delivery_fee: 1500,
    quartier: "Bonapriso",
  });

  const deliveries = await db.getDeliveries({ group_id: groupId, limit: 100 });
  const deliveryList = Array.isArray(deliveries.deliveries) ? deliveries.deliveries : [];
  
  const standardTariffs = { Kotto: 1000, Bonapriso: 1500 };
  const result = calculatePDFTariffs(deliveryList, standardTariffs);
  
  // Verify Kotto uses standard tariff
  assert(result.tarifsParQuartier.Kotto !== undefined, "Kotto should exist");
  assertEqual(result.tarifsParQuartier.Kotto.standardTariff, 1000, "Kotto standard tariff should be 1000");
  assertEqual(result.tarifsParQuartier.Kotto.total, 2000, "Kotto total should be 2000 (1000 × 2)");
  assert(result.tarifsParQuartier.Kotto.count === 2, "Kotto count should be 2");
  
  // Verify Bonapriso uses standard tariff
  assert(result.tarifsParQuartier.Bonapriso !== undefined, "Bonapriso should exist");
  assertEqual(result.tarifsParQuartier.Bonapriso.standardTariff, 1500, "Bonapriso standard tariff should be 1500");
  assertEqual(result.tarifsParQuartier.Bonapriso.total, 1500, "Bonapriso total should be 1500");
  assert(result.tarifsParQuartier.Bonapriso.count === 1, "Bonapriso count should be 1");
  
  // Verify fixed status tariffs are empty
  assert(result.fixedStatusTarifs.pickup.count === 0, "Pickup should be empty");
  
  // Cleanup
  await db.deleteGroup(groupId);
  await db.deleteAgency(agencyId);
}

// Test 3: Modified tariffs are preserved
async function testModifiedTariffsPreserved() {
  console.log("\nTEST 3: Modified tariffs are preserved in totals");
  
  const agencyId = await createTestAgency();
  const groupId = await createTestGroup(agencyId);
  
  // Create standard tariff
  await createTestTariff(agencyId, "Kotto", 1000);
  
  // Create deliveries with mixed tariffs (some standard, some modified)
  const d1 = await createTestDelivery(agencyId, groupId, {
    status: "delivered",
    delivery_fee: 1000, // Standard
    quartier: "Kotto",
  });
  const d2 = await createTestDelivery(agencyId, groupId, {
    status: "delivered",
    delivery_fee: 1000, // Standard
    quartier: "Kotto",
  });
  const d3 = await createTestDelivery(agencyId, groupId, {
    status: "delivered",
    delivery_fee: 1200, // Modified (should be preserved)
    quartier: "Kotto",
  });
  const d4 = await createTestDelivery(agencyId, groupId, {
    status: "delivered",
    delivery_fee: 1000, // Standard
    quartier: "Kotto",
  });

  const deliveries = await db.getDeliveries({ group_id: groupId, limit: 100 });
  const deliveryList = Array.isArray(deliveries.deliveries) ? deliveries.deliveries : [];
  
  const standardTariffs = { Kotto: 1000 };
  const result = calculatePDFTariffs(deliveryList, standardTariffs);
  
  // Verify total is real sum (preserves modified tariff)
  const expectedTotal = 1000 + 1000 + 1200 + 1000; // 4200
  assertEqual(result.tarifsParQuartier.Kotto.total, expectedTotal, "Kotto total should preserve modified tariff");
  
  // Verify average is used (not standard) since not all match
  assertEqual(result.tarifsParQuartier.Kotto.standardTariff, 1050, "Kotto should use average (1050) not standard (1000)");
  
  // Verify count
  assert(result.tarifsParQuartier.Kotto.count === 4, "Kotto count should be 4");
  
  // Cleanup
  await db.deleteGroup(groupId);
  await db.deleteAgency(agencyId);
}

// Test 4: Mixed fixed status and quartier tariffs
async function testMixedTariffs() {
  console.log("\nTEST 4: Mixed fixed status and quartier tariffs");
  
  const agencyId = await createTestAgency();
  const groupId = await createTestGroup(agencyId);
  
  // Create standard tariff
  await createTestTariff(agencyId, "Kotto", 1000);
  
  // Create mixed deliveries
  const d1 = await createTestDelivery(agencyId, groupId, {
    status: "delivered",
    delivery_fee: 1000,
    quartier: "Kotto",
  });
  const d2 = await createTestDelivery(agencyId, groupId, {
    status: "pickup",
    delivery_fee: 1000,
    quartier: "Kotto", // Should not affect pickup grouping
  });
  const d3 = await createTestDelivery(agencyId, groupId, {
    status: "present_ne_decroche_zone1",
    delivery_fee: 500,
    quartier: "Kotto",
  });
  const d4 = await createTestDelivery(agencyId, groupId, {
    status: "client_absent",
    delivery_fee: 1000,
    quartier: "Kotto",
  });

  const deliveries = await db.getDeliveries({ group_id: groupId, limit: 100 });
  const deliveryList = Array.isArray(deliveries.deliveries) ? deliveries.deliveries : [];
  
  const standardTariffs = { Kotto: 1000 };
  const result = calculatePDFTariffs(deliveryList, standardTariffs);
  
  // Verify fixed status tariffs
  assert(result.fixedStatusTarifs.pickup.count === 1, "Pickup count should be 1");
  assertEqual(result.fixedStatusTarifs.pickup.total, 1000, "Pickup total should be 1000");
  
  assert(result.fixedStatusTarifs.present_ne_decroche_zone1.count === 1, "Zone1 count should be 1");
  assertEqual(result.fixedStatusTarifs.present_ne_decroche_zone1.total, 500, "Zone1 total should be 500");
  
  // Verify quartier tariffs (delivered + client_absent only)
  assert(result.tarifsParQuartier.Kotto !== undefined, "Kotto should exist in quartier tariffs");
  assert(result.tarifsParQuartier.Kotto.count === 2, "Kotto count should be 2 (delivered + client_absent)");
  assertEqual(result.tarifsParQuartier.Kotto.total, 2000, "Kotto total should be 2000 (1000 × 2)");
  
  // Verify total tariffs
  const expectedTotal = 1000 + 1000 + 500 + 1000; // 3500
  assertEqual(result.totalTarifs, expectedTotal, "Total tariffs should be 3500");
  
  // Cleanup
  await db.deleteGroup(groupId);
  await db.deleteAgency(agencyId);
}

// Test 5: Total calculation accuracy
async function testTotalCalculation() {
  console.log("\nTEST 5: Total calculation accuracy");
  
  const agencyId = await createTestAgency();
  const groupId = await createTestGroup(agencyId);
  
  // Create deliveries with various statuses and tariffs
  const deliveries = [
    { status: "delivered", delivery_fee: 1000, quartier: "Kotto" },
    { status: "delivered", delivery_fee: 1000, quartier: "Kotto" },
    { status: "pickup", delivery_fee: 1000, quartier: "Kotto" },
    { status: "present_ne_decroche_zone1", delivery_fee: 500, quartier: "Kotto" },
    { status: "client_absent", delivery_fee: 1500, quartier: "Bonapriso" },
    { status: "present_ne_decroche_zone2", delivery_fee: 1000, quartier: "Bonapriso" },
  ];

  for (const del of deliveries) {
    await createTestDelivery(agencyId, groupId, del);
  }

  const deliveryResult = await db.getDeliveries({ group_id: groupId, limit: 100 });
  const deliveryList = Array.isArray(deliveryResult.deliveries) ? deliveryResult.deliveries : [];
  
  const result = calculatePDFTariffs(deliveryList, {});
  
  // Calculate expected total manually
  const expectedTotal = 1000 + 1000 + 1000 + 500 + 1500 + 1000; // 6000
  assertEqual(result.totalTarifs, expectedTotal, "Total tariffs should be 6000");
  
  // Cleanup
  await db.deleteGroup(groupId);
  await db.deleteAgency(agencyId);
}

// Main test runner
async function runTests() {
  console.log("\n🧪 Starting PDF Tariffs Tests...\n");
  console.log(`Database: ${db.adapter.type}\n`);
  
  try {
    await testFixedStatusSeparation();
    await testQuartierStandardTariffs();
    await testModifiedTariffsPreserved();
    await testMixedTariffs();
    await testTotalCalculation();
  } catch (error) {
    console.error("\n❌ Test execution error:", error);
    testsFailed++;
    failures.push(`Test execution: ${error.message}`);
  }
  
  // Print summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Test Summary");
  console.log("=".repeat(50));
  console.log(`✅ Passed: ${testsPassed}`);
  console.log(`❌ Failed: ${testsFailed}`);
  console.log(`📈 Total:  ${testsPassed + testsFailed}`);
  
  if (failures.length > 0) {
    console.log("\n❌ Failures:");
    failures.forEach((failure) => {
      console.log(`   ${failure}`);
    });
  }
  
  console.log("\n");
  
  // Close database connection
  await db.close();
  
  // Exit with appropriate code
  process.exit(testsFailed > 0 ? 1 : 0);
}

// Run tests
if (require.main === module) {
  runTests().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

module.exports = { calculatePDFTariffs };
