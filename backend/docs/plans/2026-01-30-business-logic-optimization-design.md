# 业务逻辑优化设计文档

**日期**: 2026-01-30
**项目**: 每日问答系统
**目的**: 系统性解决现有业务逻辑问题

---

## 一、问题总览

| 优先级 | 问题数 | 类别 |
|--------|--------|------|
| P0 | 4 | 严重安全问题 |
| P1 | 5 | 代码质量 |
| P2 | 5 | 性能优化 |
| P3 | 4 | 架构改进 |

---

## 二、P0 严重问题（立即修复）

### 2.1 验证码安全漏洞

**当前问题** (`src/api/auth.js:22,44`):
```javascript
// 验证码直接打印到日志
logger.info(`Verification code for ${phone}: ${code}`);

// 登录时仅验证格式，未验证正确性
if (code.length !== 6 || !/^\d{6}$/.test(code)) {
```

**修复方案**:
1. 集成Redis存储验证码，5分钟过期
2. 移除生产环境验证码日志
3. 添加验证码尝试次数限制（5次/小时）
4. 实现验证码正确性验证

**实现细节**:
```javascript
// 发送验证码时
const redisClient = require('../utils/redis');
await redisClient.setex(`sms:code:${phone}`, 300, code);
await redisClient.incr(`sms:attempts:${phone}`);
await redisClient.expire(`sms:attempts:${phone}`, 3600);

// 验证时
const storedCode = await redisClient.get(`sms:code:${phone}`);
const attempts = await redisClient.get(`sms:attempts:${phone}`);
if (attempts > 5) {
  return res.status(429).json({ error: 'Too many attempts' });
}
if (storedCode !== code) {
  return res.status(401).json({ error: 'Invalid code' });
}
```

---

### 2.2 绑定情侣逻辑错误

**当前问题** (`src/services/coupleService.js:90-96`):
```javascript
const couple = await CoupleService.bindCouple(
  userId,
  partner_phone,  // 错误：传入手机号而非user2Id
  couple_name,
  userPhone,
  partner_phone
);
```

**修复方案**:
```javascript
// 先通过手机号查询用户ID
const User = require('../models/User');
const partnerUser = await User.findByPhone(partner_phone);

if (!partnerUser) {
  throw new Error('Partner user not found');
}

// 使用正确的user2Id
const couple = await CoupleService.bindCouple(
  userId,
  partnerUser.id,  // 正确的user2Id
  couple_name,
  userPhone,
  partner_phone
);
```

---

### 2.3 定时任务函数名错误

**当前问题** (`src/models/DailyQuestion.js:245`):
```javascript
const dailyQuestion = await DailyGenerateTodayQuestion(couple.id);
// 函数名不存在，会导致崩溃
```

**修复方案**:
```javascript
const dailyQuestion = await DailyQuestion.generateTodayQuestion(couple.id);
```

---

### 2.4 内存泄漏风险

**当前问题** (`src/middleware/rateLimiter.js:5,180`):
```javascript
const userLimits = new Map();  // 无限增长
// startUserLimitCleanup(userLimits);  // 被注释
```

**修复方案**:
1. 启用清理定时任务
2. 使用LRU Cache替代Map

```javascript
const LRU = require('lru-cache');
const userLimits = new LRU({
  max: 10000,
  ttl: 3600000,  // 1小时
  updateAgeOnGet: true
});
```

---

## 三、P1 代码质量问题（本周内）

### 3.1 统一数据访问层

**问题**: Sequelize与原生SQL混用，存在语法错误

**方案**: 统一使用原生SQL（项目已建立此模式）

```javascript
// 移除Sequelize导入
// const { Sequelize } = require('sequelize');  // 删除

// 统一使用原生SQL查询
async function findByUser(userId) {
  const result = await query(
    'SELECT * FROM couples WHERE user1_id = $1 OR user2_id = $2',
    [userId, userId]
  );
  return result.rows[0];
}
```

