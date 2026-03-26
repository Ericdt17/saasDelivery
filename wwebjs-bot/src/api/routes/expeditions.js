/**
 * Expeditions Routes
 * Dedicated CRUD for inter-city expeditions (group-linked only)
 */

const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  createExpedition,
  getExpeditions,
  getExpeditionById,
  updateExpedition,
  deleteExpedition,
  getExpeditionStats,
  getGroupById,
} = require("../../db");

router.use(authenticateToken);

function resolveAgencyIdFromUser(user) {
  return user.agencyId !== null && user.agencyId !== undefined
    ? user.agencyId
    : user.userId;
}

async function ensureGroupAccess(req, groupId) {
  const group = await getGroupById(parseInt(groupId));
  if (!group) {
    return {
      ok: false,
      status: 404,
      body: {
        success: false,
        error: "Not found",
        message: "Group not found",
      },
    };
  }

  if (req.user.role !== "super_admin") {
    const agencyId = resolveAgencyIdFromUser(req.user);
    if (!agencyId || group.agency_id !== agencyId) {
      return {
        ok: false,
        status: 403,
        body: {
          success: false,
          error: "Forbidden",
          message: "You don't have access to this group",
        },
      };
    }
  }

  return { ok: true, group };
}

router.get("/", async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      startDate,
      endDate,
      status,
      group_id,
      agency_id: queryAgencyId,
      search,
      sortBy = "created_at",
      sortOrder = "DESC",
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

    if (group_id) {
      const access = await ensureGroupAccess(req, group_id);
      if (!access.ok) return res.status(access.status).json(access.body);
    }

    const result = await getExpeditions({
      page: parseInt(page),
      limit: parseInt(limit),
      startDate: startDate || null,
      endDate: endDate || null,
      status: status || null,
      group_id: group_id ? parseInt(group_id) : null,
      agency_id: agencyIdFilter,
      search: search || null,
      sortBy: sortBy || "created_at",
      sortOrder: sortOrder || "DESC",
    });

    res.json({
      success: true,
      data: result.expeditions || [],
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/stats/summary", async (req, res, next) => {
  try {
    const { startDate, endDate, group_id, status, agency_id: queryAgencyId } = req.query;

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

    if (group_id) {
      const access = await ensureGroupAccess(req, group_id);
      if (!access.ok) return res.status(access.status).json(access.body);
    }

    const stats = await getExpeditionStats({
      startDate: startDate || null,
      endDate: endDate || null,
      group_id: group_id ? parseInt(group_id) : null,
      agency_id: agencyIdFilter,
      status: status || null,
    });

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const expedition = await getExpeditionById(parseInt(req.params.id));
    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Expedition not found",
      });
    }

    if (req.user.role !== "super_admin") {
      const agencyId = resolveAgencyIdFromUser(req.user);
      if (expedition.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this expedition",
        });
      }
    }

    res.json({
      success: true,
      data: expedition,
    });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const {
      group_id,
      destination,
      agence_de_voyage,
      frais_de_course,
      frais_de_lagence_de_voyage,
      status = "en_attente",
      notes = null,
      agency_id: bodyAgencyId,
    } = req.body;

    if (!group_id || !destination || !agence_de_voyage) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "group_id, destination and agence_de_voyage are required",
      });
    }

    const course = Number(frais_de_course);
    const voyage = Number(frais_de_lagence_de_voyage);
    if (!Number.isFinite(course) || course < 0 || !Number.isFinite(voyage) || voyage < 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "frais_de_course and frais_de_lagence_de_voyage must be valid non-negative numbers",
      });
    }

    const groupAccess = await ensureGroupAccess(req, group_id);
    if (!groupAccess.ok) return res.status(groupAccess.status).json(groupAccess.body);

    let targetAgencyId;
    if (req.user.role === "super_admin") {
      targetAgencyId = bodyAgencyId ? parseInt(bodyAgencyId) : groupAccess.group.agency_id;
    } else {
      targetAgencyId = resolveAgencyIdFromUser(req.user);
      if (groupAccess.group.agency_id !== targetAgencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You can only create expeditions for your own agency groups",
        });
      }
    }

    const newId = await createExpedition({
      agency_id: targetAgencyId,
      group_id: parseInt(group_id),
      destination: String(destination).trim(),
      agence_de_voyage: String(agence_de_voyage).trim(),
      frais_de_course: course,
      frais_de_lagence_de_voyage: voyage,
      status: String(status || "en_attente"),
      notes: notes == null ? null : String(notes),
    });

    const expedition = await getExpeditionById(newId);
    res.status(201).json({
      success: true,
      data: expedition,
      message: "Expedition created successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const expedition = await getExpeditionById(parseInt(req.params.id));
    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Expedition not found",
      });
    }

    if (req.user.role !== "super_admin") {
      const agencyId = resolveAgencyIdFromUser(req.user);
      if (expedition.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this expedition",
        });
      }
    }

    const updates = { ...req.body };
    if (updates.group_id !== undefined) {
      const access = await ensureGroupAccess(req, updates.group_id);
      if (!access.ok) return res.status(access.status).json(access.body);
    }

    if (updates.frais_de_course !== undefined) {
      const v = Number(updates.frais_de_course);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "frais_de_course must be a valid non-negative number",
        });
      }
      updates.frais_de_course = v;
    }

    if (updates.frais_de_lagence_de_voyage !== undefined) {
      const v = Number(updates.frais_de_lagence_de_voyage);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "frais_de_lagence_de_voyage must be a valid non-negative number",
        });
      }
      updates.frais_de_lagence_de_voyage = v;
    }

    if (updates.destination !== undefined) {
      updates.destination = String(updates.destination).trim();
    }
    if (updates.agence_de_voyage !== undefined) {
      updates.agence_de_voyage = String(updates.agence_de_voyage).trim();
    }
    if (updates.notes !== undefined && updates.notes !== null) {
      updates.notes = String(updates.notes);
    }

    await updateExpedition(parseInt(req.params.id), updates);
    const updated = await getExpeditionById(parseInt(req.params.id));
    res.json({
      success: true,
      data: updated,
      message: "Expedition updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const expedition = await getExpeditionById(parseInt(req.params.id));
    if (!expedition) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Expedition not found",
      });
    }

    if (req.user.role !== "super_admin") {
      const agencyId = resolveAgencyIdFromUser(req.user);
      if (expedition.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this expedition",
        });
      }
    }

    await deleteExpedition(parseInt(req.params.id));
    res.json({
      success: true,
      message: "Expedition deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
