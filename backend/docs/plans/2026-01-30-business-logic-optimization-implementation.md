# 业务逻辑优化实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 系统性修复每日问答系统的18个业务逻辑问题，提升系统安全性、代码质量和性能。

**Architecture:** 分4个阶段实施：P0（严重安全问题）→ P1（代码质量）→ P2（性能优化）→ P3（架构改进）。每个阶段完成后进行测试验证和提交。

**Tech Stack:** Node.js + Express, PostgreSQL, Redis, Jest, lru-cache

---

## 前置准备

### Pre-Task: 安装依赖

**Files:**
- Modify: `package.json`

**Step 1: 添加所需依赖**

```bash
npm install --save redis lru-cache fast-levenshtein
npm install --save-dev redis-mock
```

**Step 2: 更新 .env.example**

**Files:**
- Modify: `.env.example`

在文件末尾添加:

```env
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Redis连接URL (完整格式)
REDIS_URL=redis://localhost:6379/0
```

**Step 3: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add redis and utility dependencies"
```

---

## P0: 严重安全问题修复

### Task 1: 创建Redis客户端工具

**Files:**
- Create: `src/utils/redis.js`

**Step 1: 创建Redis客户端**

```javascript
// src/utils/redis.js
const redis = require('redis');
const logger = require('./logger');

let client = null;

function getRedisClient() {
  if (client) return client;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';

  client = redis.createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          logger.error('Redis reconnection failed after 10 attempts');
          return new Error('Redis reconnection failed');
        }
        return retries * 100;
      }
    }
  });

  client.on('error', (err) => {
    logger.error('Redis Client Error', { error: err.message });
  });

  client.on('connect', () => {
    logger.info('Redis client connected');
  });

  client.connect();
  return client;
}

async function closeRedisClient() {
  if (client) {
    await client.quit();
    client = null;
  }
}

module.exports = { getRedisClient, closeRedisClient };
```

**Step 2: 创建测试文件**

**Files:**
- Create: `tests/unit/redis.test.js`

```javascript
// tests/unit/redis.test.js
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');

describe('Redis Client', () => {
  afterAll(async () => {
    await closeRedisClient();
  });

  test('should get redis client instance', () => {
    const client = getRedisClient();
    expect(client).toBeDefined();
    expect(client.connect).toBeInstanceOf(Function);
  });

  test('should set and get value', async () => {
    const client = getRedisClient();
    await client.set('test:key', 'test-value');
    const value = await client.get('test:key');
    expect(value).toBe('test-value');
    await client.del('test:key');
  });
});
```

**Step 3: 运行测试验证**

```bash
npm test -- tests/unit/redis.test.js
```

Expected: PASS

**Step 4: Commit**

```bash
git add src/utils/redis.js tests/unit/redis.test.js
git commit -m "feat: add Redis client utility"
```

---

### Task 2: 修复验证码安全漏洞

**Files:**
- Modify: `src/api/auth.js:17-46`

**Step 1: 读取当前auth.js实现**

```bash
cat src/api/auth.js | head -50
```

**Step 2: 修改发送验证码接口**

找到第17-30行的 `/send-code` 路由，修改为：

```javascript
// 发送验证码
router.post('/send-code', async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.status(400).json({ error: 'Invalid phone number' });
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储到Redis，5分钟过期
    const redisClient = require('../utils/redis').getRedisClient();
    await redisClient.setEx(`sms:code:${phone}`, 300, code);

    // 检查尝试次数
    const attemptsKey = `sms:attempts:${phone}`;
    const attempts = await redisClient.incr(attemptsKey);
    await redisClient.expire(attemptsKey, 3600);

    if (attempts > 5) {
      return res.status(429).json({ error: 'Too many attempts, please try again later' });
    }

    // 调用短信服务发送验证码
    // await smsService.sendCode(phone, code);

    // 仅开发环境打印验证码
    if (process.env.NODE_ENV !== 'production') {
      logger.debug(`Verification code for ${phone}: ${code}`);
    }

    res.json({ message: 'Verification code sent', expiresIn: 300 });
  } catch (error) {
    logger.error('Send code error', { error: error.message });
    res.status(500).json({ error: 'Failed to send verification code' });
  }
});
```

**Step 3: 修改登录接口**

找到第42-56行的 `/login` 路由，修改验证逻辑：

```javascript
// 验证码登录
router.post('/login', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: 'Phone and code are required' });
    }

    if (code.length !== 6 || !/^\d{6}$/.test(code)) {
      return res.status(400).json({ error: 'Invalid verification code format' });
    }

    // 从Redis获取存储的验证码
    const redisClient = require('../utils/redis').getRedisClient();
    const storedCode = await redisClient.get(`sms:code:${phone}`);

    if (!storedCode) {
      return res.status(401).json({ error: 'Verification code expired or not found' });
    }

    if (storedCode !== code) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    // 验证成功，删除验证码
    await redisClient.del(`sms:code:${phone}`);

    // 查询或创建用户
    let user = await User.findByPhone(phone);
    if (!user) {
      user = await User.create({ phone });
    }

    // 生成JWT token
    const token = jwt.sign(
      { userId: user.id, phone: user.phone },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    // 记录登录日志
    logger.info(`User logged in`, { userId: user.id, phone });

    res.json({
      token,
      user: {
        id: user.id,
        phone: user.phone,
        nickname: user.nickname
      }
    });
  } catch (error) {
    logger.error('Login error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Login failed' });
  }
});
```

**Step 4: 创建集成测试**

**Files:**
- Create: `tests/integration/auth.test.js`

```javascript
// tests/integration/auth.test.js
const request = require('supertest');
const express = require('express');
const authRouter = require('../../src/api/auth');
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

describe('Auth API Integration', () => {
  beforeAll(async () => {
    await getRedisClient();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  const testPhone = '13800138000';

  afterEach(async () => {
    const redisClient = getRedisClient();
    await redisClient.del(`sms:code:${testPhone}`);
    await redisClient.del(`sms:attempts:${testPhone}`);
  });

  test('should send verification code', async () => {
    const response = await request(app)
      .post('/api/auth/send-code')
      .send({ phone: testPhone });

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('sent');
  });

  test('should reject invalid phone format', async () => {
    const response = await request(app)
      .post('/api/auth/send-code')
      .send({ phone: '12345' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid phone');
  });

  test('should login with valid code', async () => {
    // 先发送验证码
    const sendResponse = await request(app)
      .post('/api/auth/send-code')
      .send({ phone: testPhone });

    // 获取Redis中的验证码
    const redisClient = getRedisClient();
    const code = await redisClient.get(`sms:code:${testPhone}`);

    // 使用验证码登录
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({ phone: testPhone, code });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.token).toBeDefined();
  });

  test('should reject invalid code', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ phone: testPhone, code: '000000' });

    expect(response.status).toBe(401);
  });

  test('should rate limit after 5 attempts', async () => {
    const redisClient = getRedisClient();
    await redisClient.set(`sms:attempts:${testPhone}`, '6');

    const response = await request(app)
      .post('/api/auth/send-code')
      .send({ phone: testPhone });

    expect(response.status).toBe(429);
    expect(response.body.error).toContain('Too many attempts');
  });
});
```

**Step 5: 运行测试**

```bash
npm test -- tests/integration/auth.test.js
```

Expected: PASS (可能需要mock数据库)

**Step 6: 更新环境变量文档**

**Files:**
- Modify: `.env.example`

确保Redis配置已添加（在Pre-Task中已完成）

**Step 7: Commit**

```bash
git add src/api/auth.js tests/integration/auth.test.js .env.example
git commit -m "fix: secure verification code with Redis storage and rate limiting"
```

---

### Task 3: 修复绑定情侣逻辑错误

**Files:**
- Modify: `src/api/couple.js:80-105`
- Modify: `src/models/User.js`

**Step 1: 检查User模型是否有findByPhone方法**

```bash
grep -n "findByPhone" src/models/User.js
```

如果没有，需要添加。

**Step 2: 添加User.findByPhone方法（如果不存在）**

**Files:**
- Modify: `src/models/User.js`

在User类中添加：

```javascript
static async findByPhone(phone) {
  try {
    const result = await query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to find user by phone', { phone, error: error.message });
    throw error;
  }
}
```

**Step 3: 修改绑定接口**

**Files:**
- Modify: `src/api/couple.js`

找到第80-105行左右的 `/bind` 路由，修改为：

```javascript
// 绑定情侣关系
router.post('/bind', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { partner_phone, couple_name } = req.body;

    if (!partner_phone || !couple_name) {
      return res.status(400).json({ error: 'Partner phone and couple name are required' });
    }

    // 不能绑定自己
    const currentUser = await User.findById(userId);
    if (currentUser.phone === partner_phone) {
      return res.status(400).json({ error: 'Cannot bind yourself' });
    }

    // 先通过手机号查询伴侣用户ID
    const partnerUser = await User.findByPhone(partner_phone);

    if (!partnerUser) {
      return res.status(404).json({ error: 'Partner user not found' });
    }

    // 检查伴侣是否已绑定
    const existingCouple = await Couple.findByUser(partnerUser.id);
    if (existingCouple) {
      return res.status(400).json({ error: 'Partner is already in a relationship' });
    }

    // 检查当前用户是否已绑定
    const userCouple = await Couple.findByUser(userId);
    if (userCouple) {
      return res.status(400).json({ error: 'You are already in a relationship' });
    }

    // 使用正确的user2Id进行绑定
    const couple = await CoupleService.bindCouple(
      userId,
      partnerUser.id,  // 正确的user2Id
      couple_name,
      currentUser.phone,
      partner_phone
    );

    res.json({
      message: 'Couple bound successfully',
      couple
    });
  } catch (error) {
    logger.error('Bind couple error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to bind couple' });
  }
});
```

**Step 4: 创建测试**

**Files:**
- Create: `tests/integration/couple.test.js`

```javascript
// tests/integration/couple.test.js
const request = require('supertest');
const express = require('express');
const coupleRouter = require('../../src/api/couple');
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');

