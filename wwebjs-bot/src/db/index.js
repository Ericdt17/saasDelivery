const logger = require("../logger");
const { createPostgresPool } = require("./postgres");
const createPostgresQueries = require("./postgres-queries");
const { runMigrations } = require("../../db/migrate");

if (!process.env.DATABASE_URL) {
  logger.error("DATABASE_URL is not set. PostgreSQL is required. See README for local dev setup.");
  process.exit(1);
}

const dbStartTime = Date.now();

let host = "unknown";
let dbName = "unknown";
try {
  const url = new URL(process.env.DATABASE_URL);
  host = url.hostname;
  dbName = url.pathname.replace("/", "");
} catch (e) { /* ignore parse errors */ }

const pool = createPostgresPool();
const queries = createPostgresQueries(pool);

logger.info({ host, db: dbName, durationMs: Date.now() - dbStartTime }, "PostgreSQL connected");

// Run migrations on startup (non-blocking)
setImmediate(async () => {
  try {
    const migrationStartTime = Date.now();
    await runMigrations();
    logger.info({ durationMs: Date.now() - migrationStartTime }, "Migrations completed");
  } catch (error) {
    logger.error({ err: error }, "Migration failed — run 'npm run migrate' manually");
  }

  // Verify DB with a quick sanity check
  try {
    const result = await queries.query("SELECT COUNT(*) as total FROM groups WHERE is_active = true");
    const count = Array.isArray(result) ? parseInt(result[0]?.total) : parseInt(result?.total);
    logger.info({ activeGroups: count }, "Database ready");
  } catch (error) {
    logger.error({ err: error }, "Database sanity check failed");
  }
});

const adapter = {
  type: "postgres",
  query: queries.query,
  close: queries.close,
  getRawDb: queries.getRawDb,
};

const api = {
  db: queries.getRawDb(),
  adapter,
  insertDelivery: queries.insertDelivery,
  createDelivery: queries.insertDelivery,
  bulkCreateDeliveries: queries.bulkCreateDeliveries,
  updateDelivery: queries.updateDelivery,
  updateDeliveryByMessageId: queries.updateDeliveryByMessageId,
  getDeliveries: queries.getDeliveries,
  getAllDeliveries: queries.getDeliveries,
  getDeliveryById: queries.getDeliveryById,
  createExpedition: queries.createExpedition,
  getExpeditions: queries.getExpeditions,
  getExpeditionById: queries.getExpeditionById,
  updateExpedition: queries.updateExpedition,
  deleteExpedition: queries.deleteExpedition,
  getExpeditionStats: queries.getExpeditionStats,
  getDailyStats: queries.getDailyStats,
  getDeliveryStats: queries.getDailyStats,
  getDeliveryHistory: queries.getDeliveryHistory,
  getTodayDeliveries: queries.getTodayDeliveries,
  findDeliveryByPhone: queries.findDeliveryByPhone,
  findDeliveryByPhoneForUpdate: queries.findDeliveryByPhoneForUpdate,
  findDeliveryByMessageId: queries.findDeliveryByMessageId,
  searchDeliveries: queries.searchDeliveries,
  saveHistory: queries.saveHistory,
  deleteDelivery: queries.deleteDelivery,
  addHistory: (deliveryId, action, details, actor = "bot") =>
    queries.saveHistory({ delivery_id: deliveryId, action, details, actor }),
  // Agency queries
  createAgency: queries.createAgency,
  getAgencyById: queries.getAgencyById,
  getAgencyByEmail: queries.getAgencyByEmail,
  findAgencyByCode: queries.findAgencyByCode,
  getAllAgencies: queries.getAllAgencies,
  updateAgency: queries.updateAgency,
  deleteAgency: queries.deleteAgency,
  getVendorsByAgency: queries.getVendorsByAgency,
  // Reminders (contacts + scheduled reminders)
  createAgencyReminderContact: queries.createAgencyReminderContact,
  getAgencyReminderContacts: queries.getAgencyReminderContacts,
  getAgencyReminderContactById: queries.getAgencyReminderContactById,
  updateAgencyReminderContact: queries.updateAgencyReminderContact,
  deleteAgencyReminderContact: queries.deleteAgencyReminderContact,
  createReminder: queries.createReminder,
  createReminderCampaign: queries.createReminderCampaign,
  getReminders: queries.getReminders,
  getReminderById: queries.getReminderById,
  getReminderTargets: queries.getReminderTargets,
  cancelReminder: queries.cancelReminder,
  deleteReminder: queries.deleteReminder,
  retryReminderFailed: queries.retryReminderFailed,
  pollQueuedReminderTargets: queries.pollQueuedReminderTargets,
  markReminderTargetProcessing: queries.markReminderTargetProcessing,
  updateReminderTargetStatus: queries.updateReminderTargetStatus,
  markReminderSent: queries.markReminderSent,
  markReminderFailed: queries.markReminderFailed,
  getDueReminders: queries.getDueReminders,
  setReminderTotals: queries.setReminderTotals,
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
