# 🚀 REST API Setup Guide

Step-by-step guide to create REST API for the delivery bot.

---

## Step 1: Install Dependencies

```bash
npm install express cors
```

**What these do:**
- `express` - Web framework for Node.js
- `cors` - Enable cross-origin requests (needed for frontend)

---

## Step 2: Create API Server Structure

Create these files:

```
wwebjs-bot/
  └── src/
      └── api/
          ├── server.js          # Main Express server
          ├── routes/
          │   ├── deliveries.js  # Delivery endpoints
          │   ├── stats.js       # Statistics endpoints
          │   └── search.js      # Search endpoints
          └── middleware/
              ├── errorHandler.js # Error handling
              └── validation.js   # Request validation
```

---

## Step 3: Create Main Server File

**File: `src/api/server.js`**

```javascript
const express = require('express');
const cors = require('cors');
const deliveriesRouter = require('./routes/deliveries');
const statsRouter = require('./routes/stats');
const searchRouter = require('./routes/search');
const errorHandler = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/v1/deliveries', deliveriesRouter);
app.use('/api/v1/stats', statsRouter);
app.use('/api/v1/search', searchRouter);

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'delivery-bot-api',
    version: '1.0.0'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Delivery Bot API',
    version: '1.0.0',
    endpoints: {
      deliveries: '/api/v1/deliveries',
      stats: '/api/v1/stats',
      search: '/api/v1/search',
      health: '/api/v1/health'
    }
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n🚀 API Server running on http://localhost:${PORT}`);
    console.log(`📋 Available endpoints:`);
    console.log(`   GET    /api/v1/deliveries`);
    console.log(`   GET    /api/v1/deliveries/:id`);
    console.log(`   POST   /api/v1/deliveries`);
    console.log(`   PUT    /api/v1/deliveries/:id`);
    console.log(`   GET    /api/v1/deliveries/:id/history`);
    console.log(`   GET    /api/v1/stats/daily`);
    console.log(`   GET    /api/v1/search?q=...`);
    console.log(`   GET    /api/v1/health\n`);
  });
}

module.exports = app;
```

---

## Step 4: Create Delivery Routes

**File: `src/api/routes/deliveries.js`**

```javascript
const express = require('express');
const router = express.Router();
const {
  getAllDeliveries,
  getDeliveryById,
  createDelivery,
  updateDelivery,
  getDeliveryHistory,
} = require('../../db');

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
    } = req.query;

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
```

---

## Step 5: Create Stats Routes

**File: `src/api/routes/stats.js`**

```javascript
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
```

---

## Step 6: Create Search Routes

**File: `src/api/routes/search.js`**

```javascript
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
```

---

## Step 7: Create Error Handler Middleware

**File: `src/api/middleware/errorHandler.js`**

```javascript
function errorHandler(err, req, res, next) {
  console.error('API Error:', err);

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Database constraint violation',
      message: err.message,
    });
  }

  // Validation errors
  if (err.message.includes('Invalid field name')) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message,
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

module.exports = errorHandler;
```

---

## Step 8: Update package.json

Add API scripts:

```json
{
  "scripts": {
    "api": "node src/api/server.js",
    "api:dev": "nodemon src/api/server.js",
    // ... existing scripts
  }
}
```

---

## Step 9: Test the API

### Start the API server:
```bash
npm run api
```

### Test endpoints:

```bash
# Health check
curl http://localhost:3000/api/v1/health

# Get all deliveries
curl http://localhost:3000/api/v1/deliveries

# Get deliveries with pagination
curl http://localhost:3000/api/v1/deliveries?page=1&limit=10

# Get deliveries by status
curl http://localhost:3000/api/v1/deliveries?status=pending

# Get single delivery
curl http://localhost:3000/api/v1/deliveries/1

# Search deliveries
curl "http://localhost:3000/api/v1/search?q=612345678"

# Get daily stats
curl http://localhost:3000/api/v1/stats/daily

# Create delivery
curl -X POST http://localhost:3000/api/v1/deliveries \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "612345678",
    "items": "2 robes",
    "amount_due": 15000,
    "quartier": "Bonapriso"
  }'

# Update delivery
curl -X PUT http://localhost:3000/api/v1/deliveries/1 \
  -H "Content-Type: application/json" \
  -d '{
    "status": "delivered"
  }'
```

---

## Step 10: Optional - Add Authentication

For production, add authentication:

```javascript
// middleware/auth.js
function authenticate(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized - Invalid API key',
    });
  }
  
  next();
}

// Use in routes:
router.use(authenticate);
```

---

## 📋 Quick Start Commands

```bash
# 1. Install dependencies
npm install express cors

# 2. Create API files (copy code above)
# 3. Start API server
npm run api

# 4. Test in browser or Postman
# http://localhost:3000/api/v1/health
```

---

## 🎯 Summary

After following these steps, you'll have:

✅ REST API server on port 3000  
✅ Full CRUD operations for deliveries  
✅ Pagination and filtering  
✅ Search functionality  
✅ Statistics endpoints  
✅ Error handling  
✅ CORS enabled  

**Next:** Connect your frontend to `http://localhost:3000/api/v1/`

