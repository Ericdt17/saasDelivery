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

// Run migrations on startup unless skipped
setImmediate(async () => {
  if (process.env.SKIP_MIGRATIONS === "true") {
    logger.info("SKIP_MIGRATIONS=true — migrations skipped");
  } else {
    try {
      const migrationStartTime = Date.now();
      await runMigrations();
      logger.info({ durationMs: Date.now() - migrationStartTime }, "Migrations completed");
    } catch (error) {
      logger.error({ err: error }, "Migration failed — run 'npm run migrate' manually");
      return;
    }
  }

  // Verify DB with a quick sanity check
  try {
    const result = await queries.query(
      "SELECT COUNT(*) as total FROM agencies WHERE is_active = true"
    );
    const count = Array.isArray(result)
      ? parseInt(result[0]?.total)
      : parseInt(result?.total);
    logger.info({ activeAgencies: count }, "Database ready");

    const { notifyApiStartup } = require("../lib/botAlerts");
    const port = process.env.PORT || process.env.API_PORT || 3000;
    notifyApiStartup({ port, activeAgencies: count }).catch((err) => {
      logger.warn({ err }, "API startup webhook failed");
    });
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
  createAgency: queries.createAgency,
  getAgencyById: queries.getAgencyById,
  getAgencyByEmail: queries.getAgencyByEmail,
  findAgencyByCode: queries.findAgencyByCode,
  getAllAgencies: queries.getAllAgencies,
  updateAgency: queries.updateAgency,
  updateAgencyProfile: queries.updateAgencyProfile,
  deleteAgency: queries.deleteAgency,
  getWaitlistEntries: queries.getWaitlistEntries,
  insertWaitlistEntry: queries.insertWaitlistEntry,
  recruitmentListOpenJobs: queries.recruitmentListOpenJobs,
  recruitmentGetJobOfferById: queries.recruitmentGetJobOfferById,
  recruitmentGetOpenJobOfferById: queries.recruitmentGetOpenJobOfferById,
  recruitmentListQuestionsForJobOffer: queries.recruitmentListQuestionsForJobOffer,
  recruitmentListAdminJobsWithCounts: queries.recruitmentListAdminJobsWithCounts,
  recruitmentCreateJobOffer: queries.recruitmentCreateJobOffer,
  recruitmentUpdateJobOffer: queries.recruitmentUpdateJobOffer,
  recruitmentDeleteJobOffer: queries.recruitmentDeleteJobOffer,
  recruitmentCountApplicationsForJob: queries.recruitmentCountApplicationsForJob,
  recruitmentCreateJobQuestion: queries.recruitmentCreateJobQuestion,
  recruitmentUpdateJobQuestion: queries.recruitmentUpdateJobQuestion,
  recruitmentDeleteJobQuestion: queries.recruitmentDeleteJobQuestion,
  recruitmentGetQuestionById: queries.recruitmentGetQuestionById,
  recruitmentListAdminApplications: queries.recruitmentListAdminApplications,
  recruitmentGetApplicationDetail: queries.recruitmentGetApplicationDetail,
  recruitmentUpdateApplication: queries.recruitmentUpdateApplication,
  recruitmentDeleteApplication: queries.recruitmentDeleteApplication,
  recruitmentCreateApplicationWithAnswers: queries.recruitmentCreateApplicationWithAnswers,
  listMerchantTerms: queries.listMerchantTerms,
  getMerchantTermsById: queries.getMerchantTermsById,
  createMerchantTerms: queries.createMerchantTerms,
  updateMerchantTerms: queries.updateMerchantTerms,
  deleteMerchantTerms: queries.deleteMerchantTerms,
  listEmployees: queries.listEmployees,
  getEmployeeById: queries.getEmployeeById,
  getEmployeeByIdWithDescriptor: queries.getEmployeeByIdWithDescriptor,
  getEmployeeByEmailWithDescriptor: queries.getEmployeeByEmailWithDescriptor,
  createEmployee: queries.createEmployee,
  updateEmployee: queries.updateEmployee,
  deleteEmployee: queries.deleteEmployee,
  enrollEmployeeFace: queries.enrollEmployeeFace,
  listEmployeeSalaryHistory: queries.listEmployeeSalaryHistory,
  replaceSalaryFrom: queries.replaceSalaryFrom,
  getAttendanceByEmployeeAndDate: queries.getAttendanceByEmployeeAndDate,
  createAttendance: queries.createAttendance,
  upsertAttendance: queries.upsertAttendance,
  listAttendances: queries.listAttendances,
  summarizeAttendances: queries.summarizeAttendances,
  getCompanySettings: queries.getCompanySettings,
  upsertCompanySettings: queries.upsertCompanySettings,
  listWorkplaces: queries.listWorkplaces,
  getWorkplaceById: queries.getWorkplaceById,
  createWorkplace: queries.createWorkplace,
  updateWorkplace: queries.updateWorkplace,
  deleteWorkplace: queries.deleteWorkplace,
  createHrContract: queries.createHrContract,
  listHrContractsByEmployee: queries.listHrContractsByEmployee,
  getHrContractById: queries.getHrContractById,
  getHrContractByToken: queries.getHrContractByToken,
  updateHrContract: queries.updateHrContract,
  cancelOpenHrContracts: queries.cancelOpenHrContracts,
  listCompanyDocuments: queries.listCompanyDocuments,
  getCompanyDocumentById: queries.getCompanyDocumentById,
  createCompanyDocument: queries.createCompanyDocument,
  listCompanyDocumentVersions: queries.listCompanyDocumentVersions,
  getCompanyDocumentVersionById: queries.getCompanyDocumentVersionById,
  createCompanyDocumentVersion: queries.createCompanyDocumentVersion,
  updateCompanyDocumentVersionContent: queries.updateCompanyDocumentVersionContent,
  publishCompanyDocumentVersion: queries.publishCompanyDocumentVersion,
  getCurrentCompanyDocument: queries.getCurrentCompanyDocument,
  acknowledgeCompanyDocumentVersion: queries.acknowledgeCompanyDocumentVersion,
  getCompanyDocumentAcknowledgement: queries.getCompanyDocumentAcknowledgement,
  listCompanyDocumentReadStatus: queries.listCompanyDocumentReadStatus,
  close: queries.close,
  getRawDb: queries.getRawDb,
};

module.exports = api;
