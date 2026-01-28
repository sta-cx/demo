const helmet = require('helmet');
const logger = require('../utils/logger');

// 基础安全头设置
const securityHeaders = helmet({
  // 内容安全策略
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.iflow.cn"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      childSrc: ["'none'"],
      workerSrc: ["'self'"],
      manifestSrc: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  
  // 跨域嵌入保护
  crossOriginEmbedderPolicy: false,
  
  // 跨域资源策略
  crossOriginResourcePolicy: { policy: "cross-origin" },
  
  // DNS预取控制
  dnsPrefetchControl: { allow: false },
  
  // 期望CT
  expectCt: {
    maxAge: 86400,
    enforce: true
  },
  
  // 功能策略
  permittedCrossDomainPolicies: false,
  
  // HSTS
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  
  // IE兼容性
  ieNoOpen: true,
  
  // MIME类型嗅探
  noSniff: true,
  
  // 来源策略
  originAgentCluster: true,
  
  // 权限策略
  permissionsPolicy: {
    features: {
      camera: ["'none'"],
      microphone: ["'none'"],
      geolocation: ["'none'"],
      payment: ["'none'"],
      usb: ["'none'"],
      magnetometer: ["'none'"],
      gyroscope: ["'none'"],
      accelerometer: ["'none'"]
    }
  },
  
  // 引用策略
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  
  // X-Frame-Options
  frameguard: { action: 'deny' },
  
  // X-XSS-Protection
  xssFilter: true
});

// 输入验证和清理
const validateInput = (req, res, next) => {
  // 检查请求体大小
  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 10 * 1024 * 1024) {
    return res.status(413).json({
      error: 'Request entity too large',
      code: 'PAYLOAD_TOO_LARGE'
    });
  }
  
  // 检查可疑的请求头
  const suspiciousHeaders = [
    'x-forwarded-for',
    'x-real-ip',
    'x-originating-ip',
    'x-remote-ip',
    'x-remote-addr'
  ];
  
  suspiciousHeaders.forEach(header => {
    if (req.headers[header]) {
      const value = req.headers[header];
      // 检查是否包含可疑字符
      if (/[<>'"&]/.test(value)) {
        logger.warn('Suspicious header detected', {
          header,
          value,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
      }
    }
  });
  
  next();
};

// IP白名单检查（可选）
const ipWhitelist = (allowedIPs = []) => {
  return (req, res, next) => {
    if (allowedIPs.length === 0) {
      return next(); // 如果没有配置白名单，跳过检查
    }
    
    const clientIP = req.ip || req.connection.remoteAddress;
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn('Unauthorized IP access attempt', {
        ip: clientIP,
        url: req.url,
        userAgent: req.get('User-Agent')
      });
      
      return res.status(403).json({
        error: 'Access denied',
        code: 'IP_NOT_ALLOWED'
      });
    }
    
    next();
  };
};

// 请求日志记录
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  // 记录请求开始
  logger.info('Request started', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type')
  });
  
  // 监听响应结束
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip
    });
  });
  
  next();
};

// 错误处理增强
const errorHandler = (err, req, res) => {
  // 记录错误详情
  logger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  });
  
  // 防止信息泄露
  const message = 'Internal server error';
  const code = 'INTERNAL_ERROR';
  let errorMessage = message;
  
  if (process.env.NODE_ENV === 'development') {
    errorMessage = err.message;
  }
  
  // 处理特定错误类型
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.details
    });
  }
  
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'Unauthorized',
      code: 'UNAUTHORIZED'
    });
  }
  
  if (err.code === '23505') { // PostgreSQL unique violation
    return res.status(409).json({
      error: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE'
    });
  }
  
  if (err.code === '23503') { // PostgreSQL foreign key violation
    return res.status(400).json({
      error: 'Invalid reference',
      code: 'INVALID_REFERENCE'
    });
  }
  
  res.status(500).json({
        error: errorMessage,
        code
      });};

// SQL注入防护
const sqlInjectionProtection = (req, res, next) => {
  const checkForSQLInjection = (value) => {
    if (typeof value !== 'string') return false;
    
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i,
      /(--|\/\*|\*\/|;|'|"|`|xp_|sp_)/i,
      /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\s+['"]?\w+['"]?\s*=\s*['"]?\w+['"]?)/i
    ];
    
    return sqlPatterns.some(pattern => pattern.test(value));
  };
  
  // 检查查询参数
  for (const [key, value] of Object.entries(req.query)) {
    if (checkForSQLInjection(value)) {
      logger.warn('SQL injection attempt detected in query', {
        ip: req.ip,
        url: req.url,
        param: key,
        value
      });
      
      return res.status(400).json({
        error: 'Invalid input detected',
        code: 'INVALID_INPUT'
      });
    }
  }
  
  // 检查请求体
  if (req.body && typeof req.body === 'object') {
    const checkObject = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string' && checkForSQLInjection(value)) {
          logger.warn('SQL injection attempt detected in body', {
            ip: req.ip,
            url: req.url,
            path: currentPath,
            value
          });
          
          return res.status(400).json({
            error: 'Invalid input detected',
            code: 'INVALID_INPUT'
          });
        }
        
        if (typeof value === 'object' && value !== null) {
          const result = checkObject(value, currentPath);
          if (result) return result;
        }
      }
    };
    
    const result = checkObject(req.body);
    if (result) return result;
  }
  
  next();
};

// XSS防护
const xssProtection = (req, res, next) => {
  const checkForXSS = (value) => {
    if (typeof value !== 'string') return false;
    
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<img[^>]*src[^>]*javascript:/gi,
      /<\s*script/gi,
      /<\s*object/gi,
      /<\s*embed/gi,
      /<\s*link/gi
    ];
    
    return xssPatterns.some(pattern => pattern.test(value));
  };
  
  // 检查查询参数
  for (const [key, value] of Object.entries(req.query)) {
    if (checkForXSS(value)) {
      logger.warn('XSS attempt detected in query', {
        ip: req.ip,
        url: req.url,
        param: key,
        value
      });
      
      return res.status(400).json({
        error: 'Invalid input detected',
        code: 'INVALID_INPUT'
      });
    }
  }
  
  // 检查请求体
  if (req.body && typeof req.body === 'object') {
    const checkObject = (obj, path = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const currentPath = path ? `${path}.${key}` : key;
        
        if (typeof value === 'string' && checkForXSS(value)) {
          logger.warn('XSS attempt detected in body', {
            ip: req.ip,
            url: req.url,
            path: currentPath,
            value
          });
          
          return res.status(400).json({
            error: 'Invalid input detected',
            code: 'INVALID_INPUT'
          });
        }
        
        if (typeof value === 'object' && value !== null) {
          const result = checkObject(value, currentPath);
          if (result) return result;
        }
      }
    };
    
    const result = checkObject(req.body);
    if (result) return result;
  }
  
  next();
};

module.exports = {
  securityHeaders,
  validateInput,
  ipWhitelist,
  requestLogger,
  errorHandler,
  sqlInjectionProtection,
  xssProtection
};