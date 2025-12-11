const express = require('express');
const cors = require('cors');
const deliveriesRouter = require('./routes/deliveries');
const statsRouter = require('./routes/stats');
const searchRouter = require('./routes/search');
const authRouter = require('./routes/auth');
const agenciesRouter = require('./routes/agencies');
const groupsRouter = require('./routes/groups');
const errorHandler = require('./middleware/errorHandler');

const app = express();
// Use Render's PORT env var (standard), fallback to API_PORT for local dev
const PORT = process.env.PORT || process.env.API_PORT || 3000;

// Middleware
// CORS configuration - allow requests from frontend with authentication support
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    // In development, allow localhost origins
    // In production, you should specify allowed origins
    if (!origin || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.includes('0.0.0.0') ||
        process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      // In production, check against allowed origins from environment variable
      const allowedOrigins = process.env.ALLOWED_ORIGINS 
        ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`⚠️  CORS blocked request from origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true, // Allow cookies/credentials (required for authentication)
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'X-Requested-With',
    'Accept',
    'Origin'
  ],
  exposedHeaders: ['Authorization'], // Expose Authorization header to frontend
  maxAge: 86400, // Cache preflight requests for 24 hours
  optionsSuccessStatus: 200, // Some legacy browsers (IE11) choke on 204
};

app.use(cors(corsOptions)); // Enable CORS with configuration

// Security headers middleware
app.use((req, res, next) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Content Security Policy (adjust as needed for your frontend)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    );
  }
  next();
});

// Enhanced JSON parser with better error handling
app.use(express.json({
  limit: '10mb',
  strict: true,
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf.toString());
    } catch (e) {
      res.status(400).json({
        success: false,
        error: 'Invalid JSON format',
        message: e.message,
        hint: 'Make sure you only paste the JSON object, no extra text before or after'
      });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/agencies', agenciesRouter);
app.use('/api/v1/groups', groupsRouter);
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
    console.log(`   POST   /api/v1/auth/login`);
    console.log(`   POST   /api/v1/auth/logout`);
    console.log(`   GET    /api/v1/auth/me`);
    console.log(`   GET    /api/v1/agencies (super admin)`);
    console.log(`   POST   /api/v1/agencies (super admin)`);
    console.log(`   GET    /api/v1/groups`);
    console.log(`   GET    /api/v1/deliveries`);
    console.log(`   GET    /api/v1/deliveries/:id`);
    console.log(`   POST   /api/v1/deliveries`);
    console.log(`   POST   /api/v1/deliveries/bulk`);
    console.log(`   PUT    /api/v1/deliveries/:id`);
    console.log(`   GET    /api/v1/deliveries/:id/history`);
    console.log(`   GET    /api/v1/stats/daily`);
    console.log(`   GET    /api/v1/search?q=...`);
    console.log(`   GET    /api/v1/health\n`);
  });
}

module.exports = app;

