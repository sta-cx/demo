const { query } = require('../utils/database');

class Milestone {
  constructor(data) {
    this.id = data.id;
    this.couple_id = data.couple_id;
    this.user_id = data.user_id;
    this.milestone_type = data.milestone_type;
    this.title = data.title;
    this.description = data.description;
    this.completed_at = data.completed_at;
    this.metadata = data.metadata;
    this.created_at = data.created_at;
  }

  // 创建里程碑
  static async create(milestoneData) {
    const { couple_id, user_id, milestone_type, title, description, metadata } = milestoneData;

    const sql = `
      INSERT INTO milestones (couple_id, user_id, milestone_type, title, description, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    try {
      const result = await query(sql, [
        couple_id,
        user_id,
        milestone_type,
        title,
        description,
        metadata ? JSON.stringify(metadata) : null
      ]);
      return new Milestone(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create milestone: ${error.message}`);
    }
  }

  // 根据ID查找里程碑
  static async findById(id) {
    const sql = 'SELECT * FROM milestones WHERE id = $1';

    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Milestone(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find milestone by ID: ${error.message}`);
    }
  }

  // 根据情侣ID获取所有里程碑
  static async findByCoupleId(coupleId, options = {}) {
    const { limit = 50, offset = 0, order = 'DESC' } = options;
    const orderDir = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const sql = `
      SELECT * FROM milestones
      WHERE couple_id = $1
      ORDER BY completed_at ${orderDir}
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await query(sql, [coupleId, limit, offset]);
      return result.rows.map(row => new Milestone(row));
    } catch (error) {
      throw new Error(`Failed to find milestones by couple ID: ${error.message}`);
    }
  }

  // 根据用户ID获取里程碑
  static async findByUserId(userId) {
    const sql = `
      SELECT m.*, c.user1_id, c.user2_id
      FROM milestones m
      JOIN couples c ON m.couple_id = c.id
      WHERE m.user_id = $1
      ORDER BY m.completed_at DESC
    `;

    try {
      const result = await query(sql, [userId]);
      return result.rows.map(row => new Milestone(row));
    } catch (error) {
      throw new Error(`Failed to find milestones by user ID: ${error.message}`);
    }
  }

  // 检查特定类型的里程碑是否存在
  static async exists(coupleId, milestoneType) {
    const sql = `
      SELECT id FROM milestones
      WHERE couple_id = $1 AND milestone_type = $2
      LIMIT 1
    `;

    try {
      const result = await query(sql, [coupleId, milestoneType]);
      return result.rows.length > 0;
    } catch (error) {
      throw new Error(`Failed to check milestone existence: ${error.message}`);
    }
  }

  // 获取里程碑统计
  static async getStats(coupleId) {
    const sql = `
      SELECT
        COUNT(*) as total_milestones,
        COUNT(CASE WHEN milestone_type = 'first_answer' THEN 1 END) as first_answer_count,
        COUNT(CASE WHEN milestone_type = 'week_streak' THEN 1 END) as week_streak_count,
        COUNT(CASE WHEN milestone_type = 'month_streak' THEN 1 END) as month_streak_count,
        COUNT(CASE WHEN milestone_type = 'hundred_days' THEN 1 END) as hundred_days_count,
        COUNT(CASE WHEN milestone_type = 'anniversary' THEN 1 END) as anniversary_count,
        COUNT(CASE WHEN milestone_type = 'fifty_answers' THEN 1 END) as fifty_answers_count
      FROM milestones
      WHERE couple_id = $1
    `;

    try {
      const result = await query(sql, [coupleId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get milestone stats: ${error.message}`);
    }
  }

  // 获取未解锁的里程碑
  static async getUnlocked(coupleId, answerCount, streakDays, daysTogether) {
    const unlockedTypes = [];

    if (answerCount >= 1) unlockedTypes.push('first_answer');
    if (streakDays >= 7) unlockedTypes.push('week_streak');
    if (streakDays >= 30) unlockedTypes.push('month_streak');
    if (daysTogether >= 100) unlockedTypes.push('hundred_days');
    if (daysTogether >= 365) unlockedTypes.push('anniversary');
    if (answerCount >= 50) unlockedTypes.push('fifty_answers');

    if (unlockedTypes.length === 0) {
      return [];
    }

    const sql = `
      SELECT milestone_type FROM milestones
      WHERE couple_id = $1 AND milestone_type = ANY($2)
    `;

    try {
      const result = await query(sql, [coupleId, unlockedTypes]);
      return result.rows.map(row => row.milestone_type);
    } catch (error) {
      throw new Error(`Failed to get unlocked milestones: ${error.message}`);
    }
  }

  // 删除里程碑
  static async delete(id) {
    const sql = 'DELETE FROM milestones WHERE id = $1 RETURNING *';

    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Milestone(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to delete milestone: ${error.message}`);
    }
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      couple_id: this.couple_id,
      user_id: this.user_id,
      milestone_type: this.milestone_type,
      title: this.title,
      description: this.description,
      completed_at: this.completed_at,
      metadata: this.metadata,
      created_at: this.created_at
    };
  }
}

module.exports = Milestone;
