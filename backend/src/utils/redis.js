// src/utils/redis.js
const redis = require('redis');
const logger = require('./logger');

let client = null;
let connectingPromise = null;

async function getRedisClient() {
  if (client) return client;
  if (connectingPromise) return connectingPromise;

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379/0';

  connectingPromise = (async () => {
    const newClient = redis.createClient({
      url: redisUrl,
      socket: {
        connectTimeout: 10000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Redis reconnection failed');
          }
          return retries * 100;
        }
      }
    });

    newClient.on('error', (err) => {
      logger.error('Redis Client Error', { error: err.message });
    });

    newClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    await newClient.connect();
    client = newClient;
    connectingPromise = null;
    return client;
  })();

  return connectingPromise;
}

async function closeRedisClient() {
  if (client) {
    await client.quit();
    client = null;
  }
  connectingPromise = null;
}

async function isRedisReady() {
  try {
    const c = await getRedisClient();
    await c.ping();
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = { getRedisClient, closeRedisClient, isRedisReady };
