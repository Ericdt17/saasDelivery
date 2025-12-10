/**
 * Database Connection Test Script
 * Tests connection to SQLite or PostgreSQL database
 */

const config = require("./config");
const { adapter } = require("./db");

async function testConnection() {
  console.log("\n" + "=".repeat(70));
  console.log("🧪 TESTING DATABASE CONNECTION");
  console.log("=".repeat(70) + "\n");

  console.log(`📊 Database Type: ${config.DB_TYPE.toUpperCase()}`);

  if (config.DB_TYPE === "postgres") {
    console.log(
      `🔗 Connection: ${config.DATABASE_URL ? "Using DATABASE_URL" : `${config.PG_HOST}:${config.PG_PORT}/${config.PG_DATABASE}`}`
    );
  } else {
    console.log(`📁 Database Path: ${config.DB_PATH}`);
  }

  console.log("\n" + "-".repeat(70));

  try {
    // Test basic query
    if (config.DB_TYPE === "postgres") {
      console.log("⏳ Testing PostgreSQL connection...");
      const result = await adapter.query(
        "SELECT NOW() as current_time, version() as version"
      );
      console.log("✅ Connection successful!");
      console.log(
        `   PostgreSQL Version: ${result.version?.substring(0, 50)}...`
      );
      console.log(`   Current Time: ${result.current_time}`);
    } else {
      console.log("⏳ Testing SQLite connection...");
      const result = await adapter.query(
        "SELECT datetime('now') as current_time, sqlite_version() as version"
      );
      console.log("✅ Connection successful!");
      // SQLite returns array for SELECT queries
      const sqliteResult = Array.isArray(result) ? result[0] : result;
      const version = sqliteResult?.version;
      const currentTime = sqliteResult?.current_time;
      console.log(`   SQLite Version: ${version || "N/A"}`);
      console.log(`   Current Time: ${currentTime || "N/A"}`);
    }

    // Test table existence
    console.log("\n⏳ Checking tables...");
    let tables;
    if (config.DB_TYPE === "postgres") {
      tables = await adapter.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('deliveries', 'delivery_history')
      `);
    } else {
      tables = await adapter.query(`
        SELECT name 
        FROM sqlite_master 
        WHERE type='table' 
        AND name IN ('deliveries', 'delivery_history')
      `);
    }

    const tableNames =
      config.DB_TYPE === "postgres"
        ? tables.map((t) => t.table_name)
        : tables.map((t) => t.name);

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

      let deliveryCnt, historyCnt;
      if (config.DB_TYPE === "postgres") {
        deliveryCnt = Array.isArray(deliveryCount)
          ? deliveryCount[0]?.count
          : deliveryCount?.count;
        historyCnt = Array.isArray(historyCount)
          ? historyCount[0]?.count
          : historyCount?.count;
      } else {
        // SQLite returns array for SELECT queries
        deliveryCnt = Array.isArray(deliveryCount)
          ? deliveryCount[0]?.count
          : deliveryCount?.count;
        historyCnt = Array.isArray(historyCount)
          ? historyCount[0]?.count
          : historyCount?.count;
      }

      console.log(`\n📊 Records in database:`);
      console.log(`   Deliveries: ${deliveryCnt}`);
      console.log(`   History: ${historyCnt}`);
    } else {
      console.log(
        "⚠️  Some tables are missing. They will be created automatically."
      );
    }

    const { close } = require("./db");
    await close();

    console.log("\n" + "=".repeat(70));
    console.log("✅ DATABASE CONNECTION TEST PASSED");
    console.log("=".repeat(70) + "\n");
  } catch (error) {
    console.error("\n" + "=".repeat(70));
    console.error("❌ DATABASE CONNECTION TEST FAILED");
    console.error("=".repeat(70));
    console.error("\nError:", error.message);

    if (config.DB_TYPE === "postgres") {
      console.error("\n💡 PostgreSQL Troubleshooting:");
      console.error("   1. Is PostgreSQL running?");
      console.error("   2. Check your DATABASE_URL or connection settings");
      console.error("   3. Does the database exist?");
      console.error("      Run: CREATE DATABASE deliverybot;");
      console.error("   4. Check user permissions");
      console.error("   5. Verify network/firewall settings\n");
    } else {
      console.error("\n💡 SQLite Troubleshooting:");
      console.error("   1. Check if the data directory exists");
      console.error("   2. Verify file permissions");
      console.error("   3. Check disk space\n");
    }

    process.exit(1);
  }
}

testConnection();
