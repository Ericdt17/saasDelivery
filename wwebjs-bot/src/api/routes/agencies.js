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
  getAgencyByEmail,
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

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/agencies/me
 * Get current user's agency (for agency admins to view/edit their own agency)
 * Agency admins can access this, super admins can too
 */
router.get("/me", async (req, res, next) => {
  try {
    // Super admins don't have an agency, so they can't use this endpoint
    if (req.user.role === "super_admin") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Super admins do not have an associated agency. Please use /api/v1/agencies/:id to access specific agencies.",
      });
    }

    // Use agencyId from token, or fallback to userId if agencyId is not set
    let agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
      ? req.user.agencyId 
      : req.user.userId;
    
    // If still no agencyId, try to find agency by user email
    if (!agencyId && req.user.email) {
      try {
        const agencyByEmail = await getAgencyByEmail(req.user.email);
        if (agencyByEmail) {
          agencyId = agencyByEmail.id;
        }
      } catch (error) {
        // If getAgencyByEmail fails, continue with the error below
        console.error("[Agencies API] Error finding agency by email:", error);
      }
    }
    
    if (!agencyId) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Agency ID not found in token and cannot be determined from user info",
      });
    }

    const agency = await getAgencyById(agencyId);

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
 * PUT /api/v1/agencies/:id
 * Update agency
 * - Super admin can update any agency
 * - Agency admin can only update their own agency (and only settings: name, address, phone, logo_base64)
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, email, password, role, is_active, agency_code, address, phone, logo_base64 } = req.body;
    
    // Log user info for debugging
    console.log("[Agencies API PUT /:id] User info from token:", {
      userId: req.user?.userId,
      agencyId: req.user?.agencyId,
      role: req.user?.role,
      email: req.user?.email,
      targetId: id,
    });
    
    // Determine if user can update this agency
    const isSuperAdmin = req.user.role === "super_admin";
    const targetAgencyId = parseInt(id);
    
    // Use agencyId from token, or fallback to userId if agencyId is not set
    // For agency admins, userId and agencyId should be the same (the agency IS the user)
    const userAgencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
      ? req.user.agencyId 
      : req.user.userId;
    
    console.log("[Agencies API PUT /:id] Resolved userAgencyId:", userAgencyId, "targetAgencyId:", targetAgencyId);
    
    // Agency admins can only update their own agency
    if (!isSuperAdmin && targetAgencyId !== userAgencyId) {
      console.error("[Agencies API PUT /:id] Access denied - userAgencyId doesn't match targetAgencyId");
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "You can only update your own agency",
      });
    }

    // Check if agency exists
    const existingAgency = await getAgencyById(parseInt(id));
    if (!existingAgency) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Agency not found",
      });
    }

    // Validate agency_code if provided (only super admin can update this)
    if (agency_code !== undefined && isSuperAdmin) {
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
    
    // Agency admins can only update: name, address, phone, logo_base64
    // Super admins can update everything
    if (name !== undefined) updateData.name = name;
    if (isSuperAdmin) {
      // Only super admin can update these fields
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
      }
    }
    
    // Settings that agency admins can update
    if (address !== undefined) updateData.address = address;
    if (phone !== undefined) updateData.phone = phone;
    if (logo_base64 !== undefined) updateData.logo_base64 = logo_base64;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "No valid fields to update",
      });
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

// Routes below require super admin role
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

