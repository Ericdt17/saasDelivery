/**
 * PostgreSQL Database Adapter
 * Uses pg library for PostgreSQL operations
 */

const { Pool } = require("pg");
const config = require("../config");

class PostgresAdapter {
  constructor() {
    // Create connection pool with error handling
    try {
      if (config.DATABASE_URL) {
        this.pool = new Pool({
          connectionString: config.DATABASE_URL,
          max: 20, // Maximum pool size
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
      } else {
        this.pool = new Pool({
          host: config.PG_HOST,
          port: config.PG_PORT,
          user: config.PG_USER,
          password: config.PG_PASSWORD,
          database: config.PG_DATABASE,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        });
      }

      // Handle pool errors
      this.pool.on("error", (err) => {
        console.error("❌ Unexpected PostgreSQL pool error:", err);
      });

      // Test connection and initialize tables
      this.initTables().catch((err) => {
        console.error("❌ Failed to initialize PostgreSQL database:", err.message);
        console.error("💡 Please check your DATABASE_URL or PostgreSQL connection settings");
        process.exit(1);
      });
    } catch (error) {
      console.error("❌ Failed to create PostgreSQL connection pool:", error.message);
      throw error;
    }
  }

  // Test database connection with retry
  async testConnection(retries = 3, delay = 2000) {
    for (let i = 0; i < retries; i++) {
      try {
        const result = await this.pool.query("SELECT NOW()");
        console.log("✅ PostgreSQL connection successful");
        return true;
      } catch (error) {
        if (i < retries - 1) {
          console.log(`⚠️  Connection attempt ${i + 1} failed, retrying in ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          console.error("❌ Failed to connect to PostgreSQL after", retries, "attempts");
          throw error;
        }
      }
    }
  }

  async initTables() {
    try {
      // Test connection first
      await this.testConnection();

      // Create agencies table
      await this.query(`
        CREATE TABLE IF NOT EXISTS agencies (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'agency',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create groups table
      await this.query(`
        CREATE TABLE IF NOT EXISTS groups (
          id SERIAL PRIMARY KEY,
          agency_id INTEGER NOT NULL,
          whatsapp_group_id VARCHAR(255) UNIQUE,
          name VARCHAR(255) NOT NULL,
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE CASCADE
        )
      `);

      // Create deliveries table
      await this.query(`
        CREATE TABLE IF NOT EXISTS deliveries (
          id SERIAL PRIMARY KEY,
          phone VARCHAR(20) NOT NULL,
          customer_name VARCHAR(255),
          items TEXT,
          amount_due DECIMAL(10, 2) DEFAULT 0,
          amount_paid DECIMAL(10, 2) DEFAULT 0,
          status VARCHAR(20) DEFAULT 'pending',
          quartier VARCHAR(255),
          notes TEXT,
          carrier VARCHAR(255),
          group_id INTEGER,
          agency_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
        )
      `);

      // Create history table
      await this.query(`
        CREATE TABLE IF NOT EXISTS delivery_history (
          id SERIAL PRIMARY KEY,
          delivery_id INTEGER NOT NULL,
          action VARCHAR(50) NOT NULL,
          details TEXT,
          actor VARCHAR(100) DEFAULT 'bot',
          agency_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (delivery_id) REFERENCES deliveries(id) ON DELETE CASCADE,
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
        )
      `);

      // Add columns to existing deliveries table if they don't exist
      try {
        await this.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'deliveries' AND column_name = 'group_id'
            ) THEN
              ALTER TABLE deliveries ADD COLUMN group_id INTEGER;
            END IF;
          END $$;
        `);
      } catch (err) {
        // Ignore errors
      }
      try {
        await this.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'deliveries' AND column_name = 'agency_id'
            ) THEN
              ALTER TABLE deliveries ADD COLUMN agency_id INTEGER;
            END IF;
          END $$;
        `);
      } catch (err) {
        // Ignore errors
      }

      // Add column to existing delivery_history table if it doesn't exist
      try {
        await this.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.columns 
              WHERE table_name = 'delivery_history' AND column_name = 'agency_id'
            ) THEN
              ALTER TABLE delivery_history ADD COLUMN agency_id INTEGER;
            END IF;
          END $$;
        `);
      } catch (err) {
        // Ignore errors
      }

      // Add foreign key constraints if columns were just added
      try {
        await this.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE table_name = 'deliveries' 
              AND constraint_name = 'deliveries_group_id_fkey'
            ) THEN
              ALTER TABLE deliveries ADD CONSTRAINT deliveries_group_id_fkey 
              FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL;
            END IF;
          END $$;
        `);
      } catch (err) {
        // Ignore errors
      }
      try {
        await this.query(`
          DO $$ 
          BEGIN
            IF NOT EXISTS (
              SELECT 1 FROM information_schema.table_constraints 
              WHERE table_name = 'deliveries' 
              AND constraint_name = 'deliveries_agency_id_fkey'
            ) THEN
              ALTER TABLE deliveries ADD CONSTRAINT deliveries_agency_id_fkey 
              FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL;
            END IF;
          END $$;
        `);
      } catch (err) {
        // Ignore errors
      }

      // Create indexes (ignore errors if they already exist)
      try {
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_deliveries_phone ON deliveries(phone)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_deliveries_created_at ON deliveries(created_at)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_history_delivery_id ON delivery_history(delivery_id)
        `);
        await this.query(`
          CREATE INDEX IF NOT EXISTS idx_history_agency_id ON delivery_history(agency_id)
        `);
      } catch (indexError) {
        // Indexes might already exist, that's OK
        if (!indexError.message.includes("already exists")) {
          console.warn("⚠️  Warning creating indexes:", indexError.message);
        }
      }

      console.log("✅ PostgreSQL database initialized successfully");
    } catch (error) {
      console.error("❌ Error initializing PostgreSQL database:", error.message);
      console.error("\n💡 Troubleshooting:");
      console.error("   1. Check if PostgreSQL is running");
      console.error("   2. Verify DATABASE_URL or connection settings in .env");
      console.error("   3. Ensure database exists: CREATE DATABASE deliverybot;");
      console.error("   4. Check user permissions\n");
      throw error;
    }
  }

  // Convert SQLite placeholders (?) to PostgreSQL placeholders ($1, $2, etc.)
  convertPlaceholders(sql, params) {
    let paramIndex = 1;
    const convertedSql = sql.replace(/\?/g, () => `$${paramIndex++}`);
    return convertedSql;
  }

  // Convert SQLite DATE() function to PostgreSQL
  convertSqlFunctions(sql) {
    // Convert DATE('now') to CURRENT_DATE or CURRENT_TIMESTAMP::date
    sql = sql.replace(/DATE\(['"]now['"]\)/gi, "CURRENT_DATE");
    // Convert DATE(column) to column::date
    sql = sql.replace(/DATE\((\w+)\)/gi, "$1::date");
    return sql;
  }

  // Execute a query with retry logic
  async query(sql, params = [], retries = 3) {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // Convert SQL syntax for PostgreSQL
        sql = this.convertSqlFunctions(sql);
        sql = this.convertPlaceholders(sql, params);

        const result = await this.pool.query(sql, params);

        // For SELECT queries, return rows
        if (sql.trim().toUpperCase().startsWith("SELECT")) {
          // If SQL has LIMIT 1, return single row
          if (sql.toUpperCase().includes("LIMIT 1")) {
            return result.rows[0] || null;
          }
          return result.rows;
        } else {
          // For INSERT with RETURNING, check if we have rows with id
          if (result.rows && result.rows.length > 0 && result.rows[0].id) {
            return {
              lastInsertRowid: result.rows[0].id,
              changes: result.rowCount || 0,
              id: result.rows[0].id, // Also include id at top level for easier access
            };
          }
          // For UPDATE, DELETE without RETURNING
          return {
            lastInsertRowid: null,
            changes: result.rowCount || 0,
          };
        }
      } catch (error) {
        // Check if it's a connection error that we should retry
        const isConnectionError = 
          error.code === "ECONNREFUSED" ||
          error.code === "ETIMEDOUT" ||
          error.code === "ENOTFOUND" ||
          error.message.includes("Connection terminated");

        if (isConnectionError && attempt < retries - 1) {
          console.warn(`⚠️  Query failed (attempt ${attempt + 1}/${retries}), retrying...`);
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }

        // Log error details for debugging
        console.error("❌ PostgreSQL Query Error:", {
          message: error.message,
          code: error.code,
          query: sql.substring(0, 100) + (sql.length > 100 ? "..." : ""),
        });
        throw error;
      }
    }
  }

  // Execute multiple statements (wrapped for compatibility)
  async exec(sql) {
    // PostgreSQL doesn't support multi-statement exec like SQLite
    // Split by semicolon and execute each
    const statements = sql
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      await this.query(statement);
    }
  }

  // Close connection pool
  async close() {
    await this.pool.end();
  }

  // Get the raw pool instance
  getRawDb() {
    return this.pool;
  }
}

module.exports = PostgresAdapter;

