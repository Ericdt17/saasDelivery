/**
 * Reminders Routes
 * Super admins schedule reminders; agencies can list their reminders.
 */

const express = require("express");
const router = express.Router();
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const {
  getAgencyReminderContactById,
  getAgencyReminderContacts,
  getGroupsByAgency,
  getAllActiveGroupsForBroadcast,
  createReminder,
  getReminders,
  getReminderById,
  getReminderTargets,
  cancelReminder,
  deleteReminder,
  retryReminderFailed,
} = require("../../db");

router.use(authenticateToken);

function resolveAgencyIdFromUser(user) {
  return user.agencyId !== null && user.agencyId !== undefined
    ? user.agencyId
    : user.userId;
}

function isValidWindow(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || ""));
}

function normalizeQuickNumber(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits || null;
}

async function buildTargets({ audience_mode, agency_id, contact_ids = [], group_ids = [], quick_numbers = [] }) {
  if (audience_mode === "all_groups") {
    const groups = await getAllActiveGroupsForBroadcast();
    return groups.map((g) => ({
      target_type: "group",
      target_value: g.whatsapp_group_id,
    }));
  }
  if (audience_mode === "contacts") {
    const contacts = await getAgencyReminderContacts({ agency_id, includeInactive: false });
    const selected = new Set((contact_ids || []).map((v) => Number(v)));
    const targets = contacts
      .filter((c) => selected.has(Number(c.id)))
      .map((c) => ({ target_type: "contact", target_value: String(c.phone || "").replace(/\D/g, "") }));
    return targets;
  }
  if (audience_mode === "groups") {
    const groups = await getGroupsByAgency(agency_id);
    const selected = new Set((group_ids || []).map((v) => Number(v)));
    return groups
      .filter((g) => selected.has(Number(g.id)))
      .map((g) => ({ target_type: "group", target_value: g.whatsapp_group_id }));
  }
  return (quick_numbers || [])
    .map(normalizeQuickNumber)
    .filter(Boolean)
    .map((n) => ({ target_type: "quick_number", target_value: n }));
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

    const withProgress = reminders.map((r) => ({
      ...r,
      progress_percent: r.total_targets > 0
        ? Math.round((((r.sent_count || 0) + (r.failed_count || 0) + (r.skipped_count || 0)) / r.total_targets) * 100)
        : 0,
    }));
    res.json({
      success: true,
      data: withProgress,
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
      if (reminder.agency_id == null) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this reminder",
        });
      }
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
      data: {
        ...reminder,
        targets: await getReminderTargets(reminder.id),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", requireSuperAdmin, async (req, res, next) => {
  try {
    const {
      agency_id,
      contact_id,
      contact_ids,
      group_ids,
      quick_numbers,
      audience_mode = "contacts",
      message,
      send_at,
      timezone = "Africa/Douala",
      send_interval_min_sec = 60,
      send_interval_max_sec = 120,
      window_start = null,
      window_end = null,
    } = req.body;

    const mode = String(audience_mode);
    const isAllGroups = mode === "all_groups";

    if (!message || !send_at) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "message and send_at are required",
      });
    }
    if (!isAllGroups && (agency_id === undefined || agency_id === null || agency_id === "")) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "agency_id is required for this audience mode",
      });
    }
    if (!["contacts", "groups", "quick_numbers", "all_groups"].includes(mode)) {
      return res.status(400).json({ success: false, error: "Validation error", message: "Invalid audience_mode" });
    }
    const minSec = Number(send_interval_min_sec);
    const maxSec = Number(send_interval_max_sec);
    if (!Number.isFinite(minSec) || !Number.isFinite(maxSec) || minSec <= 0 || maxSec <= 0 || minSec > maxSec) {
      return res.status(400).json({ success: false, error: "Validation error", message: "Invalid interval values" });
    }
    if ((window_start && !isValidWindow(window_start)) || (window_end && !isValidWindow(window_end))) {
      return res.status(400).json({ success: false, error: "Validation error", message: "Invalid HH:mm window format" });
    }

    const agencyId = isAllGroups ? null : parseInt(agency_id, 10);
    if (!isAllGroups && !Number.isFinite(agencyId)) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "agency_id must be a valid number",
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

    const selectedContactIds = Array.isArray(contact_ids) ? contact_ids : (contact_id ? [contact_id] : []);
    const targets = await buildTargets({
      audience_mode: mode,
      agency_id: agencyId,
      contact_ids: selectedContactIds,
      group_ids: Array.isArray(group_ids) ? group_ids : [],
      quick_numbers: Array.isArray(quick_numbers) ? quick_numbers : [],
    });
    const dedup = [];
    const seen = new Set();
    for (const t of targets) {
      const key = `${t.target_type}:${t.target_value}`;
      if (seen.has(key)) continue;
      seen.add(key);
      dedup.push(t);
    }
    if (dedup.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: isAllGroups
          ? "Aucun groupe actif avec ID WhatsApp enregistré"
          : "At least one valid target is required",
      });
    }

    if (mode === "contacts" && contact_id && agencyId != null) {
      const singleContact = await getAgencyReminderContactById(parseInt(contact_id));
      if (singleContact && singleContact.agency_id !== agencyId) {
        return res.status(400).json({ success: false, error: "Validation error", message: "contact_id does not belong to agency_id" });
      }
    }

    const newId = await createReminder({
      agency_id: agencyId,
      contact_id: contact_id ? parseInt(contact_id) : null,
      message: String(message),
      send_at: parsedSendAt.toISOString(),
      timezone: String(timezone || "Africa/Douala"),
      audience_mode: mode,
      send_interval_min_sec: minSec,
      send_interval_max_sec: maxSec,
      window_start: window_start || null,
      window_end: window_end || null,
      status: "scheduled",
      created_by_user_id: req.user.userId || null,
      targets: dedup,
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

router.post("/:id/cancel", requireSuperAdmin, async (req, res, next) => {
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
    await deleteReminder(reminder.id);
    return res.json({ success: true, message: "Reminder deleted successfully" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/retry-failed", requireSuperAdmin, async (req, res, next) => {
  try {
    const reminder = await getReminderById(parseInt(req.params.id));
    if (!reminder) {
      return res.status(404).json({ success: false, error: "Not found", message: "Reminder not found" });
    }
    if (reminder.status === "cancelled") {
      return res.status(400).json({ success: false, error: "Validation error", message: "Cancelled campaign cannot be retried" });
    }
    await retryReminderFailed(reminder.id);
    return res.json({ success: true, message: "Failed targets queued again" });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

