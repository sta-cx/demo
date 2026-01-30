const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const CoupleService = require('../services/coupleService');
const logger = require('../utils/logger');
const { whitelistFilter, whitelists } = require('../utils/validator');
const {
  NotFoundError,
  BadRequestError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  FieldValidationError,
  asyncHandler
} = require('../utils/errorHandler');

/**
 * 获取情侣信息
 */
router.get('/info', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const couple = await CoupleService.getCoupleByUserId(userId);

  if (!couple) {
    throw new NotFoundError('No active couple relationship found', 'COUPLE_NOT_FOUND');
  }

  // 获取情侣统计信息
  const stats = await CoupleService.getCoupleStats(couple.id);

  res.json({
    ...couple,
    stats
  });
}));

/**
 * 绑定情侣
 */
router.post('/bind', authMiddleware, asyncHandler(async (req, res) => {
  const {
    partner_phone,
    partner_phone_code,
    couple_name
  } = req.body;

  const userId = req.user.userId;

  // 验证必填字段
  if (!partner_phone || !partner_phone_code) {
    throw new BadRequestError('Partner phone and verification code are required', 'MISSING_PARTNER_INFO');
  }

  if (!couple_name) {
    throw new FieldValidationError('couple_name', 'Couple name is required');
  }

  // 验证手机号格式
  const phoneRegex = /^1[3-9]\d{9}$/;
  if (!phoneRegex.test(partner_phone)) {
    throw new BadRequestError('Invalid phone number format', 'INVALID_PHONE');
  }

  // TODO: 验证验证码（暂时跳过）
  // const isValidCode = await verifyPhoneCode(partner_phone, partner_phone_code);
  // if (!isValidCode) {
  //   throw new BadRequestError('Invalid verification code', 'INVALID_CODE');
  // }

  const { User } = require('../models');

  // 获取当前用户信息
  const currentUser = await User.findById(userId);
  if (!currentUser) {
    throw new NotFoundError('Current user not found', 'USER_NOT_FOUND');
  }

  // 根据手机号查找伴侣用户
  const partnerUser = await User.findByPhone(partner_phone);
  if (!partnerUser) {
    throw new NotFoundError('Partner user not found', 'PARTNER_NOT_FOUND');
  }

  const partnerUserId = partnerUser.id;

  // 检查是否尝试与自己绑定
  if (userId === partnerUserId) {
    throw new BadRequestError('Cannot bind with yourself', 'SELF_BIND');
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
}));

/**
 * 更新情侣信息
 */
router.put('/update', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { couple_id } = req.body;

  // 验证必填字段
  if (!couple_id) {
    throw new FieldValidationError('couple_id', 'Couple ID is required');
  }

  // 验证用户是否是情侣中的一方
  const couple = await CoupleService.getCoupleByUserId(userId);
  if (!couple || couple.id !== couple_id) {
    throw new ForbiddenError('You are not part of this couple', 'NOT_COUPLE_MEMBER');
  }

  // 使用白名单过滤输入，防止mass assignment攻击
  const updates = whitelistFilter(req.body, whitelists.couple, {
    stripUndefined: true,
    stripNull: false,
    stripEmptyString: false
  });

  // 如果没有有效的更新字段
  if (Object.keys(updates).length === 0) {
    throw new ValidationError('No valid fields to update', { validFields: Object.keys(whitelists.couple) });
  }

  // 更新情侣信息
  const updatedCouple = await CoupleService.updateCouple(couple_id, updates);

  logger.info(`Couple updated: ${couple_id}`);

  res.json({
    message: 'Couple updated successfully',
    couple: updatedCouple
  });
}));

/**
 * 获取情侣统计信息
 */
router.get('/stats', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const couple = await CoupleService.getCoupleByUserId(userId);

  if (!couple) {
    throw new NotFoundError('No active couple relationship found', 'COUPLE_NOT_FOUND');
  }

  const stats = await CoupleService.getCoupleStats(couple.id);

  res.json({
    success: true,
    data: stats
  });
}));

/**
 * 解绑情侣关系
 */
router.post('/unbind', authMiddleware, asyncHandler(async (req, res) => {
  const userId = req.user.userId;

  const couple = await CoupleService.getCoupleByUserId(userId);
  if (!couple) {
    throw new NotFoundError('No active couple relationship found', 'COUPLE_NOT_FOUND');
  }

  // 解绑情侣
  const unboundCouple = await CoupleService.unbindCouple(couple.id, userId);

  logger.info(`Couple unbound: ${couple.id}, User: ${userId}`);

  res.json({
    message: 'Couple unbound successfully',
    couple: unboundCouple
  });
}));

module.exports = router;
