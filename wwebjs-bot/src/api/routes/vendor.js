const express = require("express");
const { z } = require("zod");
const router = express.Router();

const { authenticateToken, requireVendor } = require("../middleware/auth");
const logger = require("../../logger");
const { createDeliveriesService } = require("../../services/deliveriesService");
const deliveriesRepo = require("../../repositories/deliveriesRepo");
const tariffsRepo = require("../../repositories/tariffsRepo");
const pushPort = require("../../ports/pushNotifications");
const {
  adapter,
  getStockItems,
  createStockItem,
  updateStockItemQuantity,
  setStockItemQuantity,
  deleteStockItem,
  upsertVendorPushToken,
  deleteVendorPushToken,
  deleteAllVendorPushTokens,
} = require("../../db");

const deliveriesService = createDeliveriesService({
  deliveriesRepo,
  tariffsRepo,
  pushPort,
  logger,
});

const VALID_STATUSES = [
  "pending",
  "delivered",
  "failed",
  "cancelled",
  "pickup",
  "expedition",
  "client_absent",
  "present_ne_decroche_zone1",
  "present_ne_decroche_zone2",
];

const createDeliverySchema = z.object({
  phone: z.string().trim().min(6, "Phone number is required"),
  customer_name: z.string().trim().max(200).optional().nullable(),
  items: z.string().trim().min(1, "Items description is required"),
  amount_due: z.coerce.number().min(0, "Amount due must be positive"),
  amount_paid: z.coerce.number().min(0).optional().default(0),
  status: z.enum(VALID_STATUSES).optional().default("pending"),
  quartier: z.string().trim().max(200).optional().nullable(),
  notes: z.string().trim().max(1000).optional().nullable(),
  carrier: z.string().trim().max(200).optional().nullable(),
  delivery_fee: z.coerce.number().min(0).optional().nullable(),
});

const createStockItemSchema = z.object({
  name: z.string().trim().min(1).max(255),
  subtitle: z.string().trim().max(255).optional().nullable(),
  quantity: z.coerce.number().int().min(0).optional().default(0),
});

const patchStockItemSchema = z
  .object({
    delta: z.coerce.number().int().optional(),
    quantity: z.coerce.number().int().min(0).optional(),
  })
  .refine((v) => v.delta !== undefined || v.quantity !== undefined, {
    message: "Provide either delta or quantity",
  });

const pushTokenBodySchema = z.object({
  expoPushToken: z.string().trim().min(1, "expoPushToken is required"),
  platform: z.enum(["ios", "android"]),
});

const deletePushTokenBodySchema = z.object({
  expoPushToken: z.string().trim().min(1).optional(),
});

router.use(authenticateToken);
router.use(requireVendor);

