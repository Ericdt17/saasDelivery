#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");
const config = require("../src/config");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  red: "\x1b[31m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createConnection() {
  const connectionString = config.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required. Set DATABASE_URL environment variable.");
  }

  const hostname = (() => {
    try { return new URL(connectionString).hostname; } catch { return ""; }
  })();

  const useSsl =
    process.env.PG_SSL === "true" ? true
    : process.env.PG_SSL === "false" ? false
    : hostname && !["localhost", "127.0.0.1"].includes(hostname);

  return new Pool({
    connectionString,
    ...(useSsl ? { ssl: { rejectUnauthorized: false } } : {}),
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: 1, // migration only needs one connection
  });
}

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function getAppliedMigrations(pool) {
  try {
    const result = await pool.query("SELECT version FROM schema_migrations ORDER BY version");
    return result.rows.map((row) => row.version);
  } catch {
    return [];
  }
}

async function markMigrationApplied(pool, version) {
  await pool.query(
    "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
    [version]
  );
}

function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .filter((file) => /^\d{14}_/.test(file))
    .sort();
}

async function runMigrations() {
  const pool = createConnection();

  try {
    await ensureMigrationsTable(pool);

    const appliedMigrations = await getAppliedMigrations(pool);
    const migrationFiles = getMigrationFiles();

    if (migrationFiles.length === 0) {
      log("No migration files found in db/migrations/", "yellow");
      return;
    }

    const pendingMigrations = migrationFiles.filter(
      (file) => !appliedMigrations.includes(file.substring(0, 14))
    );

    if (pendingMigrations.length === 0) {
      log("Database schema is up to date", "green");
      return;
    }

    log(`Applying ${pendingMigrations.length} pending migration(s)...`, "cyan");

    for (const filename of pendingMigrations) {
      const version = filename.substring(0, 14);
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf8");

      try {
        log(`  Applying: ${filename}`, "yellow");
        await pool.query(sql);
        await markMigrationApplied(pool, version);
        log(`  Applied:  ${filename}`, "green");
      } catch (error) {
        const msg = error.message || String(error);
        if (msg.includes("already exists") || msg.includes("duplicate column")) {
          log(`  Skipped (already applied): ${filename}`, "yellow");
          await markMigrationApplied(pool, version);
        } else {
          log(`  Failed: ${filename}: ${msg}`, "red");
          throw error;
        }
      }
    }

    log("All migrations applied successfully!", "green");
  } finally {
    await pool.end();
  }
}

const RETRYABLE_ERRORS = [
  "Connection terminated", // covers "unexpectedly" and "due to connection timeout"
  "connect ECONNREFUSED",
  "connect ETIMEDOUT",
  "ENOTFOUND",
  "getaddrinfo",
];

function isRetryableError(err) {
  const msg = err.message || String(err);
  return RETRYABLE_ERRORS.some((s) => msg.includes(s));
}

async function runMigrationsWithRetry(maxAttempts = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await runMigrations();
      return;
    } catch (err) {
      if (attempt < maxAttempts && isRetryableError(err)) {
        log(`  Connection failed (attempt ${attempt}/${maxAttempts}): ${err.message}`, "yellow");
        log(`  Retrying in ${delayMs / 1000}s…`, "yellow");
        await new Promise((r) => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
}

if (require.main === module) {
  runMigrationsWithRetry().catch((error) => {
    console.error(error.stack || error.message);
    process.exit(1);
  });
}

module.exports = { runMigrations };
