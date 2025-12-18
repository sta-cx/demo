const Memory = require('../models/Memory');
const Answer = require('../models/Answer');
const Couple = require('../models/Couple');
const Question = require('../models/Question');
const analysisService = require('./analysisService');
const aiService = require('./aiService');
const logger = require('../utils/logger');

class ReportService {
  /**
   * 生成周报
   * @param {string} coupleId - 情侣ID
   * @param {string} weekDate - 周日期（格式：YYYY-MM-DD，通常是周日）
   * @returns {Object} 生成的周报
   */
  static async generateWeeklyReport(coupleId, weekDate) {
    try {
      logger.info(`Generating weekly report for couple ${coupleId}, week ${weekDate}`);
      
      // 检查该周是否已有报告
      const existingReport = await Memory.existsByPeriod(coupleId, 'weekly', weekDate);
      if (existingReport) {
        throw new Error(`Weekly report already exists for week ${weekDate}`);
      }
      
      // 计算周的开始和结束日期
      const { startDate, endDate } = this.getWeekRange(weekDate);
      
      // 获取该周的回答数据
      const weekAnswers = await this.getAnswersInRange(coupleId, startDate, endDate);
      
      if (weekAnswers.length === 0) {
        throw new Error('No answers found for this week');
      }
      
      // 分析周数据
      const weekAnalysis = await this.analyzeWeekData(weekAnswers);
      
      // 生成AI内容
      const aiContent = await this.generateAIWeeklyContent(weekAnalysis);
      
      // 生成统计数据
      const stats = this.calculateWeekStats(weekAnswers);
      
      // 创建回忆录记录
      const memory = await Memory.create({
        couple_id: coupleId,
        period_type: 'weekly',
        period_date: weekDate,
        title: `我们的第${this.getWeekNumber(weekDate)}周回忆`,
        content: {
          highlights: weekAnalysis.highlights,
          moments: weekAnalysis.topMoments,
          topics: weekAnalysis.topTopics,
          ai_insights: aiContent.insights,
          ai_story: aiContent.story
        },
        summary: aiContent.summary,
        cover_image_url: await this.generateCoverImage(coupleId, 'weekly', weekDate),
        stats
      });
      
      logger.info(`Weekly report generated: ${memory.id}`);
      return memory;
      
    } catch (error) {
      logger.error(`Error generating weekly report for couple ${couId}:`, error);
      throw error;
    }
  }

  /**
   * 生成月报
   * @param {string} coupleId - 情侣ID
   * @param {string} monthDate - 月日期（格式：YYYY-MM-01）
   * @returns {Object} 生成的月报
   */
  static async generateMonthlyReport(coupleId, monthDate) {
    try {
      logger.info(`Generating monthly report for couple ${coupleId}, month ${monthDate}`);
      
      // 检查该月是否已有报告
      const existingReport = await Memory.existsByPeriod(coupleId, 'monthly', monthDate);
      if (existingReport) {
        throw new Error(`Monthly report already exists for month ${monthDate}`);
      }
      
      // 计算月的开始和结束日期
      const { startDate, endDate } = this.getMonthRange(monthDate);
      
      // 获取该月的回答数据
      const monthAnswers = await this.getAnswersInRange(coupleId, startDate, endDate);
      
      if (monthAnswers.length === 0) {
        throw new Error('No answers found for this month');
      }
      
      // 分析月数据
      const monthAnalysis = await this.analyzeMonthData(monthAnswers);
      
      // 生成AI内容
      const aiContent = await this.generateAIMonthlyContent(monthAnalysis);
      
      // 生成统计数据
      const stats = this.calculateMonthStats(monthAnswers);
      
      // 创建回忆录记录
      const memory = await Memory.create({
        couple_id: coupleId,
        period_type: 'monthly',
        period_date: monthDate,
        title: `${monthDate.split('-')[0]}年${monthDate.split('-')[1]}月回忆录`,
        content: {
          highlights: monthAnalysis.highlights,
          moments: monthAnalysis.topMoments,
          topics: monthAnalysis.topTopics,
          ai_insights: aiContent.insights,
          ai_story: aiContent.story,
          growth: monthAnalysis.growth
        },
        summary: aiContent.summary,
        cover_image_url: await this.generateCoverImage(coupleId, 'monthly', monthDate),
        stats
      });
      
      logger.info(`Monthly report generated: ${memory.id}`);
      return memory;
      
    } catch (error) {
      logger.error(`Error generating monthly report for couple ${couId}:`, error);
      throw error;
    }
  }

