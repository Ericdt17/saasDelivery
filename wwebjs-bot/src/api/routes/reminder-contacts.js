/**
 * Reminder Contacts Routes
 * Agencies manage their own reminder contact numbers.
 */

const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  createAgencyReminderContact,
  getAgencyReminderContacts,
  getAgencyReminderContactById,
  updateAgencyReminderContact,
  deleteAgencyReminderContact,
} = require("../../db");

router.use(authenticateToken);

function resolveAgencyIdFromUser(user) {
  return user.agencyId !== null && user.agencyId !== undefined
    ? user.agencyId
    : user.userId;
}

function normalizePhone(input) {
  const raw = String(input || "").trim();
  // Keep + and digits only
  const cleaned = raw.replace(/[^\d+]/g, "");
  return cleaned;
}

router.get("/", async (req, res, next) => {
  try {
    const { agency_id: queryAgencyId, includeInactive } = req.query;

    let agencyIdFilter;
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

    const contacts = await getAgencyReminderContacts({
      agency_id: agencyIdFilter,
      includeInactive: includeInactive === "true" || includeInactive === "1",
    });

    res.json({
      success: true,
      data: contacts,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { label, phone, is_active = true, agency_id: bodyAgencyId } = req.body;

    if (!label || !phone) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "label and phone are required",
      });
    }

    let targetAgencyId;
    if (req.user.role === "super_admin") {
      if (!bodyAgencyId) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "agency_id is required for super admin",
        });
      }
      targetAgencyId = parseInt(bodyAgencyId);
    } else {
      targetAgencyId = resolveAgencyIdFromUser(req.user);
    }

    const newId = await createAgencyReminderContact({
      agency_id: targetAgencyId,
      label: String(label).trim(),
      phone: normalizePhone(phone),
      is_active: is_active === true || is_active === 1,
    });

    const contact = await getAgencyReminderContactById(newId);
    res.status(201).json({
      success: true,
      data: contact,
      message: "Reminder contact created successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const contact = await getAgencyReminderContactById(parseInt(req.params.id));
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Reminder contact not found",
      });
    }

    if (req.user.role !== "super_admin") {
      const agencyId = resolveAgencyIdFromUser(req.user);
      if (contact.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this reminder contact",
        });
      }
    }

    const { label, phone, is_active } = req.body;
    await updateAgencyReminderContact(contact.id, {
      label: label !== undefined ? String(label).trim() : undefined,
      phone: phone !== undefined ? normalizePhone(phone) : undefined,
      is_active: is_active !== undefined ? (is_active === true || is_active === 1) : undefined,
    });

    const updated = await getAgencyReminderContactById(contact.id);
    res.json({
      success: true,
      data: updated,
      message: "Reminder contact updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const contact = await getAgencyReminderContactById(parseInt(req.params.id));
    if (!contact) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Reminder contact not found",
      });
    }

    if (req.user.role !== "super_admin") {
      const agencyId = resolveAgencyIdFromUser(req.user);
      if (contact.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this reminder contact",
        });
      }
    }

    await deleteAgencyReminderContact(contact.id);

    res.json({
      success: true,
      message: "Reminder contact deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

