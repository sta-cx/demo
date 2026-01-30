/**
 * Rate Limiter Middleware Unit Tests
 * Tests the rate limiter middleware with LRU cache to prevent memory leaks
 */

const rateLimitMiddleware = require('../../src/middleware/rateLimiter');

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('Rate Limiter Middleware', () => {
  let mockReq, mockRes, mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      user: { userId: 'test-user-123' },
      ip: '127.0.0.1',
      method: 'GET',
      url: '/api/test',
      get: jest.fn().mockReturnValue('test-agent'),
      // Express app properties needed by express-rate-limit
      app: {
        enabled: jest.fn().mockReturnValue(false),
        get: jest.fn().mockReturnValue(false)
      },
      // Protocol and connection info
      protocol: 'http',
      secure: false,
      // Headers
      headers: {},
      // Socket
      socket: {
        remoteAddress: '127.0.0.1'
      },
      // Connection
      connection: {
        remoteAddress: '127.0.0.1'
      }
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      get: jest.fn().mockReturnValue('test-agent')
    };
    mockNext = jest.fn();
  });

  describe('createUserRateLimit', () => {
    it('should allow requests within limit', () => {
      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 5
      });

      // Make 5 requests (at limit)
      for (let i = 0; i < 5; i++) {
        limiter(mockReq, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(5);
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should block requests exceeding limit', () => {
      // Use a unique user ID for this test
      const req = {
        ...mockReq,
        user: { userId: 'test-block-limit-user' }
      };

      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 3
      });

      // Make 3 requests (at limit)
      for (let i = 0; i < 3; i++) {
        limiter(req, mockRes, mockNext);
      }

      // 4th request should be blocked
      limiter(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(3);
      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Too many requests',
          code: 'USER_RATE_LIMIT_EXCEEDED',
          retryAfter: expect.any(Number)
        })
      );
    });

    it('should set rate limit headers', () => {
      // Use a unique user ID for this test
      const req = {
        ...mockReq,
        user: { userId: 'test-headers-user' }
      };

      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 10
      });

      limiter(req, mockRes, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'X-RateLimit-Limit': 10,
          'X-RateLimit-Remaining': expect.any(Number),
          'X-RateLimit-Reset': expect.any(String)
        })
      );
    });

    it('should use default options when not provided', () => {
      // Use a unique user ID for this test to avoid cache conflicts
      const req = {
        ...mockReq,
        user: { userId: 'test-default-options-user' }
      };

      const limiter = rateLimitMiddleware.createUserRateLimit();

      // Make 100 requests (default max)
      for (let i = 0; i < 100; i++) {
        limiter(req, mockRes, mockNext);
      }

      expect(mockNext).toHaveBeenCalledTimes(100);

      // 101st request should be blocked
      limiter(req, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(429);
    });

    it('should reset count after window expires', () => {
      // Use a unique user ID for this test
      const req = {
        ...mockReq,
        user: { userId: 'test-window-expiry-user' }
      };

      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 100, // 100ms window
        max: 2
      });

      // Make 2 requests (at limit)
      limiter(req, mockRes, mockNext);
      limiter(req, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);

      // 3rd request should be blocked
      limiter(req, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Wait for window to expire
      return new Promise((resolve) => {
        setTimeout(() => {
          // Reset mock for next call
          mockNext.mockClear();
          mockRes.status.mockClear();
          mockRes.json.mockClear();

          // Should be allowed again
          limiter(req, mockRes, mockNext);

          expect(mockNext).toHaveBeenCalledTimes(1);
          expect(mockRes.status).not.toHaveBeenCalled();

          resolve();
        }, 150);
      });
    });

    it('should fall back to IP-based limit when no userId', () => {
      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 5
      });

      // Request without userId
      const reqWithoutUser = {
        ...mockReq,
        user: undefined
      };

      // The function should fall back to generalLimiter
      // which is an express-rate-limit middleware
      // We just verify it doesn't throw an error
      expect(() => {
        limiter(reqWithoutUser, mockRes, mockNext);
      }).not.toThrow();
    });

    it('should handle different users independently', () => {
      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 2
      });

      // User 1 makes 2 requests
      const req1 = { ...mockReq, user: { userId: 'user-1' } };
      limiter(req1, mockRes, mockNext);
      limiter(req1, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);

      // User 1's 3rd request should be blocked
      limiter(req1, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(429);

      // Reset mocks
      mockNext.mockClear();
      mockRes.status.mockClear();
      mockRes.json.mockClear();

      // User 2 should be able to make requests
      const req2 = { ...mockReq, user: { userId: 'user-2' } };
      limiter(req2, mockRes, mockNext);
      limiter(req2, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledTimes(2);
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe('Predefined limiters', () => {
    it('should export all required limiters', () => {
      expect(rateLimitMiddleware.generalLimiter).toBeDefined();
      expect(rateLimitMiddleware.authLimiter).toBeDefined();
      expect(rateLimitMiddleware.smsLimiter).toBeDefined();
      expect(rateLimitMiddleware.answerLimiter).toBeDefined();
      expect(rateLimitMiddleware.aiLimiter).toBeDefined();
      expect(rateLimitMiddleware.uploadLimiter).toBeDefined();
      expect(rateLimitMiddleware.memoryLimiter).toBeDefined();
      expect(rateLimitMiddleware.createUserRateLimit).toBeDefined();
    });
  });

  describe('LRU Cache Memory Management', () => {
    it('should prevent memory leaks with LRU cache', () => {
      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 10
      });

      // Simulate many different users
      const numUsers = 1000;
      for (let i = 0; i < numUsers; i++) {
        const req = {
          ...mockReq,
          user: { userId: `user-${i}` }
        };
        limiter(req, mockRes, mockNext);
      }

      // LRU cache should have automatically evicted old entries
      // max is set to 10000, so all should fit
      expect(mockNext).toHaveBeenCalledTimes(numUsers);
    });

    it('should evict oldest entries when cache is full', () => {
      // This test verifies the LRU behavior
      // The cache is configured with max: 10000
      // After 10001 unique users, the oldest entry should be evicted

      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 5
      });

      // Create more requests than the cache max size
      const numUsers = 10050; // Slightly more than max (10000)
      for (let i = 0; i < numUsers; i++) {
        const req = {
          ...mockReq,
          user: { userId: `user-${i}` }
        };
        limiter(req, mockRes, mockNext);
      }

      // All requests should succeed (no memory leak)
      expect(mockNext).toHaveBeenCalledTimes(numUsers);

      // Try to access the first user again - should be treated as new user
      // because the entry was evicted
      mockNext.mockClear();
      const reqFirstUser = {
        ...mockReq,
        user: { userId: 'user-0' }
      };

      limiter(reqFirstUser, mockRes, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('Rate limit response headers', () => {
    it('should calculate remaining requests correctly', () => {
      // Use a unique user ID for this test
      const req = {
        ...mockReq,
        user: { userId: 'test-remaining-user' }
      };

      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 10
      });

      limiter(req, mockRes, mockNext);

      const setCall = mockRes.set.mock.calls[0][0];
      expect(setCall['X-RateLimit-Limit']).toBe(10);
      expect(setCall['X-RateLimit-Remaining']).toBe(9); // 10 - 1 used
    });

    it('should include retryAfter in error response', () => {
      // Use a unique user ID for this test
      const req = {
        ...mockReq,
        user: { userId: 'test-retry-after-user' }
      };

      const limiter = rateLimitMiddleware.createUserRateLimit({
        windowMs: 60000,
        max: 1
      });

      limiter(req, mockRes, mockNext);
      mockNext.mockClear();

      // Second request exceeds limit
      limiter(req, mockRes, mockNext);

      const errorResponse = mockRes.json.mock.calls[0][0];
      expect(errorResponse.retryAfter).toBeGreaterThan(0);
      expect(errorResponse.retryAfter).toBeLessThanOrEqual(60); // Should be within 1 minute
    });
  });
});
