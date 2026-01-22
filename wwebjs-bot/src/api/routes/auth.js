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
    const findAgencyQuery =
      adapter.type === "postgres"
        ? `SELECT id, name, email, password_hash, role, is_active 
         FROM agencies 
         WHERE email = $1 LIMIT 1`
        : `SELECT id, name, email, password_hash, role, is_active 
         FROM agencies 
         WHERE email = ? LIMIT 1`;

    const agency = await adapter.query(findAgencyQuery, [normalizedEmail]);

    if (!agency) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Invalid email or password",
      });
    }

    // Check if agency is active
    const isActive =
      adapter.type === "postgres" ? agency.is_active : agency.is_active === 1;

    if (!isActive) {
      return res.status(403).json({
        success: false,
        error: "Account disabled",
        message: "Your account has been disabled. Please contact support.",
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(
      password,
      agency.password_hash
    );

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

    // Set HTTP-only cookie with JWT token
    // Detect HTTPS from environment or request headers (for proxy setups)
    const isProduction = process.env.NODE_ENV === "production";
    const isHTTPS =
      process.env.HTTPS === "true" ||
      process.env.PROTOCOL === "https" ||
      req.secure || // Direct HTTPS connection
      req.headers["x-forwarded-proto"] === "https"; // Behind proxy (nginx, etc.)

    const cookieOptions = {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isHTTPS, // HTTPS only when actually using HTTPS
      sameSite: isHTTPS ? "none" : "lax", // none requires secure, lax works with HTTP
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches JWT_EXPIRES_IN default)
      path: "/", // Available for all paths
      // Don't set domain - let browser handle it automatically
    };

    console.log("[Auth] Setting cookie with options:", cookieOptions);
    res.cookie("auth_token", token, cookieOptions);

    // Return success response (exclude password_hash)
    // The token variable is ONLY used for res.cookie() above
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
    const getAgencyQuery =
      adapter.type === "postgres"
        ? `SELECT id, name, email, role, is_active 
         FROM agencies 
         WHERE id = $1 LIMIT 1`
        : `SELECT id, name, email, role, is_active 
         FROM agencies 
         WHERE id = ? LIMIT 1`;

    const result = await adapter.query(getAgencyQuery, [req.user.userId]);
    
    // PostgreSQL adapter returns single object (or null) for LIMIT 1
    // SQLite adapter returns single object (or undefined) for LIMIT 1
    const agency = adapter.type === "postgres" 
      ? (result || null)  // PostgreSQL already returns object or null
      : (result || null);  // SQLite returns object or undefined

    if (!agency) {
      console.error("[Auth /me] User not found in database:", {
        userId: req.user.userId,
        email: req.user.email,
        role: req.user.role,
        dbType: adapter.type,
        queryResult: result,
      });
      
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "User account not found. Please login again.",
      });
    }

    // Check if agency is active
    const isActive =
      adapter.type === "postgres" ? agency.is_active : agency.is_active === 1;

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
