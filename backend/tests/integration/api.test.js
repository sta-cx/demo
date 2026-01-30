/**
 * API Integration Tests
 * Comprehensive tests for authentication, couple binding, and question flows
 */

const request = require('supertest');
const express = require('express');
const jwt = require('jsonwebtoken');

// Import setup utilities
const {
  setupTestDatabase,
  setupTestRedis,
  clearTestData,
  clearTestCache,
  teardownTest,
  createTestUser,
  createTestCouple,
  generateTestPhone,
  executeQuery
} = require('./setup');

// Import route handlers
const authRouter = require('../../src/api/auth');
const coupleRouter = require('../../src/api/couple');
const questionsRouter = require('../../src/api/questions');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../../src/utils/websocket', () => {
  return jest.fn().mockImplementation(() => ({
    notifyNewAnswer: jest.fn(),
    notifyQuestionCompleted: jest.fn()
  }));
});

// Test environment setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-jwt-integration-tests';

let app;
let dbPool;
let redisClient;

beforeAll(async () => {
  // Setup test database and Redis
  dbPool = await setupTestDatabase();
  redisClient = await setupTestRedis();

  // Create Express app
  app = express();
  app.use(express.json());

  // Mock auth middleware for protected routes
  app.use((req, res, next) => {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { userId: decoded.userId };
      } catch (error) {
        // Invalid token, continue without user
      }
    }
    next();
  });

  // Mount routes
  app.use('/api/auth', authRouter);
  app.use('/api/couple', coupleRouter);
  app.use('/api/questions', questionsRouter);
});

afterAll(async () => {
  await teardownTest();
});

beforeEach(async () => {
  // Clear test data before each test
  await clearTestData();
  await clearTestCache();
});

describe('Integration Tests: Auth Flow', () => {
  describe('POST /api/auth/send-code', () => {
    it('should send verification code successfully', async () => {
      const phone = generateTestPhone(1);

      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone })
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Verification code sent');

      // Verify code is stored in Redis
      const codeKey = `sms:code:${phone}`;
      const storedCode = await redisClient.get(codeKey);
      expect(storedCode).toBeTruthy();
      expect(storedCode).toHaveLength(6);
    });

    it('should reject request without phone number', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phone number is required');
    });

    it('should reject invalid phone format', async () => {
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone: '12345' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid phone number format');
    });

    it('should enforce rate limiting', async () => {
      const phone = generateTestPhone(2);

      // Make 5 successful requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/auth/send-code')
          .send({ phone })
          .expect(200);
      }

      // 6th request should be rate limited
      const response = await request(app)
        .post('/api/auth/send-code')
        .send({ phone })
        .expect(429);

      expect(response.body).toHaveProperty('error', 'Too many attempts. Please try again later.');
      expect(response.body).toHaveProperty('retryAfter', 3600);
    });
  });

  describe('POST /api/auth/login', () => {
    let testPhone;
    let verificationCode;

    beforeEach(async () => {
      testPhone = generateTestPhone(3);

      // Send verification code first
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: testPhone })
        .expect(200);

      // Get the code from Redis
      const codeKey = `sms:code:${testPhone}`;
      verificationCode = await redisClient.get(codeKey);
    });

    it('should login successfully and create new user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: testPhone, code: verificationCode })
        .expect(200);

      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('phone', testPhone);

      // Verify token is valid JWT
      const decoded = jwt.verify(response.body.token, process.env.JWT_SECRET);
      expect(decoded).toHaveProperty('userId');
    });

    it('should login existing user successfully', async () => {
      // Create user first
      const user = await createTestUser(testPhone, 'Test User');

      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: testPhone, code: verificationCode })
        .expect(200);

      expect(response.body.user).toHaveProperty('id', user.id);
      expect(response.body.user).toHaveProperty('nickname', 'Test User');
    });

    it('should reject request without phone', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ code: verificationCode })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phone and code are required');
    });

    it('should reject request without code', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: testPhone })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Phone and code are required');
    });

    it('should reject invalid phone format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: '12345', code: verificationCode })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid phone number format');
    });

    it('should reject invalid code format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: testPhone, code: '12345' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Invalid verification code format');
    });

    it('should reject incorrect code', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: testPhone, code: '999999' })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Invalid verification code');
    });

    it('should ensure code is one-time use', async () => {
      // First login should succeed
      await request(app)
        .post('/api/auth/login')
        .send({ phone: testPhone, code: verificationCode })
        .expect(200);

      // Second login with same code should fail
      const response = await request(app)
        .post('/api/auth/login')
        .send({ phone: testPhone, code: verificationCode })
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Verification code expired or invalid');
    });
  });
});

