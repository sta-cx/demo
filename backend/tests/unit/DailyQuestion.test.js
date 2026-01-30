/**
 * DailyQuestion Model Unit Tests
 * Tests the DailyQuestion model methods, especially the fixed generateForAllActiveCouples
 */

const DailyQuestion = require('../../src/models/DailyQuestion');

// Mock database utility
jest.mock('../../src/utils/database', () => ({
  query: jest.fn()
}));

// Mock Question model
jest.mock('../../src/models/Question', () => ({
  getRandomByCategory: jest.fn()
}));

const { query } = require('../../src/utils/database');
const Question = require('../../src/models/Question');

describe('DailyQuestion Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateTodayQuestion', () => {
    it('should return existing daily question if already exists for today', async () => {
      const existingQuestion = {
        id: 'dq-123',
        couple_id: 'couple-1',
        question_id: 'q-1',
        question_date: new Date().toISOString().split('T')[0]
      };

      query.mockResolvedValueOnce({ rows: [existingQuestion] });

      const result = await DailyQuestion.generateTodayQuestion('couple-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE couple_id = $1 AND question_date = CURRENT_DATE'),
        ['couple-1']
      );
      expect(result).toBeInstanceOf(DailyQuestion);
    });

    it('should create new daily question if none exists for today', async () => {
      // No existing question
      query.mockResolvedValueOnce({ rows: [] });

      // No recent questions
      query.mockResolvedValueOnce({ rows: [] });

      // Random question selected
      const mockQuestion = { id: 'q-456' };
      Question.getRandomByCategory.mockResolvedValueOnce(mockQuestion);

      // Create successful
      query.mockResolvedValueOnce({
        rows: [{
          id: 'dq-new',
          couple_id: 'couple-1',
          question_id: 'q-456',
          question_date: new Date().toISOString().split('T')[0]
        }]
      });

      const result = await DailyQuestion.generateTodayQuestion('couple-1');

      expect(Question.getRandomByCategory).toHaveBeenCalled();
      expect(query).toHaveBeenCalledTimes(3); // Check existing, get recent, create
      expect(result).toBeInstanceOf(DailyQuestion);
    });

    it('should throw error if no available questions found', async () => {
      // No existing question
      query.mockResolvedValueOnce({ rows: [] });

      // No recent questions
      query.mockResolvedValueOnce({ rows: [] });

      // No questions available
      Question.getRandomByCategory.mockResolvedValueOnce(null);

      await expect(DailyQuestion.generateTodayQuestion('couple-1'))
        .rejects.toThrow('No available questions found');
    });

    it('should use specified questionId if provided', async () => {
      // No existing question
      query.mockResolvedValueOnce({ rows: [] });

      // Create successful with specified question
      query.mockResolvedValueOnce({
        rows: [{
          id: 'dq-new',
          couple_id: 'couple-1',
          question_id: 'q-999',
          question_date: new Date().toISOString().split('T')[0]
        }]
      });

      const result = await DailyQuestion.generateTodayQuestion('couple-1', 'q-999');

      expect(Question.getRandomByCategory).not.toHaveBeenCalled();
      expect(query).toHaveBeenCalledTimes(2); // Check existing, create (skip random selection)
      expect(result).toBeInstanceOf(DailyQuestion);
    });
  });

  describe('generateForAllActiveCouples', () => {
    it('should generate daily questions for all active couples', async () => {
      const mockCouples = [
        { id: 'couple-1' },
        { id: 'couple-2' },
        { id: 'couple-3' }
      ];

      // Mock get active couples
      query.mockResolvedValueOnce({ rows: mockCouples });

      // Mock generateTodayQuestion calls (all succeed, all create new)
      for (let i = 0; i < mockCouples.length; i++) {
        query.mockResolvedValueOnce({ rows: [] }); // No existing question
        query.mockResolvedValueOnce({ rows: [] }); // No recent questions
        Question.getRandomByCategory.mockResolvedValueOnce({ id: `q-${i}` });
        query.mockResolvedValueOnce({
          rows: [{
            id: `dq-new-${i}`,
            couple_id: mockCouples[i].id,
            question_id: `q-${i}`,
            question_date: new Date().toISOString().split('T')[0]
          }]
        });
      }

      const result = await DailyQuestion.generateForAllActiveCouples();

      expect(result.success).toHaveLength(3);
      expect(result.errors).toHaveLength(0);
      expect(result.total_processed).toBe(3);

      // Verify all couples got success status with IDs
      expect(result.success[0]).toEqual({
        couple_id: 'couple-1',
        daily_question_id: 'dq-new-0',
        status: 'success'
      });
      expect(result.success[1]).toEqual({
        couple_id: 'couple-2',
        daily_question_id: 'dq-new-1',
        status: 'success'
      });
      expect(result.success[2]).toEqual({
        couple_id: 'couple-3',
        daily_question_id: 'dq-new-2',
        status: 'success'
      });
    });

    it('should handle couples that already have daily questions', async () => {
      const mockCouples = [
        { id: 'couple-1' },
        { id: 'couple-2' }
      ];

      // Mock get active couples
      query.mockResolvedValueOnce({ rows: mockCouples });

      // Couple 1: already has question (returns existing question)
      query.mockResolvedValueOnce({ rows: [{ id: 'dq-existing-1', couple_id: 'couple-1' }] });

      // Couple 2: creates new question
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      Question.getRandomByCategory.mockResolvedValueOnce({ id: 'q-new' });
      query.mockResolvedValueOnce({
        rows: [{
          id: 'dq-new-2',
          couple_id: 'couple-2',
          question_id: 'q-new',
          question_date: new Date().toISOString().split('T')[0]
        }]
      });

      const result = await DailyQuestion.generateForAllActiveCouples();

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(0);
      expect(result.total_processed).toBe(2);

      // Both should have success status (generateTodayQuestion always returns a DailyQuestion)
      expect(result.success[0]).toEqual({
        couple_id: 'couple-1',
        daily_question_id: 'dq-existing-1',
        status: 'success'
      });
      expect(result.success[1]).toEqual({
        couple_id: 'couple-2',
        daily_question_id: 'dq-new-2',
        status: 'success'
      });
    });

    it('should handle errors gracefully for individual couples', async () => {
      const mockCouples = [
        { id: 'couple-1' },
        { id: 'couple-2' },
        { id: 'couple-3' }
      ];

      // Mock get active couples
      query.mockResolvedValueOnce({ rows: mockCouples });

      // Couple 1: success
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      Question.getRandomByCategory.mockResolvedValueOnce({ id: 'q-1' });
      query.mockResolvedValueOnce({
        rows: [{ id: 'dq-1', couple_id: 'couple-1', question_id: 'q-1' }]
      });

      // Couple 2: error (no available questions)
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      Question.getRandomByCategory.mockResolvedValueOnce(null);

      // Couple 3: success
      query.mockResolvedValueOnce({ rows: [] });
      query.mockResolvedValueOnce({ rows: [] });
      Question.getRandomByCategory.mockResolvedValueOnce({ id: 'q-3' });
      query.mockResolvedValueOnce({
        rows: [{ id: 'dq-3', couple_id: 'couple-3', question_id: 'q-3' }]
      });

      const result = await DailyQuestion.generateForAllActiveCouples();

      expect(result.success).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toEqual({
        couple_id: 'couple-2',
        error: 'No available questions found'
      });
      expect(result.total_processed).toBe(3);
    });

    it('should return empty result when no active couples exist', async () => {
      // No active couples
      query.mockResolvedValueOnce({ rows: [] });

      const result = await DailyQuestion.generateForAllActiveCouples();

      expect(result).toEqual({
        success: [],
        errors: [],
        total_processed: 0
      });

      expect(query).toHaveBeenCalledTimes(1); // Only the initial query
    });
  });

  describe('create', () => {
    it('should create a new daily question', async () => {
      const mockData = {
        couple_id: 'couple-1',
        question_id: 'q-1',
        question_date: '2026-01-30'
      };

      query.mockResolvedValueOnce({
        rows: [{ id: 'dq-1', ...mockData }]
      });

      const result = await DailyQuestion.create(mockData);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO daily_questions'),
        ['couple-1', 'q-1', '2026-01-30']
      );
      expect(result).toBeInstanceOf(DailyQuestion);
    });

    it('should return null on conflict (duplicate)', async () => {
      const mockData = {
        couple_id: 'couple-1',
        question_id: 'q-1',
        question_date: '2026-01-30'
      };

      query.mockResolvedValueOnce({ rows: [] }); // ON CONFLICT DO NOTHING

      const result = await DailyQuestion.create(mockData);

      expect(result).toBeNull();
    });
  });

  describe('getTodayQuestion', () => {
    it('should get today question for a couple', async () => {
      const mockQuestion = {
        id: 'dq-1',
        couple_id: 'couple-1',
        question_id: 'q-1',
        question_date: new Date().toISOString().split('T')[0],
        question_text: '测试问题'
      };

      query.mockResolvedValueOnce({ rows: [mockQuestion] });

      const result = await DailyQuestion.getTodayQuestion('couple-1');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE dq.couple_id = $1 AND dq.question_date = CURRENT_DATE'),
        ['couple-1']
      );
      expect(result).toBeInstanceOf(DailyQuestion);
    });

    it('should return null if no question for today', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await DailyQuestion.getTodayQuestion('couple-1');

      expect(result).toBeNull();
    });
  });
});
