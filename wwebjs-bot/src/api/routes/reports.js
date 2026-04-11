/**
 * Reports Routes
 * PDF generation endpoint — delegates all PDF rendering to src/lib/pdfReport.js
 */

const express = require("express");
const router = express.Router();
const PDFDocument = require("pdfkit");
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

/**
 * GET /api/v1/reports/groups/:groupId/pdf
 * Generate a PDF report for a group's deliveries within an optional date range.
 */
router.get("/groups/:groupId/pdf", async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { startDate, endDate } = req.query;

    // ── Auth / ownership check ───────────────────────────────────────────────
    const group = await getGroupById(parseInt(groupId));
    if (!group) {
      return res.status(404).json({ success: false, error: "Not found", message: "Group not found" });
    }

    if (req.user.role !== "super_admin") {
      const agencyId =
        req.user.agencyId !== null && req.user.agencyId !== undefined
          ? req.user.agencyId
          : req.user.userId;
      if (group.agency_id !== agencyId) {
        return res.status(403).json({ success: false, error: "Forbidden", message: "You don't have access to this group" });
      }
    }

    const agency = await getAgencyById(group.agency_id);
    if (!agency) {
      return res.status(404).json({ success: false, error: "Not found", message: "Agency not found" });
    }

    // ── Data fetching ────────────────────────────────────────────────────────
    const deliveriesResult = await getDeliveries({
      page: 1,
      limit: 10000,
      startDate: startDate || null,
      endDate: endDate || null,
      group_id: parseInt(groupId),
      sortBy: "created_at",
      sortOrder: "ASC",
    });
    const deliveries = deliveriesResult.deliveries || [];

    const standardTariffs = {};
    try {
      const tariffsResult = await getTariffsByAgency(agency.id);
      const tariffs = Array.isArray(tariffsResult)
        ? tariffsResult
        : tariffsResult ? [tariffsResult] : [];
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
        group_id: parseInt(groupId),
        agency_id: group.agency_id,
        startDate: startDate || null,
        endDate: endDate || null,
      });
      totalFraisExpeditions = parseFloat(expStats?.total_frais_de_course) || 0;
      totalExpeditions = parseInt(expStats?.total_expeditions) || 0;
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

    // ── Stream PDF ───────────────────────────────────────────────────────────
    const doc = new PDFDocument({ margin: 50, size: "A4", layout: "portrait" });
    doc.lineGap(2);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="rapport-${group.name}-${new Date().toISOString().split("T")[0]}.pdf"`
    );
    doc.pipe(res);

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
    });
    // generateGroupPdf calls doc.end() internally
  } catch (error) {
    logger.error({ err: error }, "Reports API: error generating PDF");
    next(error);
  }
});

module.exports = router;
