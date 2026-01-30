/**
 * Integration Test Setup Utilities
 * Provides database and Redis setup/teardown for integration tests
 */

const { Pool } = require('pg');
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');

// Test database configuration
const testDbConfig = {
  host: process.env.TEST_DB_HOST || process.env.DB_HOST || 'localhost',
  port: process.env.TEST_DB_PORT || process.env.DB_PORT || 5432,
  database: process.env.TEST_DB_NAME || 'our_daily_test',
  user: process.env.TEST_DB_USER || process.env.DB_USER || 'postgres',
  password: process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

let pool = null;
let redis = null;

/**
 * Setup test database connection
 * Creates a connection pool for integration tests
 */
async function setupTestDatabase() {
  if (pool) {
    return pool;
  }

  try {
    pool = new Pool(testDbConfig);

    // Test connection
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    console.log('✓ Test database connected successfully');
    return pool;
  } catch (error) {
    console.error('✗ Failed to connect to test database:', error.message);
    throw error;
  }
}

/**
 * Setup test Redis connection
 */
async function setupTestRedis() {
  if (redis) {
    return redis;
  }

  try {
    redis = await getRedisClient();

    // Test connection
    await redis.ping();

    console.log('✓ Test Redis connected successfully');
    return redis;
  } catch (error) {
    console.error('✗ Failed to connect to test Redis:', error.message);
    throw error;
  }
}

/**
 * Clear test data from database
 * Removes all test data while preserving schema
 */
async function clearTestData() {
  if (!pool) {
    throw new Error('Database not setup. Call setupTestDatabase() first.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Clear tables in correct order (respecting foreign key constraints)
    await client.query('DELETE FROM answers WHERE user_id IN (SELECT id FROM users WHERE phone LIKE \'138%\' OR phone LIKE \'139%\' OR phone LIKE \'136%\' OR phone LIKE \'135%\' OR phone LIKE \'137%\')');
    await client.query('DELETE FROM daily_questions WHERE couple_id IN (SELECT id FROM couples WHERE couple_name LIKE \'Test%\' OR couple_name LIKE \'测试%\')');
    await client.query('DELETE FROM couples WHERE couple_name LIKE \'Test%\' OR couple_name LIKE \'测试%\'');
    await client.query('DELETE FROM users WHERE phone LIKE \'138%\' OR phone LIKE \'139%\' OR phone LIKE \'136%\' OR phone LIKE \'135%\' OR phone LIKE \'137%\'');

    await client.query('COMMIT');
    console.log('✓ Test data cleared from database');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('✗ Failed to clear test data:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Clear test cache from Redis
 * Removes all test-related keys from Redis
 */
async function clearTestCache() {
  if (!redis) {
    throw new Error('Redis not setup. Call setupTestRedis() first.');
  }

  try {
    // Clear all SMS verification codes for test phone numbers
    const smsKeys = await redis.keys('sms:*');
    if (smsKeys.length > 0) {
      await redis.del(smsKeys);
    }

    // Clear rate limiters for test IPs
    const rateLimitKeys = await redis.keys('ratelimit:*');
    if (rateLimitKeys.length > 0) {
      await redis.del(rateLimitKeys);
    }

    // Clear question cache
    const cacheKeys = await redis.keys('cache:*');
    if (cacheKeys.length > 0) {
      await redis.del(cacheKeys);
    }

    console.log('✓ Test cache cleared from Redis');
  } catch (error) {
    console.error('✗ Failed to clear test cache:', error.message);
    throw error;
  }
}

/**
 * Close all test connections
 */
async function teardownTest() {
  const promises = [];

  if (pool) {
    promises.push(
      pool.end().then(() => {
        console.log('✓ Test database connection closed');
        pool = null;
      })
    );
  }

  if (redis) {
    promises.push(
      closeRedisClient().then(() => {
        console.log('✓ Test Redis connection closed');
        redis = null;
      })
    );
  }

  await Promise.all(promises);
}

/**
 * Create test user in database
 */
async function createTestUser(phone, nickname = null) {
  if (!pool) {
    throw new Error('Database not setup. Call setupTestDatabase() first.');
  }

  const result = await pool.query(
    'INSERT INTO users (phone, nickname) VALUES ($1, $2) RETURNING *',
    [phone, nickname]
  );

  return result.rows[0];
}

/**
 * Create test couple in database
 */
async function createTestCouple(user1Id, user2Id, coupleName = 'Test Couple') {
  if (!pool) {
    throw new Error('Database not setup. Call setupTestDatabase() first.');
  }

  const result = await pool.query(
    'INSERT INTO couples (user1_id, user2_id, couple_name) VALUES ($1, $2, $3) RETURNING *',
    [user1Id, user2Id, coupleName]
  );

  return result.rows[0];
}

/**
 * Generate a unique test phone number
 */
function generateTestPhone(suffix = null) {
  if (suffix !== null) {
    return `13800${String(suffix).padStart(5, '0')}`;
  }
  return `138${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`;
}

/**
 * Execute a raw SQL query
 */
async function executeQuery(text, params = []) {
  if (!pool) {
    throw new Error('Database not setup. Call setupTestDatabase() first.');
  }

  const result = await pool.query(text, params);
  return result;
}

module.exports = {
  setupTestDatabase,
  setupTestRedis,
  clearTestData,
  clearTestCache,
  teardownTest,
  createTestUser,
  createTestCouple,
  generateTestPhone,
  executeQuery,
  get pool() {
    return pool;
  },
  get redis() {
    return redis;
  },
};
