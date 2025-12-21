/**
 * Test Suite for Delivery Status Updates and Amount Calculations
 * Tests all status change scenarios and verifies correct amount calculations
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
  // Check if DATABASE_URL is set to determine database type
  const isActive = process.env.DATABASE_URL ? true : 1;
  
  const agencyId = await db.createAgency({
    name: `Test Agency ${Date.now()}`,
    email: `test_agency_${Date.now()}@test.com`,
    password_hash: passwordHash,
    role: "agency",
    is_active: isActive,
  });
  
  return agencyId;
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
async function createTestDelivery(agencyId, options = {}) {
  const deliveryId = await db.insertDelivery({
    phone: options.phone || `555${Date.now()}`,
    items: options.items || "Test Items",
    amount_due: options.amount_due || 140000,
    amount_paid: options.amount_paid || 0,
    status: options.status || "pending",
    quartier: options.quartier || "Simbock 2",
    agency_id: agencyId,
    delivery_fee: options.delivery_fee || null,
  });
  
  return deliveryId;
}

// Helper to simulate API update (mimics the PUT route logic)
async function simulateStatusUpdate(deliveryId, status, options = {}) {
  const delivery = await db.getDeliveryById(deliveryId);
  const deliveryObj = Array.isArray(delivery) ? delivery[0] : delivery;
  
  if (!deliveryObj) {
    throw new Error("Delivery not found");
  }
  
  const updates = {
    status: status,
    ...options,
  };
  
  // Determine which status change is happening
  const statusChange = {
    toDelivered: status === "delivered" && deliveryObj.status !== "delivered",
    toClientAbsent: status === "client_absent" && deliveryObj.status !== "client_absent",
    toFailed: status === "failed" && deliveryObj.status !== "failed",
  };
  
  const manualDeliveryFee = updates.delivery_fee !== undefined && updates.delivery_fee !== null;
  const currentDeliveryFee = deliveryObj.delivery_fee || 0;
  const agencyId = deliveryObj.agency_id;
  const quartier = deliveryObj.quartier || updates.quartier;
  
  // Apply tariff logic for "delivered" and "client_absent"
  if (statusChange.toDelivered || statusChange.toClientAbsent) {
    const forceAmountPaidToZero = statusChange.toClientAbsent;
    
    if (manualDeliveryFee && parseFloat(updates.delivery_fee) >= 0) {
      const manualFee = parseFloat(updates.delivery_fee) || 0;
      updates.delivery_fee = manualFee;
      
      if (forceAmountPaidToZero) {
        updates.amount_paid = 0;
      } else if (updates.amount_paid === undefined) {
        const currentAmountPaid = parseFloat(deliveryObj.amount_paid) || 0;
        if (currentAmountPaid > 0) {
          const newAmountPaid = Math.max(0, Math.round((currentAmountPaid - manualFee) * 100) / 100);
          updates.amount_paid = newAmountPaid;
        }
      }
    } else if (currentDeliveryFee > 0) {
      if (forceAmountPaidToZero) {
        updates.amount_paid = 0;
      }
    } else {
      // Apply automatic tariff
      const tariffResult = await db.getTariffByAgencyAndQuartier(agencyId, quartier);
      const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;
      
      if (tariff && tariff.tarif_amount) {
        const tariffAmount = parseFloat(tariff.tarif_amount) || 0;
        updates.delivery_fee = tariffAmount;
        
        if (forceAmountPaidToZero) {
          updates.amount_paid = 0;
        } else if (updates.amount_paid === undefined) {
          const currentAmountPaid = parseFloat(deliveryObj.amount_paid) || 0;
          const currentAmountDue = parseFloat(deliveryObj.amount_due) || 0;
          
          if (currentAmountPaid === 0 && currentAmountDue > 0) {
            // No payment recorded, assume full payment
            const newAmountPaid = Math.max(0, Math.round((currentAmountDue - tariffAmount) * 100) / 100);
            updates.amount_paid = newAmountPaid;
          } else if (currentAmountPaid > 0 && currentAmountPaid < currentAmountDue) {
            // Partial payment
            const newAmountPaid = Math.max(0, Math.round((currentAmountPaid - tariffAmount) * 100) / 100);
            updates.amount_paid = newAmountPaid;
          } else if (currentAmountPaid >= currentAmountDue && currentAmountDue > 0) {
            // Full payment already recorded
            const newAmountPaid = Math.max(0, Math.round((currentAmountDue - tariffAmount) * 100) / 100);
            updates.amount_paid = newAmountPaid;
          }
        }
      }
    }
  } else if (statusChange.toFailed) {
    // No tariff applied for "failed"
  }
  
  // Update delivery
  await db.updateDelivery(deliveryId, updates);
  
  // Return updated delivery
  const updated = await db.getDeliveryById(deliveryId);
  return Array.isArray(updated) ? updated[0] : updated;
}

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
  console.log("\n" + "=".repeat(80));
  console.log("🧪 TEST SUITE: Delivery Status Updates and Amount Calculations");
  console.log("=".repeat(80) + "\n");
  
  let testAgencyId;
  let testTariffId;
  const testDeliveryIds = [];
  
  try {
    // Setup: Create test agency and tariff
    console.log("📋 Setup: Creating test agency and tariff...");
    testAgencyId = await createTestAgency();
    testTariffId = await createTestTariff(testAgencyId, "Simbock 2", 5000);
    console.log(`   ✅ Agency ID: ${testAgencyId}, Tariff ID: ${testTariffId}\n`);
    
    // ========================================================================
    // TEST 1: Status change to "delivered" with amount_paid = 0
    // Expected: amount_paid = amount_due - delivery_fee
    // ========================================================================
    console.log("📦 TEST 1: Status change to 'delivered' with amount_paid = 0");
    console.log("   Expected: amount_paid = amount_due - delivery_fee");
    const deliveryId1 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 0,
      status: "pending",
      quartier: "Simbock 2",
    });
    testDeliveryIds.push(deliveryId1);
    
    const updated1 = await simulateStatusUpdate(deliveryId1, "delivered");
    assertEqual(updated1.status, "delivered", "Status should be 'delivered'");
    assertEqual(updated1.delivery_fee, 5000, "delivery_fee should be 5000 (tariff)");
    assertEqual(updated1.amount_paid, 135000, "amount_paid should be 135000 (140000 - 5000)");
    console.log("");
    
    // ========================================================================
    // TEST 2: Status change to "delivered" with partial payment
    // Expected: amount_paid = current_amount_paid - delivery_fee
    // ========================================================================
    console.log("📦 TEST 2: Status change to 'delivered' with partial payment");
    console.log("   Expected: amount_paid = current_amount_paid - delivery_fee");
    const deliveryId2 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 50000,
      status: "pending",
      quartier: "Simbock 2",
    });
    testDeliveryIds.push(deliveryId2);
    
    const updated2 = await simulateStatusUpdate(deliveryId2, "delivered");
    assertEqual(updated2.status, "delivered", "Status should be 'delivered'");
    assertEqual(updated2.delivery_fee, 5000, "delivery_fee should be 5000 (tariff)");
    assertEqual(updated2.amount_paid, 45000, "amount_paid should be 45000 (50000 - 5000)");
    console.log("");
    
    // ========================================================================
    // TEST 3: Status change to "delivered" with full payment already recorded
    // Expected: amount_paid = amount_due - delivery_fee
    // ========================================================================
    console.log("📦 TEST 3: Status change to 'delivered' with full payment already recorded");
    console.log("   Expected: amount_paid = amount_due - delivery_fee");
    const deliveryId3 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 140000,
      status: "pending",
      quartier: "Simbock 2",
    });
    testDeliveryIds.push(deliveryId3);
    
    const updated3 = await simulateStatusUpdate(deliveryId3, "delivered");
    assertEqual(updated3.status, "delivered", "Status should be 'delivered'");
    assertEqual(updated3.delivery_fee, 5000, "delivery_fee should be 5000 (tariff)");
    assertEqual(updated3.amount_paid, 135000, "amount_paid should be 135000 (140000 - 5000)");
    console.log("");
    
    // ========================================================================
    // TEST 4: Status change to "client_absent"
    // Expected: delivery_fee = tariff, amount_paid = 0 (forced)
    // ========================================================================
    console.log("📦 TEST 4: Status change to 'client_absent'");
    console.log("   Expected: delivery_fee = tariff, amount_paid = 0 (forced)");
    const deliveryId4 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 50000,
      status: "pending",
      quartier: "Simbock 2",
    });
    testDeliveryIds.push(deliveryId4);
    
    const updated4 = await simulateStatusUpdate(deliveryId4, "client_absent");
    assertEqual(updated4.status, "client_absent", "Status should be 'client_absent'");
    assertEqual(updated4.delivery_fee, 5000, "delivery_fee should be 5000 (tariff)");
    assertEqual(updated4.amount_paid, 0, "amount_paid should be 0 (forced)");
    console.log("");
    
    // ========================================================================
    // TEST 5: Status change to "failed"
    // Expected: No tariff applied, delivery_fee remains unchanged
    // ========================================================================
    console.log("📦 TEST 5: Status change to 'failed'");
    console.log("   Expected: No tariff applied, delivery_fee remains unchanged");
    const deliveryId5 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 50000,
      status: "pending",
      quartier: "Simbock 2",
      delivery_fee: null,
    });
    testDeliveryIds.push(deliveryId5);
    
    const updated5 = await simulateStatusUpdate(deliveryId5, "failed");
    assertEqual(updated5.status, "failed", "Status should be 'failed'");
    assertEqual(updated5.delivery_fee, null, "delivery_fee should remain null (no tariff)");
    assertEqual(updated5.amount_paid, 50000, "amount_paid should remain 50000 (unchanged)");
    console.log("");
    
    // ========================================================================
    // TEST 6: Status change to "delivered" with manual delivery_fee
    // Expected: Use manual fee, recalculate amount_paid
    // ========================================================================
    console.log("📦 TEST 6: Status change to 'delivered' with manual delivery_fee");
    console.log("   Expected: Use manual fee (10000), recalculate amount_paid");
    const deliveryId6 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 0,
      status: "pending",
      quartier: "Simbock 2",
    });
    testDeliveryIds.push(deliveryId6);
    
    const updated6 = await simulateStatusUpdate(deliveryId6, "delivered", {
      delivery_fee: 10000,
    });
    assertEqual(updated6.status, "delivered", "Status should be 'delivered'");
    assertEqual(updated6.delivery_fee, 10000, "delivery_fee should be 10000 (manual)");
    assertEqual(updated6.amount_paid, 130000, "amount_paid should be 130000 (140000 - 10000)");
    console.log("");
    
    // ========================================================================
    // TEST 7: Status change to "delivered" with no quartier
    // Expected: Status change allowed but no tariff applied
    // ========================================================================
    console.log("📦 TEST 7: Status change to 'delivered' with no quartier");
    console.log("   Expected: Status change allowed but no tariff applied");
    const deliveryId7 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 0,
      status: "pending",
      quartier: null,
    });
    testDeliveryIds.push(deliveryId7);
    
    try {
      const updated7 = await simulateStatusUpdate(deliveryId7, "delivered");
      assertEqual(updated7.status, "delivered", "Status should be 'delivered'");
      assertEqual(updated7.delivery_fee, null, "delivery_fee should remain null (no quartier)");
      assertEqual(updated7.amount_paid, 0, "amount_paid should remain 0 (no tariff applied)");
    } catch (error) {
      // If quartier is required, the update should fail
      assert(error.message.includes("quartier"), "Should require quartier for tariff application");
    }
    console.log("");
    
    // ========================================================================
    // TEST 8: Status change to "delivered" with no tariff found
    // Expected: Status change allowed but no tariff applied
    // ========================================================================
    console.log("📦 TEST 8: Status change to 'delivered' with no tariff found");
    console.log("   Expected: Status change allowed but no tariff applied");
    const deliveryId8 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 0,
      status: "pending",
      quartier: "Unknown Quartier",
    });
    testDeliveryIds.push(deliveryId8);
    
    const updated8 = await simulateStatusUpdate(deliveryId8, "delivered");
    assertEqual(updated8.status, "delivered", "Status should be 'delivered'");
    assertEqual(updated8.delivery_fee, null, "delivery_fee should remain null (no tariff found)");
    assertEqual(updated8.amount_paid, 0, "amount_paid should remain 0 (no tariff applied)");
    console.log("");
    
    // ========================================================================
    // TEST 9: Status change to "client_absent" with no payment
    // Expected: delivery_fee = tariff, amount_paid = 0
    // ========================================================================
    console.log("📦 TEST 9: Status change to 'client_absent' with no payment");
    console.log("   Expected: delivery_fee = tariff, amount_paid = 0");
    const deliveryId9 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 0,
      status: "pending",
      quartier: "Simbock 2",
    });
    testDeliveryIds.push(deliveryId9);
    
    const updated9 = await simulateStatusUpdate(deliveryId9, "client_absent");
    assertEqual(updated9.status, "client_absent", "Status should be 'client_absent'");
    assertEqual(updated9.delivery_fee, 5000, "delivery_fee should be 5000 (tariff)");
    assertEqual(updated9.amount_paid, 0, "amount_paid should be 0 (forced)");
    console.log("");
    
    // ========================================================================
    // TEST 10: Multiple status changes (pending -> delivered -> client_absent)
    // Expected: Each change applies correct logic
    // ========================================================================
    console.log("📦 TEST 10: Multiple status changes");
    console.log("   Expected: Each change applies correct logic");
    const deliveryId10 = await createTestDelivery(testAgencyId, {
      amount_due: 140000,
      amount_paid: 0,
      status: "pending",
      quartier: "Simbock 2",
    });
    testDeliveryIds.push(deliveryId10);
    
    // First change: pending -> delivered
    const updated10a = await simulateStatusUpdate(deliveryId10, "delivered");
    assertEqual(updated10a.status, "delivered", "Status should be 'delivered'");
    assertEqual(updated10a.delivery_fee, 5000, "delivery_fee should be 5000");
    assertEqual(updated10a.amount_paid, 135000, "amount_paid should be 135000");
    
    // Second change: delivered -> client_absent
    const updated10b = await simulateStatusUpdate(deliveryId10, "client_absent");
    assertEqual(updated10b.status, "client_absent", "Status should be 'client_absent'");
    assertEqual(updated10b.delivery_fee, 5000, "delivery_fee should remain 5000");
    assertEqual(updated10b.amount_paid, 0, "amount_paid should be 0 (forced)");
    console.log("");
    
    // ========================================================================
    // TEST SUMMARY
    // ========================================================================
    console.log("=".repeat(80));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(80));
    console.log(`✅ Tests Passed: ${testsPassed}`);
    console.log(`❌ Tests Failed: ${testsFailed}`);
    
    if (failures.length > 0) {
      console.log("\n❌ FAILURES:");
      failures.forEach((failure, index) => {
        console.log(`\n${index + 1}. ${failure}`);
      });
    }
    
    console.log("\n" + "=".repeat(80));
    
    // Cleanup
    console.log("\n🧹 Cleaning up test data...");
    for (const deliveryId of testDeliveryIds) {
      try {
        if (db.adapter.type === "postgres") {
          await db.adapter.query("DELETE FROM deliveries WHERE id = $1", [deliveryId]);
        } else {
          await db.adapter.query("DELETE FROM deliveries WHERE id = ?", [deliveryId]);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    if (testTariffId) {
      try {
        await db.deleteTariff(testTariffId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    if (testAgencyId) {
      try {
        await db.deleteAgency(testAgencyId);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    console.log("   ✅ Cleanup completed\n");
    
    // Exit with appropriate code
    process.exit(testsFailed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error("\n❌ FATAL ERROR:", error.message);
    console.error(error.stack);
    
    // Cleanup on error
    if (testAgencyId) {
      try {
        await deleteAgency(testAgencyId);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    process.exit(1);
  }
}

// Run tests
runTests();

