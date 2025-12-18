const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const Memory = require('../models/Memory');
const Couple = require('../models/Couple');
const logger = require('../utils/logger');
const { memoryLimiter } = require('../middleware/rateLimiter');

/**
 * 获取回忆录列表
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, limit = 10, offset = 0 } = req.query;
    
    // 获取用户的情侣关系
    const couple = await Couple.findByUserId(userId);
    if (!couple) {
      return res.status(404).json({
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }
    
    // 获取回忆录列表
    const memories = await Memory.findByCouple(couple.id, {
      period_type: type,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
    // 获取统计信息
    const stats = await Memory.getStats(couple.id);
    
    res.json({
      success: true,
      data: {
        memories,
        stats,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: stats.total
        }
      }
    });
    
  } catch (error) {
    logger.error('Get memories error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get memories',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 获取单个回忆录详情
 */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    // 获取回忆录
    const memory = await Memory.findById(id);
    if (!memory) {
      return res.status(404).json({
        error: 'Memory not found',
        code: 'MEMORY_NOT_FOUND'
      });
    }
    
    // 验证用户权限
    const couple = await Couple.findById(memory.couple_id);
    if (!couple || !couple.isUserInCouple(userId)) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    res.json({
      success: true,
      data: memory
    });
    
  } catch (error) {
    logger.error('Get memory detail error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get memory detail',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 生成分享内容
 */
router.post('/:id/share', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const { format = 'json' } = req.body;
    
    // 获取回忆录
    const memory = await Memory.findById(id);
    if (!memory) {
      return res.status(404).json({
        error: 'Memory not found',
        code: 'MEMORY_NOT_FOUND'
      });
    }
    
    // 验证用户权限
    const couple = await Couple.findById(memory.couple_id);
    if (!couple || !couple.isUserInCouple(userId)) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    // 生成分享数据
    const shareData = await Memory.generateShareData(id);
    
    // 根据格式返回不同内容
    if (format === 'image') {
      // 生成分享图片URL（占位符实现）
      const shareImageUrl = `https://api.our-daily.com/memories/share/${id}.jpg`;
      
      res.json({
        success: true,
        data: {
          share_url: shareImageUrl,
          share_data: shareData
        }
      });
    } else {
      // 默认返回JSON格式
      res.json({
        success: true,
        data: {
          share_data: shareData,
          share_url: `https://our-daily.com/memories/${id}`
        }
      });
    }
    
  } catch (error) {
    logger.error('Share memory error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to share memory',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 删除回忆录
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    
    // 获取回忆录
    const memory = await Memory.findById(id);
    if (!memory) {
      return res.status(404).json({
        error: 'Memory not found',
        code: 'MEMORY_NOT_FOUND'
      });
    }
    
    // 验证用户权限
    const couple = await Couple.findById(memory.couple_id);
    if (!couple || !couple.isUserInCouple(userId)) {
      return res.status(403).json({
        error: 'Access denied',
        code: 'ACCESS_DENIED'
      });
    }
    
    // 删除回忆录
    const deleted = await Memory.delete(id);
    if (!deleted) {
      return res.status(500).json({
        error: 'Failed to delete memory',
        code: 'DELETE_FAILED'
      });
    }
    
    res.json({
      success: true,
      message: 'Memory deleted successfully'
    });
    
  } catch (error) {
    logger.error('Delete memory error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete memory',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 获取回忆录统计
 */
router.get('/stats/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // 获取用户的情侣关系
    const couple = await Couple.findByUserId(userId);
    if (!couple) {
      return res.status(404).json({
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }
    
    // 获取统计信息
    const stats = await Memory.getStats(couple.id);
    
    res.json({
      success: true,
      data: stats
    });
    
  } catch (error) {
    logger.error('Get memory stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get memory stats',
      code: 'INTERNAL_ERROR'
    });
  }
});

/**
 * 手动触发回忆录生成（仅用于测试和管理）
 */
router.post('/generate', authMiddleware, memoryLimiter, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { period_type, period_date } = req.body;
    
    // 验证参数
    if (!period_type || !period_date) {
      return res.status(400).json({
        error: 'period_type and period_date are required',
        code: 'INVALID_PARAMS'
      });
    }
    
    if (!['weekly', 'monthly'].includes(period_type)) {
      return res.status(400).json({
        error: 'period_type must be weekly or monthly',
        code: 'INVALID_PERIOD_TYPE'
      });
    }
    
    // 获取用户的情侣关系
    const couple = await Couple.findByUserId(userId);
    if (!couple) {
      return res.status(404).json({
        error: 'No active couple relationship found',
        code: 'COUPLE_NOT_FOUND'
      });
    }
    
    // 导入报告服务（避免循环依赖）
    const ReportService = require('../services/reportService');
    
    let memory;
    if (period_type === 'weekly') {
      memory = await ReportService.generateWeeklyReport(couple.id, period_date);
    } else {
      memory = await ReportService.generateMonthlyReport(couple.id, period_date);
    }
    
    res.json({
      success: true,
      data: memory,
      message: `${period_type} report generated successfully`
    });
    
  } catch (error) {
    logger.error('Generate memory error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate memory',
      code: 'GENERATION_FAILED'
    });
  }
});

module.exports = router;