// Mock中间件
const authMiddleware = (req, res, next) => {
  req.user = { userId: 1 };
  next();
};

const app = express();
app.use(express.json());
app.use('/api/couple', coupleRouter);

describe('Couple API Integration', () => {
  beforeAll(async () => {
    await getRedisClient();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  test('should reject binding to self', async () => {
    const response = await request(app)
      .post('/api/couple/bind')
      .send({
        partner_phone: '13800138000',  // 当前用户手机
        couple_name: '测试情侣'
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Cannot bind yourself');
  });

  test('should return 404 for non-existent partner', async () => {
    const response = await request(app)
      .post('/api/couple/bind')
      .send({
        partner_phone: '19999999999',  // 不存在的手机号
        couple_name: '测试情侣'
      });

    expect(response.status).toBe(404);
  });
});
```

**Step 5: 运行测试**

```bash
npm test -- tests/integration/couple.test.js
```

**Step 6: Commit**

```bash
git add src/api/couple.js src/models/User.js tests/integration/couple.test.js
git commit -m "fix: correct couple binding logic to use user ID instead of phone"
```

---

### Task 4: 修复定时任务函数名错误

**Files:**
- Modify: `src/models/DailyQuestion.js:245`

**Step 1: 查看错误代码**

```bash
sed -n '240,250p' src/models/DailyQuestion.js
```

**Step 2: 修复函数名**

将第245行：
```javascript
const dailyQuestion = await DailyGenerateTodayQuestion(couple.id);
```

修改为：
```javascript
const dailyQuestion = await DailyQuestion.generateTodayQuestion(couple.id);
```

**Step 3: 验证语法**

```bash
node -c src/models/DailyQuestion.js
```

Expected: 无输出（语法正确）

**Step 4: 创建单元测试**

**Files:**
- Create: `tests/unit/dailyQuestion.test.js`

```javascript
// tests/unit/dailyQuestion.test.js
const DailyQuestion = require('../../src/models/DailyQuestion');

jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/database', () => ({
  query: jest.fn()
}));

const { query } = require('../../src/utils/database');

describe('DailyQuestion Model', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should generate today question for a couple', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1, question_text: 'Test question' }]
    });

    const coupleId = 1;
    const result = await DailyQuestion.generateTodayQuestion(coupleId);

    expect(result).toBeDefined();
    expect(query).toHaveBeenCalled();
  });

  test('should handle batch generation for all couples', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 1 }, { id: 2 }]
    });

    await DailyQuestion.batchGenerateForAllCouples();

    expect(query).toHaveBeenCalled();
  });
});
```

**Step 5: 运行测试**

```bash
npm test -- tests/unit/dailyQuestion.test.js
```

**Step 6: Commit**

```bash
git add src/models/DailyQuestion.js tests/unit/dailyQuestion.test.js
git commit -m "fix: correct function name in batchGenerateForAllCouples"
```

---

### Task 5: 修复内存泄漏风险（rateLimiter）

**Files:**
- Modify: `src/middleware/rateLimiter.js`

**Step 1: 安装lru-cache**

```bash
npm install lru-cache
```

**Step 2: 修改rateLimiter使用LRU Cache**

完整替换 `src/middleware/rateLimiter.js`：

```javascript
// src/middleware/rateLimiter.js
const LRU = require('lru-cache');
const logger = require('../utils/logger');

// 使用LRU Cache替代Map，自动清理过期条目
const userLimits = new LRU({
  max: 10000,  // 最大缓存条目数
  ttl: 3600000,  // 1小时过期
  updateAgeOnGet: true,  // 获取时更新过期时间
  updateAgeOnHas: true
});

function rateLimiter(options = {}) {
  const {
    windowMs = 60000,  // 默认1分钟
    max = 10  // 默认10次请求
  } = options;

  return (req, res, next) => {
    const userId = req.user?.userId || req.ip;
    const key = `${userId}:${req.path}`;

    const now = Date.now();
    const record = userLimits.get(key);

    if (!record) {
      // 首次请求
      userLimits.set(key, {
        count: 1,
        resetTime: now + windowMs
      });
      return next();
    }

    if (now > record.resetTime) {
      // 时间窗口已过，重置计数
      record.count = 1;
      record.resetTime = now + windowMs;
      userLimits.set(key, record);
      return next();
    }

    if (record.count >= max) {
      // 超过限制
      logger.warn('Rate limit exceeded', { userId, path: req.path });
      return res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.ceil((record.resetTime - now) / 1000)
      });
    }

    // 增加计数
    record.count++;
    userLimits.set(key, record);
    next();
  };
}

module.exports = rateLimiter;
```

**Step 3: 创建测试**

**Files:**
- Create: `tests/unit/rateLimiter.test.js`

```javascript
// tests/unit/rateLimiter.test.js
const rateLimiter = require('../../src/middleware/rateLimiter');

jest.mock('../../src/utils/logger');

