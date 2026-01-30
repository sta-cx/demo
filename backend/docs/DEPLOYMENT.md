# backend/docs/DEPLOYMENT.md

# 部署指南

## 环境要求

- Node.js >= 18.x
- PostgreSQL >= 14.x
- PM2 (生产环境进程管理)

## 环境变量配置

### 必需配置

```bash
# 数据库
DB_HOST=your_db_host
DB_PORT=5432
DB_NAME=our_daily
DB_USER=your_db_user
DB_PASSWORD=your_db_password

# JWT密钥 (生成随机字符串)
JWT_SECRET=your_random_secret_key

# 微信小程序
WECHAT_APPID=your_mini_program_appid
WECHAT_SECRET=your_mini_program_secret
```

### AI服务配置 (至少配置一个)

#### 方案1: 心流API (推荐，主服务)

```bash
IFLOW_API_KEY=your_iflow_api_key
IFLOW_BASE_URL=https://api.iflow.cn/v1
```

#### 方案2: 本地Ollama (备用方案)

```bash
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen2:7b
```

**AI降级策略**：
1. 优先使用心流API
2. 心流API故障时自动切换到Ollama本地
3. 两者都不可用时使用预设问题库

### 微信消息推送配置

1. 在微信小程序后台订阅消息中创建模板
2. 获取模板ID并配置：

```bash
WECHAT_DAILY_QUESTION_TEMPLATE_ID=your_template_id
```

## 数据库初始化

### 1. 创建数据库

```bash
createdb our_daily
```

### 2. 执行迁移脚本

```bash
cd backend
npm run migrate
```

### 3. 初始化预设问题

```bash
npm run seed
```

## 本地开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# 查看日志
npm run logs
```

## 生产部署

### 使用PM2部署

```bash
# 启动应用
pm2 start ecosystem.config.js

# 查看日志
pm2 logs our-daily-backend

# 查看状态
pm2 status

# 重启应用
pm2 restart our-daily-backend

# 停止应用
pm2 stop our-daily-backend
```

### Docker部署 (可选)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
```

```bash
# 构建镜像
docker build -t our-daily-backend .

# 运行容器
docker run -d \
  --name our-daily-backend \
  -p 3000:3000 \
  --env-file .env \
  our-daily-backend
```

## 定时任务

定时任务将在生产环境 (`NODE_ENV=production`) 自动启动：

- 每日问题推送: 每天 21:00
- 周报生成: 每周一 00:00
- 月报生成: 每月1日 00:00

## 健康检查

```bash
curl http://localhost:3000/health
```

## 日志

日志文件位置: `logs/`

- `combined.log`: 所有日志
- `error.log`: 错误日志
- `access.log`: HTTP请求日志

## 故障排查

### AI服务不可用

检查AI服务状态：

```bash
curl http://localhost:3000/api/ai/health
```

如果心流API不可用，系统会自动降级到：
1. Ollama本地服务 (如果启用)
2. 预设问题库

### 数据库连接失败

检查数据库配置和网络连接：

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

### 微信推送失败

1. 检查 `WECHAT_APPID` 和 `WECHAT_SECRET` 是否正确
2. 检查模板ID是否配置
3. 确保用户已授权订阅消息

## 备份

### 数据库备份

```bash
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql
```

### 恢复

```bash
psql -h $DB_HOST -U $DB_USER $DB_NAME < backup_20240130.sql
```
