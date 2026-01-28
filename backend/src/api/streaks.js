const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const StreakService = require('../services/streakService');
const Couple = require('../models/Couple');
const logger = require('../utils/logger');

// 获取当前打卡状态
router.get('/current', auth, async (req, res) => {
  try {
    const couple = await Couple.findByUserId(req.user.id);

    if (!couple) {
      return res.status(404).json({ error: '请先绑定情侣' });
    }

    const stats = await StreakService.getStats(req.user.id, couple.id);

    res.json({
      current_streak: stats.current_streak,
      max_streak: stats.max_streak,
      month_days: stats.month_days
    });
  } catch (error) {
    logger.error('获取打卡状态失败:', error);
    res.status(500).json({ error: '获取打卡状态失败' });
  }
});

// 获取打卡统计
router.get('/stats', auth, async (req, res) => {
  try {
    const couple = await Couple.findByUserId(req.user.id);

    if (!couple) {
      return res.status(404).json({ error: '请先绑定情侣' });
    }

    const stats = await StreakService.getStats(req.user.id, couple.id);
    res.json(stats);
  } catch (error) {
    logger.error('获取打卡统计失败:', error);
    res.status(500).json({ error: '获取打卡统计失败' });
  }
});

// 获取打卡日历
router.get('/calendar', auth, async (req, res) => {
  try {
    const { year, month } = req.query;
    const couple = await Couple.findByUserId(req.user.id);

    if (!couple) {
      return res.status(404).json({ error: '请先绑定情侣' });
    }

    const y = year || new Date().getFullYear();
    const m = month || new Date().getMonth() + 1;

    const calendar = await StreakService.getCalendar(req.user.id, couple.id, y, m);
    res.json({ calendar, year: y, month: m });
  } catch (error) {
    logger.error('获取打卡日历失败:', error);
    res.status(500).json({ error: '获取打卡日历失败' });
  }
});

// 获取打卡排行榜
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const couple = await Couple.findByUserId(req.user.id);

    if (!couple) {
      return res.status(404).json({ error: '请先绑定情侣' });
    }

    const leaderboard = await StreakService.getLeaderboard(couple.id);
    res.json({ leaderboard });
  } catch (error) {
    logger.error('获取排行榜失败:', error);
    res.status(500).json({ error: '获取排行榜失败' });
  }
});

module.exports = router;
