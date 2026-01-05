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
  // Enable foreign keys
  db.pragma("foreign_keys = ON");
  console.log("✅ Foreign keys enabled\n");

  // Check if agencies table exists
  const checkAgencies = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='agencies'")
    .get();

  if (checkAgencies) {
    console.log("⚠️  Agencies table already exists");
    const count = db.prepare("SELECT COUNT(*) as count FROM agencies").get();
    console.log(`   Row count: ${count.count}\n`);
  } else {
    console.log("📦 Creating agencies table...");

    try {
      db.exec(`
        CREATE TABLE agencies (
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

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email)
      `);

      console.log("✅ Agencies table created successfully\n");
    } catch (err) {
      console.error("❌ Error creating agencies table:", err.message);
      console.error("   Full error:", err);
      throw err;
    }
  }

  // Check if groups table exists
  const checkGroups = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='groups'")
    .get();

  if (checkGroups) {
    console.log("⚠️  Groups table already exists");
    const count = db.prepare("SELECT COUNT(*) as count FROM groups").get();
    console.log(`   Row count: ${count.count}\n`);
  } else {
    console.log("📦 Creating groups table...");

    try {
      db.exec(`
        CREATE TABLE groups (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agency_id INTEGER NOT NULL,
          whatsapp_group_id TEXT UNIQUE,
          name TEXT NOT NULL,
          is_active INTEGER DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id)
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id)
      `);

      console.log("✅ Groups table created successfully\n");
    } catch (err) {
      console.error("❌ Error creating groups table:", err.message);
      console.error("   Full error:", err);
      throw err;
    }
  }

  // Add missing columns to deliveries
  console.log("📝 Checking deliveries table columns...");
  const deliveryColumns = db
    .prepare("PRAGMA table_info(deliveries)")
    .all()
    .map((col) => col.name);

  console.log("   Existing columns:", deliveryColumns.join(", "));

  if (!deliveryColumns.includes("whatsapp_message_id")) {
    console.log("   ➕ Adding whatsapp_message_id column...");
    try {
      db.exec("ALTER TABLE deliveries ADD COLUMN whatsapp_message_id TEXT");
      console.log("   ✅ whatsapp_message_id added");
    } catch (err) {
      console.error("   ❌ Error:", err.message);
    }
  } else {
    console.log("   ✓ whatsapp_message_id already exists");
  }

  if (!deliveryColumns.includes("agency_id")) {
    console.log("   ➕ Adding agency_id column...");
    try {
      db.exec("ALTER TABLE deliveries ADD COLUMN agency_id INTEGER");
      console.log("   ✅ agency_id added");
    } catch (err) {
      console.error("   ❌ Error:", err.message);
    }
  } else {
    console.log("   ✓ agency_id already exists");
  }

  if (!deliveryColumns.includes("group_id")) {
    console.log("   ➕ Adding group_id column...");
    try {
      db.exec("ALTER TABLE deliveries ADD COLUMN group_id INTEGER");
      console.log("   ✅ group_id added");
    } catch (err) {
      console.error("   ❌ Error:", err.message);
    }
  } else {
    console.log("   ✓ group_id already exists");
  }

  // Add missing column to delivery_history
  console.log("\n📝 Checking delivery_history table columns...");
  const historyColumns = db
    .prepare("PRAGMA table_info(delivery_history)")
    .all()
    .map((col) => col.name);

  console.log("   Existing columns:", historyColumns.join(", "));

  if (!historyColumns.includes("agency_id")) {
    console.log("   ➕ Adding agency_id column...");
    try {
      db.exec("ALTER TABLE delivery_history ADD COLUMN agency_id INTEGER");
      console.log("   ✅ agency_id added");
    } catch (err) {
      console.error("   ❌ Error:", err.message);
    }
  } else {
    console.log("   ✓ agency_id already exists");
  }

  // Create indexes
  console.log("\n📊 Creating indexes...");
  const indexes = [
    "CREATE INDEX IF NOT EXISTS idx_deliveries_whatsapp_message_id ON deliveries(whatsapp_message_id)",
    "CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id)",
    "CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id)",
    "CREATE INDEX IF NOT EXISTS idx_history_agency_id ON delivery_history(agency_id)",
  ];

  indexes.forEach((indexSql) => {
    try {
      db.exec(indexSql);
      console.log(`   ✅ ${indexSql.split("ON ")[1]}`);
    } catch (err) {
      console.error(`   ❌ Error creating index: ${err.message}`);
    }
  });

  // Final verification
  console.log("\n" + "=".repeat(80));
  console.log("📋 Final Verification");
  console.log("=".repeat(80));

  const allTables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    .all();

  console.log("\n📊 All tables:");
  allTables.forEach((table) => {
    if (table.name.startsWith("sqlite_")) return; // Skip system tables
    const count = db
      .prepare(`SELECT COUNT(*) as count FROM ${table.name}`)
      .get();
    console.log(`   - ${table.name} (${count.count} rows)`);
  });

  // Check deliveries columns
  const finalColumns = db
    .prepare("PRAGMA table_info(deliveries)")
    .all()
    .map((col) => col.name);
  console.log("\n📝 Deliveries table columns:");
  console.log("   " + finalColumns.join(", "));

  const requiredColumns = [
    "whatsapp_message_id",
    "agency_id",
    "group_id",
  ];
  const missing = requiredColumns.filter((col) => !finalColumns.includes(col));

  if (missing.length === 0) {
    console.log("\n✅ All required columns are present!");
  } else {
    console.log("\n⚠️  Missing columns:", missing.join(", "));
  }

  db.close();
  console.log("\n✅ Database update completed!");
} catch (err) {
  console.error("\n❌ Fatal error:", err.message);
  console.error(err);
  db.close();
  process.exit(1);
}











