/**
 * Company settings — /api/v1/settings/company (super_admin)
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const controller = require("../controllers/companySettings.controller");

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/company", controller.getCompanySettingsHandler);
router.put("/company", controller.putCompanySettingsHandler);

module.exports = router;
