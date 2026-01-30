/**
 * Redis缓存服务
 * 提供统一的缓存操作接口，包含缓存穿透保护、过期策略等
 */

const { getRedisClient, isRedisReady } = require('./redis');
const logger = require('./logger');

// 缓存键前缀
const CACHE_PREFIX = {
  USER: 'user',
  COUPLE: 'couple',
  QUESTION: 'question',
  ANSWER: 'answer',
  DAILY_QUESTION: 'daily_question',
  STATS: 'stats',
  SESSION: 'session'
};

// 默认过期时间（秒）
const CACHE_TTL = {
  USER: 3600,           // 用户信息: 1小时
  COUPLE: 3600,         // 情侣信息: 1小时
  QUESTION: 7200,       // 问题: 2小时
  ANSWER: 1800,         // 回答: 30分钟
  DAILY_QUESTION: 86400, // 每日问题: 24小时
  STATS: 600,           // 统计数据: 10分钟
  SESSION: 86400        // 会话: 24小时
};

// 缓存穿透保护的空值标记
const NULL_CACHE_VALUE = '__NULL__';
const NULL_CACHE_TTL = 60; // 空值缓存1分钟

/**
 * 构建缓存键
 */
function buildKey(prefix, ...parts) {
  return `${prefix}:${parts.join(':')}`;
}

/**
 * 获取缓存
 * @param {string} key 缓存键
 * @returns {Promise<any|null>} 缓存值或null
 */
async function get(key) {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      logger.debug('Redis not ready, skipping cache get', { key });
      return null;
    }

    const client = await getRedisClient();
    const value = await client.get(key);

    if (value === null) {
      return null;
    }

    // 检查是否是空值标记
    if (value === NULL_CACHE_VALUE) {
      return null;
    }

    // 尝试解析JSON
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  } catch (error) {
    logger.error('Cache get error', { key, error: error.message });
    return null;
  }
}

/**
 * 设置缓存
 * @param {string} key 缓存键
 * @param {any} value 缓存值
 * @param {number} ttl 过期时间（秒）
 */
async function set(key, value, ttl) {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      logger.debug('Redis not ready, skipping cache set', { key });
      return false;
    }

    const client = await getRedisClient();

    // 如果值为null或undefined，设置空值标记（缓存穿透保护）
    if (value === null || value === undefined) {
      await client.setEx(key, NULL_CACHE_TTL, NULL_CACHE_VALUE);
      logger.debug('Set null cache value for penetration protection', { key });
      return true;
    }

    // 序列化值
    const serialized = typeof value === 'string' ? value : JSON.stringify(value);

    if (ttl) {
      await client.setEx(key, ttl, serialized);
    } else {
      await client.set(key, serialized);
    }

    logger.debug('Cache set successfully', { key, ttl });
    return true;
  } catch (error) {
    logger.error('Cache set error', { key, error: error.message });
    return false;
  }
}

/**
 * 删除缓存
 * @param {string} key 缓存键
 */
async function del(key) {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      return false;
    }

    const client = await getRedisClient();
    await client.del(key);
    logger.debug('Cache deleted', { key });
    return true;
  } catch (error) {
    logger.error('Cache delete error', { key, error: error.message });
    return false;
  }
}

/**
 * 按模式删除缓存
 * @param {string} pattern 键模式（如: user:*）
 */
async function delPattern(pattern) {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      return 0;
    }

    const client = await getRedisClient();
    const keys = await client.keys(pattern);

    if (keys.length === 0) {
      return 0;
    }

    await client.del(keys);
    logger.info('Cache pattern deleted', { pattern, count: keys.length });
    return keys.length;
  } catch (error) {
    logger.error('Cache pattern delete error', { pattern, error: error.message });
    return 0;
  }
}

/**
 * 获取或设置缓存（带有缓存穿透保护）
 * @param {string} key 缓存键
 * @param {Function} fetchFn 数据获取函数
 * @param {number} ttl 过期时间（秒）
 * @returns {Promise<any>} 缓存值或新获取的数据
 */
