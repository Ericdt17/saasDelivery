const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery,
  getDeliveryHistory,
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
    } = req.query;

    // Auto-filter by agency_id for agency admins (unless super admin)
    let agency_id = null;
    if (req.user && req.user.role !== 'super_admin') {
      // Use agencyId from token, or fallback to userId if agencyId is not set
      agency_id = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
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
    } = req.body;

    // Validation
    if (!phone || !items || !amount_due) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: phone, items, amount_due',
      });
    }

    const deliveryId = await createDelivery({
      phone,
      customer_name,
      items,
      amount_due: parseFloat(amount_due),
      amount_paid: parseFloat(amount_paid) || 0,
      status,
      quartier,
      notes,
      carrier,
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

    // Update delivery
    await updateDelivery(parseInt(id), updates);

    // Get updated delivery
    const updated = await getDeliveryById(parseInt(id));

    res.json({
      success: true,
      message: 'Delivery updated successfully',
      data: updated,
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

