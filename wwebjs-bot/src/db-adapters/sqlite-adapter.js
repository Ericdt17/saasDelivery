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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create history table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS delivery_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        delivery_id INTEGER NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        actor TEXT DEFAULT 'bot',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
      )
    `);

    // Create indexes
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone);
      CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status);
      CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at);
      CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history(delivery_id);
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

