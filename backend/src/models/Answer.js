const { query } = require('../utils/database');

class Answer {
  constructor(data) {
    this.id = data.id;
    this.couple_id = data.couple_id;
    this.user_id = data.user_id;
    this.question_id = data.question_id;
    this.question_text = data.question_text;
    this.answer_type = data.answer_type;
    this.answer_text = data.answer_text;
    this.media_url = data.media_url;
    this.sentiment = data.sentiment;
    this.sentiment_score = data.sentiment_score;
    this.keywords = data.keywords;
    this.answer_date = data.answer_date;
    this.is_skipped = data.is_skipped;
    this.created_at = data.created_at;
  }

  // 创建新回答
  static async create(answerData) {
    const { 
      couple_id, 
      user_id, 
      question_id, 
      question_text, 
      answer_type, 
      answer_text, 
      media_url, 
      sentiment, 
      sentiment_score, 
      keywords, 
      answer_date, 
      is_skipped 
    } = answerData;
    
    const sql = `
      INSERT INTO answers (
        couple_id, user_id, question_id, question_text, answer_type,
        answer_text, media_url, sentiment, sentiment_score, keywords,
        answer_date, is_skipped
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [
        couple_id,
        user_id,
        question_id,
        question_text,
        answer_type || 'text',
        answer_text,
        media_url,
        sentiment,
        sentiment_score,
        keywords,
        answer_date || new Date().toISOString().split('T')[0],
        is_skipped || false
      ]);
      return new Answer(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create answer: ${error.message}`);
    }
  }

  // 根据ID查找回答
  static async findById(id) {
    const sql = `
      SELECT a.*, 
             u.nickname as user_nickname, u.avatar_url as user_avatar_url,
             q.category as question_category
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE a.id = $1
    `;
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Answer(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find answer by ID: ${error.message}`);
    }
  }

  // 获取情侣的回答列表
  static async findByCouple(coupleId, limit = 30, offset = 0) {
    const sql = `
      SELECT a.*,
             u.nickname as user_nickname, u.avatar_url as user_avatar_url,
             q.category as question_category
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE a.couple_id = $1
      ORDER BY a.answer_date DESC, a.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    try {
      const result = await query(sql, [coupleId, limit, offset]);
      return result.rows.map(row => new Answer(row));
    } catch (error) {
      throw new Error(`Failed to find answers by couple: ${error.message}`);
    }
  }

  // 获取情侣在指定天数内的回答（带完整JOIN数据，避免N+1查询）
  static async findByCoupleWithDays(coupleId, days = 30) {
    const sql = `
      SELECT a.*,
             u.nickname as user_nickname, u.avatar_url as user_avatar_url,
             q.category as question_category,
             q.question_text as original_question_text
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE a.couple_id = $1
        AND a.answer_date >= CURRENT_DATE - INTERVAL '${days} days'
      ORDER BY a.answer_date DESC, a.created_at DESC
    `;

    try {
      const result = await query(sql, [coupleId]);
      return result.rows.map(row => new Answer(row));
    } catch (error) {
      throw new Error(`Failed to find answers by couple with days filter: ${error.message}`);
    }
  }

  // 获取用户对特定问题的回答
  static async findByUserAndQuestion(userId, questionId) {
    const sql = `
      SELECT * FROM answers 
      WHERE user_id = $1 AND question_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    
    try {
      const result = await query(sql, [userId, questionId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Answer(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find answer by user and question: ${error.message}`);
    }
  }

  // 获取情侣对特定问题的回答
  static async findByCoupleAndQuestion(coupleId, questionId) {
    const sql = `
      SELECT a.*, 
             u.nickname as user_nickname, u.avatar_url as user_avatar_url
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.couple_id = $1 AND a.question_id = $2
      ORDER BY a.created_at ASC
    `;
    
    try {
      const result = await query(sql, [coupleId, questionId]);
      return result.rows.map(row => new Answer(row));
    } catch (error) {
      throw new Error(`Failed to find answers by couple and question: ${error.message}`);
    }
  }

  // 获取今日回答
  static async getTodayAnswers(coupleId) {
    const sql = `
      SELECT a.*, 
             u.nickname as user_nickname, u.avatar_url as user_avatar_url,
             q.category as question_category
      FROM answers a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE a.couple_id = $1 AND a.answer_date = CURRENT_DATE
      ORDER BY a.created_at DESC
    `;
    
    try {
      const result = await query(sql, [coupleId]);
      return result.rows.map(row => new Answer(row));
    } catch (error) {
      throw new Error(`Failed to get today's answers: ${error.message}`);
    }
  }

  // 获取回答统计
  static async getStats(coupleId, days = 30) {
    const sql = `
      SELECT 
        COUNT(*) as total_answers,
        COUNT(DISTINCT answer_date) as answer_days,
        COUNT(DISTINCT user_id) as active_users,
        AVG(sentiment_score) as avg_sentiment_score,
        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment = 'neutral' THEN 1 END) as neutral_count,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END) as negative_count,
        COUNT(CASE WHEN is_skipped = true THEN 1 END) as skipped_count
      FROM answers
      WHERE couple_id = $1 
        AND answer_date >= CURRENT_DATE - INTERVAL '${days} days'
    `;
    
    try {
      const result = await query(sql, [coupleId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get answer stats: ${error.message}`);
    }
  }

  // 更新回答
  static async update(id, updateData) {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    // 动态构建更新字段
    Object.keys(updateData).forEach(key => {
      if (updateData[key] !== undefined) {
        if (key === 'keywords') {
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
      UPDATE answers 
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
      return new Answer(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update answer: ${error.message}`);
    }
  }

  // 删除回答
  static async delete(id) {
    const sql = 'DELETE FROM answers WHERE id = $1 RETURNING *';
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Answer(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to delete answer: ${error.message}`);
    }
  }

  // 分析回答情感和关键词
  static async analyzeAnswer(answerId, analysisResult) {
    const { sentiment, sentiment_score, keywords } = analysisResult;
    
    const sql = `
      UPDATE answers 
      SET sentiment = $1, sentiment_score = $2, keywords = $3
      WHERE id = $4
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [
        sentiment,
        sentiment_score,
        keywords ? JSON.stringify(keywords) : null,
        answerId
      ]);
      if (result.rows.length === 0) {
        return null;
      }
      return new Answer(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to analyze answer: ${error.message}`);
    }
  }

  // 根据日期范围获取回答
  static async findByDateRange(coupleId, startDate, endDate) {
    const sql = `
      SELECT * FROM answers 
      WHERE couple_id = $1 
        AND answer_date >= $2 
        AND answer_date <= $3
      ORDER BY answer_date ASC, created_at ASC
    `;
    
    try {
      const result = await query(sql, [coupleId, startDate, endDate]);
      return result.rows.map(row => new Answer(row));
    } catch (error) {
      throw new Error(`Failed to find answers by date range: ${error.message}`);
    }
  }

  

  // 获取回答历史趋势
  static async getTrend(coupleId, days = 30) {
    const sql = `
      SELECT 
        answer_date,
        COUNT(*) as daily_count,
        AVG(sentiment_score) as avg_sentiment,
        COUNT(CASE WHEN sentiment = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN sentiment = 'negative' THEN 1 END) as negative_count
      FROM answers
      WHERE couple_id = $1 
        AND answer_date >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY answer_date
      ORDER BY answer_date DESC
    `;
    
    try {
      const result = await query(sql, [coupleId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Failed to get answer trend: ${error.message}`);
    }
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      couple_id: this.couple_id,
      user_id: this.user_id,
      question_id: this.question_id,
      question_text: this.question_text,
      answer_type: this.answer_type,
      answer_text: this.answer_text,
      media_url: this.media_url,
      sentiment: this.sentiment,
      sentiment_score: this.sentiment_score,
      keywords: this.keywords,
      answer_date: this.answer_date,
      is_skipped: this.is_skipped,
      created_at: this.created_at
    };
  }

  // 转换为详细JSON对象（包含用户信息）
  toDetailedJSON() {
    return {
      id: this.id,
      couple_id: this.couple_id,
      user_id: this.user_id,
      user_nickname: this.user_nickname,
      user_avatar_url: this.user_avatar_url,
      question_id: this.question_id,
      question_text: this.question_text,
      question_category: this.question_category,
      answer_type: this.answer_type,
      answer_text: this.answer_text,
      media_url: this.media_url,
      sentiment: this.sentiment,
      sentiment_score: this.sentiment_score,
      keywords: this.keywords,
      answer_date: this.answer_date,
      is_skipped: this.is_skipped,
      created_at: this.created_at
    };
  }
}

module.exports = Answer;