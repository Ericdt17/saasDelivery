/**
 * SQLite Database Adapter
 * Uses better-sqlite3 for synchronous SQLite operations
 */

const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const config = require("../config");

class SqliteAdapter {
  constructor() {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(config.DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Initialize database
      this.db = new Database(config.DB_PATH);
      
      // Enable WAL mode for better concurrency
      this.db.pragma("journal_mode = WAL");
      
      this.initTables();
      console.log(`✅ SQLite database initialized: ${config.DB_PATH}`);
    } catch (error) {
      console.error("❌ Failed to initialize SQLite database:", error.message);
      throw error;
    }
  }

  initTables() {
    // Create agencies table
    this.db.exec(`
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
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS groups (
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

    // Create deliveries table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS deliveries (
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
        group_id INTEGER,
        agency_id INTEGER,
        whatsapp_message_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
      )
    `);

    // Add whatsapp_message_id column if it doesn't exist (for existing databases)
    try {
      // Check if column exists first
      const tableInfo = this.db.prepare("PRAGMA table_info(deliveries)").all();
      const hasColumn = tableInfo.some(col => col.name === "whatsapp_message_id");
      
      if (!hasColumn) {
        this.db.exec(`ALTER TABLE deliveries ADD COLUMN whatsapp_message_id TEXT`);
        console.log("✅ Added whatsapp_message_id column to deliveries table");
      }
    } catch (err) {
      // Column might already exist or other error, log it
      console.log(`⚠️  Could not add whatsapp_message_id column: ${err.message}`);
    }

    // Create history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        actor TEXT DEFAULT 'bot',
        agency_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
        FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
      )
    `);

    // Add columns to existing deliveries table if they don't exist
    try {
      this.db.exec(`ALTER TABLE deliveries ADD COLUMN group_id INTEGER`);
    } catch (err) {
      // Column already exists, ignore
    }
    try {
      this.db.exec(`ALTER TABLE deliveries ADD COLUMN agency_id INTEGER`);
    } catch (err) {
      // Column already exists, ignore
    }

    // Add column to existing delivery_history table if it doesn't exist
    try {
      this.db.exec(`ALTER TABLE delivery_history ADD COLUMN agency_id INTEGER`);
    } catch (err) {
      // Column already exists, ignore
    }

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
      CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id);
      CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id);
      CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id);
      CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id);
      CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email);
      CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history(delivery_id);
      CREATE INDEX IF NOT EXISTS idx_history_agency_id ON delivery_history(agency_id);
    `);
  }

  // Execute a query and return results
  // Returns a Promise for consistency with PostgreSQL adapter
  query(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      let result;
      
      if (sql.trim().toUpperCase().startsWith("SELECT")) {
        if (sql.toUpperCase().includes("LIMIT 1")) {
          result = stmt.get(...params);
        } else {
          result = stmt.all(...params);
        }
      } else {
        // INSERT, UPDATE, DELETE
        const runResult = stmt.run(...params);
        result = {
          lastInsertRowid: runResult.lastInsertRowid,
          changes: runResult.changes,
        };
      }
      
      return Promise.resolve(result);
    } catch (err) {
      console.error("SQLite Query Error:", err);
      return Promise.reject(err);
    }
  }

  // Execute multiple statements (like CREATE TABLE)
  exec(sql) {
    return this.db.exec(sql);
  }

  // Close connection
  close() {
    this.db.close();
  }

  // Get the raw database instance (for backward compatibility)
  getRawDb() {
    return this.db;
  }
}

module.exports = SqliteAdapter;

