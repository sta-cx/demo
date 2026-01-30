const cron = require('node-cron');
const QuestionService = require('../services/questionService');
const aiService = require('../services/aiService');
const logger = require('../utils/logger');
const wechatNotifier = require('../utils/wechatNotifier');
const Couple = require('../models/Couple');
const User = require('../models/User');

class DailyQuestionTask {
  constructor() {
    this.isRunning = false;
    this.task = null;
  }

  /**
   * 启动每日问题推送任务
   * 每天21:00执行
   */
  start() {
    if (this.isRunning) {
      logger.warn('Daily question task is already running');
      return;
    }

    logger.info('Starting daily question task...');
    
    // 每天21:00执行
    this.task = cron.schedule('0 21 * * *', async () => {
      await this.execute();
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.task.start();
    this.isRunning = true;
    
    logger.info('Daily question task started successfully');
  }

  /**
   * 停止每日问题推送任务
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Daily question task is not running');
      return;
    }

    logger.info('Stopping daily question task...');
    
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    
    this.isRunning = false;
    logger.info('Daily question task stopped');
  }

  /**
   * 手动执行任务（用于测试）
   */
  async executeManually() {
    logger.info('Manually executing daily question task...');
    await this.execute();
  }

  /**
   * 执行每日问题生成逻辑
   */
  async execute() {
    try {
      logger.info('Starting daily question generation...');
      
      // 检查AI服务健康状态
      const aiHealth = await aiService.healthCheck();
      if (!aiHealth.api.available) {
        logger.warn('AI service is not available, using fallback question generation');
      }
      
      const startTime = Date.now();
      const result = await QuestionService.generateDailyQuestionsForAll();
      const duration = Date.now() - startTime;
      
      // 获取AI使用统计
      const aiStats = aiService.getUsageStats();
      
      logger.info('Daily question generation completed', {
        duration: `${duration}ms`,
        total_processed: result.total_processed,
        success_count: result.success.length,
        error_count: result.errors.length,
        ai_service: {
          available: aiHealth.api.available,
          stats: aiStats
        }
      });

      // 如果有错误，记录详细信息
      if (result.errors.length > 0) {
        logger.error('Errors occurred during daily question generation:', result.errors);
      }

      // 发送通知（可选）
      await this.sendNotifications(result);

    } catch (error) {
      logger.error('Error in daily question task:', error);
      
      // 发送错误通知
      await this.sendErrorNotification(error);
    }
  }

  /**
   * 发送任务完成通知
   * @param {Object} result - 任务执行结果
   */
  async sendNotifications(result) {
    try {
      if (!process.env.WECHAT_APPID || !process.env.WECHAT_SECRET) {
        logger.info('WeChat notification not configured, skipping');
        return;
      }

      const wechatHealth = await wechatNotifier.healthCheck();
      if (!wechatHealth.available) {
        logger.warn('WeChat notification service not available');
        return;
      }

      // 获取所有成功生成问题的情侣及其问题
      for (const item of result.success) {
        try {
          const couple = await Couple.findById(item.coupleId);
          if (!couple) continue;

          // 获取两个用户的微信openid
          const user1 = await User.findById(couple.user1_id);
          const user2 = await User.findById(couple.user2_id);

          const users = [user1, user2].filter(u => u && u.wechat_openid);

          if (users.length === 0) {
            logger.warn(`No WeChat openid found for couple ${item.coupleId}`);
            continue;
          }

          // 发送微信推送
          const notificationResult = await wechatNotifier.sendDailyQuestionToUsers(
            users,
            item.questionText,
            item.questionDate
          );

          logger.info('WeChat notification sent', {
            coupleId: item.coupleId,
            success: notificationResult.success,
            failed: notificationResult.failed
          });

        } catch (error) {
          logger.error(`Failed to send notification for couple ${item.coupleId}:`, error);
        }
      }

    } catch (error) {
      logger.error('Error sending WeChat notifications:', error);
    }
  }

  /**
   * 发送错误通知
   * @param {Error} error - 错误对象
   */
  async sendErrorNotification(error) {
    try {
      // 发送错误通知给管理员
      logger.error('Daily question task failed:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
    } catch (notifyError) {
      logger.error('Error sending error notification:', notifyError);
    }
  }

  /**
   * 获取任务状态
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      nextExecution: this.task ? this.task.nextDates() : null
    };
  }
}

// 创建单例实例
const dailyQuestionTask = new DailyQuestionTask();

module.exports = dailyQuestionTask;