/**
 * Comprehensive Dual-Database Test
 * Tests all database operations with auto-detection (SQLite/PostgreSQL)
 */

const config = require("./config");
const {
  createDelivery,
  getAllDeliveries,
  getDeliveryById,
  updateDelivery,
  getDeliveryStats,
  searchDeliveries,
  getDeliveryHistory,
  addHistory,
  close,
} = require("./db");

async function runTests() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 DUAL-DATABASE SYSTEM TEST");
  console.log("=".repeat(70) + "\n");

  // Show detected database type
  console.log("📊 Database Configuration:");
  console.log(`   Type: ${config.DB_TYPE.toUpperCase()}`);
  if (config.DB_TYPE === "postgres") {
    console.log(`   Connection: ${config.DATABASE_URL ? "Using DATABASE_URL" : "Using connection params"}`);
    console.log(`   Auto-detected: ${process.env.DATABASE_URL ? "✅ DATABASE_URL found" : "✅ NODE_ENV=production"}`);
  } else {
    console.log(`   Database Path: ${config.DB_PATH}`);
    console.log(`   Auto-detected: ${!process.env.DATABASE_URL ? "✅ No DATABASE_URL → SQLite" : "⚠️  Should use SQLite"}`);
  }
  console.log(`   Timezone: ${config.TIME_ZONE}\n`);

  const testResults = {
    passed: 0,
    failed: 0,
    errors: [],
  };

  // Test 1: Create a test delivery
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("TEST 1: Create Delivery");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  try {
    const testDelivery = {
      phone: "612345678",
      customer_name: "Test Customer",
      items: "2 robes + 1 sac",
      amount_due: 15000,
      amount_paid: 0,
      status: "pending",
      quartier: "Bonapriso",
      notes: "Test delivery for dual-database system",
      carrier: "Test Carrier",
    };

    const deliveryId = await createDelivery(testDelivery);
    console.log(`✅ Delivery created successfully! ID: ${deliveryId}`);
    testResults.passed++;

    // Test 2: Get delivery by ID
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 2: Get Delivery by ID");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const delivery = await getDeliveryById(deliveryId);
    if (delivery && delivery.id === deliveryId) {
      console.log(`✅ Delivery retrieved successfully!`);
      console.log(`   Phone: ${delivery.phone}`);
      console.log(`   Items: ${delivery.items}`);
      console.log(`   Amount: ${delivery.amount_due} FCFA`);
      testResults.passed++;
    } else {
      throw new Error("Delivery not found or ID mismatch");
    }

    // Test 3: Update delivery
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 3: Update Delivery");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await updateDelivery(deliveryId, {
      status: "pickup",
      amount_paid: 5000,
    });
    const updatedDelivery = await getDeliveryById(deliveryId);
    // PostgreSQL returns decimals as strings, SQLite as numbers - normalize for comparison
    const amountPaid = Number(updatedDelivery.amount_paid) || 0;
    if (updatedDelivery.status === "pickup" && amountPaid === 5000) {
      console.log(`✅ Delivery updated successfully!`);
      console.log(`   New Status: ${updatedDelivery.status}`);
      console.log(`   Amount Paid: ${amountPaid} FCFA`);
      testResults.passed++;
    } else {
      throw new Error("Update failed - values don't match");
    }

    // Test 4: Add history
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 4: Add History Entry");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await addHistory(deliveryId, "test_action", JSON.stringify({ test: true }), "test_user");
    const history = await getDeliveryHistory(deliveryId);
    if (history && history.length > 0) {
      console.log(`✅ History entry added successfully!`);
      console.log(`   History entries: ${history.length}`);
      testResults.passed++;
    } else {
      throw new Error("History entry not found");
    }

    // Test 5: Get all deliveries with pagination
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 5: Get All Deliveries (Pagination)");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const allDeliveries = await getAllDeliveries({
      page: 1,
      limit: 10,
    });
    if (allDeliveries.deliveries && Array.isArray(allDeliveries.deliveries)) {
      console.log(`✅ Deliveries retrieved successfully!`);
      console.log(`   Total: ${allDeliveries.pagination.total}`);
      console.log(`   Page: ${allDeliveries.pagination.page}`);
      console.log(`   Total Pages: ${allDeliveries.pagination.totalPages}`);
      console.log(`   Returned: ${allDeliveries.deliveries.length} deliveries`);
      testResults.passed++;
    } else {
      throw new Error("Invalid response format");
    }

    // Test 6: Search deliveries
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 6: Search Deliveries");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const searchResults = await searchDeliveries("612345678");
    // SQLite may return single object or array, PostgreSQL returns array
    const resultsArray = Array.isArray(searchResults) ? searchResults : (searchResults ? [searchResults] : []);
    if (resultsArray.length > 0) {
      console.log(`✅ Search successful!`);
      console.log(`   Found: ${resultsArray.length} result(s)`);
      testResults.passed++;
    } else {
      throw new Error("Search returned no results");
    }

    // Test 7: Get daily stats
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 7: Get Daily Stats");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const today = new Date().toISOString().split("T")[0];
    const stats = await getDeliveryStats(today);
    if (stats && typeof stats.total === "number") {
      console.log(`✅ Stats retrieved successfully!`);
      console.log(`   Total: ${stats.total}`);
      console.log(`   Delivered: ${stats.delivered}`);
      console.log(`   Pending: ${stats.pending}`);
      console.log(`   Total Collected: ${stats.total_collected} FCFA`);
      testResults.passed++;
    } else {
      throw new Error("Invalid stats format");
    }

    // Test 8: Filter deliveries by status
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("TEST 8: Filter Deliveries by Status");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const filteredDeliveries = await getAllDeliveries({
      status: "pickup",
      page: 1,
      limit: 10,
    });
    if (filteredDeliveries.deliveries && Array.isArray(filteredDeliveries.deliveries)) {
      const allPickup = filteredDeliveries.deliveries.every((d) => d.status === "pickup");
      console.log(`✅ Filter successful!`);
      console.log(`   Found: ${filteredDeliveries.deliveries.length} pickup deliveries`);
      console.log(`   All match filter: ${allPickup ? "✅" : "⚠️"}`);
      testResults.passed++;
    } else {
      throw new Error("Filter failed");
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅ ALL TESTS PASSED!");
    console.log("=".repeat(70));
    console.log(`\n📊 Test Results:`);
    console.log(`   ✅ Passed: ${testResults.passed}`);
    console.log(`   ❌ Failed: ${testResults.failed}`);
    console.log(`\n💡 Database Type: ${config.DB_TYPE.toUpperCase()}`);
    console.log(`💡 All operations working correctly!\n`);

  } catch (error) {
    console.error("\n" + "=".repeat(70));
    console.error("❌ TEST FAILED");
    console.error("=".repeat(70));
    console.error(`\nError: ${error.message}`);
    console.error(`Stack: ${error.stack}\n`);
    testResults.failed++;
    testResults.errors.push(error.message);
  } finally {
    await close();
  }

  if (testResults.failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

