const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { query } = require('../utils/database');
const logger = require('../utils/logger');

// Send verification code
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return res.status(400).json({ error: 'Phone number is required' });
    }

    // TODO: Implement SMS service integration
    // For now, generate a 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Log code for development (remove in production)
    logger.info(`Verification code for ${phone}: ${code}`);
    
    // TODO: Store code in Redis with expiration
    
    res.json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error('Send code error', error);
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});

// Login with verification code
router.post('/login', async (req, res) => {
  try {
    const { phone, code } = req.body;
    
    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    // TODO: Verify code from Redis
    // For now, accept any 6-digit code
    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

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
    logger.error('Login error', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

module.exports = router;