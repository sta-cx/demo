const logger = require('../utils/logger');
const Answer = require('../models/Answer');
const Question = require('../models/Question');

class AnalysisService {
  /**
   * 获取情侣的问题回答历史
   */
  async getCoupleHistory(coupleId, days = 30) {
    try {
      const history = await Answer.findByCouple(coupleId, days);
      
      // 丰富历史数据
      const enrichedHistory = await Promise.all(
        history.map(async (answer) => {
          const question = await Question.findById(answer.question_id);
          return {
            ...answer,
            category: question?.category || 'daily',
            question_text: question?.question_text || answer.question_text
          };
        })
      );
      
      return enrichedHistory;
    } catch (error) {
      logger.error('Failed to get couple history', { coupleId, error: error.message });
      throw error;
    }
  }

  /**
   * 分析回答趋势
   */
  async analyzeAnswerTrends(coupleId, days = 30) {
    try {
      const history = await this.getCoupleHistory(coupleId, days);
      
      if (history.length === 0) {
        return {
          frequency: 0,
          consistency: 0,
          engagement: 'low',
          trend: 'stable'
        };
      }

      // 计算回答频率
      const frequency = history.length / days;
      
      // 计算回答一致性（双方都回答的比例）
      const dailyGroups = this.groupByDate(history);
      const bothAnswered = Object.values(dailyGroups).filter(answers => answers.length >= 2).length;
      const consistency = bothAnswered / Object.keys(dailyGroups).length;
      
      // 计算参与度
      const avgAnswerLength = history.reduce((sum, a) => sum + (a.answer_text?.length || 0), 0) / history.length;
      const engagement = this.calculateEngagement(frequency, consistency, avgAnswerLength);
      
      // 分析趋势
      const trend = this.analyzeTrend(history);
      
      return {
        frequency: Number(frequency.toFixed(2)),
        consistency: Number(consistency.toFixed(2)),
        engagement,
        trend,
        totalAnswers: history.length,
        activeDays: Object.keys(dailyGroups).length
      };
      
    } catch (error) {
      logger.error('Failed to analyze answer trends', { coupleId, error: error.message });
      throw error;
    }
  }

  /**
   * 分析情感变化
   */
  async analyzeSentimentProgression(coupleId, days = 30) {
    try {
      const history = await this.getCoupleHistory(coupleId, days);
      
      if (history.length === 0) {
        return {
          overall: 'neutral',
          progression: [],
          insights: []
        };
      }

      // 按时间排序
      const sortedHistory = history.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      
      // 计算每日平均情感
      const dailySentiment = this.groupByDate(sortedHistory);
      const progression = Object.entries(dailySentiment).map(([date, answers]) => {
        const avgScore = answers.reduce((sum, a) => sum + (a.sentiment_score || 50), 0) / answers.length;
        const sentiment = this.scoreToSentiment(avgScore);
        
        return {
          date,
          sentiment,
          score: Number(avgScore.toFixed(1)),
          answerCount: answers.length
        };
      });

      // 计算整体情感
      const overallScore = sortedHistory.reduce((sum, a) => sum + (a.sentiment_score || 50), 0) / sortedHistory.length;
      const overall = this.scoreToSentiment(overallScore);
      
      // 生成洞察
      const insights = this.generateSentimentInsights(progression);
      
      return {
        overall,
        progression,
        insights,
        averageScore: Number(overallScore.toFixed(1))
      };
      
    } catch (error) {
      logger.error('Failed to analyze sentiment progression', { coupleId, error: error.message });
      throw error;
    }
  }

  /**
   * 分析话题偏好
   */
  async analyzeTopicPreferences(coupleId, days = 30) {
    try {
      const history = await this.getCoupleHistory(coupleId, days);
      
      if (history.length === 0) {
        return {
          categories: {},
          keywords: {},
          preferences: []
        };
      }

      // 分析问题类别偏好
      const categories = history.reduce((acc, answer) => {
        const category = answer.category || 'daily';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      // 分析关键词
      const allKeywords = history.flatMap(a => a.keywords || []);
      const keywords = allKeywords.reduce((acc, keyword) => {
        acc[keyword] = (acc[keyword] || 0) + 1;
        return acc;
      }, {});

      // 排序并获取偏好
      const sortedCategories = Object.entries(categories)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([category, count]) => ({ category, count }));

      const sortedKeywords = Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([keyword, count]) => ({ keyword, count }));

      // 生成偏好分析
      const preferences = this.generatePreferenceInsights(sortedCategories, sortedKeywords);
      
      return {
        categories: Object.fromEntries(sortedCategories),
        keywords: Object.fromEntries(sortedKeywords),
        preferences
      };
      
    } catch (error) {
      logger.error('Failed to analyze topic preferences', { coupleId, error: error.message });
      throw error;
    }
  }

