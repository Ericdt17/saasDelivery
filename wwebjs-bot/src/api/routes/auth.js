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
    // Validate adapter is available
    if (!adapter) {
      console.error("Database adapter is not initialized");
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
        message: "Database adapter is not available. Please contact support.",
      });
    }

    if (!adapter.query || typeof adapter.query !== "function") {
      console.error("Database adapter.query is not a function", { adapter });
      return res.status(500).json({
        success: false,
        error: "Server configuration error",
        message: "Database query function is not available. Please contact support.",
      });
    }

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

    // Determine database type (default to sqlite if not set)
    const dbType = adapter.type || "sqlite";

    // Find agency by email (emails are stored as lowercase in seed script)
    // Note: adapter.query() with LIMIT 1 returns the object directly (or null), not an array
    const findAgencyQuery = dbType === "postgres"
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
        code: dbError.code,
        detail: dbError.detail,
        stack: dbError.stack,
        email: normalizedEmail,
        dbType: dbType,
        query: findAgencyQuery.substring(0, 100),
      });
      
      // Check if it's a "table does not exist" error
      if (dbError.code === '42P01' || dbError.message.includes('does not exist') || dbError.message.includes('no such table')) {
        return res.status(500).json({
          success: false,
          error: "Database configuration error",
          message: "The agencies table does not exist. Please run database migrations.",
          ...(process.env.NODE_ENV === "development" && {
            details: dbError.message,
            hint: "Run: node src/scripts/create-postgres-tables.js or check migrations",
          }),
        });
      }
      
      // Check if it's a connection error
      if (dbError.code === 'ECONNREFUSED' || dbError.code === 'ENOTFOUND' || dbError.code === 'ETIMEDOUT') {
        return res.status(500).json({
          success: false,
          error: "Database connection error",
          message: "Unable to connect to database. Please check DATABASE_URL configuration.",
          ...(process.env.NODE_ENV === "development" && {
            details: dbError.message,
          }),
        });
      }
      
      return res.status(500).json({
        success: false,
        error: "Database error",
        message: "Unable to verify credentials. Please try again later.",
        ...(process.env.NODE_ENV === "development" && {
          details: dbError.message,
          code: dbError.code,
        }),
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
    // dbType already declared above (line 53)
    const isActive = dbType === "postgres" 
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

    // Set HTTP-only cookie with JWT token
    // For cross-domain (Netlify frontend + Render backend), use SameSite=None and Secure
    const isProduction = process.env.NODE_ENV === "production";
    const cookieOptions = {
      httpOnly: true, // Prevents JavaScript access (XSS protection)
      secure: isProduction, // HTTPS only in production (required for SameSite=None)
      sameSite: isProduction ? "none" : "lax", // Cross-domain in production, lax in development
      maxAge: 24 * 60 * 60 * 1000, // 24 hours (matches JWT_EXPIRES_IN default)
      path: "/", // Available for all paths
      // Don't set domain - let browser handle it automatically for cross-origin
    };
    
    // Log cookie settings for debugging
    if (isProduction) {
      console.log("[Auth] Setting cookie with options:", {
        httpOnly: cookieOptions.httpOnly,
        secure: cookieOptions.secure,
        sameSite: cookieOptions.sameSite,
        path: cookieOptions.path,
      });
    }

    res.cookie("auth_token", token, cookieOptions);

    // Return success response - JWT is ONLY in HTTP-only cookie, NOT in response body
    // This ensures the token cannot be accessed via JavaScript (XSS protection)
    const responseData = {
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
    };
    
    // Explicitly ensure token is NOT included (defensive programming)
    // The token variable is ONLY used for res.cookie() above
    res.json(responseData);
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
 * Logout - clears the authentication cookie
 * Does not require authentication (safe to call even if already logged out)
 */
router.post("/logout", async (req, res) => {
  // Clear the authentication cookie (idempotent - safe to call even if cookie doesn't exist)
  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });

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
    const dbType = adapter.type || "sqlite"; // Local scope for this function
    const getAgencyQuery = dbType === "postgres"
      ? `SELECT id, name, email, role, is_active 
         FROM agencies 
         WHERE id = $1 LIMIT 1`
      : `SELECT id, name, email, role, is_active 
         FROM agencies 
         WHERE id = ? LIMIT 1`;

    const result = await adapter.query(getAgencyQuery, [req.user.userId]);
    // For LIMIT 1 queries, adapter.query returns the object directly (or null) for both postgres and sqlite
    const agency = result || null;

    if (!agency) {
      return res.status(404).json({
        success: false,
        error: "User not found",
        message: "User account not found",
      });
    }

    // Check if agency is active
    // dbType already declared above in this function (line 268)
    const isActive = dbType === "postgres" 
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

/**
 * GET /api/v1/auth/diagnostic
 * Diagnostic endpoint to check database connection and configuration
 */
router.get("/diagnostic", async (req, res) => {
  try {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      adapter: {
        exists: !!adapter,
        type: adapter?.type || "unknown",
        hasQuery: typeof adapter?.query === "function",
      },
      environment: {
        nodeEnv: process.env.NODE_ENV || "not set",
        hasDatabaseUrl: !!process.env.DATABASE_URL,
        hasJwtSecret: !!process.env.JWT_SECRET,
      },
      database: {
        connected: false,
        error: null,
      },
    };

    // Try to query the database
    if (adapter && adapter.query) {
      try {
        const dbType = adapter.type || "sqlite";
        const testQuery = dbType === "postgres"
          ? "SELECT 1 as test"
          : "SELECT 1 as test";
        
        await adapter.query(testQuery);
        diagnostics.database.connected = true;
      } catch (dbError) {
        diagnostics.database.connected = false;
        diagnostics.database.error = {
          message: dbError.message,
          code: dbError.code,
          detail: dbError.detail,
          hint: dbError.code === '42P01' ? 'Table does not exist' : 
                dbError.code === 'ECONNREFUSED' ? 'Connection refused - check DATABASE_URL' :
                dbError.code === 'ENOTFOUND' ? 'Database host not found - check DATABASE_URL' :
                'Check database configuration',
        };
      }

      // Try to check if agencies table exists
      try {
        const dbType = adapter.type || "sqlite";
        const checkTableQuery = dbType === "postgres"
          ? "SELECT COUNT(*) as count FROM agencies LIMIT 1"
          : "SELECT COUNT(*) as count FROM agencies LIMIT 1";
        
        const result = await adapter.query(checkTableQuery);
        diagnostics.database.agenciesTable = {
          exists: true,
          count: result?.count || "unknown",
        };
      } catch (tableError) {
        diagnostics.database.agenciesTable = {
          exists: false,
          error: tableError.message,
          code: tableError.code,
          detail: tableError.detail,
          hint: tableError.code === '42P01' ? 'Table does not exist - run migrations' : 
                tableError.code === 'ECONNREFUSED' ? 'Database connection refused - check DATABASE_URL' :
                'Check database configuration and migrations',
        };
      }
    }

    res.json({
      success: true,
      data: diagnostics,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: "Diagnostic error",
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

module.exports = router;

