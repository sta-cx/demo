// backend/tests/unit/ollamaClient.test.js
const ollamaClient = require('../../src/utils/ollamaClient');
const axios = require('axios');

// Mock axios
jest.mock('axios');
jest.mock('../../src/utils/logger');

describe('OllamaClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OLLAMA_ENABLED = 'true';
  });

  afterEach(() => {
    delete process.env.OLLAMA_ENABLED;
  });

  describe('isAvailable', () => {
    test('should return true when Ollama is running', async () => {
      axios.create.mockReturnValue({
        get: jest.fn().mockResolvedValue({
          data: { models: [{ name: 'qwen2:7b' }] }
        })
      });

      const result = await ollamaClient.isAvailable();
      expect(result).toBe(true);
    });

    test('should return false when Ollama is not running', async () => {
      axios.create.mockReturnValue({
        get: jest.fn().mockRejectedValue(new Error('Connection refused'))
      });

      const result = await ollamaClient.isAvailable();
      expect(result).toBe(false);
    });

    test('should return false when disabled', async () => {
      process.env.OLLAMA_ENABLED = 'false';

      const result = await ollamaClient.isAvailable();
      expect(result).toBe(false);
    });
  });

  describe('generateQuestion', () => {
    test('should generate question successfully', async () => {
      const mockResponse = {
        response: '今天最开心的一件事是什么？'
      };

      axios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockResponse })
      });

      const question = await ollamaClient.generateQuestion('生成一个问题');
      expect(question).toBe(mockResponse.response);
    });

    test('should throw error when disabled', async () => {
      process.env.OLLAMA_ENABLED = 'false';

      await expect(
        ollamaClient.generateQuestion('生成一个问题')
      ).rejects.toThrow('not enabled');
    });
  });

  describe('analyzeSentiment', () => {
    test('should return sentiment analysis', async () => {
      const mockResponse = {
        response: '{"sentiment": "positive", "score": 80}'
      };

      axios.create.mockReturnValue({
        post: jest.fn().mockResolvedValue({ data: mockResponse })
      });

      const result = await ollamaClient.analyzeSentiment('今天很开心');
      expect(result.sentiment).toBe('positive');
      expect(result.score).toBe(80);
    });

    test('should return default values on error', async () => {
      axios.create.mockReturnValue({
        post: jest.fn().mockRejectedValue(new Error('API error'))
      });

      const result = await ollamaClient.analyzeSentiment('test');
      expect(result.sentiment).toBe('neutral');
      expect(result.score).toBe(50);
    });
  });
});
