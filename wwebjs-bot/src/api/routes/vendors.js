/**
 * Vendors Routes
 * Agency admins manage vendor accounts (e-commerce sellers who submit deliveries via mobile app)
 */

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { hashPassword } = require('../../utils/password');
const { authenticateToken, requireAgencyAdmin } = require('../middleware/auth');
const {
  createAgency,
  getAgencyById,
  getVendorsByAgency,
  updateAgency,
  adapter,
} = require('../../db');

// All vendor routes require authentication and agency-admin or super-admin role
router.use(authenticateToken);
router.use(requireAgencyAdmin);

const createVendorSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(72),
  group_id: z.coerce.number().int().positive(),
  is_active: z.boolean().optional().default(true),
});

const updateVendorSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  email: z.string().trim().toLowerCase().email().optional(),
  password: z.string().min(6).max(72).optional(),
  group_id: z.coerce.number().int().positive().optional().nullable(),
  is_active: z.boolean().optional(),
});

// Helper: resolve the caller's agency id (super admin may pass ?agency_id=)
function resolveCallerAgencyId(req) {
  if (req.user.role === 'super_admin') {
    const q = parseInt(req.query.agency_id);
    return isNaN(q) ? null : q;
  }
  return req.user.agencyId;
}

// GET /api/v1/vendors — list vendors for caller's agency
router.get('/', async (req, res, next) => {
  try {
    const agencyId = resolveCallerAgencyId(req);
    if (!agencyId) {
      return res.status(400).json({
        success: false,
        error: 'agency_id is required for super admin',
      });
    }

    const vendors = await getVendorsByAgency(agencyId);
    res.json({ success: true, data: vendors });
  } catch (error) {
    next(error);
  }
});

// POST /api/v1/vendors — create a vendor account
router.post('/', async (req, res, next) => {
  try {
    const callerAgencyId = resolveCallerAgencyId(req);
    if (!callerAgencyId) {
      return res.status(400).json({
        success: false,
        error: 'agency_id is required for super admin',
      });
    }

    const parsed = createVendorSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: firstIssue?.message || 'Invalid vendor data',
      });
    }

    const { name, email, password, group_id, is_active } = parsed.data;

    // Verify the group belongs to the caller's agency (prevent cross-agency injection)
    const group = await adapter.query(
      `SELECT id, agency_id FROM groups WHERE id = $1 AND is_active = true LIMIT 1`,
      [group_id]
    );
    if (!group) {
      return res.status(404).json({
        success: false,
        error: 'Group not found',
      });
    }
    if (group.agency_id !== callerAgencyId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Group does not belong to your agency',
      });
    }

    // Check for email conflict
    const existing = await adapter.query(
      `SELECT id FROM agencies WHERE email = $1 LIMIT 1`,
      [email]
    );
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Conflict',
        message: 'An account with this email already exists',
      });
    }

    const password_hash = await hashPassword(password);

    const vendorId = await createAgency({
      name,
      email,
      password_hash,
      role: 'vendor',
      is_active,
      group_id,
      parent_agency_id: callerAgencyId,
    });

    const vendor = await getAgencyById(vendorId);
    res.status(201).json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/vendors/:id — get one vendor
router.get('/:id', async (req, res, next) => {
  try {
    const callerAgencyId = resolveCallerAgencyId(req);
    const vendor = await getAgencyById(parseInt(req.params.id));

    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    if (callerAgencyId && vendor.parent_agency_id !== callerAgencyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    res.json({ success: true, data: vendor });
  } catch (error) {
    next(error);
  }
});

// PUT /api/v1/vendors/:id — update vendor
router.put('/:id', async (req, res, next) => {
  try {
    const callerAgencyId = resolveCallerAgencyId(req);
    const vendor = await getAgencyById(parseInt(req.params.id));

    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    if (callerAgencyId && vendor.parent_agency_id !== callerAgencyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const parsed = updateVendorSchema.safeParse(req.body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: firstIssue?.message || 'Invalid update data',
      });
    }

    const { name, email, password, group_id, is_active } = parsed.data;

    // If group_id is being changed, verify it belongs to caller's agency
    if (group_id !== undefined && group_id !== null) {
      const group = await adapter.query(
        `SELECT id, agency_id FROM groups WHERE id = $1 AND is_active = true LIMIT 1`,
        [group_id]
      );
      if (!group) {
        return res.status(404).json({ success: false, error: 'Group not found' });
      }
      if (callerAgencyId && group.agency_id !== callerAgencyId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden',
          message: 'Group does not belong to your agency',
        });
      }
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (password !== undefined) updates.password_hash = await hashPassword(password);
    if (group_id !== undefined) updates.group_id = group_id;
    if (is_active !== undefined) updates.is_active = is_active;

    await updateAgency(parseInt(req.params.id), updates);
    const updated = await getAgencyById(parseInt(req.params.id));
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/v1/vendors/:id — soft-delete (deactivate) vendor
router.delete('/:id', async (req, res, next) => {
  try {
    const callerAgencyId = resolveCallerAgencyId(req);
    const vendor = await getAgencyById(parseInt(req.params.id));

    if (!vendor || vendor.role !== 'vendor') {
      return res.status(404).json({ success: false, error: 'Vendor not found' });
    }

    if (callerAgencyId && vendor.parent_agency_id !== callerAgencyId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    await updateAgency(parseInt(req.params.id), { is_active: false });
    res.json({ success: true, message: 'Vendor deactivated' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