  /**
   * 获取指定范围的回答
   * @param {string} coupleId - 情侣ID
   * @param {string} startDate - 开始日期
   * @param {string} endDate - 结束日期
   * @returns {Array} 回答列表
   */
  static async getAnswersInRange(coupleId, startDate, endDate) {
    try {
      const answers = await Answer.findByDateRange(coupleId, startDate, endDate);
      
      // 丰富回答数据
      const enrichedAnswers = await Promise.all(
        answers.map(async (answer) => {
          const question = await Question.findById(answer.question_id);
          return {
            ...answer,
            category: question?.category || 'daily',
            question_text: question?.question_text || answer.question_text
          };
        })
      );
      
      return enrichedAnswers;
    } catch (error) {
      logger.error(`Error getting answers in range:`, error);
      throw error;
    }
  }

  /**
   * 分析周数据
   * @param {Array} answers - 回答列表
   * @returns {Object} 分析结果
   */
  static async analyzeWeekData(answers) {
    // 按情感分组
    const sentimentGroups = this.groupBySentiment(answers);
    
    // 提取亮点
    const highlights = this.extractHighlights(answers, sentimentGroups);
    
    // 获取精彩瞬间
    const topMoments = this.extractTopMoments(answers);
    
    // 分析热门话题
    const topTopics = this.extractTopTopics(answers);
    
    return {
      highlights,
      topMoments,
      topTopics,
      sentimentDistribution: sentimentGroups
    };
  }

  /**
   * 分析月数据
   * @param {Array} answers - 回答列表
   * @returns {Object} 分析结果
   */
  static async analyzeMonthData(answers) {
    // 调用周数据分析方法获取基础分析
    const baseAnalysis = await this.analyzeWeekData(answers);
    
    // 按周分组分析趋势
    const weeklyTrends = this.analyzeWeeklyTrends(answers);
    
    // 分析成长变化
    const growth = this.analyzeGrowth(answers);
    
    return {
      ...baseAnalysis,
      weeklyTrends,
      growth
    };
  }

  /**
   * 生成AI周报内容
   * @param {Object} analysis - 分析数据
   * @returns {Object} AI生成的内容
   */
  static async generateAIWeeklyContent(analysis) {
    try {
      const prompt = this.buildWeeklyPrompt(analysis);
      
      // 使用心流API生成内容
      const aiResponse = await aiService.generateWeeklyReport({
        highlights: analysis.highlights,
        moments: analysis.topMoments,
        topics: analysis.topTopics,
        sentiment: analysis.sentimentDistribution
      });
      
      // 解析AI响应
      const { insights, story, summary } = this.parseAIResponse(aiResponse);
      
      return {
        insights,
        story,
        summary: summary || this.generateDefaultSummary(analysis)
      };
      
    } catch (error) {
      logger.warn('AI weekly content generation failed, using fallback:', error.message);
      return this.generateFallbackWeeklyContent(analysis);
    }
  }

  /**
   * 生成AI月报内容
   * @param {Object} analysis - 分析数据
   * @returns {Object} AI生成的内容
   */
  static async generateAIMonthlyContent(analysis) {
    try {
      const prompt = this.buildMonthlyPrompt(analysis);
      
      // 使用心流API生成内容
      const aiResponse = await aiService.generateWeeklyReport({
        highlights: analysis.highlights,
        moments: analysis.topMoments,
        topics: analysis.topTopics,
        sentiment: analysis.sentimentDistribution,
        growth: analysis.growth,
        trends: analysis.weeklyTrends
      });
      
      // 解析AI响应
      const { insights, story, summary } = this.parseAIResponse(aiResponse);
      
      return {
        insights,
        story,
        summary: summary || this.generateDefaultSummary(analysis)
      };
      
    } catch (error) {
      logger.warn('AI monthly content generation failed, using fallback:', error.message);
      return this.generateFallbackMonthlyContent(analysis);
    }
  }

