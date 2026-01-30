// backend/src/utils/aiFallback.js
const Question = require('../models/Question');
const logger = require('./logger');

class AIFallback {
  /**
   * 生成问题的降级策略
   * 1. 心流API（主）
   * 2. Ollama本地（备）
   * 3. 预设问题库（兜底）
   */
  static async generateQuestionWithFallback(coupleId, history, primaryAI, secondaryAI) {
    let lastError = null;

    // 第一层：心流API
    try {
      logger.info('Attempting primary AI (iFlow)...');
      const result = await primaryAI.generatePersonalizedQuestion(coupleId, history);
      return {
        source: 'iflow',
        ...result
      };
    } catch (error) {
      lastError = error;
      logger.warn('Primary AI (iFlow) failed, trying secondary...', {
        error: error.message
      });
    }

    // 第二层：Ollama本地
    try {
      const ollamaAvailable = await secondaryAI.isAvailable();
      if (ollamaAvailable) {
        logger.info('Attempting secondary AI (Ollama)...');
        const questionText = await secondaryAI.generateQuestion(
          this.buildSimplePrompt(history)
        );

        return {
          question_text: questionText,
          category: 'ai_generated',
          difficulty: 2,
          tags: ['本地生成', '备用'],
          answer_type: 'text',
          source: 'ollama'
        };
      }
    } catch (error) {
      lastError = error;
      logger.warn('Secondary AI (Ollama) failed, using preset questions...', {
        error: error.message
      });
    }

    // 第三层：预设问题库
    logger.info('Using preset question database as final fallback...');
    return await this.getPresetQuestion(coupleId, history);
  }

  /**
   * 情感分析的降级策略
   */
  static async analyzeSentimentWithFallback(text, primaryAI, secondaryAI) {
    // 第一层：心流API
    try {
      return await primaryAI.analyzeSentiment(text);
    } catch (error) {
      logger.warn('Primary AI sentiment analysis failed, trying Ollama...', {
        error: error.message
      });
    }

    // 第二层：Ollama本地
    try {
      const ollamaAvailable = await secondaryAI.isAvailable();
      if (ollamaAvailable) {
        return await secondaryAI.analyzeSentiment(text);
      }
    } catch (error) {
      logger.warn('Ollama sentiment analysis failed, using simple analysis...', {
        error: error.message
      });
    }

    // 第三层：简单关键词分析
    return this.simpleSentimentAnalysis(text);
  }

  /**
   * 从预设问题库获取问题
   */
  static async getPresetQuestion(coupleId, history) {
    try {
      // 根据历史分析选择类别
      const category = this.selectCategoryFromHistory(history);

      // 获取该类别最少使用的问题
      const question = await Question.getRandomByCategory(category);

      if (!question) {
        // 如果该类别没有问题，获取任意问题
        const anyQuestion = await Question.getRandomByCategory(null);
        if (!anyQuestion) {
          throw new Error('No preset questions available in database');
        }
        return {
          question_text: anyQuestion.question_text,
          category: anyQuestion.category,
          difficulty: anyQuestion.difficulty,
          tags: anyQuestion.tags,
          answer_type: anyQuestion.answer_type,
          source: 'preset'
        };
      }

      return {
        question_text: question.question_text,
        category: question.category,
        difficulty: question.difficulty,
        tags: question.tags,
        answer_type: question.answer_type,
        source: 'preset'
      };
    } catch (error) {
      logger.error('Failed to get preset question:', error);
      // 最终兜底：返回默认问题
      return {
        question_text: '今天最开心的一件事是什么？',
        category: 'daily',
        difficulty: 1,
        tags: ['日常', '快乐'],
        answer_type: 'text',
        source: 'default'
      };
    }
  }

  /**
   * 根据历史选择问题类别
   */
  static selectCategoryFromHistory(history) {
    if (!history || history.length === 0) {
      return 'daily';
    }

    // 计算平均情感分数
    const avgSentiment = history.reduce((sum, h) => {
      return sum + (h.sentiment_score || 50);
    }, 0) / history.length;

    if (avgSentiment < 50) {
      return 'fun'; // 情感低，选有趣的问题
    } else if (avgSentiment > 70) {
      return 'future'; // 情感高，可以聊未来
    } else {
      return 'emotion'; // 中等情感，聊情感话题
    }
  }

  /**
   * 构建简单提示词
   */
  static buildSimplePrompt(history) {
    const basePrompt = '为一对情侣生成一个温馨有趣的日常问题。';

    if (history && history.length > 0) {
      const recentTopics = history.slice(-3).flatMap(h => h.keywords || []).slice(0, 5);
      if (recentTopics.length > 0) {
        return `${basePrompt} 最近关心的话题：${recentTopics.join('、')}。问题要温馨有趣，控制在20字以内。`;
      }
    }

    return basePrompt;
  }

  /**
   * 简单情感分析
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
}

module.exports = AIFallback;