async function getOrSet(key, fetchFn, ttl) {
  try {
    // 先尝试从缓存获取
    const cached = await get(key);
    if (cached !== null) {
      logger.debug('Cache hit', { key });
      return cached;
    }

    // 缓存未命中，调用fetchFn获取数据
    logger.debug('Cache miss, fetching data', { key });
    const value = await fetchFn();

    // 设置缓存（包括null值的保护）
    await set(key, value, ttl);

    return value;
  } catch (error) {
    logger.error('Cache getOrSet error', { key, error: error.message });
    // 如果缓存失败，直接返回fetchFn的结果
    return await fetchFn();
  }
}

/**
 * 获取用户缓存
 * @param {number} userId 用户ID
 */
async function getUser(userId) {
  const key = buildKey(CACHE_PREFIX.USER, userId);
  return get(key);
}

/**
 * 设置用户缓存
 * @param {number} userId 用户ID
 * @param {object} user 用户数据
 */
async function setUser(userId, user) {
  const key = buildKey(CACHE_PREFIX.USER, userId);
  return set(key, user, CACHE_TTL.USER);
}

/**
 * 清除用户缓存
 * @param {number} userId 用户ID
 */
async function clearUserCache(userId) {
  const key = buildKey(CACHE_PREFIX.USER, userId);
  return del(key);
}

/**
 * 获取情侣缓存
 * @param {number} coupleId 情侣ID
 */
async function getCouple(coupleId) {
  const key = buildKey(CACHE_PREFIX.COUPLE, coupleId);
  return get(key);
}

/**
 * 设置情侣缓存
 * @param {number} coupleId 情侣ID
 * @param {object} couple 情侣数据
 */
async function setCouple(coupleId, couple) {
  const key = buildKey(CACHE_PREFIX.COUPLE, coupleId);
  return set(key, couple, CACHE_TTL.COUPLE);
}

/**
 * 清除情侣缓存
 * @param {number} coupleId 情侣ID
 */
async function clearCoupleCache(coupleId) {
  const key = buildKey(CACHE_PREFIX.COUPLE, coupleId);
  await del(key);
  // 同时清除该情侣相关的其他缓存
  await delPattern(`${CACHE_PREFIX.DAILY_QUESTION}:${coupleId}:*`);
  await delPattern(`${CACHE_PREFIX.STATS}:${coupleId}:*`);
}

/**
 * 获取每日问题缓存
 * @param {number} coupleId 情侣ID
 * @param {string} date 日期字符串 (YYYY-MM-DD)
 */
async function getDailyQuestion(coupleId, date) {
  const key = buildKey(CACHE_PREFIX.DAILY_QUESTION, coupleId, date);
  return get(key);
}

/**
 * 设置每日问题缓存
 * @param {number} coupleId 情侣ID
 * @param {string} date 日期字符串
 * @param {object} question 问题数据
 */
async function setDailyQuestion(coupleId, date, question) {
  const key = buildKey(CACHE_PREFIX.DAILY_QUESTION, coupleId, date);
  return set(key, question, CACHE_TTL.DAILY_QUESTION);
}

/**
 * 获取统计缓存
 * @param {number} coupleId 情侣ID
 * @param {string} type 统计类型
 */
async function getStatsCache(coupleId, type) {
  const key = buildKey(CACHE_PREFIX.STATS, coupleId, type);
  return get(key);
}

/**
 * 设置统计缓存
 * @param {number} coupleId 情侣ID
 * @param {string} type 统计类型
 * @param {object} stats 统计数据
 */
async function setStatsCache(coupleId, type, stats) {
  const key = buildKey(CACHE_PREFIX.STATS, coupleId, type);
  return set(key, stats, CACHE_TTL.STATS);
}

