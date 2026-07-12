/**
 * JWT Token Utilities
 * Handles JWT token generation and verification
 */

const jwt = require("jsonwebtoken");
const config = require("../config");

// JWT secret — must always be explicitly set. No insecure default.
if (!process.env.JWT_SECRET) {
  const logger = require("../logger");
  logger.fatal("JWT_SECRET environment variable is not set — refusing to start. Set JWT_SECRET to a long random string.");
  process.exit(1);
}
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

/**
 * Generate a JWT token for a user
 * @param {Object} payload - Token payload (userId, agencyId, email, role)
 * @returns {string} - JWT token
 */
function generateToken(payload) {
  try {
    // Validate payload
    if (!payload || (!payload.userId && !payload.id)) {
      throw new Error("Invalid token payload: userId or id is required");
    }

    if (!payload.email) {
      throw new Error("Invalid token payload: email is required");
    }

    if (!payload.role) {
      throw new Error("Invalid token payload: role is required");
    }

    const token = jwt.sign(
      {
        userId: payload.userId || payload.id,
        agencyId: payload.agencyId,
        email: payload.email,
        role: payload.role,
        groupId: payload.groupId ?? null,
      },
      JWT_SECRET,
      {
        expiresIn: JWT_EXPIRES_IN,
      }
    );
    return token;
  } catch (error) {
    throw new Error(`Error generating token: ${error.message}`);
  }
}

/**
 * Verify and decode a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
function verifyToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new Error("Token has expired");
    } else if (error.name === "JsonWebTokenError") {
      throw new Error("Invalid token");
    } else {
      throw new Error(`Error verifying token: ${error.message}`);
    }
  }
}

/**
 * Extract token from Authorization header
 * @param {string} authHeader - Authorization header value (e.g., "Bearer <token>")
 * @returns {string|null} - Extracted token or null
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader) {
    return null;
  }

  // Check if it's a Bearer token
  const parts = authHeader.split(" ");
  if (parts.length === 2 && parts[0] === "Bearer") {
    return parts[1];
  }

  return null;
}

/**
 * Extract token from cookies
 * @param {Object} cookies - Request cookies object
 * @param {string} cookieName - Name of the cookie (default: 'auth_token')
 * @returns {string|null} - Extracted token or null
 */
function extractTokenFromCookie(cookies, cookieName = 'auth_token') {
  if (!cookies || !cookies[cookieName]) {
    return null;
  }
  return cookies[cookieName];
}

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  extractTokenFromCookie,
  JWT_SECRET,
  JWT_EXPIRES_IN,
};

