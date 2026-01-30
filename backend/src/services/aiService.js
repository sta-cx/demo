const iflowClient = require('../utils/iflowClient');
const logger = require('../utils/logger');
const Question = require('../models/Question');
const ollamaClient = require('../utils/ollamaClient');
const AIFallback = require('../utils/aiFallback');

class AIService {
  constructor() {
    this.rateLimit = {
      requests: 0,
      windowStart: Date.now(),
      maxRequests: 100, // 每分钟最大请求数
      windowMs: 60000 // 1分钟窗口
    };
    
    this.usageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastReset: Date.now()
    };
  }

  /**
   * 检查API速率限制
   */
  checkRateLimit() {
    const now = Date.now();
    
    // 重置窗口
    if (now - this.rateLimit.windowStart >= this.rateLimit.windowMs) {
      this.rateLimit.requests = 0;
      this.rateLimit.windowStart = now;
    }
    
    if (this.rateLimit.requests >= this.rateLimit.maxRequests) {
      const waitTime = this.rateLimit.windowMs - (now - this.rateLimit.windowStart);
      throw new Error(`Rate limit exceeded. Wait ${Math.ceil(waitTime / 1000)} seconds`);
    }
    
    this.rateLimit.requests++;
  }

  /**
   * 更新使用统计
   */
  updateStats(success) {
    this.usageStats.totalRequests++;
    if (success) {
      this.usageStats.successfulRequests++;
    } else {
      this.usageStats.failedRequests++;
    }
  }

  /**
   * 基于历史回答生成个性化问题（带降级策略）
   */
  async generatePersonalizedQuestion(coupleId, history) {
    try {
      this.checkRateLimit();

      // 使用降级策略
      const result = await AIFallback.generateQuestionWithFallback(
        coupleId,
        history,
        this,  // 主AI (iFlow)
        ollamaClient  // 备用AI (Ollama)
      );

      // 更新统计（只计成功）
      this.updateStats(true);
      logger.info('Generated question with fallback strategy', {
        coupleId,
        source: result.source,
        length: result.question_text.length
      });

      return result;

    } catch (error) {
      this.updateStats(false);
      logger.error('All AI fallback strategies failed', { coupleId, error: error.message });
      throw error;
    }
  }

  /**
   * 心流API直接生成问题（供降级策略调用）
   */
  async generatePersonalizedQuestionInternal(coupleId, history) {
    // 分析历史数据
    const analysis = this.analyzeHistory(history);

    // 构建提示词
    const prompt = this.buildQuestionPrompt(analysis);

    // 调用AI生成问题
    const questionText = await iflowClient.generateQuestion(prompt, {
      temperature: 0.8,
      max_tokens: 100
    });

    // 验证生成的问题
    const validatedQuestion = this.validateQuestion(questionText);

    logger.info('Generated personalized question via iFlow', { coupleId, length: questionText.length });

    return {
      question_text: validatedQuestion,
      category: 'ai_generated',
      difficulty: this.calculateDifficulty(analysis),
      tags: this.extractTags(analysis),
      answer_type: 'text'
    };
  }

  /**
   * 分析历史数据
   */
  analyzeHistory(history) {
    if (!history || history.length === 0) {
      return {
        topics: [],
        sentiment: 'neutral',
        avgAnswerLength: 0,
        questionTypes: {},
        recentKeywords: []
      };
    }

    // 提取所有关键词
    const allKeywords = history.flatMap(h => h.keywords || []);
    const keywordFreq = {};
    allKeywords.forEach(keyword => {
      keywordFreq[keyword] = (keywordFreq[keyword] || 0) + 1;
    });
    
    // 获取最常见的关键词
    const recentKeywords = Object.entries(keywordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([keyword]) => keyword);

    // 分析情感分布
    const sentimentCounts = history.reduce((acc, h) => {
      acc[h.sentiment || 'neutral'] = (acc[h.sentiment || 'neutral'] || 0) + 1;
      return acc;
    }, {});
    
    const dominantSentiment = Object.entries(sentimentCounts)
      .sort((a, b) => b[1] - a[1])[0][0];

    // 计算平均回答长度
    const avgAnswerLength = history.reduce((sum, h) => {
      return sum + (h.answer_text ? h.answer_text.length : 0);
    }, 0) / history.length;

    // 分析问题类型分布
    const questionTypes = history.reduce((acc, h) => {
      const category = h.category || 'daily';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    return {
      topics: recentKeywords,
      sentiment: dominantSentiment,
      avgAnswerLength,
      questionTypes,
      recentKeywords,
      answerCount: history.length
    };
  }

  /**
   * 构建问题生成提示词
   */
  buildQuestionPrompt(analysis) {
    const { topics, sentiment, avgAnswerLength, questionTypes, answerCount } = analysis;
    
    let prompt = `为一对情侣生成一个个性化的日常问题。\n\n`;
    prompt += `背景信息：\n`;
    prompt += `- 他们已经回答了${answerCount}个问题\n`;
    
    if (topics.length > 0) {
      prompt += `- 最近关心的话题：${topics.join('、')}\n`;
    }
    
    if (sentiment !== 'neutral') {
      const sentimentDesc = {
        positive: '积极乐观',
        negative: '有些低落',
        neutral: '平和'
      };
      prompt += `- 最近情绪状态：${sentimentDesc[sentiment]}\n`;
    }
    
    if (avgAnswerLength > 0) {
      const lengthDesc = avgAnswerLength < 20 ? '简短' : avgAnswerLength < 50 ? '适中' : '详细';
      prompt += `- 回答习惯：${lengthDesc}\n`;
    }
    
    if (Object.keys(questionTypes).length > 0) {
      const dominantType = Object.entries(questionTypes)
        .sort((a, b) => b[1] - a[1])[0][0];
      prompt += `- 偏好问题类型：${dominantType}\n`;
    }
    
    prompt += `\n要求：\n`;
    prompt += `1. 问题要温馨、有趣，适合情侣交流\n`;
    prompt += `2. 避免重复最近讨论过的话题\n`;
    prompt += `3. 如果情绪偏负面，问题要积极正面\n`;
    prompt += `4. 控制在20字以内\n`;
    prompt += `5. 直接返回问题，不要其他内容\n`;
    
    return prompt;
  }

  /**
   * 验证生成的问题
   */
  validateQuestion(questionText) {
    if (!questionText || typeof questionText !== 'string') {
      throw new Error('Invalid question generated');
    }
    
    // 清理和标准化
    let cleaned = questionText.trim();
    
    // 移除可能的引号
    if (cleaned.startsWith('"') && cleaned.endsWith('"')) {
      cleaned = cleaned.slice(1, -1);
    }
    
    // 移除常见的AI响应前缀
    const prefixes = ['问题：', 'Q:', 'Question:', '这里是问题：'];
    prefixes.forEach(prefix => {
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length).trim();
      }
    });
    
    // 检查长度
    if (cleaned.length < 5 || cleaned.length > 100) {
      throw new Error(`Question length invalid: ${cleaned.length}`);
    }
    
    // 检查是否包含问题标记
    if (!cleaned.includes('？') && !cleaned.includes('?')) {
      cleaned += '？';
    }
    
    return cleaned;
  }

  /**
   * 计算问题难度
   */
  calculateDifficulty(analysis) {
    const { avgAnswerLength, sentiment, answerCount } = analysis;
    
    let difficulty = 1;
    
    // 基于回答历史调整难度
    if (answerCount > 20) difficulty += 1;
    if (answerCount > 50) difficulty += 1;
    
    // 基于回答长度调整
    if (avgAnswerLength > 50) difficulty += 1;
    
    // 基于情感状态调整
    if (sentiment === 'positive') difficulty += 0.5;
    
    return Math.min(Math.round(difficulty), 5);
  }

  /**
   * 提取标签
   */
  extractTags(analysis) {
    const tags = [];
    
    // 基于情感添加标签
    if (analysis.sentiment === 'positive') {
      tags.push('积极', '快乐');
    } else if (analysis.sentiment === 'negative') {
      tags.push('关怀', '支持');
    }
    
    // 基于话题添加标签
    if (analysis.topics.length > 0) {
      tags.push(...analysis.topics.slice(0, 3));
    }
    
    // 基于回答历史添加标签
    if (analysis.answerCount > 30) {
      tags.push('深度');
    }
    
    // 确保标签唯一且不超过5个
    return [...new Set(tags)].slice(0, 5);
  }

  /**
   * 获取使用统计
   */
  getUsageStats() {
    const now = Date.now();
    const uptimeHours = (now - this.usageStats.lastReset) / (1000 * 60 * 60);
    
    return {
      ...this.usageStats,
      uptimeHours,
      successRate: this.usageStats.totalRequests > 0 
        ? (this.usageStats.successfulRequests / this.usageStats.totalRequests * 100).toFixed(2) + '%'
        : '0%',
      currentRateLimit: {
        used: this.rateLimit.requests,
        max: this.rateLimit.maxRequests,
        resetIn: Math.max(0, this.rateLimit.windowMs - (now - this.rateLimit.windowStart)) / 1000
      }
    };
  }

  /**
   * 重置统计
   */
  resetStats() {
    this.usageStats = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      lastReset: Date.now()
    };
  }

  /**
   * 分析文本情感（带降级策略）
   */
  async analyzeSentiment(text) {
    try {
      this.checkRateLimit();

      // 使用降级策略
      const result = await AIFallback.analyzeSentimentWithFallback(
        text,
        this,  // 主AI (iFlow)
        ollamaClient  // 备用AI (Ollama)
      );

      this.updateStats(true);
      logger.info('Analyzed sentiment with fallback strategy', {
        textLength: text.length,
        sentiment: result.sentiment
      });

      return result;

    } catch (error) {
      this.updateStats(false);
      logger.error('All sentiment analysis fallback strategies failed', { error: error.message });
      // 返回默认值
      return {
        sentiment: 'neutral',
        sentiment_score: 50,
        keywords: []
      };
    }
  }

  /**
   * 心流API直接分析情感（供降级策略调用）
   */
  async analyzeSentimentInternal(text) {
    const result = await iflowClient.analyzeSentiment(text);
    logger.info('Analyzed sentiment via iFlow', { textLength: text.length, sentiment: result.sentiment });
    return result;
  }

  /**
   * 检查API健康状态
   */
  async healthCheck() {
    try {
      const result = await iflowClient.healthCheck();
      return {
        api: result,
        service: {
          rateLimit: this.rateLimit.requests < this.rateLimit.maxRequests,
          stats: this.getUsageStats()
        }
      };
    } catch (error) {
      logger.error('AI service health check failed', error);
      return {
        api: { available: false, error: error.message },
        service: {
          rateLimit: false,
          stats: this.getUsageStats()
        }
      };
    }
  }
}

module.exports = new AIService();