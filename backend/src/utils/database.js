const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'our_daily',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 20,
  min: 2,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
});

// 连接池监控日志（每60秒）
let logInterval;
if (process.env.NODE_ENV === 'production' || process.env.DB_POOL_LOGGING === 'true') {
  logInterval = setInterval(() => {
    const { totalCount, idleCount, waitingCount } = pool;
    console.log('DB Pool Status', {
      total: totalCount,
      idle: idleCount,
      waiting: waitingCount,
      timestamp: new Date().toISOString()
    });
  }, 60000);
}

const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 100) {
      console.warn('Slow query detected', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (error) {
    console.error('Database query error', { text, error });
    throw error;
  }
};

pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
});

const cleanup = async () => {
  console.log('Shutting down database pool...');
  if (logInterval) {
    clearInterval(logInterval);
  }
  await pool.end();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

module.exports = {
  query,
  pool
};