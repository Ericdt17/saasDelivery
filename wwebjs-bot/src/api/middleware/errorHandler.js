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

  // Missing required fields error
  if (err.message.includes('Missing required fields')) {
    return res.status(400).json({
      success: false,
      error: 'Validation error',
      message: err.message,
    });
  }

  // Database connection errors
  if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
    return res.status(503).json({
      success: false,
      error: 'Database connection failed',
      message: 'Unable to connect to database. Please try again later.',
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

