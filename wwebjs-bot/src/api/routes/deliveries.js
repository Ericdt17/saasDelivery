const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery,
  getDeliveryHistory,
  getTariffByAgencyAndQuartier,
  saveHistory,
  deleteDelivery,
} = require('../../db');

// All routes require authentication (cookie-based or Authorization header)
router.use(authenticateToken);

// GET /api/v1/deliveries - List all deliveries with pagination and filters
router.get('/', async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      date,
      phone,
      startDate,
      endDate,
      sortBy = 'created_at',
      sortOrder = 'DESC',
      group_id,
      agency_id: queryAgencyId,
    } = req.query;

    // Auto-filter by agency_id for agency admins (unless super admin)
    let agency_id = null;
    if (req.user && req.user.role !== 'super_admin') {
      // Use agencyId from token, or fallback to userId if agencyId is not set
      agency_id = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
    } else if (req.user && req.user.role === 'super_admin' && queryAgencyId) {
      // Super admin can filter by agency_id if provided in query
      agency_id = parseInt(queryAgencyId);
    }

    const result = await getAllDeliveries({
      page: parseInt(page),
      limit: parseInt(limit),
      status,
      date,
      phone,
      startDate,
      endDate,
      sortBy,
      sortOrder,
      agency_id,
      group_id: group_id ? parseInt(group_id) : null,
    });

    res.json({
      success: true,
      data: result.deliveries,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/deliveries/bulk - Create multiple deliveries at once (must come before POST /)
router.post('/bulk', async (req, res, next) => {
  try {
    const { deliveries } = req.body;

    // Check if deliveries is an array
    if (!Array.isArray(deliveries)) {
      return res.status(400).json({
        success: false,
        error: 'Expected an array of deliveries in "deliveries" field',
        example: { deliveries: [{ phone: "...", items: "...", amount_due: 1000 }] }
      });
    }

    if (deliveries.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Deliveries array cannot be empty',
      });
    }

    if (deliveries.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 deliveries per bulk insert',
      });
    }

    const results = {
      success: [],
      failed: [],
    };

    // Process each delivery
    for (let i = 0; i < deliveries.length; i++) {
      const deliveryData = deliveries[i];
      try {
        const {
          phone,
          items,
          amount_due,
          amount_paid = 0,
          status = 'pending',
          quartier,
          notes,
          carrier,
        } = deliveryData;

        // Validate required fields
        if (!phone || !items || !amount_due) {
          results.failed.push({
            index: i,
            data: deliveryData,
            error: 'Missing required fields: phone, items, amount_due',
          });
          continue;
        }

        // Create delivery
        const deliveryId = await createDelivery({
          phone,
          items,
          amount_due: parseFloat(amount_due),
          amount_paid: parseFloat(amount_paid) || 0,
          status,
          quartier,
          notes,
          carrier,
        });

        const delivery = await getDeliveryById(deliveryId);
        results.success.push({
          index: i,
          id: deliveryId,
          data: delivery,
        });
      } catch (error) {
        results.failed.push({
          index: i,
          data: deliveryData,
          error: error.message,
        });
      }
    }

    // Return results
    const statusCode = results.success.length > 0 ? 201 : 400;
    res.status(statusCode).json({
      success: results.success.length > 0,
      message: `Created ${results.success.length} delivery/deliveries, ${results.failed.length} failed`,
      created: results.success.length,
      failed: results.failed.length,
      results: {
        success: results.success,
        failed: results.failed,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/deliveries/:id - Get single delivery
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const delivery = await getDeliveryById(parseInt(id));

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
      });
    }

    res.json({
      success: true,
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/deliveries - Create new delivery
router.post('/', async (req, res, next) => {
  try {
    const {
      phone,
      customer_name,
      items,
      amount_due,
      amount_paid = 0,
      status = 'pending',
      quartier,
      notes,
      carrier,
      delivery_fee,
      group_id,
    } = req.body;

    // Validation
    if (!phone || !items || !amount_due) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phone, items, amount_due',
      });
    }

    // Get agency_id from authenticated user
    const agencyId = req.user?.agencyId !== null && req.user?.agencyId !== undefined 
      ? req.user.agencyId 
      : req.user?.userId;

    // Parse and prepare delivery data
    const parsedAmountDue = parseFloat(amount_due);
    const parsedAmountPaid = parseFloat(amount_paid) || 0;
    const parsedDeliveryFee = delivery_fee !== undefined && delivery_fee !== null ? parseFloat(delivery_fee) : undefined;
    const parsedStatus = status || 'pending';

    // Apply automatic tariff logic based on status (if delivery_fee not provided)
    // This ensures consistency with status change logic in PUT route
    let finalDeliveryFee = parsedDeliveryFee;
    let finalAmountPaid = parsedAmountPaid;

    if (parsedDeliveryFee === undefined || parsedDeliveryFee === null) {
      // No delivery_fee provided, apply automatic tariff based on status
      if (parsedStatus === 'pickup') {
        // Apply fixed pickup tariff of 1000 FCFA
        finalDeliveryFee = 1000;
        if (parsedAmountPaid === 0 && parsedAmountDue > 0) {
          finalAmountPaid = Math.max(0, Math.round((parsedAmountDue - finalDeliveryFee) * 100) / 100);
        }
        console.log(`[Delivery Create] Applied automatic pickup tariff: ${finalDeliveryFee} FCFA`);
      } else if (parsedStatus === 'present_ne_decroche_zone1') {
        // Apply fixed zone1 tariff of 500 FCFA
        finalDeliveryFee = 500;
        finalAmountPaid = 0; // Force to 0 for this status
        console.log(`[Delivery Create] Applied automatic zone1 tariff: ${finalDeliveryFee} FCFA`);
      } else if (parsedStatus === 'present_ne_decroche_zone2') {
        // Apply fixed zone2 tariff of 1000 FCFA
        finalDeliveryFee = 1000;
        finalAmountPaid = 0; // Force to 0 for this status
        console.log(`[Delivery Create] Applied automatic zone2 tariff: ${finalDeliveryFee} FCFA`);
      } else if (parsedStatus === 'delivered' || parsedStatus === 'client_absent') {
        // Apply tariff from quartier (same as PUT route logic)
        if (!quartier) {
          console.log(`[Delivery Create] Warning: No quartier specified for status "${parsedStatus}", status change allowed without tariff`);
        } else {
          try {
            const tariffResult = await getTariffByAgencyAndQuartier(agencyId, quartier);
            const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;
            
            if (tariff && tariff.tarif_amount) {
              finalDeliveryFee = parseFloat(tariff.tarif_amount) || 0;
              
              if (parsedStatus === 'delivered') {
                // For "delivered": calculate amount_paid = amount_due - delivery_fee
                if (parsedAmountPaid === 0 && parsedAmountDue > 0) {
                  finalAmountPaid = Math.max(0, Math.round((parsedAmountDue - finalDeliveryFee) * 100) / 100);
                }
              } else if (parsedStatus === 'client_absent') {
                // For "client_absent": force amount_paid = 0
                finalAmountPaid = 0;
              }
              
              console.log(`[Delivery Create] Applied automatic tariff: ${finalDeliveryFee} for quartier "${quartier}"`);
            } else {
              console.log(`[Delivery Create] Warning: No tariff found for quartier "${quartier}", status change allowed without tariff`);
            }
          } catch (error) {
            console.log(`[Delivery Create] Error applying tariff: ${error.message}`);
          }
        }
      }
    } else {
      // delivery_fee is provided manually
      // Check if status requires amount_paid = 0 (these statuses always force amount_paid = 0)
      if (parsedStatus === 'client_absent' || parsedStatus === 'present_ne_decroche_zone1' || parsedStatus === 'present_ne_decroche_zone2') {
        // These statuses always force amount_paid = 0, regardless of delivery_fee
        finalAmountPaid = 0;
        console.log(`[Delivery Create] Applied delivery_fee: ${parsedDeliveryFee}, amount_paid forced to 0 (status: ${parsedStatus})`);
      } else {
        // For other statuses (delivered, pickup, etc.), calculate amount_paid if needed
        if (parsedAmountPaid === 0 && parsedAmountDue > 0) {
          finalAmountPaid = Math.max(0, Math.round((parsedAmountDue - parsedDeliveryFee) * 100) / 100);
          console.log(`[Delivery Create] Applied delivery_fee: ${parsedDeliveryFee}, calculated amount_paid: ${parsedAmountDue} -> ${finalAmountPaid} (${parsedAmountDue} - ${parsedDeliveryFee})`);
        }
      }
    }

    const deliveryId = await createDelivery({
      phone,
      customer_name,
      items,
      amount_due: parsedAmountDue,
      amount_paid: finalAmountPaid,
      status: parsedStatus,
      quartier,
      notes,
      carrier,
      delivery_fee: finalDeliveryFee,
      group_id: group_id !== undefined && group_id !== null ? parseInt(group_id) : undefined,
      agency_id: agencyId,
    });

    const delivery = await getDeliveryById(deliveryId);

    res.status(201).json({
      success: true,
      message: 'Delivery created successfully',
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/deliveries/:id - Update delivery
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Check if delivery exists
    const existing = await getDeliveryById(parseInt(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
      });
    }

    // Get the actual delivery object (handle array response from queries)
    const delivery = Array.isArray(existing) ? existing[0] : existing;

    // Determine which status change is happening
    const statusChange = {
      toDelivered: updates.status === 'delivered' && delivery.status !== 'delivered',
      toClientAbsent: updates.status === 'client_absent' && delivery.status !== 'client_absent',
      toFailed: updates.status === 'failed' && delivery.status !== 'failed',
      toPickup: updates.status === 'pickup' && delivery.status !== 'pickup',
      toPresentZone1: updates.status === 'present_ne_decroche_zone1' && delivery.status !== 'present_ne_decroche_zone1',
      toPresentZone2: updates.status === 'present_ne_decroche_zone2' && delivery.status !== 'present_ne_decroche_zone2',
      fromDelivered: delivery.status === 'delivered' && updates.status !== 'delivered' && updates.status !== undefined, // Passage DEPUIS "delivered"
      fromPresentZone1: delivery.status === 'present_ne_decroche_zone1' && updates.status !== 'present_ne_decroche_zone1' && updates.status !== undefined, // Passage DEPUIS "present_ne_decroche_zone1"
      fromPresentZone2: delivery.status === 'present_ne_decroche_zone2' && updates.status !== 'present_ne_decroche_zone2' && updates.status !== undefined, // Passage DEPUIS "present_ne_decroche_zone2"
    };

    // Check if delivery_fee is provided manually in the request
    const manualDeliveryFee = updates.delivery_fee !== undefined && updates.delivery_fee !== null;
    const currentDeliveryFee = delivery.delivery_fee || 0;

    // Helper function to apply tariff logic (used for both "delivered" and "client_absent")
    const applyTariffLogic = async (forceAmountPaidToZero = false) => {
      // Get agency_id from delivery (use existing agency_id)
      const agencyId = delivery.agency_id;
      const quartier = delivery.quartier || updates.quartier;

      if (!agencyId) {
        return {
          error: {
            status: 400,
            success: false,
            error: 'Missing agency information',
            message: 'Cannot apply tariff: delivery has no agency_id',
          }
        };
      }

      if (!quartier) {
        return {
          error: {
            status: 400,
            success: false,
            error: 'Missing quartier',
            message: 'Cannot apply tariff: delivery has no quartier specified. Please specify a quartier before marking as delivered.',
          }
        };
      }

      if (manualDeliveryFee && parseFloat(updates.delivery_fee) >= 0) {
        // User provided a manual delivery_fee, use it
        const manualFee = parseFloat(updates.delivery_fee) || 0;
        
        // Use the manual delivery_fee
        updates.delivery_fee = manualFee;

        // If forcing amount_paid to 0 (client_absent), set it to 0
        if (forceAmountPaidToZero) {
          updates.amount_paid = 0;
          console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for quartier "${quartier}", amount_paid forced to 0 (client_absent)`);
        } else {
          // Calculate new amount_paid (subtract manual fee from current amount_paid)
          // Only update amount_paid if it's not explicitly set in the request
          if (updates.amount_paid === undefined) {
            const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
            const currentAmountDue = parseFloat(delivery.amount_due) || 0;
            
            // When status changes to "delivered", if amount_paid is 0, assume full payment
            if (currentAmountPaid === 0 && currentAmountDue > 0) {
              // No payment recorded yet, assume full payment was made
              const newAmountPaid = Math.max(0, Math.round((currentAmountDue - manualFee) * 100) / 100);
              updates.amount_paid = newAmountPaid;
              console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for quartier "${quartier}"`);
              console.log(`[Delivery Update] No payment recorded, assuming full payment: ${currentAmountDue} -> ${newAmountPaid} (${currentAmountDue} - ${manualFee})`);
            } else if (currentAmountPaid > 0) {
              // Payment already recorded: subtract manual fee
              const newAmountPaid = Math.max(0, Math.round((currentAmountPaid - manualFee) * 100) / 100);
              updates.amount_paid = newAmountPaid;
              console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for quartier "${quartier}"`);
              console.log(`[Delivery Update] Amount paid: ${currentAmountPaid} -> ${newAmountPaid}`);
            } else {
              // amount_paid is 0 and amount_due is 0, keep it at 0
              console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for quartier "${quartier}"`);
              console.log(`[Delivery Update] Amount paid remains 0 (no payment received yet)`);
            }
          } else {
            // amount_paid is explicitly set in the request, use it as is
            console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for quartier "${quartier}"`);
            console.log(`[Delivery Update] Amount paid explicitly set to: ${updates.amount_paid}`);
          }
        }
      } else {
        // Always apply automatic tariff from quartier (replace any existing tariff)
        // Find tariff for this agency and quartier
        const tariffResult = await getTariffByAgencyAndQuartier(agencyId, quartier);
        const tariff = Array.isArray(tariffResult) ? tariffResult[0] : tariffResult;

        if (!tariff || !tariff.tarif_amount) {
          // If no tariff found, log a warning but allow the status change
          // The delivery will be updated without tariff applied (delivery_fee remains 0)
          console.log(`[Delivery Update] Warning: No tariff found for quartier "${quartier}", status change allowed without tariff`);
          if (forceAmountPaidToZero) {
            updates.amount_paid = 0;
          }
        } else {
          const tariffAmount = parseFloat(tariff.tarif_amount) || 0;

          // Set delivery_fee
          updates.delivery_fee = tariffAmount;

          // If forcing amount_paid to 0 (client_absent), set it to 0
          if (forceAmountPaidToZero) {
            updates.amount_paid = 0;
            console.log(`[Delivery Update] Applied automatic tariff: ${tariffAmount} for quartier "${quartier}", amount_paid forced to 0 (client_absent)`);
          } else {
            // Calculate new amount_paid (subtract tariff from current amount_paid)
            // Only update amount_paid if it's not explicitly set in the request
            if (updates.amount_paid === undefined) {
              const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
              const currentAmountDue = parseFloat(delivery.amount_due) || 0;
              
              // When status changes to "delivered", if amount_paid is 0 or less than amount_due,
              // we assume the client paid the full amount_due, so calculate: amount_paid = amount_due - delivery_fee
              if (currentAmountPaid === 0 && currentAmountDue > 0) {
                // No payment recorded yet, assume full payment was made
                const newAmountPaid = Math.max(0, Math.round((currentAmountDue - tariffAmount) * 100) / 100);
                updates.amount_paid = newAmountPaid;
                console.log(`[Delivery Update] Applied automatic tariff: ${tariffAmount} for quartier "${quartier}"`);
                console.log(`[Delivery Update] No payment recorded, assuming full payment: ${currentAmountDue} -> ${newAmountPaid} (${currentAmountDue} - ${tariffAmount})`);
              } else if (currentAmountPaid > 0 && currentAmountPaid < currentAmountDue) {
                // Partial payment: subtract tariff from current amount_paid
                const newAmountPaid = Math.max(0, Math.round((currentAmountPaid - tariffAmount) * 100) / 100);
                updates.amount_paid = newAmountPaid;
                console.log(`[Delivery Update] Applied automatic tariff: ${tariffAmount} for quartier "${quartier}"`);
                console.log(`[Delivery Update] Partial payment: ${currentAmountPaid} -> ${newAmountPaid}`);
              } else if (currentAmountPaid >= currentAmountDue && currentAmountDue > 0) {
                // Full payment already recorded: recalculate with tariff
                const newAmountPaid = Math.max(0, Math.round((currentAmountDue - tariffAmount) * 100) / 100);
                updates.amount_paid = newAmountPaid;
                console.log(`[Delivery Update] Applied automatic tariff: ${tariffAmount} for quartier "${quartier}"`);
                console.log(`[Delivery Update] Full payment recalculated: ${currentAmountPaid} -> ${newAmountPaid} (${currentAmountDue} - ${tariffAmount})`);
              } else {
                // Edge case: keep current value
                console.log(`[Delivery Update] Applied automatic tariff: ${tariffAmount} for quartier "${quartier}"`);
                console.log(`[Delivery Update] Amount paid unchanged: ${currentAmountPaid}`);
              }
            } else {
              // amount_paid is explicitly set in the request, use it as is
              console.log(`[Delivery Update] Applied automatic tariff: ${tariffAmount} for quartier "${quartier}"`);
              console.log(`[Delivery Update] Amount paid explicitly set to: ${updates.amount_paid}`);
            }
          }
        }
      }

      return { success: true };
    };

    // CAS 1: Changement vers "delivered" → appliquer tarif standard (si pas de prix manuel)
    if (statusChange.toDelivered) {
      const result = await applyTariffLogic(false);
      if (result.error) {
        return res.status(result.error.status).json(result.error);
      }
    }
    // CAS 2: Changement vers "client_absent" → appliquer tarif standard MAIS amount_paid = 0 (forcé)
    else if (statusChange.toClientAbsent) {
      const result = await applyTariffLogic(true); // forceAmountPaidToZero = true
      if (result.error) {
        return res.status(result.error.status).json(result.error);
      }
    }
    // CAS 3: Changement vers "failed" → annuler tarif et rembourser complètement
    else if (statusChange.toFailed) {
      // Annuler le tarif (manuel ou automatique)
      updates.delivery_fee = 0;
      
      // Si on vient de "delivered", il faut d'abord rembourser le tarif (remettre le montant brut)
      // puis mettre à 0 pour un remboursement complet
      const currentDeliveryFee = parseFloat(delivery.delivery_fee) || 0;
      const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
      
      if (statusChange.fromDelivered && currentDeliveryFee > 0) {
        // On vient de "delivered" : rembourser le tarif d'abord, puis mettre à 0
        const amountPaidBrut = currentAmountPaid + currentDeliveryFee;
        updates.amount_paid = 0;
        console.log(`[Delivery Update] Status changed from "delivered" to "failed": refunding tariff (${currentDeliveryFee} F) and full amount (${amountPaidBrut} F -> 0)`);
      } else if (currentAmountPaid > 0) {
        // Autre cas : rembourser le montant actuel
        updates.amount_paid = 0;
        console.log(`[Delivery Update] Status changed to "failed": refunding ${currentAmountPaid} F (amount_paid set to 0)`);
      }
      
      console.log(`[Delivery Update] Status changed to "failed": tariff cancelled (delivery_fee set to 0)`);
    }
    // CAS 4: Changement vers "pickup" → appliquer tarif fixe 1000 FCFA et modifier amount_paid (comme "delivered")
    else if (statusChange.toPickup) {
      // Apply fixed tariff of 1000 FCFA for pickup (Au bureau)
      // Modify amount_paid like "delivered": amount_paid = amount_due - delivery_fee
      const pickupTariff = 1000;
      
      // Check if delivery_fee is provided manually in the request
      if (manualDeliveryFee && parseFloat(updates.delivery_fee) >= 0) {
        // User provided a manual delivery_fee, use it
        const manualFee = parseFloat(updates.delivery_fee) || 0;
        updates.delivery_fee = manualFee;
        
        // Calculate amount_paid (same logic as delivered - always recalculate from amount_due)
        if (updates.amount_paid === undefined) {
          const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
          const currentAmountDue = parseFloat(delivery.amount_due) || 0;
          
          if (currentAmountDue > 0) {
            // Always recalculate from amount_due when changing status (like delivered logic)
            // This ensures correct calculation when coming from "delivered" or other statuses with tariffs
            const newAmountPaid = Math.max(0, Math.round((currentAmountDue - manualFee) * 100) / 100);
            updates.amount_paid = newAmountPaid;
            console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for pickup`);
            console.log(`[Delivery Update] Recalculated from amount_due: ${currentAmountDue} -> ${newAmountPaid} (${currentAmountDue} - ${manualFee})`);
          }
        } else {
          // amount_paid is explicitly set in the request, use it as is
          console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for pickup`);
          console.log(`[Delivery Update] Amount paid explicitly set to: ${updates.amount_paid}`);
        }
      } else {
        // Always apply fixed pickup tariff of 1000 FCFA (replace any existing tariff)
        updates.delivery_fee = pickupTariff;
        
        // Calculate amount_paid (same logic as delivered - always recalculate from amount_due)
        if (updates.amount_paid === undefined) {
          const currentAmountPaid = parseFloat(delivery.amount_paid) || 0;
          const currentAmountDue = parseFloat(delivery.amount_due) || 0;
          
          if (currentAmountDue > 0) {
            // Always recalculate from amount_due when changing status (like delivered logic)
            // This ensures correct calculation when coming from "delivered" or other statuses with tariffs
            const newAmountPaid = Math.max(0, Math.round((currentAmountDue - pickupTariff) * 100) / 100);
            updates.amount_paid = newAmountPaid;
            console.log(`[Delivery Update] Applied fixed pickup tariff: ${pickupTariff} FCFA`);
            console.log(`[Delivery Update] Recalculated from amount_due: ${currentAmountDue} -> ${newAmountPaid} (${currentAmountDue} - ${pickupTariff})`);
          }
        } else {
          // amount_paid is explicitly set in the request, use it as is
          console.log(`[Delivery Update] Applied fixed pickup tariff: ${pickupTariff} FCFA`);
          console.log(`[Delivery Update] Amount paid explicitly set to: ${updates.amount_paid}`);
        }
      }
    }
    // CAS 5: Changement vers "present_ne_decroche_zone1" → appliquer tarif fixe 500 FCFA (comme "client_absent")
    else if (statusChange.toPresentZone1) {
      // Apply fixed tariff of 500 FCFA for present_ne_decroche_zone1
      // forceAmountPaidToZero = true (same as client_absent)
      const zone1Tariff = 500;
      
      // Check if delivery_fee is provided manually in the request
      if (manualDeliveryFee && parseFloat(updates.delivery_fee) >= 0) {
        const manualFee = parseFloat(updates.delivery_fee) || 0;
        updates.delivery_fee = manualFee;
        updates.amount_paid = 0;
        console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for present_ne_decroche_zone1, amount_paid forced to 0`);
      } else {
        // Always apply fixed zone1 tariff of 500 FCFA (replace any existing tariff)
        updates.delivery_fee = zone1Tariff;
        updates.amount_paid = 0;
        console.log(`[Delivery Update] Applied fixed zone1 tariff: ${zone1Tariff} FCFA, amount_paid forced to 0`);
      }
    }
    // CAS 6: Changement vers "present_ne_decroche_zone2" → appliquer tarif fixe 1000 FCFA (comme "client_absent")
    else if (statusChange.toPresentZone2) {
      // Apply fixed tariff of 1000 FCFA for present_ne_decroche_zone2
      // forceAmountPaidToZero = true (same as client_absent)
      const zone2Tariff = 1000;
      
      // Check if delivery_fee is provided manually in the request
      if (manualDeliveryFee && parseFloat(updates.delivery_fee) >= 0) {
        const manualFee = parseFloat(updates.delivery_fee) || 0;
        updates.delivery_fee = manualFee;
        updates.amount_paid = 0;
        console.log(`[Delivery Update] Using manual delivery_fee: ${manualFee} for present_ne_decroche_zone2, amount_paid forced to 0`);
      } else {
        // Always apply fixed zone2 tariff of 1000 FCFA (replace any existing tariff)
        updates.delivery_fee = zone2Tariff;
        updates.amount_paid = 0;
        console.log(`[Delivery Update] Applied fixed zone2 tariff: ${zone2Tariff} FCFA, amount_paid forced to 0`);
      }
    }
    // CAS 7: Changement DEPUIS "present_ne_decroche_zone1" ou "present_ne_decroche_zone2" vers un autre statut
    else if (statusChange.fromPresentZone1 || statusChange.fromPresentZone2) {
      // Annuler le tarif appliqué (500 ou 1000 FCFA)
      const currentDeliveryFee = parseFloat(delivery.delivery_fee) || 0;
      
      if (currentDeliveryFee > 0) {
        updates.delivery_fee = 0;
        // amount_paid était déjà à 0 pour ces statuts, donc pas besoin de le modifier
        console.log(`[Delivery Update] Status changed from "${delivery.status}" to "${updates.status}": tariff cancelled (delivery_fee: ${currentDeliveryFee} -> 0)`);
      }
    }
    // CAS 8: Changement DEPUIS "delivered" vers un autre statut (sauf "client_absent", "failed", "pickup", "present_ne_decroche_zone1", "present_ne_decroche_zone2" déjà gérés)
    else if (statusChange.fromDelivered && updates.status !== 'client_absent' && updates.status !== 'failed' && updates.status !== 'pickup' && updates.status !== 'present_ne_decroche_zone1' && updates.status !== 'present_ne_decroche_zone2') {
      // Annuler le tarif et remettre amount_paid à 0 (pas de paiement encore fait)
      const currentDeliveryFee = parseFloat(delivery.delivery_fee) || 0;
      
      if (currentDeliveryFee > 0) {
        // Annuler le tarif
        updates.delivery_fee = 0;
        
        // Remettre amount_paid à 0 car on revient à "en cours" (pas encore payé)
        updates.amount_paid = 0;
        
        console.log(`[Delivery Update] Status changed from "delivered" to "${updates.status}": tariff cancelled (delivery_fee: ${currentDeliveryFee} -> 0)`);
        console.log(`[Delivery Update] Amount paid reset to 0 (back to pending status, not yet paid)`);
      }
    }
    // Autre changement de statut ou pas de changement de statut
    else {
      // Status is not changing to "delivered", "client_absent", or "failed", but delivery_fee might be updated manually
      // Allow manual update of delivery_fee even if status is not changing
      if (manualDeliveryFee && parseFloat(updates.delivery_fee) >= 0) {
        const manualFee = parseFloat(updates.delivery_fee) || 0;
        updates.delivery_fee = manualFee;
        
        // Recalculate amount_paid if delivery_fee changes (always from amount_due, not from current amount_paid)
        const currentAmountDue = parseFloat(delivery.amount_due) || 0;
        const previousFee = parseFloat(delivery.delivery_fee) || 0;
        
        // Always recalculate from amount_due when delivery_fee is changed manually
        // This ensures correct calculation regardless of how amount_paid was previously set
        const newAmountPaid = Math.max(0, Math.round((currentAmountDue - manualFee) * 100) / 100);
        
        // Only update amount_paid if it's not explicitly set in the request
        if (updates.amount_paid === undefined) {
          updates.amount_paid = newAmountPaid;
        }
        
        console.log(`[Delivery Update] Manual delivery_fee update: ${previousFee} -> ${manualFee}`);
        console.log(`[Delivery Update] Amount paid recalculated from amount_due: ${currentAmountDue} -> ${newAmountPaid} (${currentAmountDue} - ${manualFee})`);
      }
    }

    // Store old values for history tracking
    const oldValues = {
      phone: delivery.phone,
      customer_name: delivery.customer_name,
      items: delivery.items,
      amount_due: delivery.amount_due,
      amount_paid: delivery.amount_paid,
      status: delivery.status,
      quartier: delivery.quartier,
      notes: delivery.notes,
      carrier: delivery.carrier,
      delivery_fee: delivery.delivery_fee,
    };

    // Get user info for history actor
    const actor = req.user?.email || req.user?.userId?.toString() || 'unknown';

    // Update delivery
    await updateDelivery(parseInt(id), updates);

    // Get updated delivery (ensure we return a single object, not an array)
    const updated = await getDeliveryById(parseInt(id));
    const updatedDelivery = Array.isArray(updated) ? updated[0] : updated;
    
    // Ensure we have a valid delivery object
    if (!updatedDelivery) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found after update',
      });
    }
    
    // Log final values for verification (important for group report calculations)
    // The amount to reverse to group is calculated as: sum(amount_paid) for all "delivered" deliveries
    // This is because: netARever = sum(amount_paid + delivery_fee) - sum(delivery_fee) = sum(amount_paid)
    console.log(`[Delivery Update] Final values after update:`);
    console.log(`   Status: ${delivery.status} -> ${updatedDelivery.status}`);
    console.log(`   Amount Due: ${updatedDelivery.amount_due}`);
    console.log(`   Amount Paid: ${delivery.amount_paid} -> ${updatedDelivery.amount_paid}`);
    console.log(`   Delivery Fee: ${delivery.delivery_fee || 0} -> ${updatedDelivery.delivery_fee || 0}`);
    if (updatedDelivery.status === 'delivered') {
      // For "delivered" status, this delivery contributes to group reverse amount
      // Contribution = amount_paid (net amount after tariff deduction)
      const contribution = parseFloat(updatedDelivery.amount_paid) || 0;
      console.log(`   ✅ This delivery contributes ${contribution} FCFA to group reverse amount`);
    } else {
      console.log(`   ⚠️  This delivery does NOT contribute to group reverse (status: ${updatedDelivery.status})`);
    }

    // Save history for each modified field
    const fieldMapping = {
      phone: { action: 'updated_phone', fieldName: 'Numéro de téléphone' },
      customer_name: { action: 'updated_customer_name', fieldName: 'Nom du client' },
      items: { action: 'updated_items', fieldName: 'Produits' },
      amount_due: { action: 'updated_amount_due', fieldName: 'Montant total' },
      amount_paid: { action: 'updated_amount_paid', fieldName: 'Montant encaissé' },
      status: { action: 'updated_status', fieldName: 'Statut' },
      quartier: { action: 'updated_quartier', fieldName: 'Quartier' },
      notes: { action: 'updated_notes', fieldName: 'Notes/Instructions' },
      carrier: { action: 'updated_carrier', fieldName: 'Transporteur' },
      delivery_fee: { action: 'updated_delivery_fee', fieldName: 'Frais de livraison' },
    };

    // Track which fields were actually updated
    for (const [field, mapping] of Object.entries(fieldMapping)) {
      if (updates[field] !== undefined && updates[field] !== null) {
        const oldValue = oldValues[field];
        const newValue = updatedDelivery[field];

        // Only save history if value actually changed
        if (oldValue !== newValue) {
          try {
            await saveHistory({
              delivery_id: parseInt(id),
              action: mapping.action,
              details: JSON.stringify({
                field: mapping.fieldName,
                old_value: oldValue,
                new_value: newValue,
                updated_by: actor,
              }),
              actor: actor,
            });
          } catch (historyError) {
            // Log error but don't fail the update
            console.error(`[Delivery Update] Error saving history for ${field}:`, historyError.message);
          }
        }
      }
    }

    res.json({
      success: true,
      message: 'Delivery updated successfully',
      data: updatedDelivery, // Return the single delivery object, not the array
    });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/deliveries/:id - Delete delivery
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if delivery exists
    const existing = await getDeliveryById(parseInt(id));
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
        message: 'Delivery not found',
      });
    }

    // Get the actual delivery object (handle array response from queries)
    const delivery = Array.isArray(existing) ? existing[0] : existing;

    // Check permissions: agency admins can only delete their own deliveries
    if (req.user && req.user.role !== 'super_admin') {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      // Normalize to numbers to avoid false mismatches (e.g. "1" vs 1)
      if (Number(delivery.agency_id) !== Number(agencyId)) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only delete deliveries belonging to your agency',
        });
      }
    }

    // Delete delivery
    const delResult = await deleteDelivery(parseInt(id));
    const changes = delResult && typeof delResult.changes === 'number' ? delResult.changes : 0;
    if (changes <= 0) {
      return res.status(500).json({
        success: false,
        error: 'Delete failed',
        message: 'Delivery could not be deleted (no rows affected)',
      });
    }

    res.json({
      success: true,
      message: 'Delivery deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/deliveries/:id/history - Get delivery history
router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    const history = await getDeliveryHistory(parseInt(id));

    res.json({
      success: true,
      data: history || [],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