/**
 * 批量获取用户缓存
 * @param {Array<number>} userIds 用户ID数组
 */
async function getManyUsers(userIds) {
  if (!userIds || userIds.length === 0) {
    return {};
  }

  try {
    const ready = await isRedisReady();
    if (!ready) {
      return {};
    }

    const client = await getRedisClient();
    const keys = userIds.map(id => buildKey(CACHE_PREFIX.USER, id));
    const values = await client.mGet(keys);

    const result = {};
    userIds.forEach((userId, index) => {
      const value = values[index];
      if (value && value !== NULL_CACHE_VALUE) {
        try {
          result[userId] = JSON.parse(value);
        } catch {
          result[userId] = value;
        }
      }
    });

    return result;
  } catch (error) {
    logger.error('Batch get users cache error', { error: error.message });
    return {};
  }
}

/**
 * 批量设置用户缓存
 * @param {Array<object>} users 用户数据数组
 */
async function setManyUsers(users) {
  if (!users || users.length === 0) {
    return;
  }

  try {
    const ready = await isRedisReady();
    if (!ready) {
      return;
    }

    const client = await getRedisClient();
    const pipeline = client.multi();

    users.forEach(user => {
      const key = buildKey(CACHE_PREFIX.USER, user.id);
      const serialized = JSON.stringify(user);
      pipeline.setEx(key, CACHE_TTL.USER, serialized);
    });

    await pipeline.exec();
    logger.debug('Batch set users cache', { count: users.length });
  } catch (error) {
    logger.error('Batch set users cache error', { error: error.message });
  }
}

/**
 * 检查缓存是否存在
 * @param {string} key 缓存键
 */
async function exists(key) {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      return false;
    }

    const client = await getRedisClient();
    return await client.exists(key) > 0;
  } catch (error) {
    logger.error('Cache exists check error', { key, error: error.message });
    return false;
  }
}

/**
 * 设置缓存过期时间
 * @param {string} key 缓存键
 * @param {number} ttl 过期时间（秒）
 */
async function expire(key, ttl) {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      return false;
    }

    const client = await getRedisClient();
    return await client.expire(key, ttl);
  } catch (error) {
    logger.error('Cache expire error', { key, ttl, error: error.message });
    return false;
  }
}

/**
 * 获取缓存剩余时间
 * @param {string} key 缓存键
 */
async function ttl(key) {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      return -1;
    }

    const client = await getRedisClient();
    return await client.ttl(key);
  } catch (error) {
    logger.error('Cache ttl error', { key, error: error.message });
    return -1;
  }
}

/**
 * 清空所有缓存（慎用）
 */
async function flushAll() {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      return false;
    }

    const client = await getRedisClient();
    await client.flushDb();
    logger.warn('Cache flushed all');
    return true;
  } catch (error) {
    logger.error('Cache flush all error', { error: error.message });
    return false;
  }
}

/**
 * 获取Redis统计信息
 */
async function getCacheStats() {
  try {
    const ready = await isRedisReady();
    if (!ready) {
      return { ready: false };
    }

    const client = await getRedisClient();
    const info = await client.info('stats');

    return {
      ready: true,
      info
    };
  } catch (error) {
    logger.error('Get cache stats error', { error: error.message });
    return { ready: false, error: error.message };
  }
}

module.exports = {
  // 基础方法
  get,
  set,
  del,
  delPattern,
  getOrSet,
  exists,
  expire,
  ttl,
  flushAll,
  getCacheStats,

  // 用户相关
  getUser,
  setUser,
  clearUserCache,
  getManyUsers,
  setManyUsers,

  // 情侣相关
  getCouple,
  setCouple,
  clearCoupleCache,

  // 问题相关
  getDailyQuestion,
  setDailyQuestion,

  // 统计相关
  getStats: getStatsCache,
  setStats: setStatsCache,

  // 常量
  CACHE_PREFIX,
  CACHE_TTL
};
