const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticateToken } = require('../middleware/auth');
const logger = require('../../logger');
const { createDeliveriesService } = require('../../services/deliveriesService');
const deliveriesRepo = require('../../repositories/deliveriesRepo');
const tariffsRepo = require('../../repositories/tariffsRepo');
const pushPort = require('../../ports/pushNotifications');
const {
  getDeliveryById,
  updateDelivery,
  getDeliveryHistory,
  getTariffByAgencyAndQuartier,
  saveHistory,
  deleteDelivery,
  getExpoPushTokensForVendorUserIds,
} = require('../../db');
const { notifyVendorDeliveryStatusChange } = require('../../lib/expoPush');
const { computeTariffPending, computeAmountPaidAfterFee } = require('../../lib/deliveryCalculations');

const deliveriesService = createDeliveriesService({
  deliveriesRepo,
  tariffsRepo,
  pushPort,
  logger,
});

const VALID_STATUSES = [
  'pending', 'delivered', 'failed', 'cancelled', 'pickup',
  'expedition', 'client_absent', 'present_ne_decroche_zone1', 'present_ne_decroche_zone2',
];

const createDeliverySchema = z.object({
  phone: z.string().trim().min(6, 'Phone number is required'),
  customer_name: z.string().trim().max(200).optional().nullable(),
  items: z.string().trim().min(1, 'Items description is required'),
  amount_due: z.coerce.number().min(0, 'Amount due must be positive'),
  amount_paid: z.coerce.number().min(0).optional().default(0),
  status: z.enum(VALID_STATUSES).optional().default('pending'),
  quartier: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  carrier: z.string().trim().max(200).optional().nullable(),
  delivery_fee: z.coerce.number().min(0).optional().nullable(),
  group_id: z.coerce.number().int().positive().optional().nullable(),
});

// All routes require authentication (cookie-based or Authorization header)
router.use(authenticateToken);

// GET /api/v1/deliveries - List all deliveries with pagination and filters
router.get('/', async (req, res, next) => {
  try {
    const result = await deliveriesService.listDeliveries({
      user: req.user,
      query: req.query,
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
  // Vendors cannot use bulk import
  if (req.user?.role === 'vendor') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Vendors cannot use bulk delivery creation',
    });
  }

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

    const results = await deliveriesService.bulkCreateDeliveries({
      user: req.user,
      deliveries,
    });

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
    const delivery = await deliveriesService.getDelivery({
      user: req.user,
      id: parseInt(id, 10),
    });

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
    if (error?.statusCode === 403) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: error.message,
      });
    }
    next(error);
  }
});

// POST /api/v1/deliveries - Create new delivery
router.post('/', async (req, res, next) => {
  try {
    const parsed = createDeliverySchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: firstIssue?.message || 'Invalid delivery data',
      });
    }

    const delivery = await deliveriesService.createDeliveryAsAgency({
      user: req.user,
      body: parsed.data,
    });

    res.status(201).json({
      success: true,
      message: 'Delivery created successfully',
      data: delivery,
    });
  } catch (error) {
    if (error?.statusCode === 400 && error?.error === 'Invalid vendor token') {
      return res.status(400).json({
        success: false,
        error: 'Invalid vendor token',
        message: error.message,
      });
    }
    next(error);
  }
});

// PUT /api/v1/deliveries/:id - Update delivery
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const actor = req.user?.email || req.user?.userId?.toString() || 'unknown';
    const { updatedDelivery } = await deliveriesService.updateDelivery({
      user: req.user,
      id: parseInt(id, 10),
      patch: req.body,
      actor,
    });

    res.json({
      success: true,
      message: 'Delivery updated successfully',
      data: updatedDelivery, // Return the single delivery object, not the array
    });
  } catch (error) {
    if (error?.statusCode && error?.responseBody) {
      return res.status(error.statusCode).json(error.responseBody);
    }
    next(error);
  }
});

// DELETE /api/v1/deliveries/:id - Delete delivery
router.delete('/:id', async (req, res, next) => {
  // Vendors cannot delete deliveries
  if (req.user?.role === 'vendor') {
    return res.status(403).json({
      success: false,
      error: 'Forbidden',
      message: 'Vendors cannot delete deliveries',
    });
  }

  try {
    const { id } = req.params;

    // Check if delivery exists (preserve existing response shape)
    const existing = await deliveriesService.getDelivery({ user: req.user, id: parseInt(id, 10) });
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Delivery not found',
        message: 'Delivery not found',
      });
    }
    const delivery = existing;

    // Check permissions: agency admins can only delete their own deliveries
    if (req.user && req.user.role !== 'super_admin') {
      const agencyId = req.user.agencyId !== null && req.user.agencyId !== undefined 
        ? req.user.agencyId 
        : req.user.userId;
      
      if (delivery.agency_id !== agencyId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'You can only delete deliveries belonging to your agency',
        });
      }
    }

    // Delete delivery
    await deliveriesService.deleteDelivery({ user: req.user, id: parseInt(id, 10) });

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
    const history = await deliveriesService.getDeliveryHistory({ user: req.user, id: parseInt(id, 10) });

    res.json({
      success: true,
      data: history || [],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

