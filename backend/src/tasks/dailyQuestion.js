const cron = require('node-cron');
const QuestionService = require('../services/questionService');
const logger = require('../utils/logger');

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
      
      const startTime = Date.now();
      const result = await QuestionService.generateDailyQuestionsForAll();
      const duration = Date.now() - startTime;
      
      logger.info('Daily question generation completed', {
        duration: `${duration}ms`,
        total_processed: result.total_processed,
        success_count: result.success.length,
        error_count: result.errors.length
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
      // 这里可以集成微信小程序消息推送
      // 或者发送邮件/短信通知
      
      if (result.errors.length > 0) {
        // 发送部分成功通知
        logger.warn(`Daily question task completed with ${result.errors.length} errors`);
      } else {
        // 发送全部成功通知
        logger.info('Daily question task completed successfully');
      }
    } catch (error) {
      logger.error('Error sending notifications:', error);
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