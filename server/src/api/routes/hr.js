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
router.post("/checkin/client-error", hrCheckinRateLimit, controller.reportClientCheckinError);
router.post("/checkin", hrCheckinRateLimit, controller.publicCheckin);

// Public payslip download — short code (WhatsApp-friendly, no long token)
router.get("/p/:code", controller.downloadPayslipByCode);
router.get("/payslips/download", controller.downloadPayslipByCode);

// Admin
router.use(authenticateToken);
router.use(requireSuperAdmin);

router.get("/employees", controller.listAdminEmployees);
router.post("/employees", controller.createAdminEmployee);
router.get("/employees/:id/payslip.pdf", controller.getEmployeePayslipPdf);
router.get("/employees/:id/payslip/:fileName", controller.getEmployeePayslipPdf);
router.post(
  "/employees/:id/payslip/send-whatsapp",
  controller.sendEmployeePayslipWhatsapp
);
router.patch("/employees/:id", controller.patchAdminEmployee);
router.delete("/employees/:id", controller.deleteAdminEmployee);
router.post("/employees/:id/enroll", controller.enrollAdminEmployeeFace);

router.get("/attendances/summary", controller.getAttendancesSummary);
router.get("/attendances", controller.listAdminAttendances);
router.post("/attendances", controller.createAdminAttendance);

module.exports = router;
