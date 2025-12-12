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

    // Normalize email (lowercase and trim) to match how it's stored in seed script
    const normalizedEmail = email.trim().toLowerCase();

    // Find agency by email (emails are stored as lowercase in seed script)
    // Note: adapter.query() with LIMIT 1 returns the object directly (or null), not an array
    const findAgencyQuery = adapter.type === "postgres"
      ? `SELECT id, name, email, password_hash, role, is_active 
         FROM agencies 
         WHERE email = $1 LIMIT 1`
      : `SELECT id, name, email, password_hash, role, is_active 
         FROM agencies 
         WHERE email = ? LIMIT 1`;

    let agency;
    try {
      agency = await adapter.query(findAgencyQuery, [normalizedEmail]);
    } catch (dbError) {
      console.error("Database query error in login:", {
        error: dbError.message,
        stack: dbError.stack,
        email: normalizedEmail,
      });
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Unable to verify credentials. Please try again later.",
      });
    }

    if (!agency) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Invalid email or password",
      });
    }

    // Validate that password_hash exists
    if (!agency.password_hash) {
      console.error("Agency found but password_hash is missing:", {
        agencyId: agency.id,
        email: agency.email,
      });
      return res.status(500).json({
        success: false,
        error: "Account configuration error",
        message: "Account is not properly configured. Please contact support.",
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
    let isPasswordValid;
    try {
      isPasswordValid = await comparePassword(password, agency.password_hash);
    } catch (passwordError) {
      console.error("Password comparison error:", {
        error: passwordError.message,
        stack: passwordError.stack,
        agencyId: agency.id,
      });
      return res.status(500).json({
        success: false,
        error: "Authentication error",
        message: "Unable to verify password. Please try again later.",
      });
    }

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Invalid email or password",
      });
    }

    // Generate JWT token
    let token;
    try {
      token = generateToken({
        id: agency.id,
        userId: agency.id,
        agencyId: agency.role === "super_admin" ? null : agency.id,
        email: agency.email,
        role: agency.role,
      });
    } catch (tokenError) {
      console.error("Token generation error:", {
        error: tokenError.message,
        stack: tokenError.stack,
        agencyId: agency.id,
      });
      return res.status(500).json({
        success: false,
        error: "Token generation error",
        message: "Unable to create authentication token. Please try again later.",
      });
    }

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
    // Log unexpected errors with full context
    console.error("Unexpected error in login route:", {
      error: error.message,
      stack: error.stack,
      body: req.body ? { email: req.body.email } : null,
    });
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

