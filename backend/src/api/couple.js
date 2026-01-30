const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const CoupleService = require('../services/coupleService');
const logger = require('../utils/logger');
const { whitelistFilter, whitelists } = require('../utils/validator');

/**
 * 获取情侣信息
 */
router.get('/info', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const couple = await CoupleService.getCoupleByUserId(userId);
    
    if (!couple) {
      return res.status(404).json({ 
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }

    // 获取情侣统计信息
    const stats = await CoupleService.getCoupleStats(couple.id);
    
    res.json({
      ...couple,
      stats
    });
  } catch (error) {
    logger.error('Get couple info error:', error);
    res.status(500).json({ 
      error: 'Failed to get couple info',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 绑定情侣
 */
router.post('/bind', authMiddleware, async (req, res) => {
  try {
    const {
      partner_phone,
      partner_phone_code,
      couple_name
    } = req.body;

    const userId = req.user.userId;

    // 验证必填字段
    if (!partner_phone || !partner_phone_code) {
      return res.status(400).json({
        error: 'Partner phone and verification code are required',
        code: 'MISSING_PARTNER_INFO'
      });
    }

    if (!couple_name) {
      return res.status(400).json({
        error: 'Couple name is required',
        code: 'MISSING_COUPLE_NAME'
      });
    }

    // 验证手机号格式
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(partner_phone)) {
      return res.status(400).json({
        error: 'Invalid phone number format',
        code: 'INVALID_PHONE'
      });
    }

    // TODO: 验证验证码（暂时跳过）
    // const isValidCode = await verifyPhoneCode(partner_phone, partner_phone_code);
    // if (!isValidCode) {
    //   return res.status(400).json({
    //     error: 'Invalid verification code',
    //     code: 'INVALID_CODE'
    //   });
    // }

    const { User } = require('../models');

    // 获取当前用户信息
    const currentUser = await User.findById(userId);
    if (!currentUser) {
      return res.status(404).json({
        error: 'Current user not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // 根据手机号查找伴侣用户
    const partnerUser = await User.findByPhone(partner_phone);
    if (!partnerUser) {
      return res.status(404).json({
        error: 'Partner user not found',
        code: 'PARTNER_NOT_FOUND'
      });
    }

    const partnerUserId = partnerUser.id;

    // 检查是否尝试与自己绑定
    if (userId === partnerUserId) {
      return res.status(400).json({
        error: 'Cannot bind with yourself',
        code: 'SELF_BIND'
      });
    }

    // 创建情侣关系
    const couple = await CoupleService.bindCouple(
      userId,
      partnerUserId,
      couple_name
    );

    logger.info(`Couple bound: ${couple.id}, User: ${userId}, Partner: ${partnerUserId}`);

    res.status(201).json({
      message: 'Couple bound successfully',
      couple
    });
  } catch (error) {
    logger.error('Bind couple error:', error);

    // 处理特定错误
    if (error.message === 'User already has an active couple relationship' ||
        error.message === 'Partner already has an active couple relationship') {
      return res.status(400).json({
        error: 'User already has an active couple',
        code: 'ALREADY_BOUND'
      });
    }

    if (error.message === 'Cannot bind with yourself') {
      return res.status(400).json({
        error: 'Cannot bind with yourself',
        code: 'SELF_BIND'
      });
    }

    if (error.message === 'Partner not found') {
      return res.status(404).json({
        error: 'Partner user not found',
        code: 'PARTNER_NOT_FOUND'
      });
    }

    res.status(500).json({
      error: 'Failed to bind couple',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 更新情侣信息
 */
router.put('/update', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { couple_id } = req.body;

    // 验证必填字段
    if (!couple_id) {
      return res.status(400).json({
        error: 'Couple ID is required',
        code: 'MISSING_COUPLE_ID'
      });
    }

    // 验证用户是否是情侣中的一方
    const couple = await CoupleService.getCoupleByUserId(userId);
    if (!couple || couple.id !== couple_id) {
      return res.status(403).json({
        error: 'You are not part of this couple',
        code: 'NOT_COUPLE_MEMBER'
      });
    }

    // 使用白名单过滤输入，防止mass assignment攻击
    const updates = whitelistFilter(req.body, whitelists.couple, {
      stripUndefined: true,
      stripNull: false,
      stripEmptyString: false
    });

    // 如果没有有效的更新字段
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update',
        code: 'NO_VALID_FIELDS'
      });
    }

    // 更新情侣信息
    const updatedCouple = await CoupleService.updateCouple(couple_id, updates);

    logger.info(`Couple updated: ${couple_id}`);

    res.json({
      message: 'Couple updated successfully',
      couple: updatedCouple
    });
  } catch (error) {
    logger.error('Update couple error:', error);
    res.status(500).json({
      error: 'Failed to update couple',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 获取情侣统计信息
 */
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const couple = await CoupleService.getCoupleByUserId(userId);
    
    if (!couple) {
      return res.status(404).json({ 
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }

    const stats = await CoupleService.getCoupleStats(couple.id);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get couple stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get couple stats',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 解绑情侣关系
 */
router.post('/unbind', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    const couple = await CoupleService.getCoupleByUserId(userId);
    if (!couple) {
      return res.status(404).json({ 
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }

    // 解绑情侣
    const unboundCouple = await CoupleService.unbindCouple(couple.id, userId);
    
    logger.info(`Couple unbound: ${couple.id}, User: ${userId}`);

    res.json({
      message: 'Couple unbound successfully',
      couple: unboundCouple
    });
  } catch (error) {
    logger.error('Unbind couple error:', error);
    
    if (error.message === 'User is not part of this couple') {
      return res.status(403).json({ 
        error: 'User is not part of this couple',
        code: 'NOT_COUPLE_MEMBER'
      });
    }

    res.status(500).json({ 
      error: 'Failed to unbind couple',
      code: 'INTERNAL_ERROR'
    });
  }
});

module.exports = router;
