const Question = require('../models/Question');
const DailyQuestion = require('../models/DailyQuestion');
const Answer = require('../models/Answer');
const Couple = require('../models/Couple');
const logger = require('../utils/logger');
const aiService = require('./aiService');
const analysisService = require('./analysisService');
const streakService = require('./streakService');

class QuestionService {
  /**
   * 获取今日问题
   * @param {string} coupleId - 情侣ID
   * @returns {Object} 今日问题信息
   */
  static async getTodayQuestion(coupleId) {
    try {
      logger.info(`Getting today's question for couple: ${coupleId}`);
      
      // 首先尝试获取已存在的今日问题
      let dailyQuestion = await DailyQuestion.getTodayQuestion(coupleId);
      
      // 如果没有今日问题，生成一个
      if (!dailyQuestion) {
        dailyQuestion = await this.generateTodayQuestion(coupleId);
      }
      
      // 获取情侣信息以确定用户回答状态
      const couple = await Couple.findById(coupleId);
      if (!couple) {
        throw new Error('Couple not found');
      }
      
      // 获取用户回答状态
      const answers = await Answer.findByCoupleAndQuestion(coupleId, dailyQuestion.question_id);
      const userAnswered = {};
      
      answers.forEach(answer => {
        userAnswered[answer.user_id] = {
          answered: true,
          answer: answer.answer_text,
          media_url: answer.media_url,
          created_at: answer.created_at
        };
      });
      
      return {
        question: {
          id: dailyQuestion.question_id,
          question_text: dailyQuestion.question_text,
          category: dailyQuestion.category,
          answer_type: dailyQuestion.answer_type,
          choices: dailyQuestion.choices
        },
        user1_answered: !!userAnswered[couple.user1_id],
        user2_answered: !!userAnswered[couple.user2_id],
        user1_answer: userAnswered[couple.user1_id] || null,
        user2_answer: userAnswered[couple.user2_id] || null,
        is_completed: dailyQuestion.is_completed,
        question_date: dailyQuestion.question_date
      };
    } catch (error) {
      logger.error(`Error getting today's question for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 生成今日问题
   * @param {string} coupleId - 情侣ID
   * @param {string} questionId - 可选，指定问题ID
   * @returns {Object} 生成的每日问题
   */
  static async generateTodayQuestion(coupleId, questionId = null) {
    try {
      logger.info(`Generating today's question for couple: ${coupleId}`);
      
      // 如果没有指定问题ID，使用智能选择逻辑
      if (!questionId) {
        questionId = await this.selectOptimalQuestion(coupleId);
      }
      
      // 创建每日问题记录
      const dailyQuestion = await DailyQuestion.create({
        couple_id: coupleId,
        question_id: questionId,
        question_date: new Date().toISOString().split('T')[0]
      });
      
      // 增加问题使用次数
      await Question.incrementUsage(questionId);
      
      logger.info(`Generated daily question ${dailyQuestion.id} for couple ${coupleId}`);
      return dailyQuestion;
    } catch (error) {
      logger.error(`Error generating today's question for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 智能选择最优问题
   * @param {string} coupleId - 情侣ID
   * @returns {string} 问题ID
   */
  static async selectOptimalQuestion(coupleId) {
    try {
      // 首先尝试AI生成个性化问题
      return await this.selectOptimalQuestionWithAI(coupleId);
    } catch (error) {
      logger.warn(`AI question generation failed for couple ${coupleId}, using fallback:`, error.message);
      // 降级到传统方法
      return await this.selectOptimalQuestionFallback(coupleId);
    }
  }

  /**
   * 使用AI生成个性化问题
   * @param {string} coupleId - 情侣ID
   * @returns {string} 问题ID
   */
  static async selectOptimalQuestionWithAI(coupleId) {
    try {
      // 获取情侣最近30天的回答历史
      const history = await analysisService.getCoupleHistory(coupleId, 30);
      
      // 检查是否有足够的历史记录（至少7天）
      if (history.length < 7) {
        logger.info(`Insufficient history for AI generation (${history.length} days), using fallback`);
        return await this.selectOptimalQuestionFallback(coupleId);
      }
      
      // 获取最近使用的问题ID用于去重
      const recentQuestions = await DailyQuestion.getHistory(coupleId, 30, 0);
      const usedQuestionTexts = recentQuestions.map(dq => dq.question_text);
      
      // 使用AI生成个性化问题
      const generatedQuestion = await aiService.generatePersonalizedQuestion(coupleId, history);
      
      // 检查问题是否与最近使用的问题重复
      const isDuplicate = this.checkQuestionDuplicate(generatedQuestion.question_text, usedQuestionTexts);
      if (isDuplicate) {
        logger.info(`Generated question is duplicate, using fallback`);
        return await this.selectOptimalQuestionFallback(coupleId);
      }
      
      // 创建新问题
      const question = await Question.create({
        question_text: generatedQuestion.question_text,
        category: generatedQuestion.category,
        difficulty: generatedQuestion.difficulty,
        tags: generatedQuestion.tags,
        answer_type: generatedQuestion.answer_type,
        is_active: true
      });
      
      logger.info(`Generated AI question ${question.id} for couple ${coupleId}`);
      return question.id;
      
    } catch (error) {
      logger.error(`AI question generation failed for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 传统问题选择方法（降级方案）
   * @param {string} coupleId - 情侣ID
   * @returns {string} 问题ID
   */
  static async selectOptimalQuestionFallback(coupleId) {
    try {
      // 获取情侣最近30天的问题历史
      const recentQuestions = await DailyQuestion.getHistory(coupleId, 30, 0);
      const excludeIds = recentQuestions.map(dq => dq.question_id);
      const usedQuestionTexts = recentQuestions.map(dq => dq.question_text);
      
      // 获取情侣回答统计，分析偏好
      const stats = await Answer.getStats(coupleId, 30);
      
      // 根据统计信息选择问题类别
      let preferredCategory = null;
      
      if (stats.avg_sentiment_score && stats.avg_sentiment_score < 50) {
        // 情感偏低，选择轻松有趣的问题
        preferredCategory = 'fun';
      } else if (stats.answer_days < 15) {
        // 参与度不高，选择简单的日常问题
        preferredCategory = 'daily';
      } else {
        // 正常情况，可以尝试情感类问题
        preferredCategory = 'emotion';
      }
      
      // 尝试获取偏好类别的问题
      let question = await Question.getRandomByCategory(preferredCategory, excludeIds);
      
      // 如果没有找到，获取任意类别的问题
      if (!question) {
        question = await Question.getRandomByCategory(null, excludeIds);
      }
      
      // 检查问题文本是否重复
      if (question && this.checkQuestionDuplicate(question.question_text, usedQuestionTexts)) {
        // 如果重复，再次尝试获取不同问题
        question = await Question.getRandomByCategory(null, excludeIds);
      }
      
      if (!question) {
        throw new Error('No available questions found');
      }
      
      return question.id;
    } catch (error) {
      logger.error(`Fallback question selection failed for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 检查问题是否重复
   * @param {string} questionText - 新问题文本
   * @param {Array} usedTexts - 已使用的问题文本列表
   * @returns {boolean} 是否重复
   */
  static checkQuestionDuplicate(questionText, usedTexts) {
    if (!usedTexts || usedTexts.length === 0) {
      return false;
    }
    
    // 简单的文本相似度检查
    const normalizedNew = questionText.replace(/[？?。！!，,]/g, '').trim().toLowerCase();
    
    return usedTexts.some(usedText => {
      const normalizedUsed = usedText.replace(/[？?。！!，,]/g, '').trim().toLowerCase();
      
      // 检查是否完全相同
      if (normalizedNew === normalizedUsed) {
        return true;
      }
      
      // 检查相似度（简单的字符重叠度）
      const similarity = this.calculateTextSimilarity(normalizedNew, normalizedUsed);
      return similarity > 0.8; // 80%相似度阈值
    });
  }

  /**
   * 计算文本相似度
   * @param {string} text1 - 文本1
   * @param {string} text2 - 文本2
   * @returns {number} 相似度（0-1）
   */
  static calculateTextSimilarity(text1, text2) {
    const words1 = text1.split('');
    const words2 = text2.split('');
    
    const intersection = words1.filter(word => words2.includes(word));
    const union = [...new Set([...words1, ...words2])];
    
    return intersection.length / union.length;
  }

  /**
   * 提交回答
   * @param {string} coupleId - 情侣ID
   * @param {string} userId - 用户ID
   * @param {string} questionId - 问题ID
   * @param {Object} answerData - 回答数据
   * @returns {Object} 提交的回答
   */
  static async submitAnswer(coupleId, userId, questionId, answerData) {
    try {
      logger.info(`Submitting answer for couple ${coupleId}, user ${userId}, question ${questionId}`);
      
      const { answer_text, media_url, answer_type = 'text' } = answerData;
      
      // 验证用户是否属于该情侣
      const couple = await Couple.findById(coupleId);
      if (!couple || !couple.isUserInCouple(userId)) {
        throw new Error('User is not part of this couple');
      }
      
      // 获取问题信息
      const question = await Question.findById(questionId);
      if (!question) {
        throw new Error('Question not found');
      }
      
      // 检查用户是否已经回答过这个问题
      const existingAnswer = await Answer.findByUserAndQuestion(userId, questionId);
      if (existingAnswer) {
        throw new Error('User has already answered this question');
      }
      
      // 创建回答记录
      const answer = await Answer.create({
        couple_id: coupleId,
        user_id: userId,
        question_id: questionId,
        question_text: question.question_text,
        answer_type,
        answer_text,
        media_url,
        answer_date: new Date().toISOString().split('T')[0]
      });
      
      // 更新每日问题的回答状态
      await DailyQuestion.updateAnswerStatus(coupleId, questionId, userId);
      
      // 异步分析回答（情感分析等）
      this.analyzeAnswerAsync(answer.id, answer_text);

      // 记录打卡
      const streakResult = await streakService.recordStreak(userId, coupleId);

      logger.info(`Answer submitted successfully: ${answer.id}, streak: ${streakResult.streak_count}`);
      return {
        ...answer.toJSON(),
        streak: streakResult
      };
    } catch (error) {
      logger.error(`Error submitting answer:`, error);
      throw error;
    }
  }

  /**
   * 异步分析回答
   * @param {string} answerId - 回答ID
   * @param {string} answerText - 回答文本
   */
  static async analyzeAnswerAsync(answerId, answerText) {
    try {
      let analysis = null;
      
      // 首先尝试使用心流API进行情感分析
      try {
        analysis = await aiService.analyzeSentiment(answerText);
        logger.info(`Answer analyzed with AI: ${answerId}`, analysis);
      } catch (aiError) {
        logger.warn(`AI sentiment analysis failed for answer ${answerId}, using fallback:`, aiError.message);
        // 降级到简单关键词分析
        analysis = this.simpleSentimentAnalysis(answerText);
      }
      
      if (analysis) {
        await Answer.analyzeAnswer(answerId, analysis);
        logger.info(`Answer analyzed: ${answerId}`, analysis);
      }
    } catch (error) {
      logger.error(`Error analyzing answer ${answerId}:`, error);
      // 分析失败不影响主流程
    }
  }

  /**
   * 简单的情感分析
   * @param {string} text - 文本内容
   * @returns {Object} 分析结果
   */
  static simpleSentimentAnalysis(text) {
    if (!text) return null;
    
    const positiveWords = ['开心', '快乐', '幸福', '爱', '喜欢', '美好', '棒', '好', '满意'];
    const negativeWords = ['难过', '伤心', '生气', '讨厌', '糟糕', '差', '不好', '失望'];
    
    const positiveCount = positiveWords.filter(word => text.includes(word)).length;
    const negativeCount = negativeWords.filter(word => text.includes(word)).length;
    
    let sentiment = 'neutral';
    let score = 50;
    
    if (positiveCount > negativeCount) {
      sentiment = 'positive';
      score = Math.min(50 + positiveCount * 10, 100);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      score = Math.max(50 - negativeCount * 10, 0);
    }
    
    // 提取关键词
    const keywords = text.replace(/[，。！？；：""''（）《》【】、]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1)
      .slice(0, 5);
    
    return {
      sentiment,
      sentiment_score: score,
      keywords
    };
  }

  /**
   * 获取历史问题
   * @param {string} coupleId - 情侣ID
   * @param {number} limit - 限制数量
   * @param {number} offset - 偏移量
   * @returns {Array} 历史问题列表
   */
  static async getHistory(coupleId, limit = 30, offset = 0) {
    try {
      logger.info(`Getting question history for couple: ${coupleId}`);
      
      const dailyQuestions = await DailyQuestion.getHistory(coupleId, limit, offset);
      
      // 获取每个问题的回答详情
      const result = await Promise.all(
        dailyQuestions.map(async (dq) => {
          const answers = await Answer.findByCoupleAndQuestion(coupleId, dq.question_id);
          
          return {
            id: dq.id,
            question: {
              id: dq.question_id,
              question_text: dq.question_text,
              category: dq.category,
              answer_type: dq.answer_type
            },
            question_date: dq.question_date,
            is_completed: dq.is_completed,
            answers: answers.map(answer => answer.toDetailedJSON())
          };
        })
      );
      
      return result;
    } catch (error) {
      logger.error(`Error getting question history for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 获取问题统计
   * @param {string} coupleId - 情侣ID
   * @param {number} days - 统计天数
   * @returns {Object} 统计信息
   */
  static async getStats(coupleId, days = 30) {
    try {
      logger.info(`Getting question stats for couple: ${coupleId}`);
      
      const [dailyStats, answerStats, trend] = await Promise.all([
        DailyQuestion.getAnswerStats(coupleId, days),
        Answer.getStats(coupleId, days),
        Answer.getTrend(coupleId, days)
      ]);
      
      return {
        daily_questions: dailyStats,
        answers: answerStats,
        trend: trend
      };
    } catch (error) {
      logger.error(`Error getting question stats for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 批量为所有活跃情侣生成每日问题
   * @returns {Object} 生成结果
   */
  static async generateDailyQuestionsForAll() {
    try {
      logger.info('Generating daily questions for all active couples');
      
      const result = await DailyQuestion.generateForAllActiveCouples();
      
      logger.info(`Daily questions generated:`, {
        total_processed: result.total_processed,
        success_count: result.success.length,
        error_count: result.errors.length
      });
      
      return result;
    } catch (error) {
      logger.error('Error generating daily questions for all couples:', error);
      throw error;
    }
  }
}

module.exports = QuestionService;