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

  // 根据用户查找活跃情侣关系
  static async findOne(where) {
    const conditions = [];
    const values = [];
    let paramIndex = 1;

    // 构建WHERE条件
    if (where.user1_id) {
      conditions.push(`user1_id = $${paramIndex}`);
      values.push(where.user1_id);
      paramIndex++;
    }
    if (where.user2_id) {
      conditions.push(`user2_id = $${paramIndex}`);
      values.push(where.user2_id);
      paramIndex++;
    }
    if (where.is_active !== undefined) {
      conditions.push(`status = $${paramIndex}`);
      values.push(where.is_active ? 'active' : 'inactive');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const sql = `SELECT * FROM couples ${whereClause} LIMIT 1`;

    try {
      const result = await query(sql, values);
      if (result.rows.length === 0) {
        return null;
      }
      return new Couple(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find couple: ${error.message}`);
    }
  }

  // 根据ID查找（别名，兼容Sequelize风格）
  static async findByPk(id) {
    return Couple.findById(id);
  }

  // 检查用户是否已有活跃关系
  static async findActiveByUserId(userId) {
    const sql = `
      SELECT * FROM couples
      WHERE (user1_id = $1 OR user2_id = $1) AND status = 'active'
    `;

    try {
      const result = await query(sql, [userId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Couple(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find active couple: ${error.message}`);
    }
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
}

module.exports = Couple;
