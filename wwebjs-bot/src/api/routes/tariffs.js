/**
 * Tariffs Routes
 * List and manage delivery tariffs (pricing) per quartier (neighborhood)
 * Each agency manages their own tariffs
 */

const express = require("express");
const router = express.Router();
const { authenticateToken } = require("../middleware/auth");
const {
  getTariffById,
  getTariffsByAgency,
  getAllTariffs,
  createTariff,
  updateTariff,
  deleteTariff,
  getTariffByAgencyAndQuartier,
  adapter,
} = require("../../db");

// All routes require authentication
router.use(authenticateToken);

/**
 * GET /api/v1/tariffs
 * List tariffs (filtered by agency for agency admins, all for super admin)
 */
router.get("/", async (req, res, next) => {
  try {
    let tariffs;

    // Super admin sees all tariffs, agency admin sees only their tariffs
    if (req.user.role === "super_admin") {
      tariffs = await getAllTariffs();
      console.log(`[Tariffs API] Super admin - Found ${tariffs?.length || 0} tariffs`);
    } else {
      // Agency admin - only their tariffs
      // Use agencyId from token, or fallback to userId if agencyId is not set
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      console.log("[Tariffs API] Using agencyId:", agencyId);
      
      if (!agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Agency ID not found in token",
        });
      }
      
      tariffs = await getTariffsByAgency(agencyId);
      console.log(`[Tariffs API] Agency admin - Found ${tariffs?.length || 0} tariffs`);
    }

    // Handle array response from queries
    const tariffList = Array.isArray(tariffs) ? tariffs : (tariffs ? [tariffs] : []);

    res.json({
      success: true,
      data: tariffList,
    });
  } catch (error) {
    console.error("[Tariffs API] Error:", error);
    next(error);
  }
});

/**
 * GET /api/v1/tariffs/:id
 * Get tariff by ID
 */
router.get("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const tariffResult = await getTariffById(parseInt(id));

    // Handle array response from queries
    const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;

    if (!tariff) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Tariff not found",
      });
    }

    // Agency admin can only access their own tariffs
    if (req.user.role !== "super_admin") {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (tariff.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You don't have access to this tariff",
        });
      }
    }

    res.json({
      success: true,
      data: tariff,
    });
  } catch (error) {
    console.error("[Tariffs API] Error:", error);
    next(error);
  }
});

/**
 * POST /api/v1/tariffs
 * Create new tariff
 * - Agency admins can create tariffs for their own agency only
 * - Super admins can create tariffs for any agency
 */
router.post("/", async (req, res, next) => {
  try {
    const { agency_id, quartier, tarif_amount } = req.body;

    // Determine which agency this tariff belongs to
    let targetAgencyId;
    
    if (req.user.role === "super_admin") {
      // Super admin can specify agency_id in request body
      if (!agency_id) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "Agency ID is required",
        });
      }
      targetAgencyId = parseInt(agency_id);
    } else {
      // Agency admin can only create tariffs for their own agency
      // Use agencyId from token, or fallback to userId if agencyId is not set
      targetAgencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (!targetAgencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "Agency ID not found in token",
        });
      }
      
      // If agency_id is provided in body, verify it matches the user's agency
      if (agency_id && parseInt(agency_id) !== targetAgencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You can only create tariffs for your own agency",
        });
      }
    }

    // Validate required fields
    if (!quartier || quartier.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Quartier is required",
      });
    }

    if (tarif_amount === undefined || tarif_amount === null) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Tarif amount is required",
      });
    }

    const tariffAmount = parseFloat(tarif_amount);
    if (isNaN(tarifAmount) || tariffAmount < 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Tarif amount must be a valid positive number",
      });
    }

    // Check if tariff already exists for this agency-quartier combination
    const existingTariff = await getTariffByAgencyAndQuartier(targetAgencyId, quartier.trim());
    const existing = Array.isArray(existingTariff) ? existingTariff[0] : existingTariff;

    if (existing) {
      return res.status(409).json({
        success: false,
        error: "Conflict",
        message: `A tariff already exists for quartier "${quartier}" in this agency`,
      });
    }

    // Create tariff
    const tariffId = await createTariff({
      agency_id: targetAgencyId,
      quartier: quartier.trim(),
      tarif_amount: tariffAmount,
    });

    // Get created tariff
    const tariffResult = await getTariffById(tariffId);
    const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;

    res.status(201).json({
      success: true,
      message: "Tariff created successfully",
      data: tariff,
    });
  } catch (error) {
    console.error("[Tariffs API] Error:", error);
    next(error);
  }
});

/**
 * PUT /api/v1/tariffs/:id
 * Update tariff
 * - Agency admins can only update their own tariffs
 * - Super admins can update any tariff
 */
router.put("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;
    const { quartier, tarif_amount } = req.body;

    // Check if tariff exists
    const existingResult = await getTariffById(parseInt(id));
    const existing = Array.isArray(existingResult) ? existingResult[0] : existingResult;

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Tariff not found",
      });
    }

    // Agency admin can only update their own tariffs
    if (req.user.role !== "super_admin") {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (existing.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You can only update your own agency's tariffs",
        });
      }
    }

    // Validate tarif_amount if provided
    if (tarif_amount !== undefined && tarif_amount !== null) {
      const tariffAmount = parseFloat(tarif_amount);
      if (isNaN(tariffAmount) || tariffAmount < 0) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          message: "Tarif amount must be a valid positive number",
        });
      }
    }

    // If quartier is being changed, check for conflicts
    if (quartier && quartier.trim() !== existing.quartier) {
      const agencyId = existing.agency_id;
      const newQuartier = quartier.trim();
      
      // Check if another tariff already exists for this agency-quartier combination
      const conflictResult = await getTariffByAgencyAndQuartier(agencyId, newQuartier);
      const conflict = Array.isArray(conflictResult) ? conflictResult[0] : conflictResult;

      if (conflict && conflict.id !== parseInt(id)) {
        return res.status(409).json({
          success: false,
          error: "Conflict",
          message: `A tariff already exists for quartier "${newQuartier}" in this agency`,
        });
      }
    }

    // Prepare updates
    const updates = {};
    if (quartier !== undefined) {
      updates.quartier = quartier.trim();
    }
    if (tarif_amount !== undefined) {
      updates.tarif_amount = parseFloat(tarif_amount);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "No valid fields to update",
      });
    }

    // Update tariff
    await updateTariff(parseInt(id), updates);

    // Get updated tariff
    const updatedResult = await getTariffById(parseInt(id));
    const updated = Array.isArray(updatedResult) ? updatedResult[0] : updatedResult;

    res.json({
      success: true,
      message: "Tariff updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("[Tariffs API] Error:", error);
    next(error);
  }
});

/**
 * DELETE /api/v1/tariffs/:id
 * Delete tariff
 * - Agency admins can only delete their own tariffs
 * - Super admins can delete any tariff
 */
router.delete("/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if tariff exists
    const existingResult = await getTariffById(parseInt(id));
    const existing = Array.isArray(existingResult) ? existingResult[0] : existingResult;

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Tariff not found",
      });
    }

    // Agency admin can only delete their own tariffs
    if (req.user.role !== "super_admin") {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (existing.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: "Forbidden",
          message: "You can only delete your own agency's tariffs",
        });
      }
    }

    // Delete tariff
    await deleteTariff(parseInt(id));

    res.json({
      success: true,
      message: "Tariff deleted successfully",
    });
  } catch (error) {
    console.error("[Tariffs API] Error:", error);
    next(error);
  }
});

module.exports = router;

