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
  adapter,
} = require("../../db");

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/groups
 * List groups (filtered by agency for agency admins, all for super admin)
 */
router.get("/", async (req, res, next) => {
  try {
    let groups;

    // Debug: Log user info
    console.log("[Groups API] User info:", {
      userId: req.user?.userId,
      agencyId: req.user?.agencyId,
      role: req.user?.role,
      email: req.user?.email,
    });

    // Super admin sees all groups, agency admin sees only their groups
    if (req.user.role === "super_admin") {
      groups = await getAllGroups();
    } else {
      // Agency admin - only their groups
      // Use agencyId from token, or fallback to userId if agencyId is not set
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      console.log("[Groups API] Using agencyId:", agencyId);
      
      if (!agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Agency ID not found in token",
        });
      }
      
      groups = await getGroupsByAgency(agencyId);
      console.log("[Groups API] Found groups:", groups?.length || 0);
    }

    res.json({
      success: true,
      data: groups,
    });
  } catch (error) {
    console.error("[Groups API] Error:", error);
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

    // Agency admin can only access their own groups
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
 * Create new group (super admin only, or auto-created by WhatsApp bot)
 */
router.post("/", async (req, res, next) => {
  try {
    // Only super admin can manually create groups
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Only super admin can create groups manually",
      });
    }

    const { agency_id, whatsapp_group_id, name, is_active = true } = req.body;

    // Validate input
    if (!agency_id || !name) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Agency ID and name are required",
      });
    }

    // Convert boolean to 1/0 for SQLite, keep boolean for PostgreSQL
    const dbType = adapter?.type || "sqlite"; // Default to sqlite if adapter not available
    const isActiveValue = dbType === "sqlite"
      ? (is_active === true || is_active === 1 ? 1 : 0)
      : (is_active === true || is_active === 1);

    // Create group
    const groupId = await createGroup({
      agency_id: parseInt(agency_id),
      whatsapp_group_id,
      name,
      is_active: isActiveValue,
    });

    // Get created group
    const group = await getGroupById(groupId);

    res.status(201).json({
      success: true,
      data: group,
      message: "Group created successfully",
    });
  } catch (error) {
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

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (is_active !== undefined) {
      // Convert boolean to 1/0 for SQLite, keep boolean for PostgreSQL
      const dbType = adapter?.type || "sqlite"; // Default to sqlite if adapter not available
      updateData.is_active = dbType === "sqlite"
        ? (is_active === true || is_active === 1 ? 1 : 0)
        : (is_active === true || is_active === 1);
    }

    // Update group
    await updateGroup(parseInt(id), updateData);

    // Get updated group
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
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if group exists
    const existingGroup = await getGroupById(parseInt(id));
    if (!existingGroup) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Group not found",
      });
    }

    // Only super admin can delete groups
    if (req.user.role !== "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Only super admin can delete groups",
      });
    }

    // Soft delete
    await deleteGroup(parseInt(id));

    res.json({
      success: true,
      message: "Group deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

