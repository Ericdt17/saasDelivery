/**
 * Dépenses générales — /api/v1/expenses/* (super_admin)
 * + catégories dynamiques gérées dans Paramètres.
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const controller = require("../controllers/companyExpenses.controller");

const router = express.Router();

router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/categories", controller.listCategoriesHandler);
router.post("/categories", controller.createCategoryHandler);
router.patch("/categories/:id", controller.patchCategoryHandler);
router.delete("/categories/:id", controller.deleteCategoryHandler);

router.get("/", controller.listExpensesHandler);
router.post("/", controller.createExpenseHandler);
router.get("/summary", controller.summaryHandler);
router.get("/:id", controller.getExpenseHandler);
router.patch("/:id", controller.patchExpenseHandler);
router.delete("/:id", controller.deleteExpenseHandler);

module.exports = router;
