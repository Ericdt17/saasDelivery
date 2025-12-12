const config = require("../config");
const { createSqliteClient } = require("./sqlite");
const { createPostgresPool } = require("./postgres");
const createSqliteQueries = require("./sqlite-queries");
const createPostgresQueries = require("./postgres-queries");

const hasDatabaseUrl = !!process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === "production";
const preferPostgres = hasDatabaseUrl || isProduction;

let queries;
let client;
let dbType;

if (preferPostgres && hasDatabaseUrl) {
  client = createPostgresPool();
  queries = createPostgresQueries(client);
  dbType = "postgres";
} else if (preferPostgres && !hasDatabaseUrl) {
  console.warn(
    "⚠️ DATABASE_URL not set; falling back to SQLite for safety. Set DATABASE_URL for PostgreSQL."
  );
  client = createSqliteClient();
  queries = createSqliteQueries(client);
  if (queries.initSchema) queries.initSchema();
  dbType = "sqlite";
} else {
  client = createSqliteClient();
  queries = createSqliteQueries(client);
  if (queries.initSchema) queries.initSchema();
  dbType = "sqlite";
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
  getDeliveries: queries.getDeliveries,
  getAllDeliveries: queries.getDeliveries, // backward compatibility
  getDeliveryById: queries.getDeliveryById,
  getDailyStats: queries.getDailyStats,
  getDeliveryStats: queries.getDailyStats, // backward compatibility
  getDeliveryHistory: queries.getDeliveryHistory,
  getTodayDeliveries: queries.getTodayDeliveries,
  findDeliveryByPhone: queries.findDeliveryByPhone,
  findDeliveryByPhoneForUpdate: queries.findDeliveryByPhoneForUpdate,
  searchDeliveries: queries.searchDeliveries,
  saveHistory: queries.saveHistory,
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
  close: queries.close,
  getRawDb: queries.getRawDb,
};

module.exports = api;
