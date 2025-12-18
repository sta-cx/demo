const { query } = require('../utils/database');

class Question {
  constructor(data) {
    this.id = data.id;
    this.question_text = data.question_text;
    this.category = data.category;
    this.difficulty = data.difficulty;
    this.tags = data.tags;
    this.answer_type = data.answer_type;
    this.choices = data.choices;
    this.is_active = data.is_active;
    this.usage_count = data.usage_count;
    this.created_at = data.created_at;
  }

  // 创建新问题
  static async create(questionData) {
    const { 
      question_text, 
      category, 
      difficulty, 
      tags, 
      answer_type, 
      choices 
    } = questionData;
    
    const sql = `
      INSERT INTO questions (
        question_text, category, difficulty, tags, answer_type, choices
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [
        question_text,
        category,
        difficulty,
        tags,
        answer_type,
        choices ? JSON.stringify(choices) : null
      ]);
      return new Question(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create question: ${error.message}`);
    }
  }

  // 根据ID查找问题
  static async findById(id) {
    const sql = 'SELECT * FROM questions WHERE id = $1';
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Question(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find question by ID: ${error.message}`);
    }
  }

  // 根据分类获取随机问题
  static async getRandomByCategory(category, excludeIds = []) {
    let sql = `
      SELECT * FROM questions 
      WHERE is_active = true
    `;
    let params = [];
    let paramIndex = 1;

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (excludeIds.length > 0) {
      sql += ` AND id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      params.push(...excludeIds);
      paramIndex += excludeIds.length;
    }

    sql += ` ORDER BY RANDOM() LIMIT 1`;

    try {
      const result = await query(sql, params);
      if (result.rows.length === 0) {
        return null;
      }
      return new Question(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to get random question: ${error.message}`);
    }
  }

  // 获取多个随机问题
  static async getRandomQuestions(count = 1, category = null, excludeIds = []) {
    let sql = `
      SELECT * FROM questions 
      WHERE is_active = true
    `;
    let params = [];
    let paramIndex = 1;

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (excludeIds.length > 0) {
      sql += ` AND id NOT IN (${excludeIds.map((_, i) => `$${paramIndex + i}`).join(', ')})`;
      params.push(...excludeIds);
      paramIndex += excludeIds.length;
    }

    sql += ` ORDER BY RANDOM() LIMIT $${paramIndex}`;
    params.push(count);

    try {
      const result = await query(sql, params);
      return result.rows.map(row => new Question(row));
    } catch (error) {
      throw new Error(`Failed to get random questions: ${error.message}`);
    }
  }

  // 根据分类获取问题列表
  static async findByCategory(category, limit = 50, offset = 0) {
    const sql = `
      SELECT * FROM questions 
      WHERE is_active = true AND category = $1
      ORDER BY usage_count ASC, created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await query(sql, [category, limit, offset]);
      return result.rows.map(row => new Question(row));
    } catch (error) {
      throw new Error(`Failed to find questions by category: ${error.message}`);
    }
  }

  // 获取所有分类
  static async getCategories() {
    const sql = `
      SELECT DISTINCT category, COUNT(*) as count
      FROM questions 
      WHERE is_active = true
      GROUP BY category
      ORDER BY count DESC
    `;
    
    try {
      const result = await query(sql);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get categories: ${error.message}`);
    }
  }

  // 搜索问题
  static async search(searchTerm, category = null, limit = 20) {
    let sql = `
      SELECT * FROM questions 
      WHERE is_active = true AND question_text ILIKE $1
    `;
    let params = [`%${searchTerm}%`];
    let paramIndex = 2;

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    sql += ` ORDER BY usage_count ASC LIMIT $${paramIndex}`;
    params.push(limit);

    try {
      const result = await query(sql, params);
      return result.rows.map(row => new Question(row));
    } catch (error) {
      throw new Error(`Failed to search questions: ${error.message}`);
    }
  }

  // 更新问题
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // 动态构建更新字段
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'choices' || key === 'tags') {
          fields.push(`${key} = $${paramIndex}`);
          values.push(JSON.stringify(updateData[key]));
        } else {
          fields.push(`${key} = $${paramIndex}`);
          values.push(updateData[key]);
        }
        paramIndex++;
      }
    });

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    const sql = `
      UPDATE questions 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);

    try {
      const result = await query(sql, values);
      if (result.rows.length === 0) {
        return null;
      }
      return new Question(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update question: ${error.message}`);
    }
  }

  // 增加使用次数
  static async incrementUsage(id) {
    const sql = `
      UPDATE questions 
      SET usage_count = usage_count + 1
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Question(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to increment usage count: ${error.message}`);
    }
  }

  // 删除问题（软删除，设置为不活跃）
  static async deactivate(id) {
    const sql = `
      UPDATE questions 
      SET is_active = false
      WHERE id = $1
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Question(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to deactivate question: ${error.message}`);
    }
  }

  // 获取热门问题
  static async getPopular(limit = 10, category = null) {
    let sql = `
      SELECT * FROM questions 
      WHERE is_active = true
    `;
    let params = [];
    let paramIndex = 1;

    if (category) {
      sql += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    sql += ` ORDER BY usage_count DESC LIMIT $${paramIndex}`;
    params.push(limit);

    try {
      const result = await query(sql, params);
      return result.rows.map(row => new Question(row));
    } catch (error) {
      throw new Error(`Failed to get popular questions: ${error.message}`);
    }
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      question_text: this.question_text,
      category: this.category,
      difficulty: this.difficulty,
      tags: this.tags,
      answer_type: this.answer_type,
      choices: this.choices,
      is_active: this.is_active,
      usage_count: this.usage_count,
      created_at: this.created_at
    };
  }
}

module.exports = Question;