/**
 * HR routes — /api/v1/hr
 * Public check-in endpoints (no auth) + admin employee endpoints (super_admin)
 */

const express = require("express");
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const { hrCheckinRateLimit } = require("../middleware/hrCheckinRateLimit");
const controller = require("../controllers/hr.controller");
const contractController = require("../controllers/hrContract.controller");
const regulationController = require("../controllers/hrRegulation.controller");

const router = express.Router();

// Public check-in (rate limited)
router.get("/checkin/verify-email", hrCheckinRateLimit, controller.verifyCheckinEmail);
router.post("/checkin/enroll", hrCheckinRateLimit, controller.publicSelfEnroll);
router.post("/checkin/client-error", hrCheckinRateLimit, controller.reportClientCheckinError);
router.post("/checkin", hrCheckinRateLimit, controller.publicCheckin);

// Public payslip download — short code (WhatsApp-friendly, no long token)
router.get("/p/:code", controller.downloadPayslipByCode);
router.get("/payslips/download", controller.downloadPayslipByCode);

// Public contract e-signature (single-use token link, rate limited)
router.get("/sign/:token", hrCheckinRateLimit, contractController.getContractSignPage);
router.get(
  "/sign/:token/summary",
  hrCheckinRateLimit,
  contractController.getContractSignSummary
);
router.get(
  "/sign/:token/document.pdf",
  hrCheckinRateLimit,
  contractController.getContractSignDocument
);
router.post(
  "/sign/:token/sign",
  hrCheckinRateLimit,
  contractController.signContractByToken
);
router.post(
  "/sign/:token/decline",
  hrCheckinRateLimit,
  contractController.declineContractByToken
);

// Public règlement intérieur — reading + acknowledgement (email-identified)
router.get("/reglement", hrCheckinRateLimit, regulationController.getRegulationPage);
router.get(
  "/reglement/current",
  hrCheckinRateLimit,
  regulationController.getCurrentRegulationForEmployee
);
router.post(
  "/reglement/acknowledge",
  hrCheckinRateLimit,
  regulationController.acknowledgeRegulation
);

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

// Employee contracts
router.get("/employees/:id/contracts", contractController.listEmployeeContracts);
router.post("/employees/:id/contracts", contractController.generateEmployeeContract);
router.get("/contracts/:id", contractController.getAdminContract);
router.get("/contracts/:id/document.pdf", contractController.getAdminContractDocument);
router.post(
  "/contracts/:id/ready-for-signature",
  contractController.readyContractForSignature
);
router.post("/contracts/:id/send-whatsapp", contractController.sendContractWhatsapp);
router.post("/contracts/:id/cancel", contractController.cancelContract);

// Company regulations (règlement intérieur) — versions + read tracking
router.get("/regulations", regulationController.listAdminRegulations);
router.post("/regulations", regulationController.createAdminRegulation);
router.get("/regulations/:id", regulationController.getAdminRegulation);
router.post(
  "/regulations/:id/versions",
  regulationController.createAdminRegulationVersion
);
router.get(
  "/regulations/:id/acknowledgements",
  regulationController.getAdminRegulationAcknowledgements
);
router.get(
  "/regulation-versions/:id",
  regulationController.getAdminRegulationVersion
);
router.patch(
  "/regulation-versions/:id",
  regulationController.updateAdminRegulationVersion
);
router.post(
  "/regulation-versions/:id/publish",
  regulationController.publishAdminRegulationVersion
);

router.get("/attendances/summary", controller.getAttendancesSummary);
router.get("/attendances", controller.listAdminAttendances);
router.post("/attendances", controller.createAdminAttendance);

router.get("/workplaces", controller.listAdminWorkplaces);
router.post("/workplaces", controller.createAdminWorkplace);
router.patch("/workplaces/:id", controller.patchAdminWorkplace);
router.delete("/workplaces/:id", controller.deleteAdminWorkplace);

module.exports = router;
