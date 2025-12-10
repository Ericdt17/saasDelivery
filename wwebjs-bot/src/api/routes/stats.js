const express = require("express");
const router = express.Router();
const { getDeliveryStats } = require("../../db");

/**
 * Validate and normalize date string (YYYY-MM-DD format)
 * @param {string} dateString - Date string to validate
 * @returns {string|null} - Normalized date string or null if invalid
 */
function validateDate(dateString) {
  if (!dateString) return null;

  // Check format YYYY-MM-DD
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateString)) {
    return null;
  }

  // Validate that it's a valid date
  const date = new Date(dateString + "T00:00:00");
  if (isNaN(date.getTime())) {
    return null;
  }

  // Return normalized date (ensure YYYY-MM-DD format)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// GET /api/v1/stats/daily - Get daily statistics
router.get("/daily", async (req, res, next) => {
  try {
    const { date } = req.query;

    // Validate and normalize date if provided
    const normalizedDate = date ? validateDate(date) : null;

    if (date && !normalizedDate) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Expected YYYY-MM-DD",
        received: date,
      });
    }

    const stats = await getDeliveryStats(normalizedDate);
    const responseDate =
      normalizedDate || new Date().toISOString().split("T")[0];

    res.json({
      success: true,
      data: stats,
      date: responseDate,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
