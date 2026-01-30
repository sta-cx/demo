/**
 * Structured Error Handling Framework
 *
 * Provides custom error classes and middleware for consistent error handling
 * across the application.
 */

const logger = require('./logger');

/**
 * Base AppError class
 */
class AppError extends Error {
  constructor(message, statusCode, code, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      statusCode: this.statusCode,
      timestamp: this.timestamp
    };
  }
}

/**
 * 400 Bad Request Error
 */
class BadRequestError extends AppError {
  constructor(message = 'Bad Request', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

/**
 * 401 Unauthorized Error
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

/**
 * 403 Forbidden Error
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

/**
 * 404 Not Found Error
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

/**
 * 409 Conflict Error
 */
class ConflictError extends AppError {
  constructor(message = 'Conflict', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

/**
 * 422 Unprocessable Entity Error
 */
class ValidationError extends AppError {
  constructor(message = 'Validation failed', details = null, code = 'VALIDATION_ERROR') {
    super(message, 422, code);
    this.details = details;
  }

  toJSON() {
    const json = super.toJSON();
    if (this.details) {
      json.details = this.details;
    }
    return json;
  }
}

/**
 * 429 Too Many Requests Error
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests', code = 'RATE_LIMIT_EXCEEDED') {
    super(message, 429, code);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error', code = 'INTERNAL_ERROR') {
    super(message, 500, code, false);
  }
}

/**
 * 502 Bad Gateway Error
 */
class BadGatewayError extends AppError {
  constructor(message = 'Bad gateway', code = 'BAD_GATEWAY') {
    super(message, 502, code);
  }
}

/**
 * 503 Service Unavailable Error
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service unavailable', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}

/**
 * Custom validation error for input fields
 */
class FieldValidationError extends ValidationError {
  constructor(field, message) {
    super(`Validation failed for field: ${field}`, { field, message }, 'FIELD_VALIDATION_ERROR');
    this.field = field;
    this.fieldMessage = message;
  }
}

/**
 * Database error wrapper
 */
class DatabaseError extends AppError {
  constructor(message, originalError, code = 'DATABASE_ERROR') {
    super(message, 500, code, false);
    this.originalError = originalError;
    this.query = originalError?.query;
    this.parameters = originalError?.parameters;
  }

  toJSON() {
    const json = super.toJSON();
    if (process.env.NODE_ENV === 'development' && this.originalError) {
      json.originalError = {
        message: this.originalError.message,
        code: this.originalError.code,
        detail: this.originalError.detail
      };
    }
    return json;
  }
}

/**
 * Authentication error
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed', code = 'AUTHENTICATION_ERROR') {
    super(message, 401, code);
  }
}

/**
 * JWT error
 */
class JWTError extends AppError {
  constructor(message = 'Invalid token', code = 'INVALID_TOKEN') {
    super(message, 401, code);
  }
}

/**
 * AI Service error
 */
class AIServiceError extends AppError {
  constructor(message = 'AI service error', service = 'unknown', code = 'AI_SERVICE_ERROR') {
    super(message, 502, code);
    this.service = service;
  }
}

/**
 * Rate limit exceeded error with retry info
 */
class RateLimitExceededError extends RateLimitError {
  constructor(retryAfter, limit) {
    super(`Rate limit exceeded. Try again in ${retryAfter} seconds.`, 'RATE_LIMIT_EXCEEDED');
    this.retryAfter = retryAfter;
    this.limit = limit;
  }

  toJSON() {
    const json = super.toJSON();
    json.retryAfter = this.retryAfter;
    json.limit = this.limit;
    return json;
  }
}

/**
 * Async handler wrapper to catch errors in async route handlers
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handling middleware
 */
const handleError = (err, req, res, next) => {
  // Log the error
  const logData = {
    error: err.message,
    code: err.code || 'UNKNOWN_ERROR',
    statusCode: err.statusCode || 500,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    isOperational: err.isOperational || false
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    logData.stack = err.stack;
  }

  // Log at appropriate level
  if (err.statusCode >= 500) {
    logger.error('Request error', logData);
  } else if (err.statusCode >= 400) {
    logger.warn('Client error', logData);
  } else {
    logger.info('Request error', logData);
  }

  // Prepare error response
  let errorResponse = {
    error: err.message || 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    statusCode: err.statusCode || 500
  };

  // Include additional details based on error type
  if (err instanceof ValidationError && err.details) {
    errorResponse.details = err.details;
  }

  if (err instanceof DatabaseError && process.env.NODE_ENV === 'development') {
    errorResponse = { ...errorResponse, ...err.toJSON() };
  }

  if (err instanceof RateLimitExceededError) {
    errorResponse.retryAfter = err.retryAfter;
    errorResponse.limit = err.limit;
  }

  // Add timestamp in non-production (test environment)
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    errorResponse.timestamp = err.timestamp || new Date().toISOString();
  }

  // Add path only in development (not in test)
  if (process.env.NODE_ENV === 'development') {
    errorResponse.path = req.url;
  }

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development' && err.stack) {
    errorResponse.stack = err.stack;
  }

  // Send error response
  res.status(err.statusCode || 500).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
const handleNotFound = (req, res, next) => {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.url}`, 'ROUTE_NOT_FOUND');
  next(error);
};

/**
 * Convert various error types to AppError
 */
const convertToAppError = (error) => {
  // Already an AppError
  if (error instanceof AppError) {
    return error;
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return new JWTError('Invalid token');
  }
  if (error.name === 'TokenExpiredError') {
    return new JWTError('Token expired');
  }
  if (error.name === 'NotBeforeError') {
    return new JWTError('Token not yet valid');
  }

  // Validation errors
  if (error.name === 'ValidationError') {
    return new ValidationError(error.message, error.details);
  }

  // Network errors - check before database errors
  if (error.code === 'ECONNREFUSED') {
    return new BadGatewayError('Service unavailable');
  }
  if (error.code === 'ETIMEDOUT') {
    return new ServiceUnavailableError('Service timeout');
  }

  // PostgreSQL errors
  if (error.code) {
    // Unique violation
    if (error.code === '23505') {
      return new ConflictError('Resource already exists', 'DUPLICATE_RESOURCE');
    }
    // Foreign key violation
    if (error.code === '23503') {
      return new ValidationError('Invalid reference to related resource', null, 'INVALID_REFERENCE');
    }
    // Not null violation
    if (error.code === '23502') {
      return new ValidationError('Required field is missing', null, 'MISSING_REQUIRED_FIELD');
    }
    // Check violation
    if (error.code === '23514') {
      return new ValidationError('Data violates constraint', null, 'CONSTRAINT_VIOLATION');
    }
  }

  // Axios/HTTP errors
  if (error.response) {
    const status = error.response.status;
    if (status === 401) return new UnauthorizedError();
    if (status === 403) return new ForbiddenError();
    if (status === 404) return new NotFoundError();
    if (status === 429) return new RateLimitError();
    if (status >= 500) return new BadGatewayError();
    return new AppError(error.response.data?.message || error.message, status, 'HTTP_ERROR');
  }

  // Default to internal server error
  return new InternalServerError(
    process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
  );
};

/**
 * Wrapper for async route handlers with automatic error conversion
 */
const wrapAsync = (fn) => async (req, res, next) => {
  try {
    await fn(req, res, next);
  } catch (error) {
    const appError = convertToAppError(error);
    next(appError);
  }
};

/**
 * Validate required fields in request body
 */
const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = [];
    const empty = [];

    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null) {
        missing.push(field);
      } else if (typeof value === 'string' && value.trim() === '') {
        empty.push(field);
      }
    }

    if (missing.length > 0 || empty.length > 0) {
      const messages = [];
      if (missing.length > 0) messages.push(`Missing required fields: ${missing.join(', ')}`);
      if (empty.length > 0) messages.push(`Empty fields: ${empty.join(', ')}`);

      throw new ValidationError(messages.join('. '), {
        missing,
        empty
      });
    }

    next();
  };
};

/**
 * Validate request body against a schema
 */
const validateSchema = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      throw new ValidationError('Validation failed', details);
    }

    req.body = value;
    next();
  };
};

module.exports = {
  // Base error class
  AppError,

  // Specific error classes
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  FieldValidationError,
  RateLimitError,
  RateLimitExceededError,
  InternalServerError,
  BadGatewayError,
  ServiceUnavailableError,
  DatabaseError,
  AuthenticationError,
  JWTError,
  AIServiceError,

  // Middleware
  handleError,
  handleNotFound,
  asyncHandler,
  wrapAsync,

  // Validators
  validateRequired,
  validateSchema,

  // Error converter
  convertToAppError
};
