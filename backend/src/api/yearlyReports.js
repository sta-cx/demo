const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const YearlyReportService = require('../services/yearlyReportService');
const Couple = require('../models/Couple');
const logger = require('../utils/logger');

// 获取所有年度报告
router.get('/couple/:coupleId', auth, async (req, res) => {
  try {
    const { coupleId } = req.params;

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== parseInt(coupleId)) {
      return res.status(403).json({ error: '无权访问此情侣的报告' });
    }

    const reports = await YearlyReportService.getReports(parseInt(coupleId));
    res.json({ reports });
  } catch (error) {
    logger.error('获取年度报告列表失败:', error);
    res.status(500).json({ error: '获取年度报告列表失败' });
  }
});

// 获取特定年份的报告
router.get('/couple/:coupleId/:year', auth, async (req, res) => {
  try {
    const { coupleId, year } = req.params;

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== parseInt(coupleId)) {
      return res.status(403).json({ error: '无权访问此情侣的报告' });
    }

    const report = await YearlyReportService.getReport(parseInt(coupleId), parseInt(year));

    if (!report) {
      return res.status(404).json({ error: '报告不存在' });
    }

    res.json(report);
  } catch (error) {
    logger.error('获取年度报告失败:', error);
    res.status(500).json({ error: '获取年度报告失败' });
  }
});

// 获取当前年份报告
router.get('/current', auth, async (req, res) => {
  try {
    const couple = await Couple.findByUserId(req.user.id);

    if (!couple) {
      return res.status(404).json({ error: '请先绑定情侣' });
    }

    const currentYear = new Date().getFullYear();
    const report = await YearlyReportService.getReport(couple.id, currentYear);

    if (!report) {
      return res.status(404).json({ error: `${currentYear}年度报告尚未生成` });
    }

    res.json(report);
  } catch (error) {
    logger.error('获取当前年度报告失败:', error);
    res.status(500).json({ error: '获取年度报告失败' });
  }
});

// 手动生成年度报告（管理员/测试用）
router.post('/generate/:coupleId', auth, async (req, res) => {
  try {
    const { coupleId } = req.params;

    // 验证用户是否属于该情侣
    const couple = await Couple.findByUserId(req.user.id);
    if (!couple || couple.id !== parseInt(coupleId)) {
      return res.status(403).json({ error: '无权为此情侣生成报告' });
    }

    const report = await YearlyReportService.generateYearlyReport(parseInt(coupleId));

    logger.info(`年度报告生成成功: ${report.id}`);
    res.json({ message: '报告生成成功', report });
  } catch (error) {
    logger.error('生成年度报告失败:', error);
    res.status(500).json({ error: '生成年度报告失败' });
  }
});

module.exports = router;
