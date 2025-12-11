/**
 * Authentication Routes
 * Handles login, logout, and user info endpoints
 */

const express = require("express");
const router = express.Router();
const { comparePassword } = require("../../utils/password");
const { generateToken } = require("../../utils/jwt");
const { authenticateToken } = require("../middleware/auth");
const { adapter } = require("../../db");

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Email and password are required",
      });
    }

    // Find agency by email
    const findAgencyQuery = adapter.type === "postgres"
      ? `SELECT id, name, email, password_hash, role, is_active 
         FROM agencies 
         WHERE email = $1 LIMIT 1`
      : `SELECT id, name, email, password_hash, role, is_active 
         FROM agencies 
         WHERE email = ? LIMIT 1`;

    const agencies = await adapter.query(findAgencyQuery, [email]);
    const agency = adapter.type === "postgres" ? (agencies[0] || null) : (agencies || null);

    if (!agency) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Invalid email or password",
      });
    }

    // Check if agency is active
    const isActive = adapter.type === "postgres" 
      ? agency.is_active 
      : agency.is_active === 1;

    if (!isActive) {
      return res.status(403).json({
        success: false,
        error: "Account disabled",
        message: "Your account has been disabled. Please contact support.",
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, agency.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    const token = generateToken({
      id: agency.id,
      userId: agency.id,
      agencyId: agency.role === "super_admin" ? null : agency.id,
      email: agency.email,
      role: agency.role,
    });

    // Return success response (exclude password_hash)
    res.json({
      success: true,
      data: {
        token,
        user: {
          id: agency.id,
          name: agency.name,
          email: agency.email,
          role: agency.role,
          agencyId: agency.role === "super_admin" ? null : agency.id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout (client-side token removal, but we can track it if needed)
 */
router.post("/logout", authenticateToken, async (req, res) => {
  // For JWT, logout is handled client-side by removing the token
  // We could implement token blacklisting here if needed
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

/**
 * GET /api/v1/auth/me
 * Get current authenticated user info
 */
router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    // Get agency details from database
    const getAgencyQuery = adapter.type === "postgres"
      ? `SELECT id, name, email, role, is_active 
         FROM agencies 
         WHERE id = $1 LIMIT 1`
      : `SELECT id, name, email, role, is_active 
         FROM agencies 
         WHERE id = ? LIMIT 1`;

    const agencies = await adapter.query(getAgencyQuery, [req.user.userId]);
    const agency = adapter.type === "postgres" ? (agencies[0] || null) : (agencies || null);

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        message: "User account not found",
      });
    }

    // Check if agency is active
    const isActive = adapter.type === "postgres" 
      ? agency.is_active 
      : agency.is_active === 1;

    if (!isActive) {
      return res.status(403).json({
        success: false,
        error: "Account disabled",
        message: "Your account has been disabled",
      });
    }

    res.json({
      success: true,
      data: {
        user: {
          id: agency.id,
          name: agency.name,
          email: agency.email,
          role: agency.role,
          agencyId: agency.role === "super_admin" ? null : agency.id,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

