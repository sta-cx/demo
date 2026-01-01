const { query } = require('../utils/database');
const Question = require('./Question');

class DailyQuestion {
  constructor(data) {
    this.id = data.id;
    this.couple_id = data.couple_id;
    this.question_id = data.question_id;
    this.question_date = data.question_date;
    this.question_text = data.question_text;
    this.category = data.category;
    this.is_completed = data.is_completed;
    this.user1_answered = data.user1_answered;
    this.user2_answered = data.user2_answered;
    this.created_at = data.created_at;
  }

  // 创建每日问题
  static async create(dailyQuestionData) {
    const { couple_id, question_id, question_date } = dailyQuestionData;
    
    const sql = `
      INSERT INTO daily_questions (couple_id, question_id, question_date)
      VALUES ($1, $2, $3)
      ON CONFLICT (couple_id, question_date) DO NOTHING
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [couple_id, question_id, question_date]);
      if (result.rows.length === 0) {
        return null; // 已存在相同日期的问题
      }
      return new DailyQuestion(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create daily question: ${error.message}`);
    }
  }

  // 根据ID查找每日问题
  static async findById(id) {
    const sql = `
      SELECT dq.*, q.question_text, q.category, q.answer_type, q.choices,
             a1.answer_text as user1_answer, a1.created_at as user1_answer_time,
             a2.answer_text as user2_answer, a2.created_at as user2_answer_time
      FROM daily_questions dq
      LEFT JOIN questions q ON dq.question_id = q.id
      LEFT JOIN answers a1 ON dq.question_id = a1.question_id AND a1.user_id = (
        SELECT user1_id FROM couples WHERE id = dq.couple_id
      )
      LEFT JOIN answers a2 ON dq.question_id = a2.question_id AND a2.user_id = (
        SELECT user2_id FROM couples WHERE id = dq.couple_id
      )
      WHERE dq.id = $1
    `;
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new DailyQuestion(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to find daily question by ID: ${error.message}`);
    }
  }

  // 获取情侣今日问题
  static async getTodayQuestion(coupleId) {
    const sql = `
      SELECT dq.*, q.question_text, q.category, q.answer_type, q.choices,
             a1.answer_text as user1_answer, a1.created_at as user1_answer_time,
             a2.answer_text as user2_answer, a2.created_at as user2_answer_time
      FROM daily_questions dq
      LEFT JOIN questions q ON dq.question_id = q.id
      LEFT JOIN answers a1 ON dq.question_id = a1.question_id AND a1.user_id = (
        SELECT user1_id FROM couples WHERE id = dq.couple_id
      )
      LEFT JOIN answers a2 ON dq.question_id = a2.question_id AND a2.user_id = (
        SELECT user2_id FROM couples WHERE id = dq.couple_id
      )
      WHERE dq.couple_id = $1 AND dq.question_date = CURRENT_DATE
    `;
    
    try {
      const result = await query(sql, [coupleId]);
      if (result.rows.length === 0) {
        return null;
      }
      return new DailyQuestion(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to get today's question: ${error.message}`);
    }
  }

  // 获取情侣指定日期的问题
  static async getQuestionByDate(coupleId, date) {
    const sql = `
      SELECT dq.*, q.question_text, q.category, q.answer_type, q.choices,
             a1.answer_text as user1_answer, a1.created_at as user1_answer_time,
             a2.answer_text as user2_answer, a2.created_at as user2_answer_time
      FROM daily_questions dq
      LEFT JOIN questions q ON dq.question_id = q.id
      LEFT JOIN answers a1 ON dq.question_id = a1.question_id AND a1.user_id = (
        SELECT user1_id FROM couples WHERE id = dq.couple_id
      )
      LEFT JOIN answers a2 ON dq.question_id = a2.question_id AND a2.user_id = (
        SELECT user2_id FROM couples WHERE id = dq.couple_id
      )
      WHERE dq.couple_id = $1 AND dq.question_date = $2
    `;
    
    try {
      const result = await query(sql, [coupleId, date]);
      if (result.rows.length === 0) {
        return null;
      }
      return new DailyQuestion(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to get question by date: ${error.message}`);
    }
  }

  // 获取情侣历史问题列表
  static async getHistory(coupleId, limit = 30, offset = 0) {
    const sql = `
      SELECT dq.*, q.question_text, q.category, q.answer_type,
             a1.answer_text as user1_answer, a1.created_at as user1_answer_time,
             a2.answer_text as user2_answer, a2.created_at as user2_answer_time
      FROM daily_questions dq
      LEFT JOIN questions q ON dq.question_id = q.id
      LEFT JOIN answers a1 ON dq.question_id = a1.question_id AND a1.user_id = (
        SELECT user1_id FROM couples WHERE id = dq.couple_id
      )
      LEFT JOIN answers a2 ON dq.question_id = a2.question_id AND a2.user_id = (
        SELECT user2_id FROM couples WHERE id = dq.couple_id
      )
      WHERE dq.couple_id = $1
      ORDER BY dq.question_date DESC
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await query(sql, [coupleId, limit, offset]);
      return result.rows.map(row => new DailyQuestion(row));
    } catch (error) {
      throw new Error(`Failed to get daily question history: ${error.message}`);
    }
  }

  // 更新回答状态
  static async updateAnswerStatus(coupleId, questionId, userId) {
    // 首先获取情侣信息
    const coupleSql = 'SELECT user1_id, user2_id FROM couples WHERE id = $1';
    const coupleResult = await query(coupleSql, [coupleId]);
    
    if (coupleResult.rows.length === 0) {
      throw new Error('Couple not found');
    }
    
    const { user1_id, user2_id } = coupleResult.rows[0];
    const isUser1 = userId === user1_id;
    const userField = isUser1 ? 'user1_answered' : 'user2_answered';
    
    const sql = `
      UPDATE daily_questions 
      SET ${userField} = true,
          is_completed = (
            SELECT CASE 
              WHEN COUNT(*) = 2 THEN true 
              ELSE false 
            END
            FROM (
              SELECT user1_answered as answered FROM daily_questions 
              WHERE couple_id = $1 AND question_id = $2
              UNION ALL
              SELECT user2_answered as answered FROM daily_questions 
              WHERE couple_id = $1 AND question_id = $2
            ) answers
            WHERE answered = true OR ($3 = true AND answered = false)
          )
      WHERE couple_id = $1 AND question_id = $2
      RETURNING *
    `;
    
    try {
      const result = await query(sql, [coupleId, questionId, isUser1]);
      if (result.rows.length === 0) {
        return null;
      }
      return new DailyQuestion(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update answer status: ${error.message}`);
    }
  }

  // 生成今日问题（如果不存在）
  static async generateTodayQuestion(coupleId, questionId = null) {
    // 检查今日是否已有问题
    const existingSql = `
      SELECT id FROM daily_questions 
      WHERE couple_id = $1 AND question_date = CURRENT_DATE
    `;
    const existingResult = await query(existingSql, [coupleId]);
    
    if (existingResult.rows.length > 0) {
      return new DailyQuestion(existingResult.rows[0]);
    }
    
    // 如果没有指定问题ID，随机选择一个
    if (!questionId) {
      // 获取最近30天使用过的问题ID
      const recentQuestionsSql = `
        SELECT DISTINCT question_id 
        FROM daily_questions 
        WHERE couple_id = $1 AND question_date >= CURRENT_DATE - INTERVAL '30 days'
      `;
      const recentResult = await query(recentQuestionsSql, [coupleId]);
      const excludeIds = recentResult.rows.map(row => row.question_id);
      
      const question = await Question.getRandomByCategory(null, excludeIds);
      if (!question) {
        throw new Error('No available questions found');
      }
      questionId = question.id;
    }
    
    // 创建今日问题
    return await DailyQuestion.create({
      couple_id: coupleId,
      question_id: questionId,
      question_date: new Date().toISOString().split('T')[0]
    });
  }

  // 批量生成活跃情侣的每日问题
  static async generateForAllActiveCouples() {
    // 获取所有活跃情侣
    const couplesSql = 'SELECT id FROM couples WHERE status = \'active\'';
    const couplesResult = await query(couplesSql);
    
    const results = [];
    const errors = [];
    
    for (const couple of couplesResult.rows) {
      try {
        const dailyQuestion = await DailyGenerateTodayQuestion(couple.id);
        if (dailyQuestion) {
          results.push({
            couple_id: couple.id,
            daily_question_id: dailyQuestion.id,
            status: 'success'
          });
        } else {
          results.push({
            couple_id: couple.id,
            status: 'already_exists'
          });
        }
      } catch (error) {
        errors.push({
          couple_id: couple.id,
          error: error.message
        });
      }
    }
    
    return {
      success: results,
      errors: errors,
      total_processed: couplesResult.rows.length
    };
  }

  // 获取情侣回答统计
  static async getAnswerStats(coupleId, days = 30) {
    const sql = `
      SELECT 
        COUNT(*) as total_questions,
        COUNT(CASE WHEN is_completed THEN 1 END) as completed_questions,
        COUNT(CASE WHEN user1_answered THEN 1 END) as user1_answered_count,
        COUNT(CASE WHEN user2_answered THEN 1 END) as user2_answered_count,
        COUNT(CASE WHEN is_completed AND user1_answered AND user2_answered THEN 1 END) as both_answered_count,
        ROUND(
          COUNT(CASE WHEN is_completed THEN 1 END) * 100.0 / COUNT(*), 2
        ) as completion_rate
      FROM daily_questions
      WHERE couple_id = $1 
        AND question_date >= CURRENT_DATE - INTERVAL '${days} days'
    `;
    
    try {
      const result = await query(sql, [coupleId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to get answer stats: ${error.message}`);
    }
  }

  // 获取历史问题
  static async getHistory(coupleId, limit = 30, offset = 0) {
    const sql = `
      SELECT dq.*, q.question_text, q.category, q.answer_type, q.choices
      FROM daily_questions dq
      LEFT JOIN questions q ON dq.question_id = q.id
      WHERE dq.couple_id = $1
      ORDER BY dq.question_date DESC, dq.created_at DESC
      LIMIT $2 OFFSET $3
    `;
    
    try {
      const result = await query(sql, [coupleId, limit, offset]);
      return result.rows.map(row => new DailyQuestion(row));
    } catch (error) {
      throw new Error(`Failed to get daily question history: ${error.message}`);
    }
  }

  // 删除每日问题
  static async delete(id) {
    const sql = 'DELETE FROM daily_questions WHERE id = $1 RETURNING *';
    
    try {
      const result = await query(sql, [id]);
      if (result.rows.length === 0) {
        return null;
      }
      return new DailyQuestion(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to delete daily question: ${error.message}`);
    }
  }

  // 转换为JSON对象
  toJSON() {
    return {
      id: this.id,
      couple_id: this.couple_id,
      question_id: this.question_id,
      question_date: this.question_date,
      is_completed: this.is_completed,
      user1_answered: this.user1_answered,
      user2_answered: this.user2_answered,
      created_at: this.created_at
    };
  }

  // 转换为详细JSON对象（包含问题和回答信息）
  toDetailedJSON() {
    return {
      id: this.id,
      couple_id: this.couple_id,
      question_id: this.question_id,
      question_text: this.question_text,
      question_category: this.category,
      question_answer_type: this.answer_type,
      question_choices: this.choices,
      question_date: this.question_date,
      is_completed: this.is_completed,
      user1_answered: this.user1_answered,
      user2_answered: this.user2_answered,
      user1_answer: this.user1_answer,
      user2_answer: this.user2_answer,
      user1_answer_time: this.user1_answer_time,
      user2_answer_time: this.user2_answer_time,
      created_at: this.created_at
    };
  }
}

module.exports = DailyQuestion;