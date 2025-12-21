const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const { getDeliveryStats } = require("../../db");

// All routes require authentication (cookie-based or Authorization header)
router.use(authenticateToken);

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
    const { date, group_id, agency_id: queryAgencyId } = req.query;

    // Debug: Log user info
    console.log("[Stats API] User info:", {
      userId: req.user?.userId,
      agencyId: req.user?.agencyId,
      role: req.user?.role,
      email: req.user?.email,
    });

    // Validate and normalize date if provided
    const normalizedDate = date ? validateDate(date) : null;

    if (date && !normalizedDate) {
      return res.status(400).json({
        success: false,
        error: "Invalid date format. Expected YYYY-MM-DD",
        received: date,
      });
    }

    // Auto-filter by agency_id for agency admins (unless super admin)
    let agency_id = null;
    if (req.user && req.user.role !== "super_admin") {
      // Use agencyId from token, or fallback to userId if agencyId is not set
      agency_id =
        req.user.agencyId !== null && req.user.agencyId !== undefined
          ? req.user.agencyId
          : req.user.userId;

      console.log("[Stats API] Using agencyId:", agency_id);
    } else if (req.user && req.user.role === "super_admin" && queryAgencyId) {
      // Super admin can filter by agency_id if provided in query
      agency_id = parseInt(queryAgencyId);
      console.log("[Stats API] Super admin filtering by agencyId:", agency_id);
    }

    const stats = await getDeliveryStats(
      normalizedDate,
      agency_id,
      group_id ? parseInt(group_id) : null
    );

    console.log("[Stats API] Stats result:", stats);

    const responseDate =
      normalizedDate || new Date().toISOString().split("T")[0];

    res.json({
      success: true,
      data: stats,
      date: responseDate,
      agency_id: agency_id,
      group_id: group_id ? parseInt(group_id) : null,
    });
  } catch (error) {
    console.error("[Stats API] Error:", error);
    next(error);
  }
});

module.exports = router;