  /**
   * 检测回答模式
   */
  async detectAnswerPatterns(coupleId, days = 30) {
    try {
      const history = await this.getCoupleHistory(coupleId, days);
      
      if (history.length === 0) {
        return {
          patterns: [],
          recommendations: []
        };
      }

      const patterns = [];
      
      // 检测时间模式
      const timePattern = this.detectTimePattern(history);
      if (timePattern) patterns.push(timePattern);
      
      // 检测长度模式
      const lengthPattern = this.detectLengthPattern(history);
      if (lengthPattern) patterns.push(lengthPattern);
      
      // 检测情感模式
      const sentimentPattern = this.detectSentimentPattern(history);
      if (sentimentPattern) patterns.push(sentimentPattern);
      
      // 检测话题模式
      const topicPattern = this.detectTopicPattern(history);
      if (topicPattern) patterns.push(topicPattern);

      // 生成建议
      const recommendations = this.generatePatternRecommendations(patterns);
      
      return {
        patterns,
        recommendations
      };
      
    } catch (error) {
      logger.error('Failed to detect answer patterns', { coupleId, error: error.message });
      throw error;
    }
  }

  /**
   * 生成情侣报告
   */
  async generateCoupleReport(coupleId, days = 30) {
    try {
      const [trends, sentiment, topics, patterns] = await Promise.all([
        this.analyzeAnswerTrends(coupleId, days),
        this.analyzeSentimentProgression(coupleId, days),
        this.analyzeTopicPreferences(coupleId, days),
        this.detectAnswerPatterns(coupleId, days)
      ]);

      const report = {
        period: `${days}天`,
        generated_at: new Date().toISOString(),
        trends,
        sentiment,
        topics,
        patterns,
        summary: this.generateReportSummary(trends, sentiment, topics, patterns)
      };

      logger.info('Generated couple report', { coupleId, days });
      return report;
      
    } catch (error) {
      logger.error('Failed to generate couple report', { coupleId, error: error.message });
      throw error;
    }
  }

  // 辅助方法

  groupByDate(history) {
    return history.reduce((groups, item) => {
      const date = item.answer_date || item.created_at?.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
      return groups;
    }, {});
  }

  calculateEngagement(frequency, consistency, avgLength) {
    let score = 0;
    
    // 频率评分 (0-40)
    score += Math.min(frequency * 40, 40);
    
    // 一致性评分 (0-30)
    score += consistency * 30;
    
    // 长度评分 (0-30)
    if (avgLength > 50) score += 30;
    else if (avgLength > 20) score += 20;
    else if (avgLength > 10) score += 10;
    
    if (score >= 80) return 'high';
    if (score >= 50) return 'medium';
    return 'low';
  }

  analyzeTrend(history) {
    if (history.length < 7) return 'stable';
    
    const recent = history.slice(-7);
    const earlier = history.slice(-14, -7);
    
    if (earlier.length === 0) return 'stable';
    
    const recentFreq = recent.length / 7;
    const earlierFreq = earlier.length / 7;
    
    const change = (recentFreq - earlierFreq) / earlierFreq;
    
    if (change > 0.2) return 'increasing';
    if (change < -0.2) return 'decreasing';
    return 'stable';
  }

  scoreToSentiment(score) {
    if (score >= 70) return 'positive';
    if (score <= 30) return 'negative';
    return 'neutral';
  }

  generateSentimentInsights(progression) {
    const insights = [];
    
    if (progression.length < 3) return insights;
    
    const recent = progression.slice(-3);
    const earlier = progression.slice(-6, -3);
    
    const recentAvg = recent.reduce((sum, p) => sum + p.score, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, p) => sum + p.score, 0) / earlier.length;
    
    if (recentAvg > earlierAvg + 10) {
      insights.push('最近情感状态有明显改善');
    } else if (recentAvg < earlierAvg - 10) {
      insights.push('最近情感状态可能需要关注');
    }
    
    const volatility = this.calculateVolatility(progression);
    if (volatility > 20) {
      insights.push('情感波动较大，建议多沟通');
    }
    
