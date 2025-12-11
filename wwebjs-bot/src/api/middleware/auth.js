/**
 * Authentication and Authorization Middleware
 */

const { verifyToken, extractTokenFromHeader } = require("../../utils/jwt");

/**
 * Middleware to authenticate requests using JWT token
 * Adds user info to req.user if token is valid
 */
function authenticateToken(req, res, next) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        error: "Authentication required",
        message: "No token provided. Please login first.",
      });
    }

    // Verify token
    const decoded = verifyToken(token);

    // Debug: Log decoded token
    console.log("[Auth Middleware] Decoded token:", {
      userId: decoded.userId,
      agencyId: decoded.agencyId,
      email: decoded.email,
      role: decoded.role,
    });

    // Add user info to request object
    req.user = {
      userId: decoded.userId,
      agencyId: decoded.agencyId,
      email: decoded.email,
      role: decoded.role,
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

module.exports = {
  authenticateToken,
  authorizeRole,
  requireSuperAdmin,
  requireAgencyAdmin,
};