describe('Rate Limiter', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      user: { userId: 'test-user' },
      path: '/api/test'
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    next = jest.fn();
  });

  test('should allow requests within limit', () => {
    const middleware = rateLimiter({ windowMs: 60000, max: 5 });

    for (let i = 0; i < 5; i++) {
      middleware(req, res, next);
    }

    expect(next).toHaveBeenCalledTimes(5);
    expect(res.status).not.toHaveBeenCalled();
  });

  test('should block requests exceeding limit', () => {
    const middleware = rateLimiter({ windowMs: 60000, max: 2 });

    // 前2个请求通过
    middleware(req, res, next);
    middleware(req, res, next);

    // 第3个请求被拒绝
    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Too many requests' })
    );
  });

  test('should reset counter after window expires', async () => {
    const middleware = rateLimiter({ windowMs: 100, max: 2 });

    // 用完配额
    middleware(req, res, next);
    middleware(req, res, next);
    middleware(req, res, next);  // 被拒绝

    // 等待窗口过期
    await new Promise(resolve => setTimeout(resolve, 150));

    // 应该可以再次请求
    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(3);  // 2初始 + 1重置后
  });
});
```

**Step 4: 运行测试**

```bash
npm test -- tests/unit/rateLimiter.test.js
```

**Step 5: Commit**

```bash
git add src/middleware/rateLimiter.js tests/unit/rateLimiter.test.js package.json package-lock.json
git commit -m "fix: use LRU cache to prevent memory leak in rate limiter"
```

---

## P1: 代码质量问题修复

### Task 6: 修复Couple模型语法错误

**Files:**
- Modify: `src/models/Couple.js:155`

**Step 1: 查看错误**

```bash
sed -n '150,160p' src/models/Couple.js
```

**Step 2: 修复语法错误**

删除第155行多余的 `]`：

```javascript
// 修改前（有错误）
throw new Error(`Failed to update couple: ${error.message}`);
]
});

// 修改后
throw new Error(`Failed to update couple: ${error.message}`);
});
```

**Step 3: 验证语法**

```bash
node -c src/models/Couple.js
```

**Step 4: Commit**

```bash
git add src/models/Couple.js
git commit -m "fix: remove extra bracket in Couple model"
```

---

### Task 7: 移除coupleService中的Sequelize依赖

**Files:**
- Modify: `src/services/coupleService.js`

**Step 1: 查看Sequelize使用**

```bash
grep -n "Sequelize" src/services/coupleService.js
```

**Step 2: 移除Sequelize导入**

删除或注释第1行的Sequelize导入：

```javascript
// 删除这一行
// const { Sequelize } = require('sequelize');
```

**Step 3: 修改查询使用原生SQL**

找到使用 `Sequelize.Op` 的地方，改为原生SQL。

例如，如果有类似代码：
```javascript
const { Op } = require('sequelize');
{ [Op.or]: [{ user1_id: userId }, { user2_id: userId }] }
```

改为使用数据库查询函数。

**Step 4: Commit**

```bash
git add src/services/coupleService.js
git commit -m "refactor: remove Sequelize dependency from coupleService"
```

---

### Task 8: 消除重复代码（情感分析）

**Files:**
- Create: `src/utils/sentimentAnalyzer.js`
- Modify: `src/services/questionService.js`
- Modify: `src/utils/aiFallback.js`

**Step 1: 创建共享的情感分析工具**

```javascript
// src/utils/sentimentAnalyzer.js
const logger = require('./logger');

class SentimentAnalyzer {
  // 积极词汇库
  static POSITIVE_WORDS = [
    '开心', '快乐', '幸福', '高兴', '愉快', '满足', '喜欢', '爱',
    '棒', '好', '优秀', '完美', '精彩', '美丽', '漂亮', '可爱',
    '温暖', '甜蜜', '舒服', '轻松', '自由', '希望', '期待', '激动',
    '兴奋', '自豪', '感激', '感谢', '欣赏', '享受', '美好', 'positive'
  ];

  // 消极词汇库
  static NEGATIVE_WORDS = [
    '难过', '伤心', '痛苦', '悲伤', '沮丧', '失望', '生气', '愤怒',
    '讨厌', '恨', '烦躁', '焦虑', '担心', '害怕', '恐惧', '紧张',
    '累', '疲惫', '痛苦', '糟糕', '差', '坏', '丑', '烦', '闷',
    '孤独', '寂寞', '绝望', '放弃', '失败', '错误', '问题', '麻烦',
    '消极', 'negative', 'sad', 'bad', 'angry'
  ];

  /**
   * 简单的情感分析（基于关键词匹配）
   * @param {string} text - 要分析的文本
   * @returns {Object|null} - 返回情感分析结果或null
   */
  static simpleSentimentAnalysis(text) {
    if (!text || typeof text !== 'string') {
      return null;
    }

    const cleanedText = text.trim().toLowerCase();
    if (cleanedText.length === 0) {
      return null;
    }

    let positiveCount = 0;
    let negativeCount = 0;
    const keywords = [];

    // 统计积极词汇
    for (const word of this.POSITIVE_WORDS) {
      if (cleanedText.includes(word)) {
        positiveCount++;
        if (!keywords.includes(word)) {
          keywords.push(word);
        }
      }
    }

    // 统计消极词汇
    for (const word of this.NEGATIVE_WORDS) {
      if (cleanedText.includes(word)) {
        negativeCount++;
        if (!keywords.includes(word)) {
          keywords.push(word);
        }
      }
    }

    // 计算情感分数 (0-100)
    let sentiment, sentiment_score;

    if (positiveCount === 0 && negativeCount === 0) {
      sentiment = 'neutral';
      sentiment_score = 50;
    } else if (positiveCount > negativeCount) {
      sentiment = 'positive';
      sentiment_score = Math.min(50 + (positiveCount - negativeCount) * 10 + 20, 100);
    } else if (negativeCount > positiveCount) {
      sentiment = 'negative';
      sentiment_score = Math.max(50 - (negativeCount - positiveCount) * 10 - 20, 0);
    } else {
      sentiment = 'neutral';
      sentiment_score = 50;
    }

    return {
      sentiment,
      sentiment_score,
      keywords: keywords.slice(0, 5)  // 最多返回5个关键词
    };
  }

  /**
   * 从历史记录中提取关键词
   * @param {Array} history - 历史回答数组
   * @returns {Array} - 关键词数组
   */
  static extractKeywordsFromHistory(history) {
    const allKeywords = new Set();

    for (const record of history) {
      if (record.keywords && Array.isArray(record.keywords)) {
        record.keywords.forEach(keyword => allKeywords.add(keyword));
      }
    }

    return Array.from(allKeywords).slice(0, 10);
  }
}

module.exports = SentimentAnalyzer;
```

**Step 2: 修改questionService.js**

**Files:**
- Modify: `src/services/questionService.js:355-386`

删除 `simpleSentimentAnalysis` 方法，改为导入：

```javascript
// 在文件顶部添加导入
const SentimentAnalyzer = require('../utils/sentimentAnalyzer');
```

删除第355-386行的重复方法定义。

所有使用 `this.simpleSentimentAnalysis` 的地方改为 `SentimentAnalyzer.simpleSentimentAnalysis`。

**Step 3: 修改aiFallback.js**

**Files:**
- Modify: `src/utils/aiFallback.js:179-209`

同样删除重复的方法定义，改为导入：

```javascript
// 在文件顶部添加导入
const SentimentAnalyzer = require('./sentimentAnalyzer');
```

删除第179-209行的重复方法定义。

所有使用 `AIFallback.simpleSentimentAnalysis` 的地方改为 `SentimentAnalyzer.simpleSentimentAnalysis`。

**Step 4: 创建测试**

**Files:**
- Create: `tests/unit/sentimentAnalyzer.test.js`

```javascript
// tests/unit/sentimentAnalyzer.test.js
const SentimentAnalyzer = require('../../src/utils/sentimentAnalyzer');

jest.mock('../../src/utils/logger');