  /**
   * 计算周统计数据
   * @param {Array} answers - 回答列表
   * @returns {Object} 统计数据
   */
  static calculateWeekStats(answers) {
    const totalAnswers = answers.length;
    const answeredDays = new Set(answers.map(a => a.answer_date)).size;
    const avgSentiment = answers.reduce((sum, a) => sum + (a.sentiment_score || 50), 0) / totalAnswers;
    
    // 计算双方参与度
    const userIds = [...new Set(answers.map(a => a.user_id))];
    const userParticipation = userIds.map(userId => ({
      user_id: userId,
      count: answers.filter(a => a.user_id === userId).length,
      percentage: (answers.filter(a => a.user_id === userId).length / totalAnswers * 100).toFixed(1)
    }));
    
    return {
      total_answers: totalAnswers,
      answered_days: answeredDays,
      avg_sentiment_score: Number(avgSentiment.toFixed(1)),
      user_participation: userParticipation,
      most_active_day: this.getMostActiveDay(answers),
      question_categories: this.getCategoryDistribution(answers)
    };
  }

  /**
   * 计算月统计数据
   * @param {Array} answers - 回答列表
   * @returns {Object} 统计数据
   */
  static calculateMonthStats(answers) {
    const baseStats = this.calculateWeekStats(answers);
    
    // 添加月特有统计
    const weeklyStats = this.calculateWeeklyStats(answers);
    const monthGrowth = this.calculateMonthGrowth(answers);
    
    return {
      ...baseStats,
      weekly_breakdown: weeklyStats,
      growth_metrics: monthGrowth
    };
  }

  /**
   * 生成封面图片URL（占位符实现）
   * @param {string} coupleId - 情侣ID
   * @param {string} periodType - 期间类型
   * @param {string} periodDate - 期间日期
   * @returns {string} 封面图片URL
   */
  static async generateCoverImage(coupleId, periodType, periodDate) {
    // 这里应该实现实际的图片生成逻辑
    // 目前返回占位符URL
    return `https://api.our-daily.com/memories/cover/${periodType}/${coupleId}/${periodDate}.jpg`;
  }

  /**
   * 获取周日期范围
   * @param {string} weekDate - 周日期（周日）
   * @returns {Object} 开始和结束日期
   */
  static getWeekRange(weekDate) {
    const endDate = new Date(weekDate);
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * 获取月日期范围
   * @param {string} monthDate - 月日期（月初）
   * @returns {Object} 开始和结束日期
   */
  static getMonthRange(monthDate) {
    const startDate = new Date(monthDate);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
    
    return {
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0]
    };
  }

