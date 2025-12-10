/**
 * PostgreSQL Connection Test Script
 * Tests PostgreSQL connection explicitly (for production testing)
 * Usage: DATABASE_URL=your_url node src/test-postgres.js
 *    OR: node src/test-postgres.js (uses .env.production)
 */

// Override environment before loading config
if (process.env.DATABASE_URL) {
  console.log("📋 Using DATABASE_URL from environment variable\n");
} else {
  // Try to load .env.production
  const fs = require("fs");
  const path = require("path");
  const envProdPath = path.join(__dirname, "..", ".env.production");
  
  if (fs.existsSync(envProdPath)) {
    const envProd = fs.readFileSync(envProdPath, "utf8");
    const lines = envProd.split("\n");
    for (const line of lines) {
      const match = line.match(/^DATABASE_URL=(.+)$/);
      if (match) {
        process.env.DATABASE_URL = match[1].trim();
        console.log("📋 Using DATABASE_URL from .env.production\n");
        break;
      }
    }
  }
  
  if (!process.env.DATABASE_URL) {
    console.error("❌ DATABASE_URL not found!");
    console.error("\n💡 Options:");
    console.error("   1. Set DATABASE_URL environment variable:");
    console.error("      DATABASE_URL=postgresql://... node src/test-postgres.js");
    console.error("   2. Create .env.production with DATABASE_URL");
    console.error("   3. Temporarily add DATABASE_URL to .env\n");
    process.exit(1);
  }
}

// Force production mode
process.env.NODE_ENV = "production";

const config = require("./config");
const { adapter, close } = require("./db");

async function testPostgresConnection() {
  console.log("=".repeat(70));
  console.log("🧪 TESTING POSTGRESQL CONNECTION (PRODUCTION)");
  console.log("=".repeat(70) + "\n");

  console.log(`📊 Database Type: ${config.DB_TYPE.toUpperCase()}`);
  console.log(`🔗 Connection: ${config.DATABASE_URL ? "Using DATABASE_URL" : "Not configured"}`);
  
  if (config.DB_TYPE !== "postgres") {
    console.error("\n❌ ERROR: Database type is not PostgreSQL!");
    console.error(`   Detected: ${config.DB_TYPE}`);
    console.error("   Expected: postgres\n");
    process.exit(1);
  }

  console.log("\n" + "-".repeat(70));

  try {
    // Test basic query
    console.log("⏳ Testing PostgreSQL connection...");
    const result = await adapter.query(
      "SELECT NOW() as current_time, version() as version"
    );
    console.log("✅ Connection successful!");
    // PostgreSQL returns array for SELECT queries
    const pgResult = Array.isArray(result) ? result[0] : result;
    if (pgResult) {
      console.log(
        `   PostgreSQL Version: ${pgResult.version?.substring(0, 50) || "N/A"}...`
      );
      console.log(`   Current Time: ${pgResult.current_time || "N/A"}`);
    } else {
      console.log("   Connection verified (result format may vary)");
    }

    // Test table existence
    console.log("\n⏳ Checking tables...");
    const tables = await adapter.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('deliveries', 'delivery_history')
    `);

    const tableNames = tables.map((t) => t.table_name);

    if (
      tableNames.includes("deliveries") &&
      tableNames.includes("delivery_history")
    ) {
      console.log("✅ Required tables exist:");
      console.log("   ✓ deliveries");
      console.log("   ✓ delivery_history");

      // Get record counts
      const deliveryCount = await adapter.query(
        "SELECT COUNT(*) as count FROM deliveries"
      );
      const historyCount = await adapter.query(
        "SELECT COUNT(*) as count FROM delivery_history"
      );

      const deliveryCnt = Array.isArray(deliveryCount)
        ? deliveryCount[0]?.count
        : deliveryCount?.count;
      const historyCnt = Array.isArray(historyCount)
        ? historyCount[0]?.count
        : historyCount?.count;

      console.log(`\n📊 Records in database:`);
      console.log(`   Deliveries: ${deliveryCnt}`);
      console.log(`   History: ${historyCnt}`);
    } else {
      console.log(
        "⚠️  Some tables are missing. They will be created automatically."
      );
    }

    await close();

    console.log("\n" + "=".repeat(70));
    console.log("✅ POSTGRESQL CONNECTION TEST PASSED");
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(70));
    console.error("❌ POSTGRESQL CONNECTION TEST FAILED");
    console.error("=".repeat(70));
    console.error("\nError:", error.message);
    console.error("\n💡 PostgreSQL Troubleshooting:");
    console.error("   1. Check your DATABASE_URL connection string");
    console.error("   2. Verify network connectivity to Render");
    console.error("   3. Check if database exists");
    console.error("   4. Verify SSL settings (should be enabled)");
    console.error("   5. Check firewall/security group settings\n");

    await close();
    process.exit(1);
  }
}

testPostgresConnection();

