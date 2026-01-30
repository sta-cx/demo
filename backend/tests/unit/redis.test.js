// tests/unit/redis.test.js
const { getRedisClient, closeRedisClient } = require('../../src/utils/redis');

describe('Redis Client', () => {
  afterAll(async () => {
    await closeRedisClient();
  });

  test('should get redis client instance', () => {
    const client = getRedisClient();
    expect(client).toBeDefined();
    expect(client.connect).toBeInstanceOf(Function);
  });

  test('should set and get value', async () => {
    const client = getRedisClient();
    await client.set('test:key', 'test-value');
    const value = await client.get('test:key');
    expect(value).toBe('test-value');
    await client.del('test:key');
  });
});
