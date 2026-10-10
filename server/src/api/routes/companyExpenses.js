/**
 * Dépenses générales — /api/v1/expenses/* (super_admin)
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const controller = require("../controllers/companyExpenses.controller");

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/", controller.listExpensesHandler);
router.post("/", controller.createExpenseHandler);
router.get("/summary", controller.summaryHandler);
router.patch("/:id", controller.patchExpenseHandler);
router.delete("/:id", controller.deleteExpenseHandler);

module.exports = router;
