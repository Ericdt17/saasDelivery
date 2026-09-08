/**
 * Merchant terms routes — /api/v1/merchant-terms (super_admin only)
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const controller = require("../controllers/merchantTerms.controller");

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/", controller.listAdminMerchantTerms);
router.post("/", controller.createAdminMerchantTerms);
router.patch("/:id", controller.patchAdminMerchantTerms);
router.delete("/:id", controller.deleteAdminMerchantTerms);

module.exports = router;
