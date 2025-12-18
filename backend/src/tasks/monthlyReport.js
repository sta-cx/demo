const cron = require('node-cron');
const ReportService = require('../services/reportService');
const logger = require('../utils/logger');

class MonthlyReportTask {
  constructor() {
    this.isRunning = false;
    this.task = null;
  }

  /**
   * 启动月报生成任务
   * 每月1日01:00执行
   */
  start() {
    if (this.isRunning) {
      logger.warn('Monthly report task is already running');
      return;
    }

    logger.info('Starting monthly report task...');
    
    // 每月1日01:00执行
    this.task = cron.schedule('0 1 1 * *', async () => {
      await this.execute();
    }, {
      scheduled: false,
      timezone: 'Asia/Shanghai'
    });

    this.task.start();
    this.isRunning = true;
    
    logger.info('Monthly report task started successfully');
  }

  /**
   * 停止月报生成任务
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Monthly report task is not running');
      return;
    }

    logger.info('Stopping monthly report task...');
    
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    
    this.isRunning = false;
    logger.info('Monthly report task stopped');
  }

  /**
   * 手动执行任务（用于测试）
   */
  async executeManually() {
    logger.info('Manually executing monthly report task...');
    await this.execute();
  }

  /**
   * 执行月报生成逻辑
   */
  async execute() {
    try {
      logger.info('Starting monthly report generation...');
      
      const startTime = Date.now();
      const result = await ReportService.generateMonthlyReportsForAll();
      const duration = Date.now() - startTime;
      
      logger.info('Monthly report generation completed', {
        duration: `${duration}ms`,
        total_processed: result.total_processed,
        success_count: result.success.length,
        error_count: result.errors.length
      });

      // 如果有错误，记录详细信息
      if (result.errors.length > 0) {
        logger.error('Errors occurred during monthly report generation:', result.errors);
      }

      // 发送通知
      await this.sendNotifications(result);

    } catch (error) {
      logger.error('Error in monthly report task:', error);
      
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
      // 或者发送邮件/短信通知给管理员
      
      if (result.errors.length > 0) {
        // 发送部分成功通知
        logger.warn(`Monthly report task completed with ${result.errors.length} errors`);
      } else {
        // 发送全部成功通知
        logger.info('Monthly report task completed successfully');
      }
      
      // 这里可以添加推送通知逻辑
      // await this.pushNotificationsToUsers(result);
      
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
      logger.error('Monthly report task failed:', {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString()
      });
      
      // 这里可以添加邮件通知或其他告警机制
      
    } catch (notifyError) {
      logger.error('Error sending error notification:', notifyError);
    }
  }

  /**
   * 推送通知给用户
   * @param {Object} result - 任务执行结果
   */
  async pushNotificationsToUsers(result) {
    try {
      // 为成功生成报告的情侣推送通知
      for (const success of result.success) {
        // 这里调用微信小程序推送API
        logger.info(`Would send notification to couple ${success.couple_id} for monthly report ${success.report_id}`);
      }
      
    } catch (error) {
      logger.error('Error pushing notifications to users:', error);
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

  /**
   * 获取下次执行时间
   */
  getNextExecutionTime() {
    if (!this.isRunning || !this.task) {
      return null;
    }
    
    const nextDates = this.task.nextDates();
    return nextDates.length > 0 ? nextDates[0] : null;
  }
}

// 创建单例实例
const monthlyReportTask = new MonthlyReportTask();

module.exports = monthlyReportTask;