  /**
   * 获取周数
   * @param {string} weekDate - 周日期
   * @returns {number} 周数
   */
  static getWeekNumber(weekDate) {
    const date = new Date(weekDate);
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const weekNumber = Math.ceil(((date - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
    return weekNumber;
  }

  /**
   * 按情感分组
   * @param {Array} answers - 回答列表
   * @returns {Object} 情感分组
   */
  static groupBySentiment(answers) {
    return answers.reduce((groups, answer) => {
      const sentiment = answer.sentiment || 'neutral';
      if (!groups[sentiment]) {
        groups[sentiment] = [];
      }
      groups[sentiment].push(answer);
      return groups;
    }, {});
  }

  /**
   * 提取亮点
   * @param {Array} answers - 回答列表
   * @param {Object} sentimentGroups - 情感分组
   * @returns {Array} 亮点列表
   */
  static extractHighlights(answers, sentimentGroups) {
    const highlights = [];
    
    // 添加积极情感的回答
    if (sentimentGroups.positive) {
      const positiveAnswers = sentimentGroups.positive
        .sort((a, b) => (b.sentiment_score || 0) - (a.sentiment_score || 0))
        .slice(0, 3);
      
      positiveAnswers.forEach(answer => {
        highlights.push({
          type: 'positive',
          text: answer.answer_text,
          date: answer.answer_date,
          score: answer.sentiment_score
        });
      });
    }
    
    // 添加长回答（可能包含深度思考）
    const longAnswers = answers
      .filter(a => a.answer_text && a.answer_text.length > 50)
      .sort((a, b) => b.answer_text.length - a.answer_text.length)
      .slice(0, 2);
    
    longAnswers.forEach(answer => {
      highlights.push({
        type: 'thoughtful',
        text: answer.answer_text,
        date: answer.answer_date,
        length: answer.answer_text.length
      });
    });
    
    return highlights;
  }

  /**
   * 提取精彩瞬间
   * @param {Array} answers - 回答列表
   * @returns {Array} 精彩瞬间
   */
  static extractTopMoments(answers) {
    // 按情感分数和长度综合评分
    const scoredAnswers = answers.map(answer => ({
      ...answer,
      score: (answer.sentiment_score || 50) + Math.min(answer.answer_text?.length || 0, 50) / 10
    }));
    
    return scoredAnswers
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(answer => ({
        question: answer.question_text,
        answer: answer.answer_text,
        date: answer.answer_date,
        sentiment: answer.sentiment
      }));
  }

  /**
   * 提取热门话题
   * @param {Array} answers - 回答列表
   * @returns {Array} 热门话题
   */
  static extractTopTopics(answers) {
    const topicCounts = {};
    
    answers.forEach(answer => {
      if (answer.keywords && answer.keywords.length > 0) {
        answer.keywords.forEach(keyword => {
          topicCounts[keyword] = (topicCounts[keyword] || 0) + 1;
        });
      }
    });
    
    return Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
  }

  /**
   * 构建周报提示词
   * @param {Object} analysis - 分析数据
   * @returns {string} 提示词
   */
  static buildWeeklyPrompt(analysis) {
    return `基于以下情侣一周的问答数据，生成温馨的周报：

亮点：${analysis.highlights.map(h => h.text).join('；')}

精彩瞬间：${analysis.topMoments.map(m => `${m.question} - ${m.answer}`).join('；')}

热门话题：${analysis.topTopics.map(t => t.topic).join('、')}

请生成：
1. 3-5条洞察（insights）
2. 一个温馨的故事（story）
3. 一句话总结（summary）`;
  }

  /**
   * 构建月报提示词
   * @param {Object} analysis - 分析数据
   * @returns {string} 提示词
   */
  static buildMonthlyPrompt(analysis) {
    return `基于以下情侣一月的问答数据，生成深度的月度回忆录：

亮点：${analysis.highlights.map(h => h.text).join('；')}

精彩瞬间：${analysis.topMoments.map(m => `${m.question} - ${m.answer}`).join('；')}

热门话题：${analysis.topTopics.map(t => t.topic).join('、')}

成长趋势：${JSON.stringify(analysis.growth)}

请生成：
1. 5-7条深度洞察（insights）
2. 一个有故事性的回忆（story）
3. 一段总结（summary）`;
  }

  /**
   * 解析AI响应
   * @param {string} response - AI响应
   * @returns {Object} 解析后的内容
   */
  static parseAIResponse(response) {
    // 简单的解析逻辑，实际可能需要更复杂的处理
    const lines = response.split('\n').filter(line => line.trim());
    
    const insights = [];
    const story = [];
    let summary = '';
    
    let currentSection = '';
    
    lines.forEach(line => {
      if (line.includes('洞察') || line.includes('insights')) {
        currentSection = 'insights';
      } else if (line.includes('故事') || line.includes('story')) {
        currentSection = 'story';
      } else if (line.includes('总结') || line.includes('summary')) {
        currentSection = 'summary';
      } else if (line.trim()) {
        switch (currentSection) {
          case 'insights':
            insights.push(line.trim());
            break;
          case 'story':
            story.push(line.trim());
            break;
          case 'summary':
            summary = line.trim();
            break;
        }
      }
    });
    
    return {
      insights,
      story: story.join(' '),
      summary
    };
  }

  /**
   * 生成默认摘要
   * @param {Object} analysis - 分析数据
   * @returns {string} 摘要
   */
  static generateDefaultSummary(analysis) {
    const answerCount = analysis.highlights.length;
    const topTopic = analysis.topTopics[0]?.topic || '生活';
    
    return `这周我们分享了${answerCount}个精彩瞬间，最关心的话题是${topTopic}。`;
  }

  /**
   * 生成降级周报内容
   * @param {Object} analysis - 分析数据
   * @returns {Object} 降级内容
   */
  static generateFallbackWeeklyContent(analysis) {
    const insights = [
      `本周共回答了${analysis.topMoments.length}个问题`,
      `最热门的话题是${analysis.topTopics[0]?.topic || '日常生活'}`,
      `情感状态以${analysis.sentimentDistribution.positive ? '积极' : '平和'}为主`
    ];
    
    const story = `这一周，我们一起分享了生活的点点滴滴。`;
    const summary = this.generateDefaultSummary(analysis);
    
    return { insights, story, summary };
  }

  /**
   * 生成降级月报内容
   * @param {Object} analysis - 分析数据
   * @returns {Object} 降级内容
   */
  static generateFallbackMonthlyContent(analysis) {
    const insights = [
      `本月共回答了${analysis.topMoments.length}个问题`,
      `最热门的话题是${analysis.topTopics[0]?.topic || '日常生活'}`,
      `情感状态以${analysis.sentimentDistribution.positive ? '积极' : '平和'}为主`,
      `互动频率保持稳定`,
      `话题丰富多样`
    ];
    
    const story = `这个月，我们共同度过了许多美好时光，留下了珍贵的回忆。`;
    const summary = `本月我们分享了${analysis.topMoments.length}个精彩瞬间，记录了生活的点点滴滴。`;
    
    return { insights, story, summary };
  }

  /**
   * 分析周趋势
   * @param {Array} answers - 回答列表
   * @returns {Object} 趋势分析
   */
  static analyzeWeeklyTrends(answers) {
    // 按周分组
    const weeklyGroups = {};
    
    answers.forEach(answer => {
      const date = new Date(answer.answer_date);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyGroups[weekKey]) {
        weeklyGroups[weekKey] = [];
      }
      weeklyGroups[weekKey].push(answer);
    });
    
    // 计算每周统计
    const weeklyStats = Object.entries(weeklyGroups).map(([week, weekAnswers]) => ({
      week,
      count: weekAnswers.length,
      avgSentiment: weekAnswers.reduce((sum, a) => sum + (a.sentiment_score || 50), 0) / weekAnswers.length
    }));
    
    return weeklyStats.sort((a, b) => a.week.localeCompare(b.week));
  }

  /**
   * 分析成长
   * @param {Array} answers - 回答列表
   * @returns {Object} 成长分析
   */
  static analyzeGrowth(answers) {
    if (answers.length < 2) {
      return { trend: 'insufficient_data' };
    }
    
    // 按时间排序
    const sortedAnswers = answers.sort((a, b) => new Date(a.answer_date) - new Date(b.answer_date));
    
    // 计算前后半段的情感变化
    const midPoint = Math.floor(sortedAnswers.length / 2);
    const firstHalf = sortedAnswers.slice(0, midPoint);
    const secondHalf = sortedAnswers.slice(midPoint);
    
    const firstHalfAvg = firstHalf.reduce((sum, a) => sum + (a.sentiment_score || 50), 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, a) => sum + (a.sentiment_score || 50), 0) / secondHalf.length;
    
    const sentimentChange = secondHalfAvg - firstHalfAvg;
    
    // 计算回答长度变化
    const firstHalfLength = firstHalf.reduce((sum, a) => sum + (a.answer_text?.length || 0), 0) / firstHalf.length;
    const secondHalfLength = secondHalf.reduce((sum, a) => sum + (a.answer_text?.length || 0), 0) / secondHalf.length;
    
    const lengthChange = secondHalfLength - firstHalfLength;
    
    return {
      sentiment_trend: sentimentChange > 5 ? 'improving' : sentimentChange < -5 ? 'declining' : 'stable',
      sentiment_change: Number(sentimentChange.toFixed(1)),
      engagement_trend: lengthChange > 10 ? 'deepening' : lengthChange < -10 ? 'declining' : 'stable',
      engagement_change: Number(lengthChange.toFixed(1))
    };
  }

  /**
   * 计算周统计
   * @param {Array} answers - 回答列表
   * @returns {Array} 周统计列表
   */
  static calculateWeeklyStats(answers) {
    const weeklyData = {};
    
    answers.forEach(answer => {
      const date = new Date(answer.answer_date);
      const weekStart = new Date(date.setDate(date.getDate() - date.getDay()));
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!weeklyData[weekKey]) {
        weeklyData[weekKey] = {
          week: weekKey,
          answers: [],
          sentiment_scores: [],
          lengths: []
        };
      }
      
      weeklyData[weekKey].answers.push(answer);
      weeklyData[weekKey].sentiment_scores.push(answer.sentiment_score || 50);
      weeklyData[weekKey].lengths.push(answer.answer_text?.length || 0);
    });
    
    return Object.values(weeklyData).map(week => ({
      week: week.week,
      count: week.answers.length,
      avg_sentiment: Number((week.sentiment_scores.reduce((a, b) => a + b, 0) / week.sentiment_scores.length).toFixed(1)),
      avg_length: Number((week.lengths.reduce((a, b) => a + b, 0) / week.lengths.length).toFixed(1))
    }));
  }

