const express = require('express');
const router = express.Router();
const { getDeliveryStats } = require('../../db');

// GET /api/v1/stats/daily - Get daily statistics
router.get('/daily', async (req, res, next) => {
  try {
    const { date } = req.query;
    const stats = await getDeliveryStats(date || null);

    res.json({
      success: true,
      data: stats,
      date: date || new Date().toISOString().split('T')[0],
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