    return insights;
  }

  calculateVolatility(progression) {
    if (progression.length < 2) return 0;
    
    const scores = progression.map(p => p.score);
    const mean = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length;
    
    return Math.sqrt(variance);
  }

  generatePreferenceInsights(categories, keywords) {
    const insights = [];
    
    if (categories.length > 0) {
      const topCategory = categories[0];
      insights.push(`最喜欢${topCategory.category}类问题`);
    }
    
    if (keywords.length > 0) {
      const topKeywords = keywords.slice(0, 3).map(k => k.keyword);
      insights.push(`最关心的话题：${topKeywords.join('、')}`);
    }
    
    return insights;
  }

  detectTimePattern(history) {
    // 按小时分组
    const hourGroups = history.reduce((groups, item) => {
      const hour = new Date(item.created_at).getHours();
      groups[hour] = (groups[hour] || 0) + 1;
      return groups;
    }, {});
    
    const sortedHours = Object.entries(hourGroups).sort((a, b) => b[1] - a[1]);
    if (sortedHours.length > 0 && sortedHours[0][1] >= history.length * 0.4) {
      return {
        type: 'time',
        description: `倾向于在${sortedHours[0][0]}点回答问题`,
        strength: sortedHours[0][1] / history.length
      };
    }
    
    return null;
  }

  detectLengthPattern(history) {
    const lengths = history.map(h => h.answer_text?.length || 0);
    const avgLength = lengths.reduce((sum, l) => sum + l, 0) / lengths.length;
    
    if (avgLength > 100) {
      return {
        type: 'length',
        description: '回答通常很详细',
        strength: avgLength / 100
      };
    } else if (avgLength < 20) {
      return {
        type: 'length',
        description: '回答通常很简洁',
        strength: 1 - (avgLength / 20)
      };
    }
    
    return null;
  }

  detectSentimentPattern(history) {
    const sentiments = history.map(h => h.sentiment || 'neutral');
    const positiveCount = sentiments.filter(s => s === 'positive').length;
    const negativeCount = sentiments.filter(s => s === 'negative').length;
    
    if (positiveCount / history.length > 0.7) {
      return {
        type: 'sentiment',
        description: '整体情感积极正面',
        strength: positiveCount / history.length
      };
    } else if (negativeCount / history.length > 0.3) {
      return {
        type: 'sentiment',
        description: '可能需要更多情感支持',
        strength: negativeCount / history.length
      };
    }
    
    return null;
  }

  detectTopicPattern(history) {
    const categories = history.reduce((acc, h) => {
      const category = h.category || 'daily';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    
    const dominantCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
    if (dominantCategory && dominantCategory[1] / history.length > 0.5) {
      return {
        type: 'topic',
        description: `偏好${dominantCategory[0]}类话题`,
        strength: dominantCategory[1] / history.length
      };
    }
    
    return null;
  }

  generatePatternRecommendations(patterns) {
    const recommendations = [];
    
    patterns.forEach(pattern => {
      switch (pattern.type) {
        case 'time':
          recommendations.push('可以在习惯的时间推送提醒');
          break;
        case 'length':
          if (pattern.description.includes('详细')) {
            recommendations.push('可以提供更多深度思考的问题');
          } else {
            recommendations.push('可以提供更轻松简单的问题');
          }
          break;
        case 'sentiment':
          if (pattern.description.includes('积极')) {
            recommendations.push('继续保持良好的互动氛围');
          } else {
            recommendations.push('建议增加一些轻松有趣的话题');
          }
          break;
        case 'topic':
          recommendations.push(`可以增加更多${pattern.description.match(/偏好(.+)类/)?.[1] || '相关'}的问题`);
          break;
      }
    });
    
    return [...new Set(recommendations)];
  }

  generateReportSummary(trends, sentiment, topics, _patterns) {
    const summary = [];
    
    // 趋势总结
    if (trends.engagement === 'high') {
      summary.push('参与度很高，互动频繁');
    } else if (trends.engagement === 'medium') {
      summary.push('参与度中等，有提升空间');
    } else {
      summary.push('参与度较低，需要更多激励');
    }
    
    // 情感总结
    if (sentiment.overall === 'positive') {
      summary.push('整体情感状态积极');
    } else if (sentiment.overall === 'negative') {
      summary.push('情感状态需要关注');
    }
    
    // 话题总结
    if (topics.preferences.length > 0) {
      summary.push(topics.preferences[0]);
    }
    
    return summary;
  }
}

module.exports = new AnalysisService();