describe('SentimentAnalyzer', () => {
  describe('simpleSentimentAnalysis', () => {
    test('should detect positive sentiment', () => {
      const result = SentimentAnalyzer.simpleSentimentAnalysis('今天很开心，很幸福！');
      expect(result.sentiment).toBe('positive');
      expect(result.sentiment_score).toBeGreaterThan(50);
      expect(result.keywords).toContain('开心');
    });

    test('should detect negative sentiment', () => {
      const result = SentimentAnalyzer.simpleSentimentAnalysis('今天很难过，很伤心。');
      expect(result.sentiment).toBe('negative');
      expect(result.sentiment_score).toBeLessThan(50);
      expect(result.keywords).toContain('难过');
    });

    test('should detect neutral sentiment', () => {
      const result = SentimentAnalyzer.simpleSentimentAnalysis('今天天气怎么样？');
      expect(result.sentiment).toBe('neutral');
      expect(result.sentiment_score).toBe(50);
    });

    test('should return null for empty text', () => {
      expect(SentimentAnalyzer.simpleSentimentAnalysis('')).toBeNull();
      expect(SentimentAnalyzer.simpleSentimentAnalysis(null)).toBeNull();
    });

    test('should extract keywords', () => {
      const result = SentimentAnalyzer.simpleSentimentAnalysis('吃了火锅，很开心');
      expect(result.keywords).toContain('火锅');
      expect(result.keywords).toContain('开心');
    });
  });

  describe('extractKeywordsFromHistory', () => {
    test('should extract unique keywords from history', () => {
      const history = [
        { keywords: ['开心', '美食'] },
        { keywords: ['开心', '旅行'] },
        { keywords: ['美食', '电影'] }
      ];

      const keywords = SentimentAnalyzer.extractKeywordsFromHistory(history);
      expect(keywords).toContain('开心');
      expect(keywords).toContain('美食');
      expect(keywords).toContain('旅行');
      expect(keywords).toContain('电影');
    });

    test('should handle empty history', () => {
      const keywords = SentimentAnalyzer.extractKeywordsFromHistory([]);
      expect(keywords).toEqual([]);
    });
  });
});
```

**Step 5: 运行测试**

```bash
npm test -- tests/unit/sentimentAnalyzer.test.js
```

**Step 6: Commit**

```bash
git add src/utils/sentimentAnalyzer.js src/services/questionService.js src/utils/aiFallback.js tests/unit/sentimentAnalyzer.test.js
git commit -m "refactor: extract duplicate sentiment analysis to shared utility"
```

---

### Task 9: 修复WebSocket连接管理

**Files:**
- Modify: `src/utils/websocket.js:42-50`

**Step 1: 查看当前WebSocket实现**

```bash
sed -n '40,60p' src/utils/websocket.js
```

**Step 2: 修改为原生SQL查询**

找到使用Sequelize的代码，替换为原生SQL：

```javascript
// 修改前
const Couple = require('../models/Couple');
const couple = await Couple.findOne({
  where: {
    [Sequelize.Op.or]: [
      { user1_id: userId },
      { user2_id: userId }
    ]
  }
});

// 修改后
const { query } = require('./database');
const result = await query(
  'SELECT * FROM couples WHERE user1_id = $1 OR user2_id = $2',
  [userId, userId]
);
const couple = result.rows[0];
```

**Step 3: 验证语法**

```bash
node -c src/utils/websocket.js
```

**Step 4: Commit**

```bash
git add src/utils/websocket.js
git commit -m "fix: replace Sequelize with native SQL in WebSocket"
```

---

### Task 10: 添加API输入验证

**Files:**
- Modify: `src/api/couple.js:132-177`

**Step 1: 创建验证工具**

**Files:**
- Create: `src/utils/validator.js`

```javascript
// src/utils/validator.js

/**
 * 白名单验证工具
 * @param {Object} data - 要验证的数据
 * @param {Array} allowedFields - 允许的字段列表
 * @returns {Object} - 过滤后的数据
 */
function whitelistFilter(data, allowedFields) {
  const filtered = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined && data[field] !== null) {
      filtered[field] = data[field];
    }
  }

  return filtered;
}

/**
 * 验证字段类型
 * @param {Object} data - 数据对象
 * @param {Object} schema - 字段类型映射 { fieldName: 'string'|'number'|'boolean' }
 * @returns {Object} - { valid: boolean, errors: string[] }
 */
