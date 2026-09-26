/**
 * Ops reports — /api/v1/ops-reports/* (super_admin)
 * Proxies LivSight delivery-ops integration endpoints.
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const controller = require("../controllers/opsReports.controller");

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/revenue", controller.getRevenueReportHandler);
router.get("/expenses", controller.getExpenseReportHandler);

module.exports = router;
