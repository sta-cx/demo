/**
 * Tests for Error Handling Framework
 */

const {
  AppError,
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
  handleError,
  handleNotFound,
  asyncHandler,
  wrapAsync,
  convertToAppError,
  validateRequired
} = require('../../src/utils/errorHandler');

describe('Custom Error Classes', () => {
  describe('AppError', () => {
    it('should create base error with correct properties', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');

      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('TEST_ERROR');
      expect(error.isOperational).toBe(true);
      expect(error.status).toBe('fail');
      expect(error.timestamp).toBeDefined();
    });

    it('should serialize to JSON correctly', () => {
      const error = new AppError('Test error', 400, 'TEST_ERROR');
      const json = error.toJSON();

      expect(json).toEqual({
        error: 'Test error',
        code: 'TEST_ERROR',
        statusCode: 400,
        timestamp: error.timestamp
      });
    });

    it('should set status to error for 5xx codes', () => {
      const error = new AppError('Server error', 500, 'SERVER_ERROR');
      expect(error.status).toBe('error');
    });
  });

  describe('BadRequestError', () => {
    it('should create with status 400', () => {
      const error = new BadRequestError('Invalid input');
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('Invalid input');
    });
  });

  describe('UnauthorizedError', () => {
    it('should create with status 401', () => {
      const error = new UnauthorizedError('Not authenticated');
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ForbiddenError', () => {
    it('should create with status 403', () => {
      const error = new ForbiddenError('Access denied');
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });

  describe('NotFoundError', () => {
    it('should create with status 404', () => {
      const error = new NotFoundError('Resource not found');
      expect(error.statusCode).toBe(404);
      expect(error.code).toBe('NOT_FOUND');
    });
  });

  describe('ConflictError', () => {
    it('should create with status 409', () => {
      const error = new ConflictError('Resource already exists');
      expect(error.statusCode).toBe(409);
      expect(error.code).toBe('CONFLICT');
    });
  });

  describe('ValidationError', () => {
    it('should create with status 422', () => {
      const error = new ValidationError('Validation failed');
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('should include details in JSON', () => {
      const details = { field: 'email', message: 'Invalid format' };
      const error = new ValidationError('Validation failed', details);
      const json = error.toJSON();

      expect(json.details).toEqual(details);
    });
  });

  describe('FieldValidationError', () => {
    it('should create with field-specific message', () => {
      const error = new FieldValidationError('email', 'Invalid email format');

      expect(error.statusCode).toBe(422);
      expect(error.code).toBe('FIELD_VALIDATION_ERROR');
      expect(error.field).toBe('email');
      expect(error.fieldMessage).toBe('Invalid email format');
      expect(error.details).toEqual({ field: 'email', message: 'Invalid email format' });
    });
  });

  describe('RateLimitError', () => {
    it('should create with status 429', () => {
      const error = new RateLimitError();
      expect(error.statusCode).toBe(429);
      expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });

  describe('RateLimitExceededError', () => {
    it('should include retry information', () => {
      const error = new RateLimitExceededError(60, 100);
      const json = error.toJSON();

      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.limit).toBe(100);
      expect(json.retryAfter).toBe(60);
      expect(json.limit).toBe(100);
    });
  });

  describe('InternalServerError', () => {
    it('should create with status 500', () => {
      const error = new InternalServerError();
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });

  describe('BadGatewayError', () => {
    it('should create with status 502', () => {
      const error = new BadGatewayError();
      expect(error.statusCode).toBe(502);
      expect(error.code).toBe('BAD_GATEWAY');
    });
  });

  describe('ServiceUnavailableError', () => {
    it('should create with status 503', () => {
      const error = new ServiceUnavailableError();
      expect(error.statusCode).toBe(503);
      expect(error.code).toBe('SERVICE_UNAVAILABLE');
    });
  });

  describe('DatabaseError', () => {
    it('should create with original error', () => {
      const originalError = new Error('Connection failed');
      const error = new DatabaseError('Database error', originalError);

      expect(error.statusCode).toBe(500);
      expect(error.originalError).toBe(originalError);
    });

    it('should include original error in development mode', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const originalError = { message: 'Connection failed', code: 'ECONNREFUSED' };
      const error = new DatabaseError('Database error', originalError);
      const json = error.toJSON();

      expect(json.originalError).toBeDefined();
      expect(json.originalError.message).toBe('Connection failed');

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('AuthenticationError', () => {
    it('should create with status 401', () => {
      const error = new AuthenticationError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('JWTError', () => {
    it('should create with status 401', () => {
      const error = new JWTError();
      expect(error.statusCode).toBe(401);
      expect(error.code).toBe('INVALID_TOKEN');
    });
  });

  describe('AIServiceError', () => {
    it('should create with service name', () => {
      const error = new AIServiceError('AI failed', 'iflow');
      expect(error.statusCode).toBe(502);
      expect(error.service).toBe('iflow');
    });
  });
});

describe('Error Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      method: 'GET',
      url: '/test',
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-agent')
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  describe('handleError', () => {
    it('should handle AppError correctly', () => {
      const error = new BadRequestError('Invalid input');

      handleError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Invalid input',
        code: 'BAD_REQUEST',
        statusCode: 400,
        timestamp: expect.any(String)
      });
    });

    it('should include timestamp in non-production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new BadRequestError('Invalid input');

      handleError(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(String)
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should include stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const error = new Error('Test error');

      handleError(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String)
        })
      );

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle generic error', () => {
      const error = new Error('Generic error');

      handleError(error, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.any(String),
          code: 'INTERNAL_ERROR'
        })
      );
    });

    it('should include ValidationError details', () => {
      const details = { field: 'email' };
      const error = new ValidationError('Validation failed', details);

      handleError(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          details
        })
      );
    });

    it('should include RateLimitExceededError retry info', () => {
      const error = new RateLimitExceededError(60, 100);

      handleError(error, req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          retryAfter: 60,
          limit: 100
        })
      );
    });
  });

  describe('handleNotFound', () => {
    it('should create NotFoundError and pass to next', () => {
      handleNotFound(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 404,
          code: 'ROUTE_NOT_FOUND'
        })
      );
    });
  });
});

describe('Async Handlers', () => {
  let req, res, next;

  beforeEach(() => {
    req = { user: { userId: 1 } };
    res = { json: jest.fn() };
    next = jest.fn();
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const handler = asyncHandler(async (req, res, next) => {
        res.json({ success: true });
      });

      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
      expect(next).not.toHaveBeenCalled();
    });

    it('should catch and pass errors to next', async () => {
      const error = new BadRequestError('Invalid input');
      const handler = asyncHandler(async (req, res, next) => {
        throw error;
      });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('wrapAsync', () => {
    it('should handle successful operations', async () => {
      const handler = wrapAsync(async (req, res, next) => {
        res.json({ success: true });
      });

      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ success: true });
    });

    it('should convert errors to AppError', async () => {
      const handler = wrapAsync(async (req, res, next) => {
        throw new Error('Generic error');
      });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: expect.any(Number),
          code: expect.any(String)
        })
      );
    });

    it('should pass AppError through unchanged', async () => {
      const originalError = new BadRequestError('Invalid input');
      const handler = wrapAsync(async (req, res, next) => {
        throw originalError;
      });

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(originalError);
    });
  });
});