**需修复文件**:
- `src/models/Couple.js:155` - 修复语法错误
- `src/services/coupleService.js` - 移除Sequelize依赖
- `src/utils/websocket.js` - 改用原生SQL

---

### 3.2 消除重复代码

**问题**: `simpleSentimentAnalysis` 在两处重复

**方案**: 提取到共享工具模块

```javascript
// src/utils/sentimentAnalyzer.js (新建)
class SentimentAnalyzer {
  static simpleSentimentAnalysis(text) {
    // 统一实现
  }
}

// questionService.js 和 aiFallback.js 改为
const SentimentAnalyzer = require('../utils/sentimentAnalyzer');
```

---

### 3.3 修复WebSocket连接管理

**问题**: 混用Sequelize语法

**方案**:
```javascript
// src/utils/websocket.js
// 改用原生SQL查询情侣关系
async function getCoupleByUser(userId) {
  const result = await query(
    'SELECT * FROM couples WHERE user1_id = $1 OR user2_id = $2',
    [userId, userId]
  );
  return result.rows[0];
}
```

---

### 3.4 添加API输入验证

**问题**: 更新接口未验证字段名

**方案**:
```javascript
// 定义允许更新的字段白名单
const ALLOWED_UPDATE_FIELDS = ['couple_name', 'anniversary_date'];

router.put('/update', authMiddleware, async (req, res) => {
  const { couple_id, couple_name, ...updates } = req.body;

  // 白名单过滤
  const sanitizedUpdates = {};
  for (const key of ALLOWED_UPDATE_FIELDS) {
    if (updates[key] !== undefined) {
      sanitizedUpdates[key] = updates[key];
    }
  }

  const updatedCouple = await CoupleService.updateCouple(
    couple_id,
    { couple_name, ...sanitizedUpdates }
  );
});
```

---

### 3.5 改进问题去重算法

**问题**: 仅基于字符重叠度

**方案**: 使用Levenshtein距离

```javascript
static calculateTextSimilarity(text1, text2) {
  const distance = levenshtein(text1, text2);
  const maxLen = Math.max(text1.length, text2.length);
  return 1 - (distance / maxLen);
}
```

---

## 四、P2 性能优化（两周内）

### 4.1 解决N+1查询

**问题**: 每个回答单独查询问题

**方案**: 使用JOIN

```javascript
// src/services/analysisService.js
async getAnalysisData(coupleId, days = 30) {
  const result = await query(`
    SELECT
      a.*,
      q.category,
      q.difficulty
    FROM answers a
    LEFT JOIN questions q ON a.question_id = q.id
    WHERE a.couple_id = $1
      AND a.created_at > NOW() - INTERVAL '${days} days'
    ORDER BY a.created_at DESC
  `, [coupleId]);

  return result.rows;
}
```

---

### 4.2 AI降级策略优化

**问题**: 串行尝试，未缓存状态

**方案**: 实现健康检查缓存和熔断器

```javascript
// src/utils/aiHealthChecker.js (新建)
class AIHealthChecker {
  constructor() {
    this.serviceStatus = {
      iflow: { healthy: true, failCount: 0, lastCheck: Date.now() },
      ollama: { healthy: true, failCount: 0, lastCheck: Date.now() }
    };
    this.failureThreshold = 3;
  }

  markFailure(service) {
    const status = this.serviceStatus[service];
    status.failCount++;
    if (status.failCount >= this.failureThreshold) {
      status.healthy = false;
      logger.warn(`AI service ${service} marked unhealthy`);
    }
  }

  isHealthy(service) {
    return this.serviceStatus[service].healthy;
  }
}
```

---

### 4.3 优化数据库连接池

**问题**: min: 0, 超时过短

**方案**:
```javascript
// src/utils/database.js
const pool = new Pool({
  max: 20,
  min: 2,  // 保持最小连接
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000  // 增加到10秒
});
```

---

### 4.4 实现缓存策略

**方案**: 使用Redis缓存

