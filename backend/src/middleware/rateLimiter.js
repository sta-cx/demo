const rateLimit = require('express-rate-limit');
const logger = require('../utils/logger');
const { LRUCache } = require('lru-cache');

// 用户限制记录存储 - 使用 LRU 缓存防止内存泄漏
// 自动清理过期条目，最大存储 10000 个用户记录
const userLimits = new LRUCache({
  max: 10000, // 最多存储 10000 个用户的限制记录
  ttl: 15 * 60 * 1000, // 15分钟自动过期
  updateAgeOnGet: true, // 访问时更新过期时间
  updateAgeOnHas: true, // 检查存在时更新过期时间
});

// 通用速率限制配置
const createRateLimit = (options = {}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 默认15分钟
    max: options.max || 100, // 默认每个IP 100个请求
    message: options.message || {
      error: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true, // 返回速率限制信息在 `RateLimit-*` headers
    legacyHeaders: false, // 禁用 `X-RateLimit-*` headers
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent')
      });
      
      res.status(429).json(options.message || {
        error: 'Too many requests',
        code: 'RATE_LIMIT_EXCEEDED'
      });
    },
    ...options
  });
};

// 不同类型的速率限制器

// 通用API限制
const generalLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每15分钟100个请求
  message: {
    error: 'Too many requests, please try again later',
    code: 'GENERAL_RATE_LIMIT_EXCEEDED'
  }
});

// 认证相关的严格限制
const authLimiter = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 10, // 每15分钟10次认证尝试
  message: {
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  }
});

// 发送验证码的限制
const smsLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 5, // 每小时5次
  message: {
    error: 'Too many SMS requests, please try again later',
    code: 'SMS_RATE_LIMIT_EXCEEDED'
  }
});

// 提交回答的限制
const answerLimiter = createRateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 20, // 每分钟20个回答
  message: {
    error: 'Too many answer submissions, please slow down',
    code: 'ANSWER_RATE_LIMIT_EXCEEDED'
  }
});

// AI生成相关的限制
const aiLimiter = createRateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 10, // 每分钟10次AI请求
  message: {
    error: 'Too many AI requests, please try again later',
    code: 'AI_RATE_LIMIT_EXCEEDED'
  }
});

// 文件上传的限制
const uploadLimiter = createRateLimit({
  windowMs: 60 * 1000, // 1分钟
  max: 5, // 每分钟5个文件
  message: {
    error: 'Too many file uploads, please try again later',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  }
});

// 生成回忆录的限制
const memoryLimiter = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 每小时3次
  message: {
    error: 'Too many memory generation requests, please try again later',
    code: 'MEMORY_RATE_LIMIT_EXCEEDED'
  }
});

// 创建基于用户的速率限制器
const createUserRateLimit = (options = {}) => {
  return (req, res, next) => {
    const userId = req.user?.userId;

    if (!userId) {
      // 如果没有用户ID，使用IP限制
      return generalLimiter(req, res, next);
    }

    const now = Date.now();
    const windowMs = options.windowMs || 15 * 60 * 1000;
    const max = options.max || 100;

    // 获取或创建用户限制记录 (LRUCache 会自动处理过期)
    let userLimit = userLimits.get(userId);

    if (!userLimit) {
      userLimit = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    // 检查是否需要重置
    if (now > userLimit.resetTime) {
      userLimit = {
        count: 0,
        resetTime: now + windowMs
      };
    }

    // 增加计数（创建新对象避免引用问题）
    const updatedLimit = {
      count: userLimit.count + 1,
      resetTime: userLimit.resetTime
    };

    // 更新缓存
    userLimits.set(userId, updatedLimit);

    // 检查是否超过限制
    if (updatedLimit.count > max) {
      logger.warn('User rate limit exceeded', {
        userId,
        count: updatedLimit.count,
        max,
        url: req.url
      });

      return res.status(429).json({
        error: 'Too many requests',
        code: 'USER_RATE_LIMIT_EXCEEDED',
        retryAfter: Math.ceil((updatedLimit.resetTime - now) / 1000)
      });
    }

    // 设置响应头
    res.set({
      'X-RateLimit-Limit': max,
      'X-RateLimit-Remaining': Math.max(0, max - updatedLimit.count),
      'X-RateLimit-Reset': new Date(updatedLimit.resetTime).toISOString()
    });

    next();
  };
};

module.exports = {
  generalLimiter,
  authLimiter,
  smsLimiter,
  answerLimiter,
  aiLimiter,
  uploadLimiter,
  memoryLimiter,
  createUserRateLimit
};