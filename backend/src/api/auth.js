const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { query } = require('../utils/database');
const logger = require('../utils/logger');
const { authLimiter, smsLimiter } = require('../middleware/rateLimiter');
const { getRedisClient } = require('../utils/redis');

// Send verification code
router.post('/send-code', smsLimiter, async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // Validate phone format (Chinese mobile: 1 followed by 10 digits)
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    const redis = await getRedisClient();

    // Check rate limiting: max 5 attempts per hour per phone
    const attemptKey = `sms:attempts:${phone}`;
    const attempts = await redis.get(attemptKey);
    const attemptCount = attempts ? parseInt(attempts) : 0;

    if (attemptCount >= 5) {
      logger.warn(`Rate limit exceeded for phone: ${phone}`);
      return res.status(429).json({
        error: 'Too many attempts. Please try again later.',
        retryAfter: 3600 // seconds
      });
    }

    // Generate 6-digit verification code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store code in Redis with 5-minute expiration (300 seconds)
    const codeKey = `sms:code:${phone}`;
    await redis.setEx(codeKey, 300, code);

    // Increment attempt counter with 1-hour expiration
    await redis.incr(attemptKey);
    await redis.expire(attemptKey, 3600);

    // Log code only in non-production environments
    if (process.env.NODE_ENV !== 'production') {
      logger.info(`[DEV] Verification code for ${phone}: ${code}`);
    }

    // TODO: Implement SMS service integration
    // For now, code is logged in development mode

    res.json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error('Send code error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Login with verification code
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    // Validate phone format
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid verification code format' });
    }

    const redis = await getRedisClient();

    // Retrieve stored code from Redis
    const codeKey = `sms:code:${phone}`;
    const storedCode = await redis.get(codeKey);

    if (!storedCode) {
      logger.warn(`Login attempt with expired or non-existent code for phone: ${phone}`);
      return res.status(401).json({ error: 'Verification code expired or invalid' });
    }

    // Validate code matches
    if (code !== storedCode) {
      logger.warn(`Login attempt with invalid code for phone: ${phone}`);
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // Delete code after successful validation (one-time use)
    await redis.del(codeKey);

    // Find or create user
    let user = await query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );

    if (user.rows.length === 0) {
      // Create new user
      user = await query(
        'INSERT INTO users (phone) VALUES ($1) RETURNING *',
        [phone]
      );
    }

    const userData = user.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: userData.id,
        phone: userData.phone
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: userData.id,
        phone: userData.phone,
        nickname: userData.nickname,
        avatar_url: userData.avatar_url
      }
    });
  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;