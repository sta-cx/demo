const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Milestone = require('../models/Milestone');
const Couple = require('../models/Couple');
const logger = require('../utils/logger');

// 获取情侣所有里程碑
router.get('/couple/:coupleId', auth, async (req, res) => {
  try {
    const { coupleId } = req.params;
    const { limit = 50, offset = 0, order = 'DESC' } = req.query;

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== parseInt(coupleId)) {
      return res.status(403).json({ error: '无权访问此情侣的里程碑' });
    }

    const milestones = await Milestone.findByCoupleId(parseInt(coupleId), {
      limit: parseInt(limit),
      offset: parseInt(offset),
      order
    });

    res.json({
      milestones: milestones.map(m => m.toJSON()),
      total: milestones.length
    });
  } catch (error) {
    logger.error('获取里程碑列表失败:', error);
    res.status(500).json({ error: '获取里程碑列表失败' });
  }
});

// 获取我的里程碑
router.get('/my', auth, async (req, res) => {
  try {
    const milestones = await Milestone.findByUserId(req.user.id);
    res.json({
      milestones: milestones.map(m => m.toJSON())
    });
  } catch (error) {
    logger.error('获取我的里程碑失败:', error);
    res.status(500).json({ error: '获取里程碑失败' });
  }
});

// 获取里程碑统计
router.get('/stats/:coupleId', auth, async (req, res) => {
  try {
    const { coupleId } = req.params;

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== parseInt(coupleId)) {
      return res.status(403).json({ error: '无权访问此情侣的里程碑' });
    }

    const stats = await Milestone.getStats(parseInt(coupleId));
    res.json(stats);
  } catch (error) {
    logger.error('获取里程碑统计失败:', error);
    res.status(500).json({ error: '获取里程碑统计失败' });
  }
});

// 获取单个里程碑详情
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const milestone = await Milestone.findById(parseInt(id));

    if (!milestone) {
      return res.status(404).json({ error: '里程碑不存在' });
    }

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== milestone.couple_id) {
      return res.status(403).json({ error: '无权访问此里程碑' });
    }

    res.json(milestone.toJSON());
  } catch (error) {
    logger.error('获取里程碑详情失败:', error);
    res.status(500).json({ error: '获取里程碑详情失败' });
  }
});

// 手动创建里程碑（管理员功能）
router.post('/', auth, async (req, res) => {
  try {
    const { couple_id, milestone_type, title, description, metadata } = req.body;

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== parseInt(couple_id)) {
      return res.status(403).json({ error: '无权为此情侣创建里程碑' });
    }

    // 检查里程碑是否已存在
    const exists = await Milestone.exists(parseInt(couple_id), milestone_type);
    if (exists) {
      return res.status(400).json({ error: '该里程碑已完成' });
    }

    const milestone = await Milestone.create({
      couple_id: parseInt(couple_id),
      user_id: req.user.id,
      milestone_type,
      title,
      description,
      metadata
    });

    logger.info(`里程碑创建成功: ${milestone.id}`);
    res.status(201).json(milestone.toJSON());
  } catch (error) {
    logger.error('创建里程碑失败:', error);
    res.status(500).json({ error: '创建里程碑失败' });
  }
});

// 删除里程碑
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const milestone = await Milestone.findById(parseInt(id));

    if (!milestone) {
      return res.status(404).json({ error: '里程碑不存在' });
    }

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== milestone.couple_id) {
      return res.status(403).json({ error: '无权删除此里程碑' });
    }

    await Milestone.delete(parseInt(id));
    res.json({ message: '里程碑已删除' });
  } catch (error) {
    logger.error('删除里程碑失败:', error);
    res.status(500).json({ error: '删除里程碑失败' });
  }
});

module.exports = router;
