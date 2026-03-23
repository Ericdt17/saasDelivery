const path = require("path");
const config = require("../config");
const logger = require("../logger");
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

const dbStartTime = Date.now();

// Helper function to run migrations after database connection
// Runs asynchronously without blocking module initialization
function runDatabaseMigrations() {
  // Run migrations in background (fire and forget)
  // This ensures migrations run on startup without blocking the module export
  setImmediate(async () => {
    try {
      const migrationStartTime = Date.now();
      await runMigrations();
      logger.info({ durationMs: Date.now() - migrationStartTime }, "Migrations completed");
    } catch (error) {
      logger.error({ err: error }, "Migration failed — run 'npm run migrate' manually");
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

  client = createPostgresPool();
  queries = createPostgresQueries(client);
  dbType = "postgres";
  logger.info({ host, db: dbName, durationMs: Date.now() - dbStartTime }, "PostgreSQL connected");

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
      logger.info({ totalGroups: count, activeGroups: activeCount }, "Database ready");
    } catch (error) {
      logger.error({ err: error }, "Database test query failed");
    }
  });

  // Run migrations for PostgreSQL (async, non-blocking)
  runDatabaseMigrations();
} else if (preferPostgres && !hasDatabaseUrl) {
  logger.warn("DATABASE_URL not set, falling back to SQLite");
  const dbPath = config.DB_PATH || path.join(__dirname, "..", "data", "bot.db");
  client = createSqliteClient();
  queries = createSqliteQueries(client);
  if (queries.initSchema) queries.initSchema();
  dbType = "sqlite";
  logger.info({ path: dbPath, durationMs: Date.now() - dbStartTime }, "SQLite initialized");
  runDatabaseMigrations();
} else {
  const dbPath = config.DB_PATH || path.join(__dirname, "..", "data", "bot.db");
  client = createSqliteClient();
  queries = createSqliteQueries(client);
  if (queries.initSchema) queries.initSchema();
  dbType = "sqlite";
  logger.info({ path: dbPath, durationMs: Date.now() - dbStartTime }, "SQLite initialized");
  runDatabaseMigrations();
}

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