  /**
   * 计算月成长
   * @param {Array} answers - 回答列表
   * @returns {Object} 成长指标
   */
  static calculateMonthGrowth(answers) {
    const weeklyStats = this.calculateWeeklyStats(answers);
    
    if (weeklyStats.length < 2) {
      return { trend: 'insufficient_data' };
    }
    
    const firstWeek = weeklyStats[0];
    const lastWeek = weeklyStats[weeklyStats.length - 1];
    
    return {
      frequency_change: lastWeek.count - firstWeek.count,
      sentiment_change: lastWeek.avg_sentiment - firstWeek.avg_sentiment,
      engagement_change: lastWeek.avg_length - firstWeek.avg_length,
      trend: this.determineGrowthTrend(firstWeek, lastWeek)
    };
  }

  /**
   * 确定成长趋势
   * @param {Object} firstWeek - 第一周数据
   * @param {Object} lastWeek - 最后一周数据
   * @returns {string} 趋势
   */
  static determineGrowthTrend(firstWeek, lastWeek) {
    const improvements = [];
    const declines = [];
    
    if (lastWeek.count > firstWeek.count) improvements.push('frequency');
    if (lastWeek.count < firstWeek.count) declines.push('frequency');
    
    if (lastWeek.avg_sentiment > firstWeek.avg_sentiment) improvements.push('sentiment');
    if (lastWeek.avg_sentiment < firstWeek.avg_sentiment) declines.push('sentiment');
    
    if (lastWeek.avg_length > firstWeek.avg_length) improvements.push('engagement');
    if (lastWeek.avg_length < firstWeek.avg_length) declines.push('engagement');
    
    if (improvements.length > declines.length) return 'improving';
    if (declines.length > improvements.length) return 'declining';
    return 'stable';
  }

