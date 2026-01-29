const { Couple, User } = require('../models');

class CoupleService {
  /**
   * 根据 userId 获取情侣信息
   */
  static async getCoupleByUserId(userId) {
    try {
      const couple = await Couple.findOne({
        where: {
          [Sequelize.Op.or]: [
            { user1_id: userId },
            { user2_id: userId }
          ],
          is_active: true
        }
      });

      if (!couple) {
        return null;
      }

      return couple.toJSON();
    } catch (error) {
      console.error('Get couple by userId error:', error);
      throw error;
    }
  }

  /**
   * 绑定情侣关系
   */
  static async bindCouple(user1Id, user2Id, coupleName, user1Phone, user2Phone) {
    try {
      // 检查用户是否已有活跃的情侣关系
      const existingCouple1 = await Couple.findOne({
        where: {
          user1_id: user1Id,
          is_active: true
        }
      });

      const existingCouple2 = await Couple.findOne({
        where: {
          user2_id: user2Id,
          is_active: true
        }
      });

      if (existingCouple1 || existingCouple2) {
        throw new Error('User already has an active couple relationship');
      }

      // 检查是否尝试与自己绑定
      if (user1Id === user2Id) {
        throw new Error('Cannot bind with yourself');
      }

      // 检查用户是否存在
      const user1 = await User.findByPk(user1Id);
      const user2 = await User.findByPk(user2Id);

      if (!user1 || !user2) {
        throw new Error('User not found');
      }

      // 创建情侣关系
      const couple = await Couple.create({
        couple_name: coupleName,
        user1_id: user1Id,
        user2_id: user2Id,
        user1_phone: user1Phone,
        user2_phone: user2Phone,
        start_date: new Date(),
        is_active: true
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
      const couple = await Couple.findByPk(coupleId);
      if (!couple) {
        throw new Error('Couple not found');
      }

      await couple.update(updates);
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
      const couple = await Couple.findByPk(coupleId);
      if (!couple) {
        throw new Error('Couple not found');
      }

      const { Answer } = require('../models/Answer');
      const startDate = couple.start_date;
      const now = new Date();
      
      // 计算在一起的天数
      const daysTogether = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));

      // 计算总回答数
      const totalAnswers = await Answer.count({
        where: {
          couple_id: coupleId
        }
      });

      // 计算本周回答数
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const weeklyAnswers = await Answer.count({
        where: {
          couple_id: coupleId,
          created_at: { [Sequelize.Op.gte]: weekAgo }
        }
      });

      // 计算本月回答数
      const monthAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
      const monthlyAnswers = await Answer.count({
        where: {
          couple_id: coupleId,
          created_at: { [Sequelize.Op.gte]: monthAgo }
        }
      });

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
      const couple = await Couple.findByPk(coupleId);
      if (!couple) {
        throw new Error('Couple not found');
      }

      // 验证用户是否是情侣中的一方
      if (couple.user1_id !== userId && couple.user2_id !== userId) {
        throw new Error('User is not part of this couple');
      }

      // 停用情侣关系（不删除，只是标记为不活跃）
      await couple.update({
        is_active: false,
        end_date: new Date()
      });

      return couple.toJSON();
    } catch (error) {
      console.error('Unbind couple error:', error);
      throw error;
    }
  }
}

module.exports = CoupleService;
