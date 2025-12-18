const { query } = require('../utils/database');
class Couple {
  constructor(data) {
    this.id = data.id;
    this.user1_id = data.user1_id;
    this.user2_id = data.user2_id;
    this.relationship_start_date = data.relationship_start_date;
    this.couple_name = data.couple_name;
    this.status = data.status;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建情侣关系
  static async create(coupleData) {
    const { user1_id, user2_id, relationship_start_date, couple_name } = coupleData;
    
    const sql = `
      INSERT INTO couples (user1_id, user2_id, relationship_start_date, couple_name)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [user1_id, user2_id, relationship_start_date, couple_name]);
      return new Couple(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create couple: ${error.message}`);
    }
  }

  // 根据ID查找情侣
  static async findById(id) {
    const sql = `
      SELECT c.*, 
             u1.nickname as user1_nickname, u1.avatar_url as user1_avatar_url,
             u2.nickname as user2_nickname, u2.avatar_url as user2_avatar_url
      FROM couples c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      WHERE c.id = $1
    `;
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Couple(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find couple by ID: ${error.message}`);
    }
  }

  // 根据用户ID查找情侣关系
  static async findByUserId(userId) {
    const sql = `
      SELECT c.*, 
             u1.nickname as user1_nickname, u1.avatar_url as user1_avatar_url,
             u2.nickname as user2_nickname, u2.avatar_url as user2_avatar_url
      FROM couples c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      WHERE (c.user1_id = $1 OR c.user2_id = $1) AND c.status = 'active'
    `;
    
    try {
      const result = await query(sql, [userId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Couple(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find couple by user ID: ${error.message}`);
    }
  }

  // 检查两个用户是否已经是情侣
  static async findByUsers(user1Id, user2Id) {
    const sql = `
      SELECT * FROM couples 
      WHERE ((user1_id = $1 AND user2_id = $2) OR (user1_id = $2 AND user2_id = $1))
        AND status = 'active'
    `;
    
    try {
      const result = await query(sql, [user1Id, user2Id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Couple(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to check couple relationship: ${error.message}`);
    }
  }

  // 获取所有活跃情侣
  static async findActive() {
    const sql = `
      SELECT c.*, 
             u1.nickname as user1_nickname, u1.avatar_url as user1_avatar_url,
             u2.nickname as user2_nickname, u2.avatar_url as user2_avatar_url
      FROM couples c
      LEFT JOIN users u1 ON c.user1_id = u1.id
      LEFT JOIN users u2 ON c.user2_id = u2.id
      WHERE c.status = 'active'
      ORDER BY c.created_at DESC
    `;
    
    try {
      const result = await query(sql);
      return result.rows.map(row => new Couple(row));
    } catch (error) {
      throw new Error(`Failed to find active couples: ${error.message}`);
    }
  }

  // 更新情侣信息
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // 动态构建更新字段
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        fields.push(`${key} = $${paramIndex}`);
        values.push(updateData[key]);
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const sql = `
      UPDATE couples 
      SET ${fields.join(', ')}, updated_at = NOW()
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);

    try {
      const result = await query(sql, values);
      if (result.rows.length === 0) {
        return null;
      }
      return new Couple(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update couple: ${error.message}`);
    }
  }

  // 获取情侣统计信息
  async getStats() {
    const sql = `
      SELECT 
        COUNT(DISTINCT a.answer_date) as answer_days,
        COUNT(a.id) as total_answers,
        MAX(a.answer_date) as last_answer_date,
        COUNT(DISTINCT CASE WHEN a.sentiment = 'positive' THEN a.id END) as positive_answers,
        COUNT(DISTINCT CASE WHEN a.sentiment = 'negative' THEN a.id END) as negative_answers
      FROM answers a
      WHERE a.couple_id = $1
    `;
    
    try {
      const result = await query(sql, [this.id]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get couple stats: ${error.message}`);
    }
  }

  // 获取情侣的回答历史
  async getAnswers(limit = 30, offset = 0) {
    const sql = `
      SELECT a.*, 
             u.nickname as user_nickname, u.avatar_url as user_avatar_url,
             q.category as question_category
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE a.couple_id = $1
      ORDER BY a.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await query(sql, [this.id, limit, offset]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get couple answers: ${error.message}`);
    }
  }

  // 获取今日问题
  async getTodayQuestion() {
    const sql = `
      SELECT dq.*, q.*, 
             a1.answer_text as user1_answer, a1.created_at as user1_answer_time,
             a2.answer_text as user2_answer, a2.created_at as user2_answer_time
      FROM daily_questions dq
      LEFT JOIN questions q ON dq.question_id = q.id
      LEFT JOIN answers a1 ON dq.question_id = a1.question_id AND a1.user_id = dq.user1_id
      LEFT JOIN answers a2 ON dq.question_id = a2.question_id AND a2.user_id = dq.user2_id
      WHERE dq.couple_id = $1 AND dq.question_date = CURRENT_DATE
    `;
    
    try {
      const result = await query(sql, [this.id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to get today's question: ${error.message}`);
    }
  }

  // 检查用户是否是情侣中的一员
  isUserInCouple(userId) {
    return this.user1_id === userId || this.user2_id === userId;
  }

  // 获取情侣中的另一个用户ID
  getPartnerId(userId) {
    if (this.user1_id === userId) {
      return this.user2_id;
    } else if (this.user2_id === userId) {
      return this.user1_id;
    }
    return null;
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      user1_id: this.user1_id,
      user2_id: this.user2_id,
      relationship_start_date: this.relationship_start_date,
      couple_name: this.couple_name,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }

  // 转换为详细JSON对象（包含用户信息）
  toDetailedJSON() {
    return {
      id: this.id,
      user1_id: this.user1_id,
      user2_id: this.user2_id,
      user1_nickname: this.user1_nickname,
      user2_nickname: this.user2_nickname,
      user1_avatar_url: this.user1_avatar_url,
      user2_avatar_url: this.user2_avatar_url,
      relationship_start_date: this.relationship_start_date,
      couple_name: this.couple_name,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Couple;