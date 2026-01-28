const cron = require('node-cron');
const YearlyReportService = require('../services/yearlyReportService');
const logger = require('../utils/logger');

class YearlyReportTask {
  constructor() {
    this.isRunning = false;
    this.task = null;
  }

  /**
   * 启动年报生成任务
   * 每年1月1日02:00执行
   */
  start() {
    if (this.isRunning) {
      logger.warn('Yearly report task is already running');
      return;
    }

    logger.info('Starting yearly report task...');

    // 每年1月1日02:00执行
    this.task = cron.schedule('0 2 1 1 *', async () => {
      await this.execute();
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.task.start();
    this.isRunning = true;

    logger.info('Yearly report task started successfully');
  }

  /**
   * 停止年报生成任务
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Yearly report task is not running');
      return;
    }

    logger.info('Stopping yearly report task...');

    if (this.task) {
      this.task.stop();
      this.task = null;
    }

    this.isRunning = false;
    logger.info('Yearly report task stopped');
  }

  /**
   * 手动执行任务（用于测试）
   */
  async executeManually() {
    logger.info('Manually executing yearly report task...');
    await this.execute();
  }

  /**
   * 执行年报生成逻辑
   */
  async execute() {
    try {
      logger.info('Starting yearly report generation...');

      const startTime = Date.now();
      const result = await YearlyReportService.generateYearlyReportsForAll();
      const duration = Date.now() - startTime;

      logger.info('Yearly report generation completed', {
        duration: `${duration}ms`,
        total_processed: result.total_processed,
        success_count: result.success.length,
        error_count: result.errors.length
      });

      if (result.errors.length > 0) {
        logger.error('Errors occurred during yearly report generation:', result.errors);
      }

      await this.sendNotifications(result);

    } catch (error) {
      logger.error('Error in yearly report task:', error);
      await this.sendErrorNotification(error);
    }
  }

  /**
   * 发送任务完成通知
   */
  async sendNotifications(result) {
    try {
      if (result.errors.length > 0) {
        logger.warn(`Yearly report task completed with ${result.errors.length} errors`);
      } else {
        logger.info('Yearly report task completed successfully');
      }
    } catch (error) {
      logger.error('Error sending notifications:', error);
    }
  }

  /**
   * 发送错误通知
   */
  async sendErrorNotification(error) {
    try {
      logger.error('Yearly report task failed:', {
        error: error.message,
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
const yearlyReportTask = new YearlyReportTask();

module.exports = yearlyReportTask;
