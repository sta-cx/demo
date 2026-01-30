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
