const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'our_daily',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  max: 10,
  min: 0,
  connectionTimeoutMillis: 5000,
});

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
  pool
};