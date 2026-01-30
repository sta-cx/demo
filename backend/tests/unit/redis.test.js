// tests/unit/redis.test.js
const { getRedisClient, closeRedisClient, isRedisReady } = require('../../src/utils/redis');

jest.mock('../../src/utils/logger');

describe('Redis Client', () => {
  beforeAll(async () => {
    // Ensure clean state before tests
    await closeRedisClient();
  });

  afterAll(async () => {
    await closeRedisClient();
  });

  test('should get redis client instance', async () => {
    const client = await getRedisClient();
    expect(client).toBeDefined();
    expect(client.connect).toBeInstanceOf(Function);
  });

  test('should set and get value', async () => {
    const client = await getRedisClient();
    await client.set('test:key', 'test-value');
    const value = await client.get('test:key');
    expect(value).toBe('test-value');
    await client.del('test:key');
  });

  test('should check if Redis is ready', async () => {
    const ready = await isRedisReady();
    expect(typeof ready).toBe('boolean');
  });

  test('should handle concurrent getRedisClient calls', async () => {
    const [client1, client2, client3] = await Promise.all([
      getRedisClient(),
      getRedisClient(),
      getRedisClient()
    ]);
    expect(client1).toBeDefined();
    expect(client1).toBe(client2);
    expect(client2).toBe(client3);
  });
});
