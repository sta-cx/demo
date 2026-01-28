const { query } = require('../utils/database');
const Milestone = require('../models/Milestone');
const logger = require('../utils/logger');

class StreakService {
  /**
   * 记录用户打卡
   */
  static async recordStreak(userId, coupleId) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // 检查今日是否已打卡
    const existingCheck = await this.checkTodayStreak(userId, coupleId);
    if (existingCheck) {
      return existingCheck;
    }

    // 检查昨日是否打卡，以确定是否连续
    const yesterdayStreak = await this.getStreakCount(userId, coupleId, yesterday);
    const newStreakCount = yesterdayStreak ? yesterdayStreak + 1 : 1;

    // 插入打卡记录
    const sql = `
      INSERT INTO streak_records (user_id, couple_id, streak_date, streak_count)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (user_id, couple_id, streak_date)
      DO UPDATE SET streak_count = EXCLUDED.streak_count
      RETURNING *
    `;

    await query(sql, [userId, coupleId, today, newStreakCount]);

    // 检查是否触发里程碑
    await this.checkMilestones(userId, coupleId, newStreakCount);

    logger.info(`Streak recorded for user ${userId}: ${newStreakCount} days`);

    return {
      streak_count: newStreakCount,
      is_continuous: newStreakCount > 1,
      milestones_unlocked: []
    };
  }

  /**
   * 检查今日是否已打卡
   */
  static async checkTodayStreak(userId, coupleId) {
    const today = new Date().toISOString().split('T')[0];

    const sql = `
      SELECT * FROM streak_records
      WHERE user_id = $1 AND couple_id = $2 AND streak_date = $3
    `;

    const result = await query(sql, [userId, coupleId, today]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * 获取特定日期的打卡记录
   */
  static async getStreakCount(userId, coupleId, date) {
    const sql = `
      SELECT streak_count FROM streak_records
      WHERE user_id = $1 AND couple_id = $2 AND streak_date = $3
    `;

    const result = await query(sql, [userId, coupleId, date]);
    return result.rows.length > 0 ? result.rows[0].streak_count : null;
  }

  /**
   * 获取当前连续打卡天数
   */
  static async getCurrentStreak(userId, coupleId) {
    // 先检查今日是否打卡
    const todayRecord = await this.checkTodayStreak(userId, coupleId);
    if (todayRecord) {
      return todayRecord.streak_count;
    }

    // 检查昨日是否打卡
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yesterdayRecord = await this.getStreakCount(userId, coupleId, yesterday);

    return yesterdayRecord || 0;
  }

  /**
   * 获取最长连续打卡记录
   */
  static async getMaxStreak(userId, coupleId) {
    const sql = `
      SELECT MAX(streak_count) as max_streak FROM streak_records
      WHERE user_id = $1 AND couple_id = $2
    `;

    const result = await query(sql, [userId, coupleId]);
    return result.rows[0].max_streak || 0;
  }

  /**
   * 获取打卡统计
   */
  static async getStats(userId, coupleId) {
    const currentStreak = await this.getCurrentStreak(userId, coupleId);
    const maxStreak = await this.getMaxStreak(userId, coupleId);

    // 获取本月打卡天数
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const monthSql = `
      SELECT COUNT(*) as month_days FROM streak_records
      WHERE user_id = $1 AND couple_id = $2 AND streak_date >= $3
    `;

    const monthResult = await query(monthSql, [userId, coupleId, monthStartStr]);

    return {
      current_streak: currentStreak,
      max_streak: maxStreak,
      month_days: parseInt(monthResult.rows[0].month_days) || 0,
      total_days: currentStreak // 可以扩展为总打卡天数
    };
  }

  /**
   * 检查里程碑
   */
  static async checkMilestones(userId, coupleId, streakCount) {
    const unlockedMilestones = [];
    // today 变量当前未使用，如果需要记录里程碑获取日期可以启用
    // const today = new Date().toISOString().split('T')[0];

    // 里程碑定义
    const streakMilestones = [
      { type: 'week_streak', threshold: 7, title: '一周cp', description: '连续打卡7天' },
      { type: 'month_streak', threshold: 30, title: '一月cp', description: '连续打卡30天' },
      { type: 'hundred_days', threshold: 100, title: '百日cp', description: '连续打卡100天' }
    ];

    for (const milestone of streakMilestones) {
      if (streakCount === milestone.threshold) {
        // 检查是否已存在
        const exists = await Milestone.exists(coupleId, milestone.type);
        if (!exists) {
          await Milestone.create({
            couple_id: coupleId,
            user_id: userId,
            milestone_type: milestone.type,
            title: milestone.title,
            description: milestone.description,
            metadata: { streak_count: streakCount }
          });
          unlockedMilestones.push(milestone);
          logger.info(`Milestone unlocked: ${milestone.type} for couple ${coupleId}`);
        }
      }
    }

    return unlockedMilestones;
  }

  /**
   * 获取打卡日历
   */
  static async getCalendar(userId, coupleId, year, month) {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const sql = `
      SELECT streak_date, streak_count FROM streak_records
      WHERE user_id = $1 AND couple_id = $2
        AND streak_date BETWEEN $3 AND $4
      ORDER BY streak_date
    `;

    const result = await query(sql, [
      userId,
      coupleId,
      startDate.toISOString().split('T')[0],
      endDate.toISOString().split('T')[0]
    ]);

    // 构建日历数据
    const calendar = {};
    result.rows.forEach(row => {
      calendar[row.streak_date] = {
        streak_count: row.streak_count,
        completed: true
      };
    });

    return calendar;
  }

  /**
   * 获取打卡排行榜
   */
  static async getLeaderboard(coupleId, limit = 10) {
    const sql = `
      SELECT
        u.id,
        u.nickname,
        u.avatar_url,
        MAX(s.streak_count) as max_streak,
        COUNT(s.id) as total_records
      FROM streak_records s
      JOIN users u ON s.user_id = u.id
      WHERE s.couple_id = $1
      GROUP BY u.id, u.nickname, u.avatar_url
      ORDER BY max_streak DESC, total_records DESC
      LIMIT $2
    `;

    const result = await query(sql, [coupleId, limit]);
    return result.rows;
  }
}

module.exports = StreakService;