  /**
   * 获取最活跃的日期
   * @param {Array} answers - 回答列表
   * @returns {string} 最活跃的日期
   */
  static getMostActiveDay(answers) {
    const dayCounts = {};
    
    answers.forEach(answer => {
      const date = answer.answer_date;
      dayCounts[date] = (dayCounts[date] || 0) + 1;
    });
    
    return Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  /**
   * 获取类别分布
   * @param {Array} answers - 回答列表
   * @returns {Object} 类别分布
   */
  static getCategoryDistribution(answers) {
    const categories = {};
    
    answers.forEach(answer => {
      const category = answer.category || 'daily';
      categories[category] = (categories[category] || 0) + 1;
    });
    
    return categories;
  }

  /**
   * 为所有活跃情侣生成周报
   * @returns {Object} 生成结果
   */
  static async generateWeeklyReportsForAll() {
    try {
      logger.info('Generating weekly reports for all active couples');
      
      // 获取所有活跃情侣
      const activeCouples = await Couple.findActive();
      const results = {
        total_processed: activeCouples.length,
        success: [],
        errors: []
      };
      
      // 获取当前周日期（最近的周日）
      const today = new Date();
      const sunday = new Date(today.setDate(today.getDate() - today.getDay()));
      const weekDate = sunday.toISOString().split('T')[0];
      
      for (const couple of activeCouples) {
        try {
          const report = await this.generateWeeklyReport(couple.id, weekDate);
          results.success.push({
            couple_id: couple.id,
            report_id: report.id
          });
        } catch (error) {
          results.errors.push({
            couple_id: couple.id,
            error: error.message
          });
        }
      }
      
      logger.info(`Weekly reports generated:`, {
        total_processed: results.total_processed,
        success_count: results.success.length,
        error_count: results.errors.length
      });
      
      return results;
      
    } catch (error) {
      logger.error('Error generating weekly reports for all couples:', error);
      throw error;
    }
  }

  /**
   * 为所有活跃情侣生成月报
   * @returns {Object} 生成结果
   */
  static async generateMonthlyReportsForAll() {
    try {
      logger.info('Generating monthly reports for all active couples');
      
      // 获取所有活跃情侣
      const activeCouples = await Couple.findActive();
      const results = {
        total_processed: activeCouples.length,
        success: [],
        errors: []
      };
      
      // 获取当前月日期（月初）
      const today = new Date();
      const monthDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      
      for (const couple of activeCouples) {
        try {
          const report = await this.generateMonthlyReport(couple.id, monthDate);
          results.success.push({
            couple_id: couple.id,
            report_id: report.id
          });
        } catch (error) {
          results.errors.push({
            couple_id: couple.id,
            error: error.message
          });
        }
      }
      
      logger.info(`Monthly reports generated:`, {
        total_processed: results.total_processed,
        success_count: results.success.length,
        error_count: results.errors.length
      });
      
      return results;
      
    } catch (error) {
      logger.error('Error generating monthly reports for all couples:', error);
      throw error;
    }
  }
}

module.exports = ReportService;