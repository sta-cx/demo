// backend/tests/unit/aiFallback.test.js
const AIFallback = require('../../src/utils/aiFallback');

// Mock dependencies
jest.mock('../../src/models/Question');
jest.mock('../../src/utils/logger');

const Question = require('../../src/models/Question');

describe('AIFallback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('simpleSentimentAnalysis', () => {
    test('should detect positive sentiment', () => {
      const result = AIFallback.simpleSentimentAnalysis('今天很开心，很幸福！');
      expect(result.sentiment).toBe('positive');
      expect(result.sentiment_score).toBeGreaterThan(50);
    });

    test('should detect negative sentiment', () => {
      const result = AIFallback.simpleSentimentAnalysis('今天很难过，很伤心。');
      expect(result.sentiment).toBe('negative');
      expect(result.sentiment_score).toBeLessThan(50);
    });

    test('should detect neutral sentiment', () => {
      const result = AIFallback.simpleSentimentAnalysis('今天天气怎么样？');
      expect(result.sentiment).toBe('neutral');
    });

    test('should extract keywords', () => {
      const result = AIFallback.simpleSentimentAnalysis('今天吃了很好吃的火锅，很开心');
      expect(result.keywords).toContain('火锅');
      expect(result.keywords).toContain('开心');
    });

    test('should handle empty text', () => {
      const result = AIFallback.simpleSentimentAnalysis('');
      expect(result).toBeNull();
    });
  });

  describe('selectCategoryFromHistory', () => {
    test('should return daily for empty history', () => {
      const category = AIFallback.selectCategoryFromHistory([]);
      expect(category).toBe('daily');
    });

    test('should return fun for low sentiment', () => {
      const history = [
        { sentiment_score: 30 },
        { sentiment_score: 40 }
      ];
      const category = AIFallback.selectCategoryFromHistory(history);
      expect(category).toBe('fun');
    });

    test('should return future for high sentiment', () => {
      const history = [
        { sentiment_score: 80 },
        { sentiment_score: 75 }
      ];
      const category = AIFallback.selectCategoryFromHistory(history);
      expect(category).toBe('future');
    });

    test('should return emotion for medium sentiment', () => {
      const history = [
        { sentiment_score: 60 },
        { sentiment_score: 55 }
      ];
      const category = AIFallback.selectCategoryFromHistory(history);
      expect(category).toBe('emotion');
    });
  });

  describe('buildSimplePrompt', () => {
    test('should return base prompt for empty history', () => {
      const prompt = AIFallback.buildSimplePrompt([]);
      expect(prompt).toContain('情侣');
      expect(prompt).toContain('问题');
    });

    test('should include recent topics', () => {
      const history = [
        { keywords: ['美食', '旅行'] },
        { keywords: ['电影', '音乐'] }
      ];
      const prompt = AIFallback.buildSimplePrompt(history);
      expect(prompt).toContain('美食');
      expect(prompt).toContain('旅行');
    });
  });
});
