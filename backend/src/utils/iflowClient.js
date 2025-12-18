const axios = require('axios');
const logger = require('./logger');

class IFlowClient {
  constructor() {
    this.baseURL = process.env.IFLOW_BASE_URL || 'https://api.iflow.cn/v1';
    this.apiKey = process.env.IFLOW_API_KEY;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.info('IFlow API Request', {
          method: config.method,
          url: config.url,
          headers: { ...config.headers, Authorization: '[REDACTED]' }
        });
        return config;
      },
      (error) => {
        logger.error('IFlow API Request Error', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.info('IFlow API Response', {
          status: response.status,
          url: response.config.url
        });
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // Retry logic for rate limiting (429)
        if (error.response?.status === 429 && !originalRequest._retry) {
          originalRequest._retry = true;
          const retryAfter = error.response.headers['retry-after'] || 5;
          
          logger.warn(`Rate limited. Retrying after ${retryAfter} seconds`);
          
          /* eslint-disable-next-line no-undef */
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          
          return this.client(originalRequest);
        }
        
        logger.error('IFlow API Error', {
          status: error.response?.status,
          message: error.message,
          url: originalRequest?.url
        });
        
        return Promise.reject(error);
      }
    );
  }

  async generateQuestion(prompt, options = {}) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: options.model || 'qwen3-coder',
        messages: [
          {
            role: 'system',
            content: '你是一个温柔的AI助手，帮助情侣增进了解。请生成一个有趣的问题。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options.temperature || 0.8,
        max_tokens: options.max_tokens || 100
      });

      return response.data.choices[0].message.content.trim();
    } catch (error) {
      logger.error('Failed to generate question', error);
      throw new Error(`IFlow API error: ${error.message}`);
    }
  }

  async analyzeSentiment(text) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: 'qwen3-coder',
        messages: [
          {
            role: 'system',
            content: '分析这段话的情感倾向，返回JSON格式：{"sentiment": "positive/neutral/negative", "score": 0-100}'
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      const result = response.data.choices[0].message.content;
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      throw new Error('Invalid response format');
    } catch (error) {
      logger.error('Failed to analyze sentiment', error);
      // Return default values on error
      return {
        sentiment: 'neutral',
        score: 50
      };
    }
  }

  async generateWeeklyReport(data) {
    try {
      const response = await this.client.post('/chat/completions', {
        model: 'qwen3-coder',
        messages: [
          {
            role: 'system',
            content: '生成情侣周报，包含关键词、发现、精彩瞬间和下周期待'
          },
          {
            role: 'user',
            content: JSON.stringify(data)
          }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error('Failed to generate weekly report', error);
      throw new Error(`IFlow API error: ${error.message}`);
    }
  }

  async healthCheck() {
    try {
      const response = await this.client.get('/models');
      return {
        available: true,
        models: response.data.data?.map(m => m.id) || []
      };
    } catch (error) {
      logger.error('IFlow health check failed', error);
      return {
        available: false,
        error: error.message
      };
    }
  }
}

module.exports = new IFlowClient();