const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;
const logger = require('./utils/logger');
const WebSocketServer = require('./utils/websocket');

// 导入定时任务
const dailyQuestionTask = require('./tasks/dailyQuestion');
const weeklyReportTask = require('./tasks/weeklyReport');
const monthlyReportTask = require('./tasks/monthlyReport');

// 导入安全中间件
const {
  securityHeaders,
  validateInput,
  requestLogger,
  errorHandler,
  sqlInjectionProtection,
  xssProtection
} = require('./middleware/security');

// 安全中间件
app.use(securityHeaders);
app.use(requestLogger);

// CORS配置
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 基础中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 输入验证和安全检查
app.use(validateInput);
app.use(sqlInjectionProtection);
app.use(xssProtection);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
const authRouter = require('./api/auth');
const questionsRouter = require('./api/questions');
const coupleRouter = require('./api/couple');
const memoriesRouter = require('./api/memories');
const userRouter = require('./api/user');
const aiRouter = require('./api/ai');

app.use('/api/auth', authRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/couple', coupleRouter);
app.use('/api/memories', memoriesRouter);
app.use('/api/user', userRouter);
app.use('/api/ai', aiRouter);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

server.listen(PORT, () => {
  // 初始化WebSocket服务器
  const wsServer = new WebSocketServer(server);
  
  // Set WebSocket server instance for questions route
  questionsRouter.setWebSocketServer(wsServer);
  logger.info(`Server is running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  
  // 启动定时任务
  if (process.env.NODE_ENV === 'production') {
    logger.info('Starting scheduled tasks...');
    
    // 启动每日问题推送任务
    dailyQuestionTask.start();
    logger.info('Daily question task started');
    
    // 启动周报生成任务
    weeklyReportTask.start();
    logger.info('Weekly report task started');
    
    // 启动月报生成任务
    monthlyReportTask.start();
    logger.info('Monthly report task started');
  } else {
    logger.info('Scheduled tasks disabled in development mode');
  }
});

module.exports = app;