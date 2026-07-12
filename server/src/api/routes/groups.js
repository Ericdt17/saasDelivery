/**
 * Groups Routes
 * List and manage groups (filtered by agency for agency admins)
 */

const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  getGroupById,
  getGroupsByAgency,
  getAllGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  hardDeleteGroup,
  adapter,
} = require("../../db");

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/groups
 * List groups (filtered by agency for agency admins, all for super admin)
 * Returns all groups (active and inactive) so users can see their status and toggle them.
 */
router.get("/", async (req, res, next) => {
  try {
    let groups;

    if (req.user.role === "super_admin") {
      groups = await getAllGroups(true);
    } else {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined
        ? req.user.agencyId
        : req.user.userId;
      
      if (!agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Agency ID not found in token",
        });
      }
      
      groups = await getGroupsByAgency(agencyId, true);
    }

    res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/groups/:id
 * Get group by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const group = await getGroupById(parseInt(id));

    if (!group) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Group not found",
      });
    }

    if (req.user.role !== "super_admin") {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined
        ? req.user.agencyId
        : req.user.userId;

      if (group.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this group",
        });
      }
    }

    res.json({
      success: true,
      data: group,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/groups
 * Create new group
 * - Agency admins can create groups for their own agency only
 * - Super admins can create groups for any agency
 */
router.post("/", async (req, res, next) => {
  try {
    const { agency_id, whatsapp_group_id, name, is_active = true } = req.body;

    // Determine which agency this group belongs to
    let targetAgencyId;
    
    if (req.user.role === "super_admin") {
      // Super admin can specify agency_id in request body
      if (!agency_id) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "Agency ID is required",
        });
      }
      targetAgencyId = parseInt(agency_id);
    } else {
      // Agency admin can only create groups for their own agency
      // Use agencyId from token, or fallback to userId if agencyId is not set
      targetAgencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (!targetAgencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Agency ID not found in token",
        });
      }
      
      // If agency_id is provided in body, verify it matches the user's agency
      if (agency_id && parseInt(agency_id) !== targetAgencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You can only create groups for your own agency",
        });
      }
    }

    // Validate required fields
    if (!name || !whatsapp_group_id) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Name and WhatsApp Group ID are required",
      });
    }

    // Validate WhatsApp Group ID format (should match pattern like "120363424120563204@g.us")
    const whatsappIdPattern = /^\d+@g\.us$/;
    if (!whatsappIdPattern.test(whatsapp_group_id.trim())) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Invalid WhatsApp Group ID format. Expected format: numbers@g.us",
      });
    }

    const existingGroup = await adapter.query(
      `SELECT id FROM groups WHERE whatsapp_group_id = $1 LIMIT 1`,
      [whatsapp_group_id.trim()]
    );

    if (existingGroup) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: "A group with this WhatsApp Group ID already exists",
      });
    }

    const groupId = await createGroup({
      agency_id: targetAgencyId,
      whatsapp_group_id: whatsapp_group_id.trim(),
      name: name.trim(),
      is_active: is_active === true || is_active === 1,
    });

    // Get created group
    const group = await getGroupById(groupId);

    res.status(201).json({
      success: true,
      data: group,
      message: "Group created successfully",
    });
  } catch (error) {
    // Handle unique constraint violation (whatsapp_group_id)
    if (error.message && (error.message.includes("UNIQUE constraint") || error.message.includes("duplicate key"))) {
      if (error.message.includes("whatsapp_group_id") || error.message.includes("group")) {
        return res.status(409).json({
          success: false,
          error: "Conflict",
          message: "A group with this WhatsApp Group ID already exists",
        });
      }
    }
    next(error);
  }
});

/**
 * PUT /api/v1/groups/:id
 * Update group
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, is_active } = req.body;

    // Check if group exists
    const existingGroup = await getGroupById(parseInt(id));
    if (!existingGroup) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Group not found",
      });
    }

    // Agency admin can only update their own groups
    if (req.user.role !== "super_admin") {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (existingGroup.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this group",
        });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (is_active !== undefined) {
      updateData.is_active = is_active === true || is_active === 1;
    }

    await updateGroup(parseInt(id), updateData);
    const updatedGroup = await getGroupById(parseInt(id));

    res.json({
      success: true,
      data: updatedGroup,
      message: "Group updated successfully",
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/groups/:id
 * Delete group (soft delete - sets is_active to false)
 * - Agency admins can delete their own groups
 * - Super admins can delete any group
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query; // Check if permanent=true in query string

    // Check if group exists
    const existingGroup = await getGroupById(parseInt(id));
    if (!existingGroup) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Group not found",
      });
    }

    // Agency admin can only delete their own groups
    if (req.user.role !== "super_admin") {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (existingGroup.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You can only delete groups belonging to your agency",
        });
      }
    }

    const permanentStr = String(permanent || "").trim().toLowerCase();
    const isPermanent = permanentStr === "true" || permanent === true || permanentStr === "1";

    if (isPermanent) {
      await hardDeleteGroup(parseInt(id));
      res.json({
        success: true,
        message: "Group permanently deleted from database",
      });
    } else {
      await deleteGroup(parseInt(id));

      res.json({
        success: true,
        message: "Group deactivated (soft delete - is_active set to false)",
      });
    }
  } catch (error) {
    next(error);
  }
});

module.exports = router;

