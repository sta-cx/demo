const express = require('express');
const router = express.Router();
const { query } = require('../utils/database');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

// 获取用户设置
router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const sql = `
      SELECT
        id, user_id,
        notification_enabled, notification_time, push_enabled, email_enabled,
        profile_visible, show_answers_count, show_streak,
        question_category, ai_question_ratio, language, theme,
        daily_reminder, streak_reminder,
        preferences,
        created_at, updated_at
      FROM user_settings
      WHERE user_id = $1
    `;

    const result = await query(sql, [req.user.id]);

    if (result.rows.length === 0) {
      // 返回默认设置
      return res.json({
        notification_enabled: true,
        notification_time: '21:00:00',
        push_enabled: true,
        email_enabled: false,
        profile_visible: true,
        show_answers_count: true,
        show_streak: true,
        question_category: ['relationship', 'lifestyle', 'hobbies', 'values', 'future'],
        ai_question_ratio: 70,
        language: 'zh-CN',
        theme: 'light',
        daily_reminder: true,
        streak_reminder: true,
        preferences: {}
      });
    }

    const settings = result.rows[0];

    // 解析JSON字段
    if (typeof settings.question_category === 'string') {
      settings.question_category = settings.question_category.replace(/[{}]/g, '').split(',');
    }
    if (typeof settings.preferences === 'string') {
      settings.preferences = JSON.parse(settings.preferences);
    }

    res.json(settings);
  } catch (error) {
    logger.error('获取用户设置失败:', error);
    res.status(500).json({ error: '获取用户设置失败' });
  }
});

// 更新用户设置
router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const {
      notification_enabled,
      notification_time,
      push_enabled,
      email_enabled,
      profile_visible,
      show_answers_count,
      show_streak,
      question_category,
      ai_question_ratio,
      language,
      theme,
      daily_reminder,
      streak_reminder,
      preferences
    } = req.body;

    const sql = `
      INSERT INTO user_settings (
        user_id,
        notification_enabled, notification_time, push_enabled, email_enabled,
        profile_visible, show_answers_count, show_streak,
        question_category, ai_question_ratio, language, theme,
        daily_reminder, streak_reminder,
        preferences
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
      ON CONFLICT (user_id)
      DO UPDATE SET
        notification_enabled = COALESCE($2, user_settings.notification_enabled),
        notification_time = COALESCE($3, user_settings.notification_time),
        push_enabled = COALESCE($4, user_settings.push_enabled),
        email_enabled = COALESCE($5, user_settings.email_enabled),
        profile_visible = COALESCE($6, user_settings.profile_visible),
        show_answers_count = COALESCE($7, user_settings.show_answers_count),
        show_streak = COALESCE($8, user_settings.show_streak),
        question_category = COALESCE($9, user_settings.question_category),
        ai_question_ratio = COALESCE($10, user_settings.ai_question_ratio),
        language = COALESCE($11, user_settings.language),
        theme = COALESCE($12, user_settings.theme),
        daily_reminder = COALESCE($13, user_settings.daily_reminder),
        streak_reminder = COALESCE($14, user_settings.streak_reminder),
        preferences = COALESCE($15, user_settings.preferences),
        updated_at = NOW()
      RETURNING *
    `;

    const result = await query(sql, [
      req.user.id,
      notification_enabled,
      notification_time,
      push_enabled,
      email_enabled,
      profile_visible,
      show_answers_count,
      show_streak,
      question_category ? JSON.stringify(question_category) : null,
      ai_question_ratio,
      language,
      theme,
      daily_reminder,
      streak_reminder,
      preferences ? JSON.stringify(preferences) : null
    ]);

    const settings = result.rows[0];

    // 解析JSON字段
    if (typeof settings.question_category === 'string') {
      settings.question_category = settings.question_category.replace(/[{}]/g, '').split(',');
    }
    if (typeof settings.preferences === 'string') {
      settings.preferences = JSON.parse(settings.preferences);
    }

    logger.info(`用户 ${req.user.id} 设置已更新`);
    res.json(settings);
  } catch (error) {
    logger.error('更新用户设置失败:', error);
    res.status(500).json({ error: '更新用户设置失败' });
  }
});

// 获取用户统计
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // 获取回答统计
    const statsSql = `
      SELECT
        COUNT(*) as total_answers,
        COUNT(DISTINCT answer_date) as active_days,
        MAX(created_at) as last_answer_date,
        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment = 'neutral' THEN 1 END) as neutral_count,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END) as negative_count
      FROM answers
      WHERE user_id = $1
    `;

    const statsResult = await query(statsSql, [userId]);

    // 获取当前连续打卡天数
    const streakSql = `
      WITH RECURSIVE date_series AS (
        SELECT
          CURRENT_DATE as date,
          1 as streak,
          (SELECT MAX(answer_date) FROM answers WHERE user_id = $1) as last_date
        UNION ALL
        SELECT
          date - 1,
          streak + 1,
          last_date
        FROM date_series
        WHERE EXISTS (
          SELECT 1 FROM answers
          WHERE user_id = $1 AND answer_date = date - 1
        )
      )
      SELECT MAX(streak) as current_streak
      FROM date_series
      WHERE date = last_date OR date = CURRENT_DATE
    `;

    const streakResult = await query(streakSql, [userId]);

    // 获取情侣信息
    const coupleSql = `
      SELECT c.*,
             u1.nickname as partner_nickname, u1.avatar_url as partner_avatar
      FROM couples c
      LEFT JOIN users u1 ON c.user2_id = u1.id OR c.user1_id = u1.id
      WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'active'
      LIMIT 1
    `;

    const coupleResult = await query(coupleSql, [userId]);

    res.json({
      total_answers: parseInt(statsResult.rows[0].total_answers) || 0,
      active_days: parseInt(statsResult.rows[0].active_days) || 0,
      last_answer_date: statsResult.rows[0].last_answer_date,
      sentiment: {
        positive: parseInt(statsResult.rows[0].positive_count) || 0,
        neutral: parseInt(statsResult.rows[0].neutral_count) || 0,
        negative: parseInt(statsResult.rows[0].negative_count) || 0
      },
      current_streak: parseInt(streakResult.rows[0].current_streak) || 0,
      couple: coupleResult.rows[0] || null
    });
  } catch (error) {
    logger.error('获取用户统计失败:', error);
    res.status(500).json({ error: '获取用户统计失败' });
  }
});

// 获取用户资料
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const sql = `
      SELECT u.id, u.nickname, u.avatar_url, u.gender, u.birthday,
             u.created_at,
             (SELECT couple_id FROM couples WHERE user1_id = u.id OR user2_id = u.id LIMIT 1) as couple_id
      FROM users u
      WHERE u.id = $1
    `;

    const result = await query(sql, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    logger.error('获取用户资料失败:', error);
    res.status(500).json({ error: '获取用户资料失败' });
  }
});

// 更新用户资料
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nickname, avatar_url, gender, birthday } = req.body;

    const sql = `
      UPDATE users
      SET nickname = COALESCE($2, nickname),
          avatar_url = COALESCE($3, avatar_url),
          gender = COALESCE($4, gender),
          birthday = COALESCE($5, birthday),
          updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;

    const result = await query(sql, [req.user.id, nickname, avatar_url, gender, birthday]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '用户不存在' });
    }

    logger.info(`用户 ${req.user.id} 资料已更新`);
    res.json(result.rows[0]);
  } catch (error) {
    logger.error('更新用户资料失败:', error);
    res.status(500).json({ error: '更新用户资料失败' });
  }
});

module.exports = router;
