/**
 * Password Hashing Utilities
 * Uses bcrypt for secure password hashing
 */

const bcrypt = require("bcrypt");

// Salt rounds for bcrypt (10 is a good balance between security and performance)
const SALT_ROUNDS = 10;

/**
 * Hash a plain text password
 * @param {string} plainPassword - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(plainPassword) {
  try {
    const hashedPassword = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hashedPassword;
  } catch (error) {
    throw new Error(`Error hashing password: ${error.message}`);
  }
}

/**
 * Compare a plain text password with a hashed password
 * @param {string} plainPassword - Plain text password to verify
 * @param {string} hashedPassword - Hashed password from database
 * @returns {Promise<boolean>} - True if passwords match, false otherwise
 */
async function comparePassword(plainPassword, hashedPassword) {
  try {
    // Validate inputs
    if (!plainPassword) {
      throw new Error("Plain password is required");
    }

    if (!hashedPassword) {
      throw new Error("Hashed password is required");
    }

    if (typeof plainPassword !== "string") {
      throw new Error("Plain password must be a string");
    }

    if (typeof hashedPassword !== "string") {
      throw new Error("Hashed password must be a string");
    }

    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error(`Error comparing passwords: ${error.message}`);
  }
}

module.exports = {
  hashPassword,
  comparePassword,
  SALT_ROUNDS,
};

