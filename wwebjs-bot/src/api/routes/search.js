const express = require('express');
const router = express.Router();
const { searchDeliveries } = require('../../db');

// GET /api/v1/search?q=... - Search deliveries
router.get('/', async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required',
      });
    }

    const results = await searchDeliveries(q);

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

