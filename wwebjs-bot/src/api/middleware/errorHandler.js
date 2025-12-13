function errorHandler(err, req, res, next) {
  // Log error with context
  console.error('API Error:', {
    method: req.method,
    path: req.path,
    error: err.message,
    status: err.status || 500,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  // Prevent "Cannot set headers after they are sent" error
  // If headers were already sent (e.g., by JSON parser), don't try to send another response
  if (res.headersSent) {
    return next(err); // Let Express handle it or ignore
  }

  // CORS errors
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({
      success: false,
      error: 'CORS error',
      message: 'Origin not allowed by CORS policy',
    });
  }

  // Authentication errors (401 Unauthorized)
  if (err.status === 401 || err.message.includes('Authentication') || err.message.includes('token')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
      message: err.message || 'Please login to access this resource',
    });
  }

  // Authorization errors (403 Forbidden)
  if (err.status === 403 || err.message.includes('Forbidden') || err.message.includes('Access denied')) {
    return res.status(403).json({
      success: false,
      error: 'Access denied',
      message: err.message || 'You do not have permission to access this resource',
    });
  }

  // Database errors
  if (err.code === 'SQLITE_CONSTRAINT' || err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Database constraint violation',
      message: err.message || 'A record with this information already exists',
    });
  }

  // Validation errors
  if (err.message.includes('Invalid field name') || err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message,
    });
  }

  // Missing required fields error
  if (err.message.includes('Missing required fields')) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'Invalid token',
      message: err.name === 'TokenExpiredError' 
        ? 'Your session has expired. Please login again.'
        : 'Invalid authentication token. Please login again.',
    });
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
    return res.status(503).json({
      success: false,
      error: 'Database connection failed',
      message: 'Unable to connect to database. Please try again later.',
    });
  }

  // Rate limiting errors (if you add rate limiting later)
  if (err.status === 429) {
    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
    });
  }

  // Default error
  // Double-check headers weren't sent (defensive programming)
  if (res.headersSent) {
    return next(err);
  }
  
  const statusCode = err.status || err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      stack: err.stack,
      details: err 
    }),
  });
}

module.exports = errorHandler;

