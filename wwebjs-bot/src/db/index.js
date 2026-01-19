const path = require("path");
const config = require("../config");
const { createSqliteClient } = require("./sqlite");
const { createPostgresPool } = require("./postgres");
const createSqliteQueries = require("./sqlite-queries");
const createPostgresQueries = require("./postgres-queries");
const { runMigrations } = require("../../db/migrate");

const hasDatabaseUrl = !!process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";
const preferPostgres = hasDatabaseUrl || isProduction;

let queries;
let client;
let dbType;

console.log("\n" + "=".repeat(60));
console.log("📊 DATABASE CONNECTION INITIALIZATION");
console.log("=".repeat(60));
const dbStartTime = Date.now();

// Helper function to run migrations after database connection
// Runs asynchronously without blocking module initialization
function runDatabaseMigrations() {
  // Run migrations in background (fire and forget)
  // This ensures migrations run on startup without blocking the module export
  setImmediate(async () => {
    try {
      console.log("\n🔄 Running database migrations...");
      const migrationStartTime = Date.now();

      // Run migrations (will create schema_migrations table if needed)
      await runMigrations();

      const migrationDuration = (
        (Date.now() - migrationStartTime) /
        1000
      ).toFixed(2);
      console.log(`   ✅ Migrations completed (${migrationDuration}s)\n`);
    } catch (error) {
      // Log error but don't crash - allow app to start even if migrations fail
      // This is important for production where migrations might need manual intervention
      console.error("\n⚠️  Migration warning:", error.message);
      console.error("   App will continue, but schema may be out of date.");
      console.error("   Run 'npm run migrate' manually to fix.\n");
    }
  });
}

if (preferPostgres && hasDatabaseUrl) {
  // Extract database info from connection string
  const dbUrl = process.env.DATABASE_URL;
  let dbInfo = "PostgreSQL (Remote)";
  let host = "unknown";
  let dbName = "unknown";
  try {
    const url = new URL(dbUrl);
    host = url.hostname;
    dbName = url.pathname.replace("/", "");
    dbInfo = `PostgreSQL - ${dbName} @ ${host}`;
  } catch (e) {
    // If parsing fails, just show it's PostgreSQL
  }

  console.log(`\n🗄️  DATABASE TYPE: ${dbInfo}`);
  console.log(`   Host: ${host}`);
  console.log(`   Database: ${dbName}`);
  console.log(`   DATABASE_URL present: ${hasDatabaseUrl ? "YES" : "NO"}`);
  console.log("   Status: Connecting...");
  client = createPostgresPool();
  queries = createPostgresQueries(client);
  dbType = "postgres";
  const dbDuration = ((Date.now() - dbStartTime) / 1000).toFixed(2);
  console.log(`   ✅ Connection established (${dbDuration}s)`);

  // Test database connection and show groups count
  setImmediate(async () => {
    try {
      const testQuery = "SELECT COUNT(*) as total FROM groups";
      const result = await queries.query(testQuery, []);
      const count =
        dbType === "postgres"
          ? Array.isArray(result) && result.length > 0
            ? parseInt(result[0].total)
            : 0
          : result
            ? parseInt(result.total)
            : 0;
      console.log(`   📊 Database test: Found ${count} groups in database`);

      // Also show active groups
      const activeQuery =
        dbType === "postgres"
          ? "SELECT COUNT(*) as total FROM groups WHERE is_active = true"
          : "SELECT COUNT(*) as total FROM groups WHERE is_active = 1";
      const activeResult = await queries.query(activeQuery, []);
      const activeCount =
        dbType === "postgres"
          ? Array.isArray(activeResult) && activeResult.length > 0
            ? parseInt(activeResult[0].total)
            : 0
          : activeResult
            ? parseInt(activeResult.total)
            : 0;
      console.log(`   ✅ Active groups: ${activeCount}`);

      // Show sample group IDs for debugging (only if groups exist)
      if (count > 0) {
        const sampleQuery =
          "SELECT whatsapp_group_id, name, is_active FROM groups LIMIT 5";
        const sampleResult = await queries.query(sampleQuery, []);
        const samples =
          dbType === "postgres"
            ? Array.isArray(sampleResult)
              ? sampleResult
              : []
            : Array.isArray(sampleResult)
              ? sampleResult
              : [sampleResult].filter(Boolean);

        if (samples.length > 0) {
          console.log(`   📋 Sample groups in database:`);
          samples.forEach((g, i) => {
            console.log(
              `      ${i + 1}. ${g.name || "Unnamed"} - ${g.whatsapp_group_id} (active: ${g.is_active})`
            );
          });
        }
      }
    } catch (error) {
      console.error(`   ⚠️  Database test query failed: ${error.message}`);
    }
  });

  // Run migrations for PostgreSQL (async, non-blocking)
  runDatabaseMigrations();
} else if (preferPostgres && !hasDatabaseUrl) {
  console.warn(
    "\n⚠️  DATABASE_URL not set; falling back to SQLite for safety."
  );
  console.warn("   Set DATABASE_URL for PostgreSQL.");
  const dbPath = config.DB_PATH || path.join(__dirname, "..", "data", "bot.db");
  console.log(`\n🗄️  DATABASE TYPE: SQLite (Local)`);
  console.log(`   Path: ${dbPath}`);
  console.log("   Status: Initializing...");
  client = createSqliteClient();
  queries = createSqliteQueries(client);
  if (queries.initSchema) queries.initSchema();
  dbType = "sqlite";
  const dbDuration = ((Date.now() - dbStartTime) / 1000).toFixed(2);
  console.log(`   ✅ Initialized (${dbDuration}s)`);

  // Run migrations for SQLite (async, non-blocking)
  runDatabaseMigrations();
} else {
  const dbPath = config.DB_PATH || path.join(__dirname, "..", "data", "bot.db");
  console.log(`\n🗄️  DATABASE TYPE: SQLite (Local)`);
  console.log(`   Path: ${dbPath}`);
  console.log("   Status: Initializing...");
  client = createSqliteClient();
  queries = createSqliteQueries(client);
  if (queries.initSchema) queries.initSchema();
  dbType = "sqlite";
  const dbDuration = ((Date.now() - dbStartTime) / 1000).toFixed(2);
  console.log(`   ✅ Initialized (${dbDuration}s)`);

  // Run migrations for SQLite (async, non-blocking)
  runDatabaseMigrations();
}

