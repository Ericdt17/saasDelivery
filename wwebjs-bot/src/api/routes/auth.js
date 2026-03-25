/**
 * Authentication Routes
 * Handles login, logout, and user info endpoints
 */

const express = require("express");
const router = express.Router();
const { comparePassword } = require("../../utils/password");
const { hashPassword } = require("../../utils/password");
const { generateToken } = require("../../utils/jwt");
const { authenticateToken } = require("../middleware/auth");
const { createAgency, getAgencyByEmail, adapter } = require("../../db");
const { z } = require("zod");

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: "Invalid email address" });

const passwordSchema = z
  .string()
  .min(6, { message: "Password must be at least 6 characters long" })
  .max(72, { message: "Password is too long" });

const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

const signupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, { message: "Name is required" })
    .max(100, { message: "Name is too long" }),
  email: emailSchema,
  password: passwordSchema,
  // Security: allow only agency self-signup. Super admin accounts should be created via seed scripts.
  role: z.enum(["agency"]).optional().default("agency"),
  is_active: z.boolean().optional().default(true),
  agency_code: z
    .string()
    .trim()
    .min(4, { message: "Agency code must be at least 4 characters" })
    .max(20, { message: "Agency code must be at most 20 characters" })
    .regex(/^[A-Za-z0-9]+$/, { message: "Agency code must be alphanumeric" })
    .optional()
    .nullable(),
});

function getIsHTTPS(req) {
  // Detect HTTPS from environment or request headers (for proxy setups)
  return (
    process.env.HTTPS === "true" ||
    process.env.PROTOCOL === "https" ||
    req.secure || // Direct HTTPS connection
    req.headers["x-forwarded-proto"] === "https" // Behind proxy (nginx, etc.)
  );
}

function getCookieOptions(req) {
  const isHTTPS = getIsHTTPS(req);
  return {
    httpOnly: true,
    secure: isHTTPS,
    sameSite: "strict",
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    path: "/",
  };
}

/**
 * POST /api/v1/auth/login
 * Login with email and password
 */
async function handleLogin(req, res, next) {
  try {
    const { email, password } = req.body;

    // Strict validation (zod)
    const loginParsed = loginSchema.safeParse({ email, password });
    if (!loginParsed.success) {
      const firstIssue = loginParsed.error?.issues?.[0];
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: firstIssue?.message || "Invalid email or password",
      });
    }

    // Normalize email (lowercase and trim) and validate password length/format
    const validatedEmail = loginParsed.data.email;
    const validatedPassword = loginParsed.data.password;
    const normalizedEmail = validatedEmail;

    const agency = await adapter.query(
      `SELECT id, name, email, password_hash, role, is_active FROM agencies WHERE email = $1 LIMIT 1`,
      [normalizedEmail]
    );

    if (!agency) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "Invalid email or password",
      });
    }

    if (!agency.is_active) {
      return res.status(403).json({
        success: false,
        error: "Account disabled",
        message: "Your account has been disabled. Please contact support.",
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(
      validatedPassword,
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
    const cookieOptions = getCookieOptions(req);

    res.cookie("auth_token", token, cookieOptions);

    // Return success response (exclude password_hash)
    // The token variable is ONLY used for res.cookie() above
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
}

router.post("/login", handleLogin);
router.post("/signin", handleLogin);

/**
 * POST /api/v1/auth/signup
 * Create a new agency account
 */
router.post("/signup", async (req, res, next) => {
  try {
    const signupParsed = signupSchema.safeParse(req.body);
    if (!signupParsed.success) {
      const firstIssue = signupParsed.error?.issues?.[0];
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: firstIssue?.message || "Invalid signup input",
      });
    }

    const { name, email, password, role = "agency", is_active, agency_code } =
      signupParsed.data;

    // Security: allow only agency self-signup (super admin accounts should be created via seed scripts)
    if (role !== "agency") {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: "Super admin signup is not allowed",
      });
    }

    const normalizedEmail = email;
    const password_hash = await hashPassword(password);

    // Duplicate user prevention (proactive lookup)
    const existing = await getAgencyByEmail(normalizedEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: "An account with this email already exists",
      });
    }

    const agencyId = await createAgency({
      name,
      email: normalizedEmail,
      password_hash,
      role: "agency",
      is_active: is_active === true || is_active === 1,
      agency_code: agency_code ? String(agency_code) : null,
    });

    // Generate JWT token
    const token = generateToken({
      id: agencyId,
      userId: agencyId,
      agencyId: agencyId,
      email: normalizedEmail,
      role: "agency",
    });

    const cookieOptions = getCookieOptions(req);
    res.cookie("auth_token", token, cookieOptions);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: agencyId,
          name: String(name),
          email: normalizedEmail,
          role: "agency",
          agencyId: agencyId,
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
async function handleLogout(req, res) {
  // Revoke access by clearing the authentication cookie
  const clearCookieOptions = {
    ...getCookieOptions(req),
    maxAge: 0,
  };

  res.clearCookie("auth_token", clearCookieOptions);

  res.json({
    success: true,
    message: "Logged out successfully",
  });
}

router.post("/logout", authenticateToken, handleLogout);
router.post("/signout", authenticateToken, handleLogout);

/**
 * GET /api/v1/auth/me
 * Get current authenticated user info
 */
router.get("/me", authenticateToken, async (req, res, next) => {
  try {
    const agency = await adapter.query(
      `SELECT id, name, email, role, is_active FROM agencies WHERE id = $1 LIMIT 1`,
      [req.user.userId]
    );

    if (!agency) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
        message: "User account not found. Please login again.",
      });
    }

    if (!agency.is_active) {
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
