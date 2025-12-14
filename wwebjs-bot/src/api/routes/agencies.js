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
  findAgencyByCode,
  adapter,
} = require("../../db");
const { hashPassword } = require("../../utils/password");

/**
 * Validate agency code format
 * @param {string} code - Agency code to validate
 * @returns {Object} - { valid: boolean, error: string|null }
 */
function validateAgencyCode(code) {
  if (code === null || code === undefined || code === "") {
    return { valid: true, error: null }; // NULL is allowed
  }

  const trimmed = code.trim();
  
  if (trimmed.length < 4) {
    return { valid: false, error: "Agency code must be at least 4 characters" };
  }
  
  if (trimmed.length > 20) {
    return { valid: false, error: "Agency code must be at most 20 characters" };
  }
  
  // Alphanumeric only (A-Z, 0-9)
  if (!/^[A-Z0-9]+$/i.test(trimmed)) {
    return { valid: false, error: "Agency code must contain only letters and numbers" };
  }
  
  return { valid: true, error: null };
}

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
    const { name, email, password, role = "agency", is_active = true, agency_code } = req.body;

    // Validate input
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Name, email, and password are required",
      });
    }

    // Validate agency_code if provided
    if (agency_code !== undefined && agency_code !== null) {
      const codeValidation = validateAgencyCode(agency_code);
      if (!codeValidation.valid) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: codeValidation.error,
        });
      }

      // Check if code is already taken (case-insensitive)
      const normalizedCode = agency_code.trim().toUpperCase();
      const existingAgency = await findAgencyByCode(normalizedCode);
      if (existingAgency) {
        return res.status(409).json({
          success: false,
          error: "Conflict",
          message: "An agency with this code already exists",
        });
      }
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
      agency_code: agency_code || null,
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
    const { name, email, password, role, is_active, agency_code } = req.body;

    // Debug: Log received data
    console.log(`[Agency Update] ID: ${id}, Received agency_code:`, agency_code, "Type:", typeof agency_code);
    console.log(`[Agency Update] Full body:`, JSON.stringify(req.body, null, 2));

    // Check if agency exists
    const existingAgency = await getAgencyById(parseInt(id));
    if (!existingAgency) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Agency not found",
      });
    }

    // Validate agency_code if provided
    if (agency_code !== undefined) {
      const codeValidation = validateAgencyCode(agency_code);
      if (!codeValidation.valid) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: codeValidation.error,
        });
      }

      // Check if code is already taken by another agency (case-insensitive)
      if (agency_code !== null && agency_code !== "") {
        const normalizedCode = agency_code.trim().toUpperCase();
        const existingAgencyWithCode = await findAgencyByCode(normalizedCode);
        if (existingAgencyWithCode && existingAgencyWithCode.id !== parseInt(id)) {
          return res.status(409).json({
            success: false,
            error: "Conflict",
            message: "An agency with this code already exists",
          });
        }
      }
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
    if (agency_code !== undefined) {
      // Normalize the code: trim and uppercase if provided, null if empty
      const normalizedCode = agency_code && typeof agency_code === 'string' && agency_code.trim()
        ? agency_code.trim().toUpperCase()
        : null;
      updateData.agency_code = normalizedCode;
      console.log(`[Agency Update] Setting agency_code in updateData:`, updateData.agency_code, "from original:", agency_code);
    } else {
      console.log(`[Agency Update] WARNING: agency_code is undefined, not including in update`);
    }

    console.log(`[Agency Update] Final updateData:`, JSON.stringify(updateData, null, 2));

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
    // Handle unique constraint violation (duplicate email or code)
    if (error.message && (error.message.includes("UNIQUE constraint") || error.message.includes("duplicate key"))) {
      if (error.message.includes("agency_code") || error.message.includes("code")) {
        return res.status(409).json({
          success: false,
          error: "Conflict",
          message: "An agency with this code already exists",
        });
      }
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

