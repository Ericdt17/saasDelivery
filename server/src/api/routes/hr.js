/**
 * HR routes — /api/v1/hr
 * Public check-in endpoints (no auth) + admin employee endpoints (super_admin)
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const { hrCheckinRateLimit } = require("../middleware/hrCheckinRateLimit");
const controller = require("../controllers/hr.controller");

const router = express.Router();

// Public check-in (rate limited)
router.get("/checkin/verify-email", hrCheckinRateLimit, controller.verifyCheckinEmail);
router.post("/checkin/enroll", hrCheckinRateLimit, controller.publicSelfEnroll);
router.post("/checkin", hrCheckinRateLimit, controller.publicCheckin);

// Admin
router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/employees", controller.listAdminEmployees);
router.post("/employees", controller.createAdminEmployee);
router.patch("/employees/:id", controller.patchAdminEmployee);
router.post("/employees/:id/enroll", controller.enrollAdminEmployeeFace);

router.get("/attendances/summary", controller.getAttendancesSummary);
router.get("/attendances", controller.listAdminAttendances);
router.post("/attendances", controller.createAdminAttendance);

module.exports = router;
