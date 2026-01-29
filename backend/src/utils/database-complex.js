const { Pool } = require('pg');
require('dotenv').config();

// 简单的内存缓存实现
class SimpleCache {
  constructor(ttl = 300000) { // 默认5分钟TTL
    this.cache = new Map();
    this.ttl = ttl;
  }

  set(key, value) {
    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.value;
  }

  clear() {
    this.cache.clear();
  }

  delete(key) {
    this.cache.delete(key);
  }
}

// 创建缓存实例
const queryCache = new SimpleCache(300000); // 5分钟缓存
const staticDataCache = new SimpleCache(3600000); // 1小时缓存（用于静态数据）

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'our_daily',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 10, // 减少最大连接数
  min: 0, // 不保持最小连接
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  // 优化连接池配置
  acquireTimeoutMillis: 10000,
  createTimeoutMillis: 5000,
  destroyTimeoutMillis: 5000,
  reapIntervalMillis: 1000,
  createRetryIntervalMillis: 200
});

// 带缓存的查询函数
const query = async (text, params, useCache = false, cacheTTL = 300000) => {
  const start = Date.now();
  
  // 如果启用缓存，尝试从缓存获取
  if (useCache) {
    const cacheKey = `${text}:${JSON.stringify(params)}`;
    const cached = queryCache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }
  
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    
    // 记录慢查询（超过100ms）
    if (duration > 100) {
      console.warn('Slow query detected', { text, duration, rows: res.rowCount });
    }
    
    // 如果启用缓存，将结果存入缓存
    if (useCache) {
      const cacheKey = `${text}:${JSON.stringify(params)}`;
      queryCache.set(cacheKey, res);
    }
    
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
};

// 缓存静态数据查询
const queryStatic = async (text, params) => {
  const cacheKey = `static:${text}:${JSON.stringify(params)}`;
  const cached = staticDataCache.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  const result = await query(text, params);
  staticDataCache.set(cacheKey, result);
  return result;
};

// 清理缓存
const clearCache = (pattern = null) => {
  if (pattern) {
    // 清理匹配模式的缓存
    for (const key of queryCache.cache.keys()) {
      if (key.includes(pattern)) {
        queryCache.delete(key);
      }
    }
    for (const key of staticDataCache.cache.keys()) {
      if (key.includes(pattern)) {
        staticDataCache.delete(key);
      }
    }
  } else {
    // 清理所有缓存
    queryCache.clear();
    staticDataCache.clear();
  }
};

// 定期清理过期缓存
setInterval(() => {
  // 简单的清理机制，实际的TTL检查在get方法中进行
  if (queryCache.cache.size > 1000) {
    queryCache.clear();
    console.log('Query cache cleared due to size limit');
  }
  
  if (staticDataCache.cache.size > 100) {
    staticDataCache.clear();
    console.log('Static data cache cleared due to size limit');
  }
}, 60000); // 每分钟检查一次

// 监听连接池事件
pool.on('connect', (client) => {
  console.log('New client connected to PostgreSQL database');
});

pool.on('acquire', (client) => {
  // 可以在这里添加连接获取的监控
});

pool.on('remove', (client) => {
  console.log('Client removed from pool');
});

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  // 不要直接退出，让连接池处理错误
});

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('Shutting down database pool...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down database pool...');
  await pool.end();
  process.exit(0);
});

module.exports = {
  query,
  queryStatic,
  clearCache,
  pool,
  queryCache,
  staticDataCache
};