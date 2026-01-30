// backend/src/utils/wechatNotifier.js
const axios = require('axios');
const logger = require('./logger');

class WechatNotifier {
  constructor() {
    this.appid = process.env.WECHAT_APPID;
    this.secret = process.env.WECHAT_SECRET;
    this.accessToken = null;
    this.tokenExpireTime = 0;

    this.apiBase = 'https://api.weixin.qq.com/cgi-bin';
  }

  /**
   * 获取访问令牌
   */
  async getAccessToken() {
    // 如果令牌还有效，直接返回
    if (this.accessToken && Date.now() < this.tokenExpireTime) {
      return this.accessToken;
    }

    try {
      const response = await axios.get(`${this.apiBase}/token`, {
        params: {
          grant_type: 'client_credential',
          appid: this.appid,
          secret: this.secret
        }
      });

      if (response.data.errcode) {
        throw new Error(`WeChat API error: ${response.data.errmsg}`);
      }

      this.accessToken = response.data.access_token;
      // 提前5分钟过期
      this.tokenExpireTime = Date.now() + (response.data.expires_in - 300) * 1000;

      logger.info('WeChat access token refreshed');
      return this.accessToken;

    } catch (error) {
      logger.error('Failed to get WeChat access token:', error);
      throw new Error(`WeChat token error: ${error.message}`);
    }
  }

  /**
   * 发送订阅消息
   */
  async sendSubscribeMessage(openid, templateId, data, page = 'pages/index/index') {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.apiBase}/message/subscribe/send?access_token=${accessToken}`,
        {
          touser: openid,
          template_id: templateId,
          page: page,
          data: data,
          miniprogram_state: process.env.NODE_ENV === 'production' ? 'formal' : 'developer'
        }
      );

      if (response.data.errcode && response.data.errcode !== 0) {
        logger.warn('WeChat message send failed', {
          errcode: response.data.errcode,
          errmsg: response.data.errmsg
        });
        return {
          success: false,
          errcode: response.data.errcode,
          errmsg: response.data.errmsg
        };
      }

      logger.info('WeChat message sent successfully', { openid });
      return {
        success: true,
        msgid: response.data.msgid
      };

    } catch (error) {
      logger.error('Failed to send WeChat message:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 发送每日问题推送
   */
  async sendDailyQuestionNotification(openid, questionText, questionDate) {
    // 模板消息数据结构需要根据实际小程序模板配置
    const templateId = process.env.WECHAT_DAILY_QUESTION_TEMPLATE_ID;

    if (!templateId) {
      logger.warn('WeChat daily question template ID not configured');
      return { success: false, error: 'Template ID not configured' };
    }

    const data = {
      thing1: {  // 问题内容
        value: questionText
      },
      date2: {  // 日期
        value: questionDate
      },
      thing3: {  // 提示
        value: '点击查看今日问题'
      }
    };

    return await this.sendSubscribeMessage(openid, templateId, data);
  }

  /**
   * 批量发送问题通知
   */
  async sendDailyQuestionToUsers(users, questionText, questionDate) {
    const results = {
      total: users.length,
      success: 0,
      failed: 0,
      errors: []
    };

    for (const user of users) {
      if (!user.wechat_openid) {
        results.failed++;
        results.errors.push({
          userId: user.id,
          error: 'No WeChat openid'
        });
        continue;
      }

      const result = await this.sendDailyQuestionNotification(
        user.wechat_openid,
        questionText,
        questionDate
      );

      if (result.success) {
        results.success++;
      } else {
        results.failed++;
        results.errors.push({
          userId: user.id,
          error: result.error || result.errmsg
        });
      }

      // 避免频繁请求，稍微延迟
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    logger.info('Batch WeChat notification completed', {
      total: results.total,
      success: results.success,
      failed: results.failed
    });

    return results;
  }

  /**
   * 健康检查
   */
  async healthCheck() {
    try {
      await this.getAccessToken();
      return {
        available: true,
        configured: !!(this.appid && this.secret)
      };
    } catch (error) {
      return {
        available: false,
        configured: !!(this.appid && this.secret),
        error: error.message
      };
    }
  }
}

module.exports = new WechatNotifier();