```javascript
// src/utils/cache.js (新建)
class CacheService {
  static async get(key) {
    return await redisClient.get(key);
  }

  static async set(key, value, ttl = 3600) {
    await redisClient.setex(key, ttl, JSON.stringify(value));
  }

  static async getUser(userId) {
    const cached = await this.get(`user:${userId}`);
    if (cached) return JSON.parse(cached);

    const user = await User.findById(userId);
    if (user) await this.set(`user:${userId}`, user, 1800);
    return user;
  }
}
```

---

### 4.5 规范日志级别

**方案**:
```javascript
// 敏感信息使用debug
logger.debug(`Verification code for ${phone}: ${code}`);

// 业务操作使用info
logger.info(`User ${userId} logged in`);

// 警告使用warn
logger.warn(`Rate limit exceeded for ${userId}`);

// 错误使用error
logger.error(`Database connection failed`, { error: err.stack });
```

---

## 五、P3 架构改进（长期）

### 5.1 Repository模式

```javascript
// src/repositories/BaseRepository.js
class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  async findById(id) {
    const result = await query(`SELECT * FROM ${this.tableName} WHERE id = $1`, [id]);
    return result.rows[0];
  }
}

// src/repositories/CoupleRepository.js
class CoupleRepository extends BaseRepository {
  constructor() {
    super('couples');
  }

  async findByUser(userId) {
    // 实现特定查询
  }
}
```

---

### 5.2 定时任务监控

```javascript
// src/utils/taskMonitor.js (新建)
class TaskMonitor {
  static async recordExecution(taskName, status, duration, error) {
    await query(`
      INSERT INTO task_executions (task_name, status, duration, error, created_at)
      VALUES ($1, $2, $3, $4, NOW())
    `, [taskName, status, duration, error]);
  }

  static async alertFailure(taskName, error) {
    // 发送告警通知
  }
}
```

---

### 5.3 改进错误处理

```javascript
// src/utils/errorHandler.js (新建)
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
  }
}

function handleError(error, req, res, next) {
  if (error.isOperational) {
    return res.status(error.statusCode).json({ error: error.message });
  }
  logger.error('Unexpected error', { error: error.stack });
  res.status(500).json({ error: 'Internal server error' });
}
```

---

### 5.4 集成测试

```javascript
// tests/integration/api.test.js (新建)
describe('User API Integration', () => {
  test('should complete login flow', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ phone: '13800138000', code: '123456' });

    expect(response.status).toBe(200);
    expect(response.body.token).toBeDefined();
  });
});
```

---

## 六、实施计划

### 第一周 (P0)
- [ ] 修复验证码安全漏洞
- [ ] 修复绑定情侣逻辑
- [ ] 修复定时任务函数名
- [ ] 启用rateLimiter清理

### 第二周 (P1)
- [ ] 统一数据访问层
- [ ] 消除重复代码
- [ ] 修复WebSocket连接
- [ ] 添加API验证
- [ ] 改进去重算法

### 第三-四周 (P2)
- [ ] 优化N+1查询
- [ ] 实现AI健康检查
- [ ] 优化连接池
- [ ] 实现缓存策略
- [ ] 规范日志

### 长期 (P3)
- [ ] Repository重构
- [ ] 定时任务监控
- [ ] 改进错误处理
- [ ] 添加集成测试

---

## 七、风险评估

| 修复项 | 风险级别 | 缓解措施 |
|--------|----------|----------|
| 验证码修复 | 中 | 充分测试登录流程 |
| 绑定逻辑修复 | 低 | 添加单元测试 |
| 数据层统一 | 高 | 增加测试覆盖，分批迁移 |
| 性能优化 | 低 | 监控性能指标 |

---

## 八、验收标准

- [ ] 所有P0问题修复并测试通过
- [ ] 代码无重复，通过linter检查
- [ ] API响应时间 < 500ms (P95)
- [ ] 无内存泄漏（7天稳定运行）
- [ ] 测试覆盖率 > 70%

---

审核完成日期: 2026-01-30
审核人员: Claude Code
文档版本: 1.0
