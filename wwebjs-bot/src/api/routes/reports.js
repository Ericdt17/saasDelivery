/**
 * Reports Routes
 * PDF generation endpoint — delegates all PDF rendering to src/lib/pdfReport.js
 */

const express = require("express");
const { z } = require("zod");
const PDFDocument = require("pdfkit");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  getGroupById,
  getDeliveries,
  getAgencyById,
  getTariffsByAgency,
  getExpeditionStats,
} = require("../../db");
const { buildReportPdfData } = require("../../lib/reportAggregates");
const { generateGroupPdf } = require("../../lib/pdfReport");
const logger = require("../../logger");

// All routes require authentication
router.use(authenticateToken);

const postPdfBodySchema = z.object({
  startDate: z.union([z.string(), z.null()]).optional(),
  endDate: z.union([z.string(), z.null()]).optional(),
  stock: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(200),
        quantity: z.coerce.number().int().min(0).max(999_999_999),
        subtitle: z.union([z.string().trim().max(500), z.null()]).optional(),
      })
    )
    .max(50)
    .optional()
    .default([]),
});

/**
 * Shared PDF stream for GET and POST (same data pipeline; POST adds optional stock lines).
 */
async function streamGroupPdf(req, res, { startDate, endDate, stockLines = [] }) {
  const { groupId } = req.params;

  const group = await getGroupById(parseInt(groupId, 10));
  if (!group) {
    return res.status(404).json({ success: false, error: "Not found", message: "Group not found" });
  }

  if (req.user.role !== "super_admin") {
    const agencyId =
      req.user.agencyId !== null && req.user.agencyId !== undefined
        ? req.user.agencyId
        : req.user.userId;
    if (group.agency_id !== agencyId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You don't have access to this group",
      });
    }
  }

  const agency = await getAgencyById(group.agency_id);
  if (!agency) {
    return res.status(404).json({ success: false, error: "Not found", message: "Agency not found" });
  }

  const deliveriesResult = await getDeliveries({
    page: 1,
    limit: 10000,
    startDate: startDate || null,
    endDate: endDate || null,
    group_id: parseInt(groupId, 10),
    sortBy: "created_at",
    sortOrder: "ASC",
  });
  const deliveries = deliveriesResult.deliveries || [];

  const standardTariffs = {};
  try {
    const tariffsResult = await getTariffsByAgency(agency.id);
    const tariffs = Array.isArray(tariffsResult)
      ? tariffsResult
      : tariffsResult
        ? [tariffsResult]
        : [];
    tariffs.forEach((t) => {
      if (t?.quartier && t?.tarif_amount) {
        standardTariffs[t.quartier] = parseFloat(t.tarif_amount) || 0;
      }
    });
  } catch (err) {
    logger.error({ err }, "Reports API: error fetching standard tariffs");
  }

  let totalFraisExpeditions = 0;
  let totalExpeditions = 0;
  try {
    const expStats = await getExpeditionStats({
      group_id: parseInt(groupId, 10),
      agency_id: group.agency_id,
      startDate: startDate || null,
      endDate: endDate || null,
    });
    totalFraisExpeditions = parseFloat(expStats?.total_frais_de_course) || 0;
    totalExpeditions = parseInt(expStats?.total_expeditions, 10) || 0;
  } catch (err) {
    logger.error({ err }, "Reports API: error fetching expedition stats");
  }

  const {
    totalEncaisse,
    totalTarifs,
    fixedStatusTarifs,
    tarifsParQuartier,
    allLivraisonsDetails,
  } = buildReportPdfData(deliveries, standardTariffs);

  const doc = new PDFDocument({ margin: 50, size: "A4", layout: "portrait" });
  doc.lineGap(2);

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="rapport-${group.name}-${new Date().toISOString().split("T")[0]}.pdf"`
  );
  doc.pipe(res);

  const normalizedStock =
    Array.isArray(stockLines) && stockLines.length > 0
      ? stockLines.map((s) => ({
          name: String(s.name).trim(),
          quantity: Number.isFinite(s.quantity) ? s.quantity : 0,
          subtitle: s.subtitle != null && String(s.subtitle).trim() !== "" ? String(s.subtitle).trim() : null,
        }))
      : [];

  generateGroupPdf(doc, {
    agency,
    group,
    startDate,
    endDate,
    totalEncaisse,
    totalTarifs,
    fixedStatusTarifs,
    tarifsParQuartier,
    allLivraisonsDetails,
    totalFraisExpeditions,
    totalExpeditions,
    stockLines: normalizedStock,
  });
}

/**
 * GET /api/v1/reports/groups/:groupId/pdf
 * Generate a PDF report for a group's deliveries within an optional date range (no stock section).
 */
router.get("/groups/:groupId/pdf", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    await streamGroupPdf(req, res, {
      startDate: startDate || null,
      endDate: endDate || null,
      stockLines: [],
    });
  } catch (error) {
    logger.error({ err: error }, "Reports API: error generating PDF");
    next(error);
  }
});

/**
 * POST /api/v1/reports/groups/:groupId/pdf
 * Same as GET but JSON body may include manual stock lines for the PDF snapshot.
 */
router.post("/groups/:groupId/pdf", async (req, res, next) => {
  try {
    const parsed = postPdfBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        message: "Invalid request body",
        fields: parsed.error.flatten(),
      });
    }

    const { startDate, endDate, stock } = parsed.data;
    await streamGroupPdf(req, res, {
      startDate: startDate ?? null,
      endDate: endDate ?? null,
      stockLines: stock,
    });
  } catch (error) {
    logger.error({ err: error }, "Reports API: error generating PDF (POST)");
    next(error);
  }
});

module.exports = router;
