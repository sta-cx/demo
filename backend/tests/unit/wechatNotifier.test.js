// backend/tests/unit/wechatNotifier.test.js
const wechatNotifier = require('../../src/utils/wechatNotifier');
const axios = require('axios');

// Mock axios
jest.mock('axios');
jest.mock('../../src/utils/logger');

describe('WechatNotifier', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.WECHAT_APPID = 'test_appid';
    process.env.WECHAT_SECRET = 'test_secret';
  });

  afterEach(() => {
    delete process.env.WECHAT_APPID;
    delete process.env.WECHAT_SECRET;
  });

  describe('getAccessToken', () => {
    test('should fetch access token', async () => {
      const mockToken = {
        access_token: 'test_token',
        expires_in: 7200
      };

      axios.get.mockResolvedValue({ data: mockToken });

      const token = await wechatNotifier.getAccessToken();
      expect(token).toBe('test_token');
    });

    test('should throw error on API failure', async () => {
      axios.get.mockRejectedValue(new Error('Network error'));

      await expect(wechatNotifier.getAccessToken()).rejects.toThrow();
    });
  });

  describe('sendSubscribeMessage', () => {
    test('should send message successfully', async () => {
      const mockResponse = {
        errcode: 0,
        msgid: '123456'
      };

      axios.post.mockResolvedValue({ data: mockResponse });
      wechatNotifier.accessToken = 'test_token';

      const result = await wechatNotifier.sendSubscribeMessage(
        'openid',
        'template_id',
        { thing1: { value: 'test' } }
      );

      expect(result.success).toBe(true);
      expect(result.msgid).toBe('123456');
    });

    test('should handle error response', async () => {
      const mockResponse = {
        errcode: 40037,
        errmsg: 'template_id不正确'
      };

      axios.post.mockResolvedValue({ data: mockResponse });
      wechatNotifier.accessToken = 'test_token';

      const result = await wechatNotifier.sendSubscribeMessage(
        'openid',
        'template_id',
        { thing1: { value: 'test' } }
      );

      expect(result.success).toBe(false);
      expect(result.errcode).toBe(40037);
    });
  });

  describe('healthCheck', () => {
    test('should return available when configured', async () => {
      axios.get.mockResolvedValue({
        data: { access_token: 'test', expires_in: 7200 }
      });

      const result = await wechatNotifier.healthCheck();
      expect(result.available).toBe(true);
      expect(result.configured).toBe(true);
    });

    test('should return not configured when missing credentials', async () => {
      delete process.env.WECHAT_APPID;
      delete process.env.WECHAT_SECRET;

      const result = await wechatNotifier.healthCheck();
      expect(result.available).toBe(false);
      expect(result.configured).toBe(false);
    });
  });
});
