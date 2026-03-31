/**
 * Authentication and Authorization Middleware
 */

const { verifyToken, extractTokenFromHeader, extractTokenFromCookie } = require("../../utils/jwt");

/**
 * Middleware to authenticate requests using JWT token
 * Checks cookies first (HTTP-only), then falls back to Authorization header (for backward compatibility)
 * Adds user info to req.user if token is valid
 */
function authenticateToken(req, res, next) {
  try {
    let token = null;

    const originalUrl = String(req.originalUrl || "");
    const isLogoutRoute =
      req.path === "/logout" ||
      req.path === "/signout" ||
      originalUrl.endsWith("/api/v1/auth/logout") ||
      originalUrl.endsWith("/api/v1/auth/signout") ||
      originalUrl.endsWith("/auth/logout") ||
      originalUrl.endsWith("/auth/signout");

    // First, try to get token from HTTP-only cookie (preferred method)
    token = extractTokenFromCookie(req.cookies, 'auth_token');

    // If no cookie token, optionally fall back to Authorization header.
    // Opt-in via AUTH_HEADER_FALLBACK=true. Works in all environments so
    // that mobile clients (Expo/React Native) can use Bearer token auth
    // in production without relying on cookies.
    if (!token) {
      const allowHeaderFallback =
        process.env.AUTH_HEADER_FALLBACK === "true" ||
        process.env.AUTH_HEADER_FALLBACK === "1";

      if (allowHeaderFallback) {
        const authHeader = req.headers.authorization;
        token = extractTokenFromHeader(authHeader);
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "No token provided. Please login first.",
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      // Special-case: logout/signout should clear cookie even if token is expired/invalid.
      // This keeps the endpoint protected (cookie must exist), but guarantees revocation.
      if (isLogoutRoute) {
        req.user = null;
        return next();
      }
      throw error;
    }

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      agencyId: decoded.agencyId,
      email: decoded.email,
      role: decoded.role,
      groupId: decoded.groupId ?? null,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Authentication failed",
      message: error.message || "Invalid or expired token",
    });
  }
}

/**
 * Middleware to authorize based on user roles
 * @param {string[]} allowedRoles - Array of allowed roles (e.g., ['super_admin', 'agency_admin'])
 */
function authorizeRole(allowedRoles) {
  return (req, res, next) => {
    // First check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "Please login first",
      });
    }

    // Check if user's role is in allowed roles
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden",
        message: `Access denied. Required role: ${allowedRoles.join(" or ")}`,
      });
    }

    next();
  };
}

/**
 * Middleware to check if user is super admin
 */
function requireSuperAdmin(req, res, next) {
  return authorizeRole(["super_admin"])(req, res, next);
}

/**
 * Middleware to check if user is agency admin or super admin
 */
function requireAgencyAdmin(req, res, next) {
  return authorizeRole(["agency", "super_admin"])(req, res, next);
}

/**
 * Middleware to check if user is a vendor
 */
function requireVendor(req, res, next) {
  return authorizeRole(["vendor"])(req, res, next);
}

/**
 * Middleware to check if user is agency admin, super admin, or vendor
 */
function requireAgencyAdminOrVendor(req, res, next) {
  return authorizeRole(["agency", "super_admin", "vendor"])(req, res, next);
}

module.exports = {
  authenticateToken,
  authorizeRole,
  requireSuperAdmin,
  requireAgencyAdmin,
  requireVendor,
  requireAgencyAdminOrVendor,
};

