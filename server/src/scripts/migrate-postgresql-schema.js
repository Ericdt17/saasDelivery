/**
 * Migration script for PostgreSQL database
 * Creates missing tables (agencies, groups) and adds missing columns
 * to existing tables (deliveries, delivery_history)
 */

const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

// Load .env first (base configuration)
dotenv.config();

// Load .env.production if it exists (production overrides)
const envProductionPath = path.join(__dirname, "..", ".env.production");
if (fs.existsSync(envProductionPath)) {
  console.log("📄 Loading .env.production...");
  dotenv.config({ path: envProductionPath, override: true });
}

const { Pool } = require("pg");
const config = require("../config");

async function migratePostgreSQL() {
  let pool;

  try {
    // Create connection pool
    if (config.DATABASE_URL) {
      console.log("📡 Using DATABASE_URL for connection...");
      pool = new Pool({
        connectionString: config.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
    } else {
      // Use individual connection parameters
      const pgHost = process.env.PG_HOST || "localhost";
      const pgPort = parseInt(process.env.PG_PORT || "5432", 10);
      const pgUser = process.env.PG_USER;
      const pgPassword = process.env.PG_PASSWORD || "";
      const pgDatabase = process.env.PG_DATABASE;

      if (!pgUser || !pgDatabase) {
        throw new Error(
          "Missing PostgreSQL configuration. Please set DATABASE_URL or PG_HOST, PG_USER, PG_PASSWORD, and PG_DATABASE in your .env file"
        );
      }

      console.log("📡 Using individual PostgreSQL connection parameters...");
      console.log(`   Host: ${pgHost}`);
      console.log(`   Port: ${pgPort}`);
      console.log(`   User: ${pgUser}`);
      console.log(`   Database: ${pgDatabase}`);

      pool = new Pool({
        host: pgHost,
        port: pgPort,
        user: pgUser,
        password: String(pgPassword), // Ensure password is a string
        database: pgDatabase,
      });
    }

    console.log("🔄 Starting PostgreSQL migration...\n");

    // Test connection
    await pool.query("SELECT NOW()");
    console.log("✅ Connected to PostgreSQL database\n");

    // Check existing tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const existingTables = tablesResult.rows.map((row) => row.table_name);
    console.log("📋 Existing tables:", existingTables.join(", ") || "None\n");

    // 1. Create agencies table if it doesn't exist
    if (!existingTables.includes("agencies")) {
      console.log("📦 Creating 'agencies' table...");
      await pool.query(`
        CREATE TABLE agencies (
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
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_agencies_email ON agencies(email)
      `);
      console.log("   ✅ 'agencies' table created\n");
    } else {
      console.log("   ℹ️  'agencies' table already exists\n");
    }

    // 2. Create groups table if it doesn't exist
    if (!existingTables.includes("groups")) {
      console.log("📦 Creating 'groups' table...");
      await pool.query(`
        CREATE TABLE groups (
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
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_groups_agency_id ON groups(agency_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_groups_whatsapp_id ON groups(whatsapp_group_id)
      `);
      console.log("   ✅ 'groups' table created\n");
    } else {
      console.log("   ℹ️  'groups' table already exists\n");
    }

    // 3. Check and add missing columns to deliveries table
    if (existingTables.includes("deliveries")) {
      console.log("🔍 Checking 'deliveries' table columns...");
      const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'deliveries'
      `);
      const existingColumns = columnsResult.rows.map((row) => row.column_name);
      console.log("   Existing columns:", existingColumns.join(", "));

      // Add group_id if missing
      if (!existingColumns.includes("group_id")) {
        console.log("   ➕ Adding 'group_id' column...");
        await pool.query(`
          ALTER TABLE deliveries ADD COLUMN group_id INTEGER
        `);
        console.log("   ✅ 'group_id' column added");
      } else {
        console.log("   ℹ️  'group_id' column already exists");
      }

      // Add agency_id if missing
      if (!existingColumns.includes("agency_id")) {
        console.log("   ➕ Adding 'agency_id' column...");
        await pool.query(`
          ALTER TABLE deliveries ADD COLUMN agency_id INTEGER
        `);
        console.log("   ✅ 'agency_id' column added");
      } else {
        console.log("   ℹ️  'agency_id' column already exists");
      }

      // Add whatsapp_message_id if missing
      if (!existingColumns.includes("whatsapp_message_id")) {
        console.log("   ➕ Adding 'whatsapp_message_id' column...");
        await pool.query(`
          ALTER TABLE deliveries ADD COLUMN whatsapp_message_id VARCHAR(255)
        `);
        console.log("   ✅ 'whatsapp_message_id' column added");
      } else {
        console.log("   ℹ️  'whatsapp_message_id' column already exists");
      }

      // Add foreign key constraints if they don't exist
      const constraintsResult = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'deliveries' 
        AND constraint_type = 'FOREIGN KEY'
      `);
      const existingConstraints = constraintsResult.rows.map(
        (row) => row.constraint_name
      );

      if (!existingConstraints.includes("deliveries_group_id_fkey")) {
        console.log("   ➕ Adding foreign key constraint for 'group_id'...");
        await pool.query(`
          ALTER TABLE deliveries 
          ADD CONSTRAINT deliveries_group_id_fkey 
          FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE SET NULL
        `);
        console.log("   ✅ Foreign key constraint added");
      }

      if (!existingConstraints.includes("deliveries_agency_id_fkey")) {
        console.log("   ➕ Adding foreign key constraint for 'agency_id'...");
        await pool.query(`
          ALTER TABLE deliveries 
          ADD CONSTRAINT deliveries_agency_id_fkey 
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
        `);
        console.log("   ✅ Foreign key constraint added");
      }

      // Create indexes if they don't exist
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_deliveries_group_id ON deliveries(group_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_deliveries_agency_id ON deliveries(agency_id)
      `);
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_deliveries_whatsapp_message_id ON deliveries(whatsapp_message_id)
      `);

      console.log("   ✅ 'deliveries' table migration completed\n");
    } else {
      console.log("   ⚠️  'deliveries' table does not exist. It will be created by initTables()\n");
    }

    // 4. Check and add missing columns to delivery_history table
    if (existingTables.includes("delivery_history")) {
      console.log("🔍 Checking 'delivery_history' table columns...");
      const columnsResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'delivery_history'
      `);
      const existingColumns = columnsResult.rows.map((row) => row.column_name);
      console.log("   Existing columns:", existingColumns.join(", "));

      // Add agency_id if missing
      if (!existingColumns.includes("agency_id")) {
        console.log("   ➕ Adding 'agency_id' column...");
        await pool.query(`
          ALTER TABLE delivery_history ADD COLUMN agency_id INTEGER
        `);
        console.log("   ✅ 'agency_id' column added");
      } else {
        console.log("   ℹ️  'agency_id' column already exists");
      }

      // Add foreign key constraint if it doesn't exist
      const constraintsResult = await pool.query(`
        SELECT constraint_name 
        FROM information_schema.table_constraints 
        WHERE table_name = 'delivery_history' 
        AND constraint_type = 'FOREIGN KEY'
        AND constraint_name = 'delivery_history_agency_id_fkey'
      `);

      if (constraintsResult.rows.length === 0) {
        console.log("   ➕ Adding foreign key constraint for 'agency_id'...");
        await pool.query(`
          ALTER TABLE delivery_history 
          ADD CONSTRAINT delivery_history_agency_id_fkey 
          FOREIGN KEY (agency_id) REFERENCES agencies(id) ON DELETE SET NULL
        `);
        console.log("   ✅ Foreign key constraint added");
      }

      // Create index if it doesn't exist
      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_history_agency_id ON delivery_history(agency_id)
      `);

      console.log("   ✅ 'delivery_history' table migration completed\n");
    } else {
      console.log("   ⚠️  'delivery_history' table does not exist. It will be created by initTables()\n");
    }

    // Final verification
    console.log("🔍 Verifying migration...\n");
    const finalTablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    const finalTables = finalTablesResult.rows.map((row) => row.table_name);
    console.log("✅ Final tables:", finalTables.join(", "));

    if (finalTables.includes("agencies") && finalTables.includes("groups")) {
      console.log("\n✅ Migration completed successfully!");
      console.log("\n📝 Next steps:");
      console.log("   1. Run 'npm run seed:admin' to create a super admin account");
      console.log("   2. Create agency accounts via the API or frontend");
      console.log("   3. Existing deliveries will be assigned to a default agency when processed\n");
    } else {
      console.log("\n⚠️  Migration completed, but some tables are missing.");
      console.log("   The missing tables should be created automatically when the bot starts.\n");
    }
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Check DATABASE_URL in .env file");
    console.error("   2. Ensure PostgreSQL is running");
    console.error("   3. Verify database user has CREATE TABLE permissions");
    console.error("   4. Check error details above\n");
    throw error;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

// Run migration if called directly
if (require.main === module) {
  migratePostgreSQL()
    .then(() => {
      console.log("✅ Migration script completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("❌ Migration script failed:", error);
      process.exit(1);
    });
}

module.exports = { migratePostgreSQL };

