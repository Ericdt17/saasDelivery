const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const dbPath = path.join(__dirname, "data", "bot.db");

if (!fs.existsSync(dbPath)) {
  console.error("❌ Database file not found at:", dbPath);
  process.exit(1);
}

console.log("✅ Connected to database:", dbPath);
console.log("");

const db = new Database(dbPath);

try {
  // Get all tables
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();

  if (tables.length === 0) {
    console.log("⚠️  No tables found in database");
    db.close();
    process.exit(0);
  }

  console.log("📊 Tables found:", tables.length);
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
  );

  tables.forEach((table, index) => {
    const tableName = table.name;

    // Get table schema (CREATE TABLE statement)
    const schemaRows = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`)
      .all(tableName);

    console.log(`📋 Table: ${tableName}`);
    console.log("─".repeat(80));

    if (schemaRows && schemaRows[0] && schemaRows[0].sql) {
      console.log(schemaRows[0].sql);
    } else {
      console.log("(No schema found)");
    }

    // Get column info using pragma
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();

    console.log("\n📝 Columns:");
    console.log(
      "   Name".padEnd(25) +
        "Type".padEnd(20) +
        "Nullable".padEnd(12) +
        "Default"
    );
    console.log("   " + "─".repeat(70));
    columns.forEach((col) => {
      const nullable = col.notnull === 0 ? "YES" : "NO";
      const defaultVal = col.dflt_value || "(none)";
      console.log(
        `   ${col.name.padEnd(25)}${col.type.padEnd(20)}${nullable.padEnd(12)}${defaultVal}`
      );
    });

    // Get row count
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get();
    if (row) {
      console.log(`\n📊 Row count: ${row.count}`);
    }

    console.log("\n");
  });

  // Get indexes
  console.log(
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  );
  console.log("🔍 Indexes:\n");

  const indexes = db
    .prepare(
      "SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL ORDER BY tbl_name, name"
    )
    .all();

  if (indexes.length === 0) {
    console.log("(No indexes found)");
  } else {
    indexes.forEach((idx) => {
      console.log(`📌 ${idx.tbl_name}.${idx.name}`);
      console.log(`   ${idx.sql}\n`);
    });
  }

  db.close();
  console.log("✅ Database connection closed");
} catch (err) {
  console.error("❌ Error:", err.message);
  db.close();
  process.exit(1);
}
