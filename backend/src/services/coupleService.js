const { Couple, User } = require('../models');
const { query } = require('../utils/database');

class CoupleService {
  /**
   * 根据 userId 获取情侣信息
   */
  static async getCoupleByUserId(userId) {
    try {
      const couple = await Couple.findByUserId(userId);
      return couple ? couple.toJSON() : null;
    } catch (error) {
      console.error('Get couple by userId error:', error);
      throw error;
    }
  }

  /**
   * 绑定情侣关系
   */
  static async bindCouple(user1Id, user2Id, coupleName) {
    try {
      // 检查是否尝试与自己绑定
      if (user1Id === user2Id) {
        throw new Error('Cannot bind with yourself');
      }

      // 检查用户1是否已有活跃的情侣关系
      const existingCouple1 = await Couple.findActiveByUserId(user1Id);
      if (existingCouple1) {
        throw new Error('User already has an active couple relationship');
      }

      // 检查用户2是否已有活跃的情侣关系
      const existingCouple2 = await Couple.findActiveByUserId(user2Id);
      if (existingCouple2) {
        throw new Error('Partner already has an active couple relationship');
      }

      // 检查用户是否存在
      const user1 = await User.findById(user1Id);
      const user2 = await User.findById(user2Id);

      if (!user1) {
        throw new Error('User not found');
      }
      if (!user2) {
        throw new Error('Partner not found');
      }

      // 创建情侣关系
      const couple = await Couple.create({
        user1_id: user1Id,
        user2_id: user2Id,
        relationship_start_date: new Date(),
        couple_name: coupleName
      });

      return couple.toJSON();
    } catch (error) {
      console.error('Bind couple error:', error);
      throw error;
    }
  }

  /**
   * 更新情侣信息
   */
  static async updateCouple(coupleId, updates) {
    try {
      const couple = await Couple.update(coupleId, updates);
      if (!couple) {
        throw new Error('Couple not found');
      }
      return couple.toJSON();
    } catch (error) {
      console.error('Update couple error:', error);
      throw error;
    }
  }

  /**
   * 获取情侣统计信息
   */
  static async getCoupleStats(coupleId) {
    try {
      const couple = await Couple.findById(coupleId);
      if (!couple) {
        throw new Error('Couple not found');
      }

      const { Answer } = require('../models/Answer');
      const startDate = couple.relationship_start_date;
      const now = new Date();

      // 计算在一起的天数
      const daysTogether = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

      // 计算总回答数
      const totalAnswersResult = await query(
        'SELECT COUNT(*) as count FROM answers WHERE couple_id = $1',
        [coupleId]
      );
      const totalAnswers = parseInt(totalAnswersResult.rows[0].count);

      // 计算本周回答数
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const weeklyAnswersResult = await query(
        'SELECT COUNT(*) as count FROM answers WHERE couple_id = $1 AND created_at >= $2',
        [coupleId, weekAgo]
      );
      const weeklyAnswers = parseInt(weeklyAnswersResult.rows[0].count);

      // 计算本月回答数
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const monthlyAnswersResult = await query(
        'SELECT COUNT(*) as count FROM answers WHERE couple_id = $1 AND created_at >= $2',
        [coupleId, monthAgo]
      );
      const monthlyAnswers = parseInt(monthlyAnswersResult.rows[0].count);

      return {
        days_together: daysTogether,
        total_answers: totalAnswers,
        weekly_answers: weeklyAnswers,
        monthly_answers: monthlyAnswers,
        start_date: startDate,
        couple_name: couple.couple_name
      };
    } catch (error) {
      console.error('Get couple stats error:', error);
      throw error;
    }
  }

  /**
   * 解除情侣关系
   */
  static async unbindCouple(coupleId, userId) {
    try {
      const couple = await Couple.findById(coupleId);
      if (!couple) {
        throw new Error('Couple not found');
      }

      // 验证用户是否是情侣中的一方
      if (couple.user1_id !== userId && couple.user2_id !== userId) {
        throw new Error('User is not part of this couple');
      }

      // 停用情侣关系（不删除，只是标记为不活跃）
      const updatedCouple = await Couple.update(coupleId, {
        status: 'inactive'
      });

      return updatedCouple ? updatedCouple.toJSON() : null;
    } catch (error) {
      console.error('Unbind couple error:', error);
      throw error;
    }
  }
}

module.exports = CoupleService;
