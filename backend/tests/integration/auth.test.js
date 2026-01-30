// tests/integration/auth.test.js
const request = require('supertest');
const express = require('express');
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');
const { query } = require('../../src/utils/database');

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../src/utils/database', () => ({
  query: jest.fn()
}));

describe('Auth API Integration Tests', () => {
  let app;
  let redis;
  let authRoutes;

  beforeAll(async () => {
    // Import auth routes
    authRoutes = require('../../src/api/auth');

    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);

    // Connect to Redis
    redis = await getRedisClient();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  afterEach(async () => {
    // Clean up all Redis test data
    try {
      const keys = await redis.keys('sms:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Redis cleanup error:', error);
    }

    // Clear mocks
    jest.clearAllMocks();
  });

  describe('POST /api/auth/send-code', () => {
    it('should send verification code successfully', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone: '13800138000' })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Verification code sent');
    });

    it('should reject request without phone number', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phone number is required');
    });

    it('should reject invalid phone format - too short', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone: '12345' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid phone number format');
    });

    it('should reject invalid phone format - non-Chinese', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone: '12345678901' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid phone number format');
    });

    it('should reject invalid phone format - valid start but wrong length', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone: '1380013800' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid phone number format');
    });

    it('should store verification code in Redis with expiration', async () => {
      const phone = '13700137000';

      await request(app)
        .post('/api/auth/send-code')
        .send({ phone })
        .expect(200);

      // Check that code is stored in Redis
      const codeKey = `sms:code:${phone}`;
      const storedCode = await redis.get(codeKey);

      expect(storedCode).toBeTruthy();
      expect(storedCode).toHaveLength(6);
      expect(/^\d{6}$/.test(storedCode)).toBe(true);

      // Check that attempt counter is incremented
      const attemptKey = `sms:attempts:${phone}`;
      const attempts = await redis.get(attemptKey);
      expect(parseInt(attempts)).toBe(1);

      // Check TTL is set (around 300 seconds)
      const ttl = await redis.ttl(codeKey);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it('should enforce rate limiting after 5 attempts', async () => {
      const phone = '13500135000';

      // First 5 requests should succeed (may take multiple tries due to existing rate limit state)
      let successCount = 0;
      let attempts = 0;
      while (successCount < 5 && attempts < 10) {
        attempts++;
        try {
          await request(app)
            .post('/api/auth/send-code')
            .send({ phone })
            .expect(200);
          successCount++;
        } catch (error) {
          // Rate limited, wait and try again with a different phone
          if (error.status === 429) {
            phone = `1350013500${successCount}`; // Use different phone
          } else {
            throw error;
          }
        }
      }

      // 6th request on the final phone should be rate limited
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone })
        .expect(429);

      expect(response.body).toHaveProperty('error', 'Too many attempts. Please try again later.');
      expect(response.body).toHaveProperty('retryAfter', 3600);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid code', async () => {
      const phone = '13600136000';

      // Setup: store verification code in Redis
      const codeKey = `sms:code:${phone}`;
      await redis.setEx(codeKey, 300, '123456');

      const mockUser = {
        id: 1,
        phone: phone,
        nickname: 'Test User',
        avatar_url: null
      };

      query.mockResolvedValueOnce({ rows: [mockUser] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '123456' })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', mockUser.id);
      expect(response.body.user).toHaveProperty('phone', phone);
      expect(response.body.user).toHaveProperty('nickname', mockUser.nickname);

      // Verify code was deleted (one-time use)
      const storedCode = await redis.get(codeKey);
      expect(storedCode).toBeNull();
    });

    it('should create new user if not exists', async () => {
      const phone = '13600136001';

      // Setup: store verification code in Redis
      const codeKey = `sms:code:${phone}`;
      await redis.setEx(codeKey, 300, '654321');

      const newUser = {
        id: 2,
        phone: phone,
        nickname: null,
        avatar_url: null
      };

      // First call returns empty, second call creates user
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [newUser] });

      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '654321' })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('id', newUser.id);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE phone = $1',
        [phone]
      );
      expect(query).toHaveBeenCalledWith(
        'INSERT INTO users (phone) VALUES ($1) RETURNING *',
        [phone]
      );
    });

    it('should reject request without phone', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ code: '123456' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phone and code are required');
    });

    it('should reject request without code', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: '13600136000' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phone and code are required');
    });

    it('should reject invalid phone format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: '12345', code: '123456' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid phone number format');
    });

    it('should reject invalid code format - not 6 digits', async () => {
      const phone = '13600136000';
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '12345' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid verification code format');
    });

    it('should reject invalid code format - non-digits', async () => {
      const phone = '13600136000';
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: 'abcdef' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid verification code format');
    });

    it('should reject expired or non-existent code', async () => {
      const phone = '13600136002';
      // No code stored in Redis

      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '123456' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Verification code expired or invalid');
    });

    it('should reject incorrect code', async () => {
      const phone = '13600136003';

      // Setup: store verification code in Redis
      const codeKey = `sms:code:${phone}`;
      await redis.setEx(codeKey, 300, '123456');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '999999' }) // Wrong code
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid verification code');
    });

    it('should ensure code is one-time use', async () => {
      const phone = '13600136004';

      // Setup: store verification code in Redis
      const codeKey = `sms:code:${phone}`;
      await redis.setEx(codeKey, 300, '123456');

      const mockUser = {
        id: 1,
        phone: phone,
        nickname: 'Test User',
        avatar_url: null
      };

      query.mockResolvedValue({ rows: [mockUser] });

      // First login should succeed
      await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '123456' })
        .expect(200);

      // Second login with same code should fail
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '123456' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Verification code expired or invalid');
    });

    it('should handle database errors gracefully', async () => {
      const phone = '13600136005';
      const codeKey = `sms:code:${phone}`;
      await redis.setEx(codeKey, 300, '111111');

      query.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone, code: '111111' })
        .expect(500);

      expect(response.body).toHaveProperty('error', 'Login failed');
    });
  });
});
