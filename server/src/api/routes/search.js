const express = require('express');
const router = express.Router();
const { searchDeliveries } = require('../../db');
const { authenticateToken } = require('../middleware/auth');

// All search routes require authentication
router.use(authenticateToken);

// GET /api/v1/search?q=... - Search deliveries (scoped to caller's agency)
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    // Resolve the agency to scope results — super_admins see all agencies
    const agencyId = req.user.role === 'super_admin' ? null : (req.user.agencyId ?? req.user.userId);

    const results = await searchDeliveries(q, agencyId);

    res.json({
      success: true,
      data: results,
      count: results.length,
      query: q,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

