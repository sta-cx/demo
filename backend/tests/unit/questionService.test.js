const QuestionService = require('../../src/services/questionService');

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

jest.mock('../../src/models/Question');
jest.mock('../../src/models/DailyQuestion');
jest.mock('../../src/models/Answer');
jest.mock('../../src/models/Couple');

describe('QuestionService', () => {
  describe('simpleSentimentAnalysis', () => {
    test('should return positive sentiment for happy text', () => {
      const text = '今天很开心，很快乐！';
      const result = QuestionService.simpleSentimentAnalysis(text);
      
      expect(result).toEqual({
        sentiment: 'positive',
        sentiment_score: expect.any(Number),
        keywords: expect.any(Array)
      });
      expect(result.sentiment).toBe('positive');
      expect(result.sentiment_score).toBeGreaterThan(50);
    });

    test('should return negative sentiment for sad text', () => {
      const text = '今天很难过，很伤心';
      const result = QuestionService.simpleSentimentAnalysis(text);
      
      expect(result).toEqual({
        sentiment: 'negative',
        sentiment_score: expect.any(Number),
        keywords: expect.any(Array)
      });
      expect(result.sentiment).toBe('negative');
      expect(result.sentiment_score).toBeLessThan(50);
    });

    test('should return neutral sentiment for neutral text', () => {
      const text = '今天天气不错';
      const result = QuestionService.simpleSentimentAnalysis(text);
      
      expect(result).toEqual({
        sentiment: 'neutral',
        sentiment_score: expect.any(Number),
        keywords: expect.any(Array)
      });
      expect(result.sentiment).toBe('neutral');
      expect(result.sentiment_score).toBe(50);
    });

    test('should return null for empty text', () => {
      const result = QuestionService.simpleSentimentAnalysis('');
      expect(result).toBeNull();
    });

    test('should return null for null text', () => {
      const result = QuestionService.simpleSentimentAnalysis(null);
      expect(result).toBeNull();
    });
  });
});