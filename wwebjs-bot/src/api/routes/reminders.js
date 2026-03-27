/**
 * Reminders Routes
 * Super admins schedule reminders; agencies can list their reminders.
 */

const express = require("express");
const router = express.Router();
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const {
  getAgencyReminderContactById,
  createReminder,
  getReminders,
  getReminderById,
  cancelReminder,
} = require("../../db");

router.use(authenticateToken);

function resolveAgencyIdFromUser(user) {
  return user.agencyId !== null && user.agencyId !== undefined
    ? user.agencyId
    : user.userId;
}

router.get("/", async (req, res, next) => {
  try {
    const {
      agency_id: queryAgencyId,
      status,
      contact_id,
      startDate,
      endDate,
      limit = 200,
      offset = 0,
    } = req.query;

    let agencyIdFilter = null;
    if (req.user.role === "super_admin") {
      agencyIdFilter = queryAgencyId ? parseInt(queryAgencyId) : null;
    } else {
      agencyIdFilter = resolveAgencyIdFromUser(req.user);
      if (!agencyIdFilter) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Agency ID not found in token",
        });
      }
    }

    const reminders = await getReminders({
      agency_id: agencyIdFilter,
      status: status || null,
      contact_id: contact_id ? parseInt(contact_id) : null,
      startDate: startDate || null,
      endDate: endDate || null,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      success: true,
      data: reminders,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const reminder = await getReminderById(parseInt(req.params.id));
    if (!reminder) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Reminder not found",
      });
    }

    if (req.user.role !== "super_admin") {
      const agencyId = resolveAgencyIdFromUser(req.user);
      if (reminder.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this reminder",
        });
      }
    }

    res.json({
      success: true,
      data: reminder,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireSuperAdmin, async (req, res, next) => {
  try {
    const { agency_id, contact_id, message, send_at, timezone = "UTC" } = req.body;

    if (!agency_id || !contact_id || !message || !send_at) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "agency_id, contact_id, message, and send_at are required",
      });
    }

    const contact = await getAgencyReminderContactById(parseInt(contact_id));
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Reminder contact not found",
      });
    }

    const agencyId = parseInt(agency_id);
    if (contact.agency_id !== agencyId) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "contact_id does not belong to agency_id",
      });
    }

    const parsedSendAt = new Date(send_at);
    if (Number.isNaN(parsedSendAt.getTime())) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "send_at must be a valid datetime",
      });
    }

    const newId = await createReminder({
      agency_id: agencyId,
      contact_id: parseInt(contact_id),
      message: String(message),
      send_at: parsedSendAt.toISOString(),
      timezone: String(timezone || "UTC"),
      status: "scheduled",
      created_by_user_id: req.user.userId || null,
    });

    const reminder = await getReminderById(newId);
    res.status(201).json({
      success: true,
      data: reminder,
      message: "Reminder scheduled successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireSuperAdmin, async (req, res, next) => {
  try {
    const reminder = await getReminderById(parseInt(req.params.id));
    if (!reminder) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Reminder not found",
      });
    }

    await cancelReminder(reminder.id);
    res.json({
      success: true,
      message: "Reminder cancelled successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

