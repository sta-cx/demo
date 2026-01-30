const express = require('express');
const router = express.Router();
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const { aiLimiter } = require('../middleware/rateLimiter');
const { aiHealthManager } = require('../utils/aiHealthChecker');

/**
 * 获取AI服务状态
 */
router.get('/status', async (req, res) => {
  try {
    const status = await aiService.healthCheck();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    logger.error('Get AI status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI status'
    });
  }
});

/**
 * 获取AI服务健康状态
 */
router.get('/health', async (req, res) => {
  try {
    const overall = aiService.getOverallHealth();
    res.json({
      success: true,
      data: overall
    });
  } catch (error) {
    logger.error('Get AI health error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI health'
    });
  }
});

/**
 * 获取特定服务的健康状态
 */
router.get('/health/:service', async (req, res) => {
  try {
    const { service } = req.params;
    const health = aiService.getServiceHealth(service);

    if (!health) {
      return res.status(404).json({
        success: false,
        error: `Unknown service: ${service}`
      });
    }

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    logger.error('Get service health error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service health'
    });
  }
});

/**
 * 重置服务健康检查器
 */
router.post('/health/:service/reset', async (req, res) => {
  try {
    const { service } = req.params;
    aiService.resetServiceHealth(service);

    logger.info(`Health checker reset for ${service}`);
    res.json({
      success: true,
      message: `Health checker reset for ${service}`
    });
  } catch (error) {
    logger.error('Reset health checker error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset health checker'
    });
  }
});

/**
 * 获取AI使用统计
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = aiService.getUsageStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Get AI stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get AI stats'
    });
  }
});

/**
 * 重置AI使用统计
 */
router.post('/stats/reset', async (req, res) => {
  try {
    aiService.resetStats();
    logger.info('AI stats reset by admin');
    res.json({
      success: true,
      message: 'Stats reset successfully'
    });
  } catch (error) {
    logger.error('Reset AI stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset stats'
    });
  }
});

/**
 * 测试AI问题生成
 */
router.post('/test/question', aiLimiter, async (req, res) => {
  try {
    const { coupleId, history } = req.body;

    if (!coupleId) {
      return res.status(400).json({
        success: false,
        error: 'coupleId is required'
      });
    }

    const question = await aiService.generatePersonalizedQuestion(coupleId, history || []);

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    logger.error('Test AI question generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 测试AI情感分析
 */
router.post('/test/sentiment', aiLimiter, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: 'text is required'
      });
    }

    const analysis = await aiService.analyzeSentiment(text);

    res.json({
      success: true,
      data: analysis
    });
  } catch (error) {
    logger.error('Test AI sentiment analysis error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;