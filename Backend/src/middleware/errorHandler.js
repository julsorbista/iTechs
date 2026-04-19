const { Prisma } = require('@prisma/client');

const errorHandler = (error, req, res, next) => {
  console.error('🔴 Error:', error);

  // Default error response
  let status = 500;
  let message = 'Internal server error';
  let details = null;

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        status = 400;
        message = 'A record with this information already exists';
        details = `Duplicate field: ${error.meta?.target?.join(', ')}`;
        break;
      case 'P2014':
        status = 400;
        message = 'Invalid data provided';
        details = error.meta?.target;
        break;
      case 'P2003':
        status = 400;
        message = 'Invalid reference to related record';
        break;
      case 'P2025':
        status = 404;
        message = 'Record not found';
        break;
      case 'P2021':
        status = 500;
        message = 'Database schema is missing required table(s)';
        details = error.meta?.table || error.code;
        break;
      default:
        status = 400;
        message = 'Database operation failed';
        details = error.code;
    }
  } else if (error instanceof Prisma.PrismaClientValidationError) {
    status = 400;
    message = 'Invalid data format';
    details = 'Please check your request data';
  } else if (error.name === 'ValidationError') {
    // Express-validator errors
    status = 400;
    message = 'Validation failed';
    details = error.errors || error.message;
  } else if (error.name === 'CastError') {
    status = 400;
    message = 'Invalid ID format';
  } else if (error.name === 'JsonWebTokenError') {
    status = 401;
    message = 'Invalid token';
  } else if (error.name === 'TokenExpiredError') {
    status = 401;
    message = 'Token expired';
  } else if (error.status || error.statusCode) {
    status = error.status || error.statusCode;
    message = error.message;
  } else if (error.message) {
    message = error.message;
  }

  // Don't expose sensitive error details in production
  if (process.env.NODE_ENV === 'production') {
    if (status === 500) {
      message = 'Something went wrong';
      details = null;
    }
  }

  res.status(status).json({
    status: 'error',
    message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === 'development' && { 
      stack: error.stack,
      originalError: error.message 
    })
  });
};

module.exports = errorHandler;