console.log("=".repeat(60) + "\n");

const adapter = {
  type: dbType,
  query: queries.query,
  close: queries.close,
  getRawDb: queries.getRawDb,
};

const api = {
  db: queries.getRawDb(),
  adapter,
  insertDelivery: queries.insertDelivery,
  createDelivery: queries.insertDelivery, // backward compatibility
  bulkCreateDeliveries: queries.bulkCreateDeliveries,
  updateDelivery: queries.updateDelivery,
  updateDeliveryByMessageId: queries.updateDeliveryByMessageId,
  getDeliveries: queries.getDeliveries,
  getAllDeliveries: queries.getDeliveries, // backward compatibility
  getDeliveryById: queries.getDeliveryById,
  getDailyStats: queries.getDailyStats,
  getDeliveryStats: queries.getDailyStats, // backward compatibility
  getDeliveryHistory: queries.getDeliveryHistory,
  getTodayDeliveries: queries.getTodayDeliveries,
  findDeliveryByPhone: queries.findDeliveryByPhone,
  findDeliveryByPhoneForUpdate: queries.findDeliveryByPhoneForUpdate,
  findDeliveryByMessageId: queries.findDeliveryByMessageId,
  searchDeliveries: queries.searchDeliveries,
  saveHistory: queries.saveHistory,
  deleteDelivery: queries.deleteDelivery,
  addHistory: (deliveryId, action, details, actor = "bot") => {
    // Backward compatibility: convert old signature (separate params) to new format (object)
    return queries.saveHistory({
      delivery_id: deliveryId,
      action,
      details,
      actor,
    });
  },
  // Agency queries
  createAgency: queries.createAgency,
  getAgencyById: queries.getAgencyById,
  getAgencyByEmail: queries.getAgencyByEmail,
  findAgencyByCode: queries.findAgencyByCode,
  getAllAgencies: queries.getAllAgencies,
  updateAgency: queries.updateAgency,
  deleteAgency: queries.deleteAgency,
  // Group queries
  createGroup: queries.createGroup,
  getGroupById: queries.getGroupById,
  getGroupsByAgency: queries.getGroupsByAgency,
  getAllGroups: queries.getAllGroups,
  updateGroup: queries.updateGroup,
  deleteGroup: queries.deleteGroup,
  hardDeleteGroup: queries.hardDeleteGroup,
  // Tariff queries
  createTariff: queries.createTariff,
  getTariffById: queries.getTariffById,
  getTariffByAgencyAndQuartier: queries.getTariffByAgencyAndQuartier,
  getTariffsByAgency: queries.getTariffsByAgency,
  getAllTariffs: queries.getAllTariffs,
  updateTariff: queries.updateTariff,
  deleteTariff: queries.deleteTariff,
  close: queries.close,
  getRawDb: queries.getRawDb,
};

module.exports = api;
