/**
 * Ops reports proxy — pulls revenue/expense reports from LivSight
 * delivery-ops (X-Api-Key stays server-side). super_admin only.
 */

const { z } = require("zod");
const {
  fetchRevenueReport,
  fetchExpenseReport,
  LivsightOpsError,
} = require("../../lib/livsightOps");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const reportQuerySchema = z.object({
  start_date: z.string().regex(DATE_RE, "start_date must be YYYY-MM-DD").optional(),
  end_date: z.string().regex(DATE_RE, "end_date must be YYYY-MM-DD").optional(),
  personId: z.coerce.number().int().positive().optional(),
  chargeTypeId: z.coerce.number().int().positive().optional(),
});

/** Map upstream client errors to HTTP responses. */
function handleOpsError(err, res, next) {
  if (!(err instanceof LivsightOpsError)) return next(err);
  if (err.code === "config") {
    return res.status(503).json({
      success: false,
      error:
        "L'intégration LivSight ops n'est pas configurée (LIVSIGHT_API_BASE_URL / LIVSIGHT_API_KEY)",
    });
  }
  if (err.code === "bad_request") {
    return res.status(400).json({ success: false, error: err.message });
  }
  if (err.code === "unauthorized") {
    return res.status(502).json({
      success: false,
      error:
        "Clé API LivSight ops invalide — vérifiez LIVSIGHT_API_KEY (ou LIVSIGHT_HR_API_KEY) dans server/.env",
      code: "ops_unauthorized",
    });
  }
  if (err.code === "timeout") {
    return res.status(502).json({
      success: false,
      error: "LivSight ops n'a pas répondu à temps",
      code: "ops_timeout",
    });
  }
  if (err.code === "network") {
    return res.status(502).json({
      success: false,
      error:
        "Impossible de joindre LivSight ops — vérifiez que le gateway tourne (LIVSIGHT_API_BASE_URL)",
      code: "ops_network",
    });
  }
  return res.status(502).json({
    success: false,
    error: err.message || "Impossible de joindre LivSight ops",
    code: "ops_upstream",
  });
}

async function getRevenueReportHandler(req, res, next) {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten(),
    });
  }
  try {
    const report = await fetchRevenueReport(
      parsed.data.start_date,
      parsed.data.end_date
    );
    return res.json({ success: true, data: report });
  } catch (err) {
    return handleOpsError(err, res, next);
  }
}

async function getExpenseReportHandler(req, res, next) {
  const parsed = reportQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "Validation failed",
      details: parsed.error.flatten(),
    });
  }
  try {
    const report = await fetchExpenseReport(
      parsed.data.start_date,
      parsed.data.end_date,
      parsed.data.personId,
      parsed.data.chargeTypeId
    );
    return res.json({ success: true, data: report });
  } catch (err) {
    return handleOpsError(err, res, next);
  }
}

module.exports = {
  getRevenueReportHandler,
  getExpenseReportHandler,
};