describe('Integration Tests: Couple Flow', () => {
  let user1Token;
  let user2Token;
  let user1Phone;
  let user2Phone;
  let user1Id;
  let user2Id;

  beforeEach(async () => {
    // Create and login two users
    user1Phone = generateTestPhone(10);
    user2Phone = generateTestPhone(11);

    // Send codes for both users
    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user1Phone });

    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user2Phone });

    // Get codes from Redis
    const code1 = await redisClient.get(`sms:code:${user1Phone}`);
    const code2 = await redisClient.get(`sms:code:${user2Phone}`);

    // Login both users
    const response1 = await request(app)
      .post('/api/auth/login')
      .send({ phone: user1Phone, code: code1 });

    const response2 = await request(app)
      .post('/api/auth/login')
      .send({ phone: user2Phone, code: code2 });

    user1Token = response1.body.token;
    user2Token = response2.body.token;
    user1Id = response1.body.user.id;
    user2Id = response2.body.user.id;
  });

  describe('POST /api/couple/bind', () => {
    let partnerCode;

    beforeEach(async () => {
      // Send verification code for partner
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: user2Phone });

      partnerCode = await redisClient.get(`sms:code:${user2Phone}`);
    });

    it('should bind partners successfully', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: user2Phone,
          partner_phone_code: partnerCode,
          couple_name: '测试情侣'
        })
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('couple');
      expect(response.body.couple).toHaveProperty('id');
      expect(response.body.couple).toHaveProperty('couple_name', '测试情侣');
    });

    it('should reject binding without partner phone', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone_code: partnerCode,
          couple_name: '测试情侣'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MISSING_PARTNER_INFO');
    });

    it('should reject binding without verification code', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: user2Phone,
          couple_name: '测试情侣'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MISSING_PARTNER_INFO');
    });

    it('should reject binding without couple name', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: user2Phone,
          partner_phone_code: partnerCode
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MISSING_COUPLE_NAME');
    });

    it('should reject invalid phone format', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: '12345',
          partner_phone_code: partnerCode,
          couple_name: '测试情侣'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('INVALID_PHONE');
    });

    it('should reject binding to self', async () => {
      // Send code for own phone
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: user1Phone });

      const ownCode = await redisClient.get(`sms:code:${user1Phone}`);

      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: user1Phone,
          partner_phone_code: ownCode,
          couple_name: '测试情侣'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('SELF_BIND');
    });

    it('should reject binding with non-existent partner', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: '19999999999',
          partner_phone_code: partnerCode,
          couple_name: '测试情侣'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('PARTNER_NOT_FOUND');
    });

    it('should reject binding when already bound', async () => {
      // First binding
      await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: user2Phone,
          partner_phone_code: partnerCode,
          couple_name: '测试情侣'
        })
        .expect(200);

      // Try to bind again with different user
      const user3Phone = generateTestPhone(12);
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: user3Phone });

      const code3 = await redisClient.get(`sms:code:${user3Phone}`);

      const response3 = await request(app)
        .post('/api/auth/login')
        .send({ phone: user3Phone, code: code3 });

      const user3Token = response3.body.token;

      // Send code for user2 again
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: user2Phone });

      const code2Again = await redisClient.get(`sms:code:${user2Phone}`);

      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user3Token}`)
        .send({
          partner_phone: user2Phone,
          partner_phone_code: code2Again,
          couple_name: '测试情侣2'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('ALREADY_BOUND');
    });
  });

  describe('GET /api/couple/info', () => {
    beforeEach(async () => {
      // Bind users as a couple
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: user2Phone });

      const partnerCode = await redisClient.get(`sms:code:${user2Phone}`);

      await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          partner_phone: user2Phone,
          partner_phone_code: partnerCode,
          couple_name: '测试情侣'
        });
    });

    it('should get couple info successfully', async () => {
      const response = await request(app)
        .get('/api/couple/info')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('couple');
      expect(response.body.couple).toHaveProperty('id');
      expect(response.body.couple).toHaveProperty('couple_name', '测试情侣');
      expect(response.body).toHaveProperty('partner');
      expect(response.body.partner).toHaveProperty('phone', user2Phone);
    });

    it('should return 404 for user without couple', async () => {
      // Create a new user without couple
      const newPhone = generateTestPhone(20);
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: newPhone });

      const code = await redisClient.get(`sms:code:${newPhone}`);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ phone: newPhone, code });

      const response = await request(app)
        .get('/api/couple/info')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Integration Tests: Question Flow', () => {
  let user1Token;
  let user2Token;
  let coupleId;
  let testQuestionId;

  beforeEach(async () => {
    // Create and bind two users
    const user1Phone = generateTestPhone(30);
    const user2Phone = generateTestPhone(31);

    // Setup user 1
    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user1Phone });

    const code1 = await redisClient.get(`sms:code:${user1Phone}`);

    const response1 = await request(app)
      .post('/api/auth/login')
      .send({ phone: user1Phone, code: code1 });

    user1Token = response1.body.token;

    // Setup user 2
    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user2Phone });

    const code2 = await redisClient.get(`sms:code:${user2Phone}`);

    await request(app)
      .post('/api/auth/login')
      .send({ phone: user2Phone, code: code2 });

    user2Token = response1.body.token;

    // Bind users
    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user2Phone });

    const partnerCode = await redisClient.get(`sms:code:${user2Phone}`);

    const bindResponse = await request(app)
      .post('/api/couple/bind')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        partner_phone: user2Phone,
        partner_phone_code: partnerCode,
        couple_name: '测试情侣'
      });

    coupleId = bindResponse.body.couple.id;

    // Create a test question
    const questionResult = await executeQuery(
      'INSERT INTO questions (question_text, category, answer_type) VALUES ($1, $2, $3) RETURNING id',
      ['What is your favorite memory?', 'emotion', 'text']
    );
    testQuestionId = questionResult.rows[0].id;

    // Create today's daily question
    await executeQuery(
      'INSERT INTO daily_questions (couple_id, question_id, date) VALUES ($1, $2, CURRENT_DATE)',
      [coupleId, testQuestionId]
    );
  });

  describe('GET /api/questions/today', () => {
    it('should get today\'s question successfully', async () => {
      const response = await request(app)
        .get('/api/questions/today')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('question');
      expect(response.body.question).toHaveProperty('id');
      expect(response.body.question).toHaveProperty('question_text');
      expect(response.body).toHaveProperty('user_answered', false);
      expect(response.body).toHaveProperty('partner_answered', false);
    });

    it('should return 404 for user without couple', async () => {
      // Create new user without couple
      const newPhone = generateTestPhone(40);
      await request(app)
        .post('/api/auth/send-code')
        .send({ phone: newPhone });

      const code = await redisClient.get(`sms:code:${newPhone}`);

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({ phone: newPhone, code });

      const response = await request(app)
        .get('/api/questions/today')
        .set('Authorization', `Bearer ${loginResponse.body.token}`)
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('COUPLE_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/questions/today')
        .expect(401);
    });
  });

  describe('POST /api/questions/answer', () => {
    it('should submit answer successfully', async () => {
      const response = await request(app)
        .post('/api/questions/answer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          question_id: testQuestionId,
          answer_text: 'Our first date at the park'
        })
        .expect(201);

      expect(response.body).toHaveProperty('message', 'Answer submitted successfully');
      expect(response.body).toHaveProperty('answer');
      expect(response.body.answer).toHaveProperty('id');
      expect(response.body.answer).toHaveProperty('answer_text', 'Our first date at the park');
    });

    it('should reject answer without question_id', async () => {
      const response = await request(app)
        .post('/api/questions/answer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          answer_text: 'Test answer'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MISSING_QUESTION_ID');
    });

    it('should reject answer without content', async () => {
      const response = await request(app)
        .post('/api/questions/answer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          question_id: testQuestionId
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('MISSING_ANSWER_CONTENT');
    });

    it('should reject answer for non-existent question', async () => {
      const response = await request(app)
        .post('/api/questions/answer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          question_id: 99999,
          answer_text: 'Test answer'
        })
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.code).toBe('QUESTION_NOT_FOUND');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/questions/answer')
        .send({
          question_id: testQuestionId,
          answer_text: 'Test answer'
        })
        .expect(401);
    });
  });

  describe('GET /api/questions/history', () => {
    beforeEach(async () => {
      // Submit some test answers
      await request(app)
        .post('/api/questions/answer')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          question_id: testQuestionId,
          answer_text: 'First answer'
        });
    });

    it('should get answer history successfully', async () => {
      const response = await request(app)
        .get('/api/questions/history')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('answers');
      expect(Array.isArray(response.body.answers)).toBe(true);
      expect(response.body).toHaveProperty('total');
      expect(response.body).toHaveProperty('limit', 30);
      expect(response.body).toHaveProperty('offset', 0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/questions/history?limit=10&offset=0')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('offset', 0);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/questions/history')
        .expect(401);
    });
  });
});

describe('Integration Tests: End-to-End User Journey', () => {
  it('should complete full user journey from signup to answering', async () => {
    // Step 1: User 1 signs up
    const user1Phone = generateTestPhone(50);
    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user1Phone });

    const code1 = await redisClient.get(`sms:code:${user1Phone}`);

    const login1Response = await request(app)
      .post('/api/auth/login')
      .send({ phone: user1Phone, code: code1 });

    expect(login1Response.body).toHaveProperty('token');
    const user1Token = login1Response.body.token;

    // Step 2: User 2 signs up
    const user2Phone = generateTestPhone(51);
    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user2Phone });

    const code2 = await redisClient.get(`sms:code:${user2Phone}`);

    await request(app)
      .post('/api/auth/login')
      .send({ phone: user2Phone, code: code2 });

    // Step 3: User 1 initiates couple binding
    await request(app)
      .post('/api/auth/send-code')
      .send({ phone: user2Phone });

    const partnerCode = await redisClient.get(`sms:code:${user2Phone}`);

    const bindResponse = await request(app)
      .post('/api/couple/bind')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        partner_phone: user2Phone,
        partner_phone_code: partnerCode,
        couple_name: '测试情侣'
      });

    expect(bindResponse.body).toHaveProperty('couple');
    const coupleId = bindResponse.body.couple.id;

    // Step 4: Create a daily question for the couple
    const questionResult = await executeQuery(
      'INSERT INTO questions (question_text, category, answer_type) VALUES ($1, $2, $3) RETURNING id',
      ['What made you smile today?', 'daily', 'text']
    );
    const questionId = questionResult.rows[0].id;

    await executeQuery(
      'INSERT INTO daily_questions (couple_id, question_id, date) VALUES ($1, $2, CURRENT_DATE)',
      [coupleId, questionId]
    );

    // Step 5: User 1 gets today's question
    const todayResponse = await request(app)
      .get('/api/questions/today')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(todayResponse.body).toHaveProperty('question');
    expect(todayResponse.body.question).toHaveProperty('question_text', 'What made you smile today?');
    expect(todayResponse.body).toHaveProperty('user_answered', false);

    // Step 6: User 1 submits answer
    const answerResponse = await request(app)
      .post('/api/questions/answer')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        question_id: questionId,
        answer_text: 'Seeing your smile this morning!'
      });

    expect(answerResponse.status).toBe(201);
    expect(answerResponse.body).toHaveProperty('message', 'Answer submitted successfully');

    // Step 7: Verify answer in history
    const historyResponse = await request(app)
      .get('/api/questions/history')
      .set('Authorization', `Bearer ${user1Token}`);

    expect(historyResponse.body.answers.length).toBeGreaterThan(0);
    expect(historyResponse.body.answers[0]).toHaveProperty('answer_text', 'Seeing your smile this morning!');
  });
});
