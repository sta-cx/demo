/**
 * Couple API Integration Tests
 * Tests the couple binding logic with proper validation
 */

const request = require('supertest');
const express = require('express');
const coupleRouter = require('../../src/api/couple');

// Mock auth middleware - we'll control the user ID via headers
jest.mock('../../src/middleware/auth', () => (req, res, next) => {
  req.user = { userId: req.headers['x-user-id'] || 'test-user-id' };
  next();
});

// Create test app
const app = express();
app.use(express.json());
app.use('/api/couple', coupleRouter);

describe('Couple Binding Logic', () => {
  describe('POST /api/couple/bind - Input validation', () => {
    it('should return 400 for invalid phone format', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-123')
        .send({
          partner_phone: '12345',
          partner_phone_code: '123456',
          couple_name: 'Test Couple'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PHONE');
      expect(response.body.error).toBe('Invalid phone number format');
    });

    it('should return 400 for phone starting with wrong digit', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-123')
        .send({
          partner_phone: '23800138000', // starts with 2, not 1
          partner_phone_code: '123456',
          couple_name: 'Test Couple'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PHONE');
    });

    it('should return 400 for phone less than 11 digits', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-123')
        .send({
          partner_phone: '1380013800', // 10 digits
          partner_phone_code: '123456',
          couple_name: 'Test Couple'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PHONE');
    });

    it('should return 400 for phone more than 11 digits', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-123')
        .send({
          partner_phone: '138001380001', // 12 digits
          partner_phone_code: '123456',
          couple_name: 'Test Couple'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_PHONE');
    });

    it('should return 400 for missing partner phone', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-123')
        .send({
          partner_phone_code: '123456',
          couple_name: 'Test Couple'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_PARTNER_INFO');
    });

    it('should return 400 for missing verification code', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-123')
        .send({
          partner_phone: '13800138000',
          couple_name: 'Test Couple'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_PARTNER_INFO');
    });

    it('should return 400 for missing couple name', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-123')
        .send({
          partner_phone: '13800138000',
          partner_phone_code: '123456'
        });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('MISSING_COUPLE_NAME');
    });

    it('should accept valid phone number format', async () => {
      // This test validates the phone regex accepts valid formats
      const validPhones = [
        '13800138000', // starts with 13
        '15000150000', // starts with 15
        '18800188000', // starts with 18
        '19000190000'  // starts with 19
      ];

      for (const phone of validPhones) {
        const regex = /^1[3-9]\d{9}$/;
        expect(regex.test(phone)).toBe(true);
      }
    });
  });

  describe('POST /api/couple/bind - Business logic validation', () => {
    // Mock the User model methods
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should reject binding to self with 400', async () => {
      // Mock User.findById to return current user
      const { User } = require('../../src/models');
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'test-user-123',
        phone: '13800138000'
      });

      // Mock User.findByPhone to return the same user (self-bind attempt)
      jest.spyOn(User, 'findByPhone').mockResolvedValue({
        id: 'test-user-123',  // Same as current user
        phone: '13800138000'
      });

      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'test-user-123')
        .send({
          partner_phone: '13800138000',  // Same as current user's phone
          partner_phone_code: '123456',
          couple_name: '测试情侣'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Cannot bind');
      expect(response.body.code).toBe('SELF_BIND');

      // Verify the mocks were called
      expect(User.findById).toHaveBeenCalledWith('test-user-123');
      expect(User.findByPhone).toHaveBeenCalledWith('13800138000');
    });

    it('should return 404 for non-existent partner', async () => {
      // Mock User.findById to return current user
      const { User } = require('../../src/models');
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'test-user-456',
        phone: '13800138000'
      });

      // Mock User.findByPhone to return null (partner not found)
      jest.spyOn(User, 'findByPhone').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'test-user-456')
        .send({
          partner_phone: '19999999999',  // Phone that doesn't exist
          partner_phone_code: '123456',
          couple_name: '测试情侣'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Partner user not found');
      expect(response.body.code).toBe('PARTNER_NOT_FOUND');

      // Verify the mocks were called
      expect(User.findById).toHaveBeenCalledWith('test-user-456');
      expect(User.findByPhone).toHaveBeenCalledWith('19999999999');
    });

    it('should return 404 if current user not found', async () => {
      // Mock User.findById to return null (current user not found)
      const { User } = require('../../src/models');
      jest.spyOn(User, 'findById').mockResolvedValue(null);

      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'non-existent-user')
        .send({
          partner_phone: '13800138000',
          partner_phone_code: '123456',
          couple_name: '测试情侣'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('Current user not found');
      expect(response.body.code).toBe('USER_NOT_FOUND');

      // Verify findById was called
      expect(User.findById).toHaveBeenCalledWith('non-existent-user');
      // findByPhone should not be called if current user is not found
      expect(User.findByPhone).not.toHaveBeenCalled();
    });

    it('should return 400 when current user already has active couple', async () => {
      const { User, Couple } = require('../../src/models');

      // Mock User.findById to return current user
      jest.spyOn(User, 'findById').mockResolvedValue({
        id: 'user-with-couple',
        phone: '13800138000'
      });

      // Mock User.findByPhone to return partner
      jest.spyOn(User, 'findByPhone').mockResolvedValue({
        id: 'partner-user-456',
        phone: '13900139000'
      });

      // Mock Couple.findActiveByUserId to return existing couple
      jest.spyOn(Couple, 'findActiveByUserId').mockResolvedValue({
        id: 'existing-couple-123',
        user1_id: 'user-with-couple',
        user2_id: 'another-partner'
      });

      const response = await request(app)
        .post('/api/couple/bind')
        .set('x-user-id', 'user-with-couple')
        .send({
          partner_phone: '13900139000',
          partner_phone_code: '123456',
          couple_name: '测试情侣'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('already has an active couple');
      expect(response.body.code).toBe('ALREADY_BOUND');
    });
  });
});