// GET /api/v1/vendor/me — current vendor profile
router.get("/me", async (req, res, next) => {
  try {
    const vendor = await adapter.query(
      `SELECT id, name, email, role, is_active, group_id, parent_agency_id
       FROM agencies
       WHERE id = $1
       LIMIT 1`,
      [req.user.userId]
    );

    if (!vendor || vendor.role !== "vendor") {
      return res.status(404).json({
        success: false,
        error: "Vendor not found",
      });
    }

    res.json({
      success: true,
      data: {
        id: vendor.id,
        name: vendor.name,
        email: vendor.email,
        role: vendor.role,
        is_active: vendor.is_active,
        agencyId: req.user.agencyId ?? null,
        groupId: req.user.groupId ?? null,
        parent_agency_id: vendor.parent_agency_id ?? null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/vendor/stock-items — list stock items for vendor's group
router.get("/stock-items", async (req, res, next) => {
  try {
    if (!req.user.groupId) {
      return res.status(400).json({
        success: false,
        error: "Invalid vendor token",
        message: "Vendor account is not linked to a group",
      });
    }

    const rows = await getStockItems({ group_id: req.user.groupId });
    const items = Array.isArray(rows) ? rows : [rows].filter(Boolean);

    res.json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/vendor/stock-items — create stock item
router.post("/stock-items", async (req, res, next) => {
  try {
    if (!req.user.groupId) {
      return res.status(400).json({
        success: false,
        error: "Invalid vendor token",
        message: "Vendor account is not linked to a group",
      });
    }

    const parsed = createStockItemSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: firstIssue?.message || "Invalid stock item data",
      });
    }

    const created = await createStockItem({
      group_id: req.user.groupId,
      name: parsed.data.name,
      subtitle: parsed.data.subtitle ?? null,
      quantity: parsed.data.quantity,
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/v1/vendor/stock-items/:id — delta or absolute quantity update
router.patch("/stock-items/:id", async (req, res, next) => {
  try {
    if (!req.user.groupId) {
      return res.status(400).json({
        success: false,
        error: "Invalid vendor token",
        message: "Vendor account is not linked to a group",
      });
    }

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Invalid id",
      });
    }

    const parsed = patchStockItemSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: firstIssue?.message || "Invalid stock item update",
      });
    }

    const { delta, quantity } = parsed.data;
    const updated =
      delta !== undefined
        ? await updateStockItemQuantity({ id, group_id: req.user.groupId, delta })
        : await setStockItemQuantity({ id, group_id: req.user.groupId, quantity });

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Stock item not found",
      });
    }

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/vendor/stock-items/:id — delete stock item
router.delete("/stock-items/:id", async (req, res, next) => {
  try {
    if (!req.user.groupId) {
      return res.status(400).json({
        success: false,
        error: "Invalid vendor token",
        message: "Vendor account is not linked to a group",
      });
    }

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Invalid id",
      });
    }

    const result = await deleteStockItem({ id, group_id: req.user.groupId });
    if ((result?.changes || 0) === 0) {
      return res.status(404).json({
        success: false,
        error: "Not found",
        message: "Stock item not found",
      });
    }

    res.json({ success: true, message: "Stock item deleted" });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/vendor/push-tokens — register or update Expo push token for this device
router.post("/push-tokens", async (req, res, next) => {
  try {
    const parsed = pushTokenBodySchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: firstIssue?.message || "Invalid push token payload",
      });
    }

    await upsertVendorPushToken({
      vendor_user_id: req.user.userId,
      expo_push_token: parsed.data.expoPushToken,
      platform: parsed.data.platform,
    });

    res.status(201).json({ success: true, message: "Push token registered" });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/vendor/push-tokens — remove one token or all tokens for this vendor
router.delete("/push-tokens", async (req, res, next) => {
  try {
    const parsed = deletePushTokenBodySchema.safeParse(req.body || {});
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: firstIssue?.message || "Invalid body",
      });
    }

    const token = parsed.data.expoPushToken;
    if (token) {
      await deleteVendorPushToken({
        vendor_user_id: req.user.userId,
        expo_push_token: token,
      });
    } else {
      await deleteAllVendorPushTokens({ vendor_user_id: req.user.userId });
    }

    res.json({ success: true, message: "Push token(s) removed" });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/vendor/deliveries — vendor-scoped list
router.get("/deliveries", async (req, res, next) => {
  try {
    if (!req.user.agencyId || !req.user.groupId) {
      return res.status(400).json({
        success: false,
        error: "Invalid vendor token",
        message: "Vendor account is not linked to an agency and group",
      });
    }

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

// POST /api/v1/vendor/deliveries — vendor-scoped create
router.post("/deliveries", async (req, res, next) => {
  try {
    if (!req.user.agencyId || !req.user.groupId) {
      return res.status(400).json({
        success: false,
        error: "Invalid vendor token",
        message: "Vendor account is not linked to an agency and group",
      });
    }

    const parsed = createDeliverySchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: firstIssue?.message || "Invalid delivery data",
      });
    }
    const delivery = await deliveriesService.createDeliveryAsVendor({
      user: req.user,
      body: parsed.data,
    });

    res.status(201).json({
      success: true,
      message: "Delivery created successfully",
      data: delivery,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/vendor/deliveries/:id — vendor-scoped read one (no status updates)
router.get("/deliveries/:id", async (req, res, next) => {
  try {
    if (!req.user.agencyId || !req.user.groupId) {
      return res.status(400).json({
        success: false,
        error: "Invalid vendor token",
        message: "Vendor account is not linked to an agency and group",
      });
    }

    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        error: "Validation error",
        message: "Invalid id",
      });
    }

    const delivery = await deliveriesService.getDelivery({
      user: req.user,
      id,
    });

    if (!delivery) {
      return res.status(404).json({
        success: false,
        error: "Delivery not found",
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
        error: "Forbidden",
        message: error.message,
      });
    }
    next(error);
  }
});

module.exports = router;

