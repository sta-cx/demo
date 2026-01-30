const { query } = require('../utils/database');
const bcrypt = require('bcryptjs');

class User {
  constructor(data) {
    this.id = data.id;
    this.phone = data.phone;
    this.nickname = data.nickname;
    this.avatar_url = data.avatar_url;
    this.gender = data.gender;
    this.birthday = data.birthday;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  // 创建新用户
  static async create(userData) {
    const { phone, nickname, avatar_url, gender, birthday } = userData;
    
    const sql = `
      INSERT INTO users (phone, nickname, avatar_url, gender, birthday)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [phone, nickname, avatar_url, gender, birthday]);
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  // 根据ID查找用户
  static async findById(id) {
    const sql = 'SELECT * FROM users WHERE id = $1';
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }
  }

  // 根据手机号查找用户
  static async findByPhone(phone) {
    const sql = 'SELECT * FROM users WHERE phone = $1';

    try {
      const result = await query(sql, [phone]);
      if (result.rows.length === 0) {
        return null;
      }
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find user by phone: ${error.message}`);
    }
  }

  // findByPk - findById的别名，用于兼容Sequelize风格调用
  static async findByPk(id) {
    return User.findById(id);
  }

  // 更新用户信息
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
      UPDATE users 
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
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  // 删除用户
  static async delete(id) {
    const sql = 'DELETE FROM users WHERE id = $1 RETURNING *';
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new User(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  // 获取用户设置
  async getSettings() {
    const sql = `
      SELECT * FROM user_settings 
      WHERE user_id = $1
    `;
    
    try {
      const result = await query(sql, [this.id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Failed to get user settings: ${error.message}`);
    }
  }

  // 更新用户设置
  async updateSettings(settingsData) {
    const {
      notification_enabled,
      notification_time,
      profile_visible,
      preferences
    } = settingsData;

    const sql = `
      INSERT INTO user_settings (
        user_id, notification_enabled, notification_time, 
        profile_visible, preferences
      )
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id)
      DO UPDATE SET
        notification_enabled = EXCLUDED.notification_enabled,
        notification_time = EXCLUDED.notification_time,
        profile_visible = EXCLUDED.profile_visible,
        preferences = EXCLUDED.preferences,
        updated_at = NOW()
      RETURNING *
    `;

    try {
      const result = await query(sql, [
        this.id,
        notification_enabled,
        notification_time,
        profile_visible,
        preferences ? JSON.stringify(preferences) : null
      ]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update user settings: ${error.message}`);
    }
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      phone: this.phone,
      nickname: this.nickname,
      avatar_url: this.avatar_url,
      gender: this.gender,
      birthday: this.birthday,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = User;