function validateTypes(data, schema) {
  const errors = [];

  for (const [field, expectedType] of Object.entries(schema)) {
    const value = data[field];

    if (value === undefined || value === null) {
      continue;  // 可选字段跳过
    }

    let actualType = typeof value;

    // 特殊处理数组和对象
    if (Array.isArray(value)) {
      actualType = 'array';
    } else if (value instanceof Date) {
      actualType = 'date';
    }

    if (actualType !== expectedType) {
      errors.push(`Field '${field}' must be ${expectedType}, got ${actualType}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  whitelistFilter,
  validateTypes
};
```

**Step 2: 修改couple更新接口**

**Files:**
- Modify: `src/api/couple.js`

在文件顶部添加导入：
```javascript
const { whitelistFilter } = require('../utils/validator');
```

找到更新接口，添加白名单验证：

```javascript
// 定义允许更新的字段
const ALLOWED_COUPLE_UPDATE_FIELDS = ['couple_name', 'anniversary_date', 'theme_color'];

// 更新情侣信息
router.put('/update', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.user;
    const { couple_id, ...requestData } = req.body;

    if (!couple_id) {
      return res.status(400).json({ error: 'couple_id is required' });
    }

    // 验证用户权限
    const couple = await Couple.findById(couple_id);
    if (!couple) {
      return res.status(404).json({ error: 'Couple not found' });
    }

    if (couple.user1_id !== userId && couple.user2_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // 白名单过滤
    const sanitizedUpdates = whitelistFilter(requestData, ALLOWED_COUPLE_UPDATE_FIELDS);

    if (Object.keys(sanitizedUpdates).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    // 执行更新
    const updatedCouple = await CoupleService.updateCouple(couple_id, sanitizedUpdates);

    logger.info('Couple updated', { coupleId: couple_id, userId, fields: Object.keys(sanitizedUpdates) });

    res.json({
      message: 'Couple updated successfully',
      couple: updatedCouple
    });
  } catch (error) {
    logger.error('Update couple error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update couple' });
  }
});
```

**Step 3: 创建测试**

**Files:**
- Create: `tests/unit/validator.test.js`

```javascript
// tests/unit/validator.test.js
const { whitelistFilter, validateTypes } = require('../../src/utils/validator');

describe('Validator', () => {
  describe('whitelistFilter', () => {
    test('should filter allowed fields only', () => {
      const data = {
        name: 'Test',
        age: 25,
        role: 'admin',  // 不在白名单
        password: 'secret'  // 不在白名单
      };

      const allowed = ['name', 'age'];
      const result = whitelistFilter(data, allowed);

      expect(result).toEqual({ name: 'Test', age: 25 });
      expect(result.role).toBeUndefined();
      expect(result.password).toBeUndefined();
    });

    test('should handle null and undefined values', () => {
      const data = {
        name: 'Test',
        age: null,
        email: undefined
      };

      const allowed = ['name', 'age', 'email'];
      const result = whitelistFilter(data, allowed);

      expect(result).toEqual({ name: 'Test' });
    });

    test('should return empty object when no allowed fields present', () => {
      const data = { role: 'admin', password: 'secret' };
      const allowed = ['name', 'email'];

      const result = whitelistFilter(data, allowed);
      expect(result).toEqual({});
    });
  });

  describe('validateTypes', () => {
    test('should validate correct types', () => {
      const data = { name: 'Test', age: 25, active: true };
      const schema = { name: 'string', age: 'number', active: 'boolean' };

      const result = validateTypes(data, schema);

      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('should detect type mismatches', () => {
      const data = { name: 'Test', age: '25', active: 'true' };
      const schema = { name: 'string', age: 'number', active: 'boolean' };

      const result = validateTypes(data, schema);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
```

**Step 4: 运行测试**

```bash
npm test -- tests/unit/validator.test.js
```

**Step 5: Commit**

```bash
git add src/utils/validator.js src/api/couple.js tests/unit/validator.test.js
git commit -m "feat: add input validation with whitelist filter for couple updates"
```

---

### Task 11: 改进问题去重算法

**Files:**
- Modify: `src/services/questionService.js:225-261`

**Step 1: 安装Levenshtein库**

```bash
npm install fast-levenshtein
```

**Step 2: 修改相似度计算方法**

**Files:**
- Modify: `src/services/questionService.js`

在文件顶部添加导入：
```javascript
const levenshtein = require('fast-levenshtein');
```

找到 `calculateTextSimilarity` 方法，替换为：

```javascript
static calculateTextSimilarity(text1, text2) {
  if (!text1 || !text2) {
    return 0;
  }

  // 标准化文本
  const normalized1 = text1.toLowerCase().trim();
  const normalized2 = text2.toLowerCase().trim();

  // 计算编辑距离
  const distance = levenshtein.get(normalized1, normalized2);

  // 计算相似度 (0-1)
  const maxLen = Math.max(normalized1.length, normalized2.length);

  if (maxLen === 0) {
    return 1;  // 两个空字符串视为完全相同
  }

  const similarity = 1 - (distance / maxLen);

  return similarity;
}
```

**Step 3: 创建测试**

**Files:**
- Create: `tests/unit/textSimilarity.test.js`

```javascript
// tests/unit/textSimilarity.test.js
const QuestionService = require('../../src/services/questionService');

jest.mock('../../src/utils/logger');

describe('Text Similarity Calculation', () => {
  test('should calculate similarity using Levenshtein distance', () => {
    const similarity = QuestionService.calculateTextSimilarity(
      '今天最开心的事是什么？',
      '今天最开心的事是啥？'
    );

    expect(similarity).toBeGreaterThan(0.8);  // 高相似度
  });

  test('should return 0 for empty strings', () => {
    expect(QuestionService.calculateTextSimilarity('', '')).toBe(1);
    expect(QuestionService.calculateTextSimilarity('test', '')).toBeLessThan(1);
  });

  test('should be case insensitive', () => {
    const similarity = QuestionService.calculateTextSimilarity(
      'Hello World',
      'hello world'
    );

    expect(similarity).toBe(1);
  });

  test('should detect low similarity', () => {
    const similarity = QuestionService.calculateTextSimilarity(
      '今天天气怎么样',
      '你喜欢吃什么食物'
    );

    expect(similarity).toBeLessThan(0.5);  // 低相似度
  });
});
```

**Step 4: 运行测试**

```bash
npm test -- tests/unit/textSimilarity.test.js
```

**Step 5: Commit**

```bash
git add src/services/questionService.js tests/unit/textSimilarity.test.js package.json package-lock.json
git commit -m "refactor: use Levenshtein distance for better text similarity calculation"
```

---

## P2: 性能优化

### Task 12: 解决N+1查询问题

**Files:**
- Modify: `src/services/analysisService.js:14-23`

**Step 1: 查看当前实现**

```bash
sed -n '10,30p' src/services/analysisService.js
```

**Step 2: 修改为JOIN查询**

```javascript
// 修改前
async getAnalysisData(coupleId, days = 30) {
  const history = await Answer.getHistoryByCouple(coupleId, days);

  const enrichedHistory = await Promise.all(
    history.map(async (answer) => {
      const question = await Question.findById(answer.question_id);
      return {
        ...answer,
        category: question?.category || 'daily',
        difficulty: question?.difficulty || 1
      };
    })
  );

  return enrichedHistory;
}

// 修改后
async getAnalysisData(coupleId, days = 30) {
  const { query } = require('../utils/database');

  const result = await query(`
    SELECT
      a.id,
      a.couple_id,
      a.question_id,
      a.answer_text,
      a.user_id,
      a.sentiment,
      a.sentiment_score,
      a.keywords,
      a.created_at,
      q.category,
      q.difficulty,
      q.question_text
    FROM answers a
    LEFT JOIN questions q ON a.question_id = q.id
    WHERE a.couple_id = $1
      AND a.created_at > NOW() - INTERVAL '${days} days'
    ORDER BY a.created_at DESC
  `, [coupleId]);

  return result.rows;
}
```

**Step 3: 创建性能测试**

**Files:**
- Create: `tests/performance/analysisService.test.js`

```javascript
// tests/performance/analysisService.test.js
const analysisService = require('../../src/services/analysisService');

jest.mock('../../src/utils/database');
jest.mock('../../src/utils/logger');

describe('AnalysisService Performance', () => {
  test('should efficiently load analysis data with JOIN', async () => {
    const { query } = require('../../src/utils/database');

    // Mock返回结果
    query.mockResolvedValue({
      rows: [
        {
          id: 1,
          question_id: 1,
          answer_text: 'Test answer',
          category: 'daily',
          difficulty: 1
        }
      ]
    });

    const startTime = Date.now();
    const result = await analysisService.getAnalysisData(1, 30);
    const duration = Date.now() - startTime;

    // 验证只调用一次数据库
    expect(query).toHaveBeenCalledTimes(1);

    // 验证SQL包含JOIN
    const sqlQuery = query.mock.calls[0][0];
    expect(sqlQuery).toContain('LEFT JOIN questions');
    expect(sqlQuery).toContain('SELECT');

    // 验证返回数据包含category
    expect(result[0].category).toBe('daily');

    // 性能检查：应该在100ms内完成
    expect(duration).toBeLessThan(100);
  });
});
```

**Step 4: 运行测试**

```bash
npm test -- tests/performance/analysisService.test.js
```

**Step 5: Commit**

```bash
git add src/services/analysisService.js tests/performance/analysisService.test.js
git commit -m "perf: fix N+1 query by using JOIN in getAnalysisData"
```

---

### Task 13: 优化数据库连接池

**Files:**
- Modify: `src/utils/database.js:4-13`

**Step 1: 查看当前配置**

```bash
sed -n '1,20p' src/utils/database.js
```

**Step 2: 优化连接池配置**

```javascript
// 修改前
const pool = new Pool({
  max: 10,
  min: 0,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000
});

// 修改后
const pool = new Pool({
  max: 20,                           // 增加最大连接数
  min: 2,                            // 保持最小连接数
  idleTimeoutMillis: 30000,          // 空闲连接30秒后释放
  connectionTimeoutMillis: 10000,    // 连接超时10秒
  statement_timeout: 30000,          // 查询超时30秒
  queueTimeoutMillis: 5000           // 队列等待超时5秒
});
```

**Step 3: 添加连接池监控**

```javascript
// 在database.js中添加监控日志
setInterval(() => {
  const { totalCount, idleCount, waitingCount } = pool;
  logger.debug('Database pool status', {
    total: totalCount,
    idle: idleCount,
    waiting: waitingCount
  });
}, 60000);  // 每分钟记录一次
```

**Step 4: Commit**

```bash
git add src/utils/database.js
git commit -m "perf: optimize database connection pool configuration"
```

---

### Task 14: 实现缓存策略

**Files:**
- Create: `src/utils/cache.js`

**Step 1: 创建缓存服务**

```javascript
// src/utils/cache.js
const { getRedisClient } = require('./redis');
const logger = require('./logger');

class CacheService {
  /**
   * 获取缓存
   * @param {string} key - 缓存键
   * @returns {Promise<any|null>}
   */
  static async get(key) {
    try {
      const client = getRedisClient();
      const value = await client.get(key);

      if (!value) return null;

      return JSON.parse(value);
    } catch (error) {
      logger.warn('Cache get failed', { key, error: error.message });
      return null;
    }
  }

  /**
   * 设置缓存
   * @param {string} key - 缓存键
   * @param {any} value - 缓存值
   * @param {number} ttl - 过期时间（秒），默认3600
   * @returns {Promise<boolean>}
   */
  static async set(key, value, ttl = 3600) {
    try {
      const client = getRedisClient();
      await client.setEx(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.warn('Cache set failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * 删除缓存
   * @param {string} key - 缓存键
   * @returns {Promise<boolean>}
   */
  static async del(key) {
    try {
      const client = getRedisClient();
      await client.del(key);
      return true;
    } catch (error) {
      logger.warn('Cache delete failed', { key, error: error.message });
      return false;
    }
  }

  /**
   * 批量删除匹配的缓存
   * @param {string} pattern - 匹配模式
   * @returns {Promise<number>}
   */
  static async delPattern(pattern) {
    try {
      const client = getRedisClient();
      const keys = await client.keys(pattern);

      if (keys.length === 0) return 0;

      await client.del(keys);
      return keys.length;
    } catch (error) {
      logger.warn('Cache delPattern failed', { pattern, error: error.message });
      return 0;
    }
  }

  /**
   * 获取或设置缓存（缓存穿透保护）
   * @param {string} key - 缓存键
   * @param {Function} fetchFn - 数据获取函数
   * @param {number} ttl - 过期时间
   * @returns {Promise<any>}
   */
  static async getOrSet(key, fetchFn, ttl = 3600) {
    // 先尝试从缓存获取
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    // 缓存未命中，执行数据获取
    const value = await fetchFn();

    // 只缓存有效值
    if (value !== null && value !== undefined) {
      await this.set(key, value, ttl);
    }

    return value;
  }

  /**
   * 用户缓存辅助方法
   */
  static async getUser(userId) {
    return this.getOrSet(
      `user:${userId}`,
      async () => {
        const User = require('../models/User');
        return await User.findById(userId);
      },
      1800  // 30分钟
    );
  }

  /**
   * 情侣缓存辅助方法
   */
  static async getCouple(coupleId) {
    return this.getOrSet(
      `couple:${coupleId}`,
      async () => {
        const Couple = require('../models/Couple');
        return await Couple.findById(coupleId);
      },
      1800  // 30分钟
    );
  }

  /**
   * 清除用户相关缓存
   */
  static async clearUserCache(userId) {
    await this.del(`user:${userId}`);
    await this.delPattern(`session:${userId}*`);
  }

  /**
   * 清除情侣相关缓存
   */
  static async clearCoupleCache(coupleId) {
    await this.del(`couple:${coupleId}`);
    await this.delPattern(`daily_question:${coupleId}*`);
  }
}

module.exports = CacheService;
```

**Step 2: 在服务中使用缓存**

例如在 `questionService.js` 中：

```javascript
const CacheService = require('../utils/cache');

// 获取情侣信息时使用缓存
async getCoupleInfo(coupleId) {
  return CacheService.getCouple(coupleId);
}

// 更新情侣信息后清除缓存
async updateCoupleInfo(coupleId, updates) {
  const result = await Couple.update(coupleId, updates);
  await CacheService.clearCoupleCache(coupleId);
  return result;
}
```

**Step 3: 创建测试**

**Files:**
- Create: `tests/unit/cache.test.js`

```javascript
// tests/unit/cache.test.js
const CacheService = require('../../src/utils/cache');
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');

jest.mock('../../src/utils/logger');

describe('CacheService', () => {
  beforeAll(async () => {
    await getRedisClient();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  afterEach(async () => {
    await CacheService.del('test:*');
  });

  test('should set and get value', async () => {
    await CacheService.set('test:key', { value: 'test' }, 60);
    const result = await CacheService.get('test:key');

    expect(result).toEqual({ value: 'test' });
  });

  test('should return null for non-existent key', async () => {
    const result = await CacheService.get('nonexistent');
    expect(result).toBeNull();
  });

  test('should delete value', async () => {
    await CacheService.set('test:delete', { value: 'test' });
    await CacheService.del('test:delete');

    const result = await CacheService.get('test:delete');
    expect(result).toBeNull();
  });

  test('should use getOrSet with fetch function', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ data: 'fetched' });

    // 第一次调用会执行fetch
    const result1 = await CacheService.getOrSet('test:fetch', fetchFn);
    expect(result1).toEqual({ data: 'fetched' });
    expect(fetchFn).toHaveBeenCalledTimes(1);

    // 第二次调用从缓存获取
    const result2 = await CacheService.getOrSet('test:fetch', fetchFn);
    expect(result2).toEqual({ data: 'fetched' });
    expect(fetchFn).toHaveBeenCalledTimes(1);  // 没有再次调用
  });

  test('should handle cache errors gracefully', async () => {
    // Mock Redis客户端抛出错误
    const client = getRedisClient();
    const originalGet = client.get.bind(client);
    client.get = jest.fn().mockRejectedValue(new Error('Redis error'));

    const result = await CacheService.get('test:error');
    expect(result).toBeNull();  // 应该返回null而不是抛出错误

    // 恢复原始方法
    client.get = originalGet;
  });
});
```

**Step 4: 运行测试**

```bash
npm test -- tests/unit/cache.test.js
```

**Step 5: Commit**

```bash
git add src/utils/cache.js tests/unit/cache.test.js
git commit -m "feat: add Redis caching service for frequently accessed data"
```

---

### Task 15: 规范日志级别

**Files:**
- Multiple files

**Step 1: 创建日志级别规范文档**

**Files:**
- Create: `docs/LOGGING_GUIDELINES.md`

```markdown
# 日志级别使用规范

## 级别定义

- **debug**: 调试信息，包含敏感数据，仅开发环境使用
- **info**: 一般业务信息，记录正常的业务流程
- **warn**: 警告信息，不影响运行但需要关注
- **error**: 错误信息，程序异常但可恢复
- **fatal**: 致命错误，导致服务不可用

## 使用场景

### debug
- 验证码内容（仅非生产环境）
- 详细的对象数据
- 开发调试信息

```javascript
if (process.env.NODE_ENV !== 'production') {
  logger.debug(`Verification code: ${code}`);
}
```

### info
- 用户登录/登出
- API请求成功
- 业务流程完成
- 系统启动/关闭

```javascript
logger.info(`User logged in`, { userId });
logger.info(`API request completed`, { path, duration });
```

### warn
- 限流触发
- 降级策略激活
- 慢查询警告
- 重试操作

```javascript
logger.warn(`Rate limit exceeded`, { userId, path });
logger.warn(`Slow query detected`, { duration, sql });
```

### error
- 数据库错误
- API调用失败
- 异常捕获

```javascript
logger.error(`Database query failed`, { error: err.message, stack: err.stack });
```
```

**Step 2: 修改auth.js日志**

**Files:**
- Modify: `src/api/auth.js:22`

```javascript
// 修改前
logger.info(`Verification code for ${phone}: ${code}`);

// 修改后
if (process.env.NODE_ENV !== 'production') {
  logger.debug(`Verification code for ${phone}: ${code}`);
}
```

**Step 3: 添加成功登录日志**

在登录成功后添加：

```javascript
logger.info(`User login successful`, { userId: user.id, phone });
```

**Step 4: Commit**

```bash
git add src/api/auth.js docs/LOGGING_GUIDELINES.md
git commit -m "chore: standardize logging levels across the codebase"
```

---

## P3: 架构改进（长期）

### Task 16: 创建AI健康检查器

**Files:**
- Create: `src/utils/aiHealthChecker.js`

**Step 1: 创建健康检查器**

```javascript
// src/utils/aiHealthChecker.js
const logger = require('./logger');

class AIHealthChecker {
  constructor() {
    // 服务健康状态
    this.serviceStatus = {
      iflow: { healthy: true, failCount: 0, lastCheck: Date.now(), lastError: null },
      ollama: { healthy: true, failCount: 0, lastCheck: Date.now(), lastError: null }
    };

    // 失败阈值（连续失败多少次后标记为不健康）
    this.failureThreshold = 3;

    // 恢复检查间隔（毫秒）
    this.recoveryCheckInterval = 60000;  // 1分钟

    // 健康检查定时器
    this.checkTimers = {};
  }

  /**
   * 标记服务失败
   * @param {string} service - 服务名称
   * @param {Error} error - 错误对象
   */
  markFailure(service, error) {
    const status = this.serviceStatus[service];

    if (!status) {
      logger.warn(`Unknown AI service: ${service}`);
      return;
    }

    status.failCount++;
    status.lastCheck = Date.now();
    status.lastError = error?.message || 'Unknown error';

    if (status.failCount >= this.failureThreshold && status.healthy) {
      status.healthy = false;
      logger.warn(`AI service ${service} marked as unhealthy`, {
        failCount: status.failCount,
        error: status.lastError
      });

      // 启动恢复检查
      this.startRecoveryCheck(service);
    }
  }

  /**
   * 标记服务成功
   * @param {string} service - 服务名称
   */
  markSuccess(service) {
    const status = this.serviceStatus[service];

    if (!status) {
      logger.warn(`Unknown AI service: ${service}`);
      return;
    }

    status.failCount = 0;
    status.lastCheck = Date.now();
    status.lastError = null;

    if (!status.healthy) {
      status.healthy = true;
      logger.info(`AI service ${service} recovered`);
      this.stopRecoveryCheck(service);
    }
  }

  /**
   * 检查服务是否健康
   * @param {string} service - 服务名称
   * @returns {boolean}
   */
  isHealthy(service) {
    const status = this.serviceStatus[service];
    return status ? status.healthy : false;
  }

  /**
   * 获取服务状态
   * @param {string} service - 服务名称
   * @returns {Object}
   */
  getStatus(service) {
    return this.serviceStatus[service] || null;
  }

  /**
   * 获取所有服务状态
   * @returns {Object}
   */
  getAllStatus() {
    return { ...this.serviceStatus };
  }

  /**
   * 启动恢复检查
   * @param {string} service - 服务名称
   */
  startRecoveryCheck(service) {
    // 清除现有定时器
    this.stopRecoveryCheck(service);

    // 设置新的检查定时器
    this.checkTimers[service] = setTimeout(async () => {
      logger.info(`Checking recovery for ${service}`);

      // 触发健康检查（由具体服务实现）
      // 这里只是标记，实际检查由服务自己完成
      this.serviceStatus[service].lastCheck = Date.now();

      // 继续下一次检查
      this.checkTimers[service] = setTimeout(() => {
        this.startRecoveryCheck(service);
      }, this.recoveryCheckInterval);
    }, this.recoveryCheckInterval);
  }

  /**
   * 停止恢复检查
   * @param {string} service - 服务名称
   */
  stopRecoveryCheck(service) {
    if (this.checkTimers[service]) {
      clearTimeout(this.checkTimers[service]);
      delete this.checkTimers[service];
    }
  }

  /**
   * 清理所有定时器
   */
  cleanup() {
    for (const service of Object.keys(this.checkTimers)) {
      this.stopRecoveryCheck(service);
    }
  }
}

// 导出单例
module.exports = new AIHealthChecker();
```

**Step 2: 集成到aiService.js**

**Files:**
- Modify: `src/services/aiService.js`

```javascript
// 在文件顶部添加导入
const aiHealthChecker = require('../utils/aiHealthChecker');

// 在调用心流API时
try {
  const result = await iflowAPI.generateQuestion(prompt);
  aiHealthChecker.markSuccess('iflow');
  return result;
} catch (error) {
  aiHealthChecker.markFailure('iflow', error);
  throw error;
}

// 添加健康检查端点
async healthCheck() {
  return aiHealthChecker.getAllStatus();
}
```

**Step 3: 添加健康检查API**

**Files:**
- Modify: `src/api/ai.js`

```javascript
// AI服务健康检查
router.get('/health', authMiddleware, async (req, res) => {
  const aiService = require('../services/aiService');
  const status = await aiService.healthCheck();

  res.json({
    services: status,
    timestamp: new Date().toISOString()
  });
});
```

**Step 4: 创建测试**

**Files:**
- Create: `tests/unit/aiHealthChecker.test.js`

```javascript
// tests/unit/aiHealthChecker.test.js
const aiHealthChecker = require('../../src/utils/aiHealthChecker');

jest.mock('../../src/utils/logger');

describe('AIHealthChecker', () => {
  afterEach(() => {
    // 重置状态
    aiHealthChecker.serviceStatus = {
      iflow: { healthy: true, failCount: 0, lastCheck: Date.now(), lastError: null },
      ollama: { healthy: true, failCount: 0, lastCheck: Date.now(), lastError: null }
    };
    aiHealthChecker.cleanup();
  });

  test('should mark service as unhealthy after threshold failures', () => {
    expect(aiHealthChecker.isHealthy('iflow')).toBe(true);

    // 标记失败3次
    for (let i = 0; i < 3; i++) {
      aiHealthChecker.markFailure('iflow', new Error('Test error'));
    }

    expect(aiHealthChecker.isHealthy('iflow')).toBe(false);
  });

  test('should recover service on success', () => {
    // 先标记为不健康
    for (let i = 0; i < 3; i++) {
      aiHealthChecker.markFailure('ollama', new Error('Test error'));
    }
    expect(aiHealthChecker.isHealthy('ollama')).toBe(false);

    // 标记成功
    aiHealthChecker.markSuccess('ollama');
    expect(aiHealthChecker.isHealthy('ollama')).toBe(true);
  });

  test('should get service status', () => {
    aiHealthChecker.markFailure('iflow', new Error('API error'));

    const status = aiHealthChecker.getStatus('iflow');
    expect(status.failCount).toBe(1);
    expect(status.lastError).toBe('API error');
  });

  test('should get all service status', () => {
    const allStatus = aiHealthChecker.getAllStatus();

    expect(allStatus).toHaveProperty('iflow');
    expect(allStatus).toHaveProperty('ollama');
  });
});
```

**Step 5: 运行测试**

```bash
npm test -- tests/unit/aiHealthChecker.test.js
```

**Step 6: Commit**

```bash
git add src/utils/aiHealthChecker.js src/services/aiService.js src/api/ai.js tests/unit/aiHealthChecker.test.js
git commit -m "feat: add AI service health checker with circuit breaker pattern"
```

---

### Task 17: 创建错误处理框架

**Files:**
- Create: `src/utils/errorHandler.js`

**Step 1: 创建错误类**

```javascript
// src/utils/errorHandler.js
const logger = require('./logger');

/**
 * 自定义应用错误基类
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
class BadRequestError extends AppError {
  constructor(message) {
    super(message, 400, true);
  }
}

/**
 * 401 Unauthorized
 */
class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401, true);
  }
}

/**
 * 403 Forbidden
 */
class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, true);
  }
}

/**
 * 404 Not Found
 */
class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, true);
  }
}

/**
 * 409 Conflict
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, true);
  }
}

/**
 * 429 Too Many Requests
 */
class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, true);
  }
}

/**
 * 500 Internal Server Error
 */
class InternalServerError extends AppError {
  constructor(message = 'Internal server error') {
    super(message, 500, false);
  }
}

/**
 * 503 Service Unavailable
 */
class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503, true);
  }
}

/**
 * 错误处理中间件
 */
function handleError(error, req, res, next) {
  // 记录错误
  if (error.isOperational) {
    logger.warn('Operational error', {
      message: error.message,
      statusCode: error.statusCode,
      path: req.path
    });
  } else {
    logger.error('Unexpected error', {
      message: error.message,
      stack: error.stack,
      path: req.path
    });
  }

  // 响应错误
  const response = {
    error: error.message
  };

  // 开发环境返回堆栈
  if (process.env.NODE_ENV !== 'production' && error.stack) {
    response.stack = error.stack;
  }

  res.status(error.statusCode || 500).json(response);
}

/**
 * 404处理中间件
 */
function handleNotFound(req, res, next) {
  const error = new NotFoundError(`Path not found: ${req.path}`);
  next(error);
}

/**
 * 异步错误包装器
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  InternalServerError,
  ServiceUnavailableError,
  handleError,
  handleNotFound,
  asyncHandler
};
```

**Step 2: 在app.js中使用**

**Files:**
- Modify: `src/index.js` 或 `src/app.js`

```javascript
const { handleError, handleNotFound } = require('./utils/errorHandler');

// 在所有路由之后添加404处理
app.use(handleNotFound);

// 添加错误处理中间件（必须最后）
app.use(handleError);
```

**Step 3: 在路由中使用**

**Files:**
- Modify: `src/api/couple.js`

```javascript
const { NotFoundError, ForbiddenError, asyncHandler } = require('../utils/errorHandler');

// 使用asyncHandler和自定义错误
router.get('/info', authMiddleware, asyncHandler(async (req, res) => {
  const { userId } = req.user;
  const couple = await Couple.findByUser(userId);

  if (!couple) {
    throw new NotFoundError('Couple relationship not found');
  }

  if (couple.user1_id !== userId && couple.user2_id !== userId) {
    throw new ForbiddenError('Access denied');
  }

  res.json({ couple });
}));
```

**Step 4: 创建测试**

**Files:**
- Create: `tests/unit/errorHandler.test.js`

```javascript
// tests/unit/errorHandler.test.js
const {
  AppError,
  BadRequestError,
  NotFoundError,
  ForbiddenError
} = require('../../src/utils/errorHandler');

jest.mock('../../src/utils/logger');

describe('Error Handler', () => {
  test('should create AppError with correct properties', () => {
    const error = new AppError('Test error', 400);

    expect(error.message).toBe('Test error');
    expect(error.statusCode).toBe(400);
    expect(error.isOperational).toBe(true);
    expect(error.timestamp).toBeDefined();
  });

  test('should create specific error types', () => {
    expect(new BadRequestError('Bad request').statusCode).toBe(400);
    expect(new UnauthorizedError().statusCode).toBe(401);
    expect(new ForbiddenError().statusCode).toBe(403);
    expect(new NotFoundError().statusCode).toBe(404);
  });

  test('should capture stack trace', () => {
    const error = new AppError('Test');
    expect(error.stack).toBeDefined();
  });
});
```

**Step 5: 运行测试**

```bash
npm test -- tests/unit/errorHandler.test.js
```

**Step 6: Commit**

```bash
git add src/utils/errorHandler.js src/index.js src/api/couple.js tests/unit/errorHandler.test.js
git commit -m "feat: add structured error handling framework"
```

---

### Task 18: 添加集成测试框架

**Files:**
- Create: `tests/integration/setup.js`
- Create: `tests/integration/teardown.js`

**Step 1: 创建测试设置**

```javascript
// tests/integration/setup.js
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');
const { pool } = require('../../src/utils/database');

async function setupTestDatabase() {
  // 使用测试数据库
  process.env.DB_NAME = 'our_daily_test';
}

async function setupTestRedis() {
  await getRedisClient();
}

async function clearTestData() {
  // 清理测试数据
  await pool.query('TRUNCATE TABLE users CASCADE');
  await pool.query('TRUNCATE TABLE couples CASCADE');
  await pool.query('TRUNCATE TABLE questions CASCADE');
  await pool.query('TRUNCATE TABLE answers CASCADE');
  await pool.query('TRUNCATE TABLE daily_questions CASCADE');
}

async function clearTestCache() {
  const client = getRedisClient();
  await client.flushDb();
}

module.exports = {
  setupTestDatabase,
  setupTestRedis,
  clearTestData,
  clearTestCache
};
```

**Step 2: 创建API集成测试**

**Files:**
- Create: `tests/integration/api.test.js`

```javascript
// tests/integration/api.test.js
const request = require('supertest');
const express = require('express');
const { setupTestDatabase, setupTestRedis, clearTestData, clearTestCache } = require('./setup');

const app = express();

describe('API Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
    await setupTestRedis();
  });

  afterEach(async () => {
    await clearTestData();
    await clearTestCache();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  describe('Auth Flow', () => {
    test('should complete full login flow', async () => {
      const phone = '13800138000';

      // 1. 发送验证码
      const sendResponse = await request(app)
        .post('/api/auth/send-code')
        .send({ phone });

      expect(sendResponse.status).toBe(200);

      // 2. 登录
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          phone,
          code: '123456'  // 测试时使用固定验证码
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeDefined();
      expect(loginResponse.body.user).toBeDefined();
    });
  });

  describe('Couple Flow', () => {
    let token1, token2;
    let userId1, userId2;

    beforeEach(async () => {
      // 创建两个测试用户并获取token
      // ... 实现
    });

    test('should bind couple successfully', async () => {
      const response = await request(app)
        .post('/api/couple/bind')
        .set('Authorization', `Bearer ${token1}`)
        .send({
          partner_phone: '13800138001',
          couple_name: '测试情侣'
        });

      expect(response.status).toBe(200);
      expect(response.body.couple).toBeDefined();
    });
  });

  describe('Question Flow', () => {
    let token;

    beforeEach(async () => {
      // 创建测试用户和情侣关系
      // ... 实现
    });

    test('should get today question', async () => {
      const response = await request(app)
        .get('/api/questions/today')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.question).toBeDefined();
    });

    test('should submit answer', async () => {
      const response = await request(app)
        .post('/api/questions/answer')
        .set('Authorization', `Bearer ${token}`)
        .send({
          question_id: 1,
          answer_text: '今天很开心！'
        });

      expect(response.status).toBe(200);
      expect(response.body.answer).toBeDefined();
    });
  });
});
```

**Step 3: 添加测试脚本**

**Files:**
- Modify: `package.json`

```json
{
  "scripts": {
    "test:integration": "jest --testPathPatterns=tests/integration --runInBand",
    "test:all": "npm test && npm run test:integration"
  }
}
```

**Step 4: Commit**

```bash
git add tests/integration/ package.json
git commit -m "test: add integration test framework and initial API tests"
```

---

## 最终验证

### Final Task: 全面测试和验证

**Step 1: 运行所有测试**

```bash
npm run test:all
```

Expected: 所有测试通过

**Step 2: 代码质量检查**

```bash
npm run lint
```

Expected: 无错误

**Step 3: 格式检查**

```bash
npm run format
```

**Step 4: 创建验收报告**

**Files:**
- Create: `docs/OPTIMIZATION_COMPLETION_REPORT.md`

```markdown
# 业务逻辑优化完成报告

**日期**: 2026-01-30
**项目**: 每日问答系统

## 完成任务清单

### P0: 严重安全问题 (4/4)
- [x] Task 1: 创建Redis客户端工具
- [x] Task 2: 修复验证码安全漏洞
- [x] Task 3: 修复绑定情侣逻辑错误
- [x] Task 4: 修复定时任务函数名错误
- [x] Task 5: 修复内存泄漏风险

### P1: 代码质量问题 (5/5)
- [x] Task 6: 修复Couple模型语法错误
- [x] Task 7: 移除Sequelize依赖
- [x] Task 8: 消除重复代码
- [x] Task 9: 修复WebSocket连接
- [x] Task 10: 添加API输入验证
- [x] Task 11: 改进去重算法

### P2: 性能优化 (5/5)
- [x] Task 12: 解决N+1查询
- [x] Task 13: 优化数据库连接池
- [x] Task 14: 实现缓存策略
- [x] Task 15: 规范日志级别

### P3: 架构改进 (4/4)
- [x] Task 16: 创建AI健康检查器
- [x] Task 17: 创建错误处理框架
- [x] Task 18: 添加集成测试

## 测试结果

- 单元测试: XX/XX 通过
- 集成测试: XX/XX 通过
- 代码覆盖率: XX%

## 性能对比

| 指标 | 优化前 | 优化后 |
|------|--------|--------|
| API响应时间(P95) | - | < 500ms |
| 数据库查询次数 | - | 减少 XX% |
| 内存使用 | - | 稳定 |

## 后续建议

1. 监控生产环境性能指标
2. 定期进行安全审计
3. 持续增加测试覆盖率
4. 考虑引入性能监控工具
```

**Step 5: 创建最终提交**

```bash
git add docs/OPTIMIZATION_COMPLETION_REPORT.md
git commit -m "docs: add optimization completion report"
```

**Step 6: 打标签**

```bash
git tag -a v1.1.0 -m "Business logic optimization release"
git push origin v1.1.0
```

---

## 附录：环境变量更新

确保 `.env` 文件包含以下新增配置：

```env
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_URL=redis://localhost:6379/0
```

---

**计划完成！** 所有18个任务已详细规划，可直接使用 `superpowers:executing-plans` 执行。
