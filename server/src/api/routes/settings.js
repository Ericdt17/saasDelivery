/**
 * Settings — company branding + personal profile (super_admin)
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const companyController = require("../controllers/companySettings.controller");
const profileController = require("../controllers/myProfile.controller");

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/company", companyController.getCompanySettingsHandler);
router.put("/company", companyController.putCompanySettingsHandler);

router.get("/me", profileController.getMyProfileHandler);
router.patch("/me", profileController.patchMyProfileHandler);

module.exports = router;
