/**
 * Agencies Routes
 * Super admin only - manage agencies
 */

const express = require("express");
const router = express.Router();
const { authenticateToken, requireSuperAdmin } = require("../middleware/auth");
const {
  createAgency,
  getAgencyById,
  getAllAgencies,
  updateAgency,
  deleteAgency,
  adapter,
} = require("../../db");
const { hashPassword } = require("../../utils/password");

// All routes require authentication and super admin role
router.use(authenticateToken);
router.use(requireSuperAdmin);

/**
 * GET /api/v1/agencies
 * List all agencies
 */
router.get("/", async (req, res, next) => {
  try {
    const agencies = await getAllAgencies();
    res.json({
      success: true,
      data: agencies,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/agencies/:id
 * Get agency by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const agency = await getAgencyById(parseInt(id));

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Agency not found",
      });
    }

    res.json({
      success: true,
      data: agency,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/agencies
 * Create new agency
 */
router.post("/", async (req, res, next) => {
  try {
    const { name, email, password, role = "agency", is_active = true } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Name, email, and password are required",
      });
    }

    // Hash password
    const password_hash = await hashPassword(password);

    // Convert boolean to 1/0 for SQLite, keep boolean for PostgreSQL
    const dbType = adapter?.type || "sqlite"; // Default to sqlite if adapter not available
    const isActiveValue = dbType === "sqlite" 
      ? (is_active === true || is_active === 1 ? 1 : 0)
      : (is_active === true || is_active === 1);

    // Create agency
    const agencyId = await createAgency({
      name,
      email,
      password_hash,
      role,
      is_active: isActiveValue,
    });

    // Get created agency
    const agency = await getAgencyById(agencyId);

    res.status(201).json({
      success: true,
      data: agency,
      message: "Agency created successfully",
    });
  } catch (error) {
    console.error("Error creating agency:", error);
    // Handle unique constraint violation (duplicate email)
    if (error.message && (error.message.includes("UNIQUE constraint") || error.message.includes("already exists"))) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: "An agency with this email already exists",
      });
    }
    // Handle SQLite binding errors
    if (error.message && error.message.includes("SQLite3 can only bind")) {
      console.error("SQLite binding error - is_active value:", is_active, "converted to:", isActiveValue, "dbType:", dbType);
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Invalid data type. Please contact support.",
      });
    }
    next(error);
  }
});

/**
 * PUT /api/v1/agencies/:id
 * Update agency
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, is_active } = req.body;

    // Check if agency exists
    const existingAgency = await getAgencyById(parseInt(id));
    if (!existingAgency) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Agency not found",
      });
    }

    // Prepare update data
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (email !== undefined) updateData.email = email;
    if (role !== undefined) updateData.role = role;
    if (is_active !== undefined) {
      // Convert boolean to 1/0 for SQLite, keep boolean for PostgreSQL
      const dbType = adapter?.type || "sqlite"; // Default to sqlite if adapter not available
      updateData.is_active = dbType === "sqlite"
        ? (is_active === true || is_active === 1 ? 1 : 0)
        : (is_active === true || is_active === 1);
    }
    if (password !== undefined) {
      updateData.password_hash = await hashPassword(password);
    }

    // Update agency
    await updateAgency(parseInt(id), updateData);

    // Get updated agency
    const updatedAgency = await getAgencyById(parseInt(id));

    res.json({
      success: true,
      data: updatedAgency,
      message: "Agency updated successfully",
    });
  } catch (error) {
    // Handle unique constraint violation (duplicate email)
    if (error.message && error.message.includes("UNIQUE constraint")) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: "An agency with this email already exists",
      });
    }
    next(error);
  }
});

/**
 * DELETE /api/v1/agencies/:id
 * Delete agency (soft delete - sets is_active to false)
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if agency exists
    const existingAgency = await getAgencyById(parseInt(id));
    if (!existingAgency) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Agency not found",
      });
    }

    // Soft delete
    await deleteAgency(parseInt(id));

    res.json({
      success: true,
      message: "Agency deleted successfully",
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

