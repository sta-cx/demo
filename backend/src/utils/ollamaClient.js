// backend/src/utils/ollamaClient.js
const axios = require('axios');
const logger = require('./logger');
const { aiHealthManager } = require('./aiHealthChecker');

class OllamaClient {
  constructor() {
    this.baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
    this.model = process.env.OLLAMA_MODEL || 'qwen2:7b';
    this.enabled = process.env.OLLAMA_ENABLED === 'true';

    if (this.enabled) {
      this.client = axios.create({
        baseURL: this.baseURL,
        timeout: 60000, // 本地模型可能需要更长时间
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }

  /**
   * 检查Ollama服务是否可用
   */
  async isAvailable() {
    if (!this.enabled) {
      return false;
    }

    try {
      const response = await this.client.get('/api/tags');

      // 标记成功
      aiHealthManager.markSuccess('ollama');

      logger.info('Ollama service is available', {
        models: response.data.models?.map(m => m.name) || []
      });
      return true;
    } catch (error) {
      // 标记失败
      aiHealthManager.markFailure('ollama', error);

      logger.warn('Ollama service is not available', {
        error: error.message,
        url: this.baseURL
      });
      return false;
    }
  }

  /**
   * 生成问题
   */
  async generateQuestion(prompt) {
    if (!this.enabled) {
      throw new Error('Ollama is not enabled');
    }

    // 检查健康状态
    if (!aiHealthManager.isHealthy('ollama')) {
      throw new Error('Ollama service is unhealthy - circuit breaker is open');
    }

    try {
      const response = await this.client.post('/api/generate', {
        model: this.model,
        prompt: this.buildPrompt(prompt),
        stream: false,
        options: {
          temperature: 0.8,
          num_predict: 100
        }
      });

      const questionText = response.data.response?.trim();
      if (!questionText) {
        throw new Error('Empty response from Ollama');
      }

      // 标记成功
      aiHealthManager.markSuccess('ollama');

      logger.info('Ollama question generated', {
        model: this.model,
        length: questionText.length
      });

      return questionText;
    } catch (error) {
      // 标记失败
      aiHealthManager.markFailure('ollama', error);

      logger.error('Failed to generate question with Ollama', error);
      throw new Error(`Ollama error: ${error.message}`);
    }
  }

  /**
   * 分析情感
   */
  async analyzeSentiment(text) {
    if (!this.enabled) {
      throw new Error('Ollama is not enabled');
    }

    // 检查健康状态
    if (!aiHealthManager.isHealthy('ollama')) {
      throw new Error('Ollama service is unhealthy - circuit breaker is open');
    }

    try {
      const prompt = `分析这段话的情感倾向，返回JSON格式：{"sentiment": "positive/neutral/negative", "score": 0-100}\n\n文本：${text}`;

      const response = await this.client.post('/api/generate', {
        model: this.model,
        prompt: prompt,
        stream: false,
        options: {
          temperature: 0.3,
          num_predict: 100
        }
      });

      const result = response.data.response?.trim();
      const jsonMatch = result.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        // 标记成功
        aiHealthManager.markSuccess('ollama');

        return JSON.parse(jsonMatch[0]);
      }

      throw new Error('Invalid response format');
    } catch (error) {
      // 标记失败
      aiHealthManager.markFailure('ollama', error);

      logger.error('Failed to analyze sentiment with Ollama', error);
      // 返回默认值
      return {
        sentiment: 'neutral',
        score: 50
      };
    }
  }

  /**
   * 构建提示词
   */
  buildPrompt(userPrompt) {
    return `${userPrompt}\n\n要求：直接返回问题，不要其他内容，控制在20字以内。`;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    const available = await this.isAvailable();
    return {
      available,
      url: this.baseURL,
      model: this.model,
      enabled: this.enabled
    };
  }
}

module.exports = new OllamaClient();