describe('convertToAppError', () => {
  it('should return AppError unchanged', () => {
    const error = new BadRequestError('Invalid');
    const converted = convertToAppError(error);

    expect(converted).toBe(error);
  });

  it('should convert JWT errors', () => {
    const error = new Error('JsonWebTokenError');
    error.name = 'JsonWebTokenError';

    const converted = convertToAppError(error);

    expect(converted).toBeInstanceOf(JWTError);
  });

  it('should convert PostgreSQL unique violation', () => {
    const error = new Error('Unique violation');
    error.code = '23505';

    const converted = convertToAppError(error);

    expect(converted).toBeInstanceOf(ConflictError);
    expect(converted.code).toBe('DUPLICATE_RESOURCE');
  });

  it('should convert PostgreSQL foreign key violation', () => {
    const error = new Error('Foreign key violation');
    error.code = '23503';

    const converted = convertToAppError(error);

    expect(converted).toBeInstanceOf(ValidationError);
    expect(converted.code).toBe('INVALID_REFERENCE');
  });

  it('should convert network errors', () => {
    const error = new Error('Connection refused');
    error.code = 'ECONNREFUSED';

    const converted = convertToAppError(error);

    expect(converted).toBeInstanceOf(BadGatewayError);
  });

  it('should convert timeout errors', () => {
    const error = new Error('Timeout');
    error.code = 'ETIMEDOUT';

    const converted = convertToAppError(error);

    expect(converted).toBeInstanceOf(ServiceUnavailableError);
  });

  it('should convert axios errors', () => {
    const error = new Error('Not Found');
    error.response = { status: 404 };

    const converted = convertToAppError(error);

    expect(converted).toBeInstanceOf(NotFoundError);
  });

  it('should default to InternalServerError', () => {
    const error = new Error('Unknown error');
    const converted = convertToAppError(error);

    expect(converted).toBeInstanceOf(InternalServerError);
  });
});

describe('validateRequired', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  it('should pass when all required fields are present', () => {
    req.body = { name: 'Test', email: 'test@example.com' };
    const validator = validateRequired(['name', 'email']);

    validator(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should throw ValidationError for missing fields', () => {
    req.body = { name: 'Test' };
    const validator = validateRequired(['name', 'email']);

    expect(() => validator(req, res, next)).toThrow(ValidationError);
  });

  it('should throw ValidationError for empty string fields', () => {
    req.body = { name: 'Test', email: '   ' };
    const validator = validateRequired(['name', 'email']);

    expect(() => validator(req, res, next)).toThrow(ValidationError);
  });

  it('should handle null and undefined', () => {
    req.body = { name: null, email: undefined };
    const validator = validateRequired(['name', 'email']);

    expect(() => validator(req, res, next)).toThrow(ValidationError);
  });
});
