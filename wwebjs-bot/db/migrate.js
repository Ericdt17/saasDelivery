#!/usr/bin/env node

/**
 * Database Migration Runner
 * Executes SQL migration files in chronological order
 * Supports both SQLite and PostgreSQL
 */

const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const { Pool } = require("pg");
const config = require("../src/config");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

// Colors for output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Detect database type and create appropriate connection
 */
function detectDatabaseType() {
  const hasDatabaseUrl = !!config.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";
  
  if (hasDatabaseUrl || isProduction) {
    return "postgres";
  }
  return "sqlite";
}

/**
 * Create database connection based on type
 */
function createDatabaseConnection(dbType) {
  if (dbType === "postgres") {
    const connectionString = config.DATABASE_URL;
    if (!connectionString) {
      throw new Error(
        "DATABASE_URL is required for PostgreSQL. Set DATABASE_URL environment variable."
      );
    }
    return new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
    });
  } else {
    // SQLite
    const dbPath = config.DB_PATH;
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    return db;
  }
}

/**
 * Execute query based on database type
 */
async function executeQuery(connection, sql, dbType) {
  if (dbType === "postgres") {
    return await connection.query(sql);
  } else {
    // SQLite
    return connection.exec(sql);
  }
}

/**
 * Execute query and return result (for SELECT)
 */
async function query(connection, sql, dbType) {
  if (dbType === "postgres") {
    const result = await connection.query(sql);
    return result.rows;
  } else {
    // SQLite
    return connection.prepare(sql).all();
  }
}

/**
 * Create schema_migrations table if it doesn't exist
 */
async function ensureMigrationsTable(connection, dbType) {
  let createTableSQL;
  
  if (dbType === "postgres") {
    createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;
  } else {
    // SQLite
    createTableSQL = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `;
  }
  
  await executeQuery(connection, createTableSQL, dbType);
}

/**
 * Get list of applied migrations
 */
async function getAppliedMigrations(connection, dbType) {
  try {
    const rows = await query(
      connection,
      "SELECT version FROM schema_migrations ORDER BY version",
      dbType
    );
    return rows.map((row) => row.version);
  } catch (error) {
    // Table might not exist yet, return empty array
    return [];
  }
}

/**
 * Mark migration as applied
 */
async function markMigrationApplied(connection, version, dbType) {
  if (dbType === "postgres") {
    await connection.query(
      "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
      [version]
    );
  } else {
    // SQLite
    const stmt = connection.prepare(
      "INSERT OR IGNORE INTO schema_migrations (version) VALUES (?)"
    );
    stmt.run(version);
  }
}

/**
 * Get all migration files in chronological order
 */
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    return [];
  }
  
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => /^\d{14}_/.test(file)) // Format: YYYYMMDDHHMMSS_description.sql
    .sort();
  
  return files;
}

/**
 * Extract version from filename
 */
function getVersionFromFilename(filename) {
  return filename.substring(0, 14); // First 14 characters (timestamp)
}

/**
 * Read migration file content
 */
function readMigrationFile(filename) {
  const filePath = path.join(MIGRATIONS_DIR, filename);
  return fs.readFileSync(filePath, "utf8");
}

/**
 * Run migrations
 */
async function runMigrations() {
  try {
    // Detect database type
    const dbType = detectDatabaseType();
    log(`\n🔍 Detected database type: ${dbType === "postgres" ? "PostgreSQL" : "SQLite"}`, "cyan");
    
    // Create connection
    const connection = createDatabaseConnection(dbType);
    
    // Ensure migrations table exists
    log("📋 Ensuring schema_migrations table exists...", "blue");
    await ensureMigrationsTable(connection, dbType);
    
    // Get applied migrations
    const appliedMigrations = await getAppliedMigrations(connection, dbType);
    log(`✅ Found ${appliedMigrations.length} applied migration(s)`, "green");
    
    // Get all migration files
    const migrationFiles = getMigrationFiles();
    
    if (migrationFiles.length === 0) {
      log("ℹ️  No migration files found in db/migrations/", "yellow");
      if (dbType === "postgres") {
        await connection.end();
      } else {
        connection.close();
      }
      return;
    }
    
    log(`📦 Found ${migrationFiles.length} migration file(s)`, "blue");
    
    // Filter pending migrations
    const pendingMigrations = migrationFiles.filter(
      (file) => !appliedMigrations.includes(getVersionFromFilename(file))
    );
    
    if (pendingMigrations.length === 0) {
      log("✅ Database schema is up to date", "green");
      if (dbType === "postgres") {
        await connection.end();
      } else {
        connection.close();
      }
      return;
    }
    
    log(`\n🔄 Applying ${pendingMigrations.length} pending migration(s)...\n`, "cyan");
    
    // Apply each pending migration
    for (const filename of pendingMigrations) {
      const version = getVersionFromFilename(filename);
      const migrationSQL = readMigrationFile(filename);
      
      try {
        log(`Applying migration: ${filename}`, "yellow");
        
        // Execute migration SQL
        await executeQuery(connection, migrationSQL, dbType);
        
        // Mark as applied
        await markMigrationApplied(connection, version, dbType);
        
        log(`✅ Migration applied successfully: ${filename}`, "green");
      } catch (error) {
        log(`❌ Failed to apply migration ${filename}: ${error.message}`, "red");
        throw error;
      }
    }
    
    log(`\n✅ All migrations applied successfully!`, "green");
    
    // Close connection
    if (dbType === "postgres") {
      await connection.end();
    } else {
      connection.close();
    }
  } catch (error) {
    log(`\n❌ Migration failed: ${error.message}`, "red");
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  runMigrations();
}

module.exports = { runMigrations };

