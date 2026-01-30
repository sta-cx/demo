const {
  whitelistFilter,
  validateRequired,
  sanitizeString,
  isValidPhone,
  isValidEmail,
  isValidDate,
  whitelists
} = require('../../src/utils/validator');

describe('validator utils', () => {
  describe('whitelistFilter', () => {
    test('should filter object to only include whitelisted keys', () => {
      const data = {
        couple_name: 'My Couple',
        anniversary_date: '2023-01-01',
        theme_color: '#FF5733',
        malicious_field: 'should be removed',
        another_field: 'also removed'
      };

      const whitelist = ['couple_name', 'anniversary_date', 'theme_color'];
      const result = whitelistFilter(data, whitelist);

      expect(result).toEqual({
        couple_name: 'My Couple',
        anniversary_date: '2023-01-01',
        theme_color: '#FF5733'
      });
      expect(result).not.toHaveProperty('malicious_field');
      expect(result).not.toHaveProperty('another_field');
    });

    test('should handle empty data object', () => {
      const result = whitelistFilter({}, ['field1', 'field2']);
      expect(result).toEqual({});
    });

    test('should handle null data', () => {
      const result = whitelistFilter(null, ['field1', 'field2']);
      expect(result).toEqual({});
    });

    test('should handle undefined data', () => {
      const result = whitelistFilter(undefined, ['field1', 'field2']);
      expect(result).toEqual({});
    });

    test('should handle empty whitelist', () => {
      const data = { field1: 'value1', field2: 'value2' };
      const result = whitelistFilter(data, []);
      expect(result).toEqual({});
    });

    test('should strip undefined values by default', () => {
      const data = {
        field1: 'value1',
        field2: undefined,
        field3: 'value3'
      };

      const result = whitelistFilter(data, ['field1', 'field2', 'field3']);
      expect(result).toEqual({
        field1: 'value1',
        field3: 'value3'
      });
    });

    test('should keep undefined values when stripUndefined is false', () => {
      const data = {
        field1: 'value1',
        field2: undefined
      };

      const result = whitelistFilter(data, ['field1', 'field2'], {
        stripUndefined: false
      });

      expect(result).toEqual({
        field1: 'value1',
        field2: undefined
      });
    });

    test('should keep null values by default', () => {
      const data = {
        field1: 'value1',
        field2: null
      };

      const result = whitelistFilter(data, ['field1', 'field2']);
      expect(result).toEqual({
        field1: 'value1',
        field2: null
      });
    });

    test('should strip null values when stripNull is true', () => {
      const data = {
        field1: 'value1',
        field2: null
      };

      const result = whitelistFilter(data, ['field1', 'field2'], {
        stripNull: true
      });

      expect(result).toEqual({
        field1: 'value1'
      });
    });

    test('should keep empty strings by default', () => {
      const data = {
        field1: 'value1',
        field2: ''
      };

      const result = whitelistFilter(data, ['field1', 'field2']);
      expect(result).toEqual({
        field1: 'value1',
        field2: ''
      });
    });

    test('should strip empty strings when stripEmptyString is true', () => {
      const data = {
        field1: 'value1',
        field2: ''
      };

      const result = whitelistFilter(data, ['field1', 'field2'], {
        stripEmptyString: true
      });

      expect(result).toEqual({
        field1: 'value1'
      });
    });

    test('should handle all strip options together', () => {
      const data = {
        field1: 'value1',
        field2: undefined,
        field3: null,
        field4: '',
        field5: 'value5'
      };

      const result = whitelistFilter(data, ['field1', 'field2', 'field3', 'field4', 'field5'], {
        stripUndefined: true,
        stripNull: true,
        stripEmptyString: true
      });

      expect(result).toEqual({
        field1: 'value1',
        field5: 'value5'
      });
    });
  });

  describe('validateRequired', () => {
    test('should return isValid true when all required fields exist', () => {
      const data = {
        name: 'John',
        email: 'john@example.com',
        age: 25
      };

      const result = validateRequired(data, ['name', 'email']);
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });

    test('should return isValid false when required fields are missing', () => {
      const data = {
        name: 'John'
      };

      const result = validateRequired(data, ['name', 'email', 'age']);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['email', 'age']);
    });

    test('should treat empty string as missing', () => {
      const data = {
        name: 'John',
        email: ''
      };

      const result = validateRequired(data, ['name', 'email']);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['email']);
    });

    test('should treat undefined as missing', () => {
      const data = {
        name: 'John',
        email: undefined
      };

      const result = validateRequired(data, ['name', 'email']);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['email']);
    });

    test('should treat null as missing', () => {
      const data = {
        name: 'John',
        email: null
      };

      const result = validateRequired(data, ['name', 'email']);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['email']);
    });

    test('should handle null data', () => {
      const result = validateRequired(null, ['name', 'email']);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['name', 'email']);
    });

    test('should handle undefined data', () => {
      const result = validateRequired(undefined, ['name', 'email']);
      expect(result.isValid).toBe(false);
      expect(result.missing).toEqual(['name', 'email']);
    });

    test('should handle empty required fields array', () => {
      const data = { name: 'John' };
      const result = validateRequired(data, []);
      expect(result.isValid).toBe(true);
      expect(result.missing).toEqual([]);
    });
  });

  describe('sanitizeString', () => {
    test('should trim whitespace by default', () => {
      const result = sanitizeString('  hello world  ');
      expect(result).toBe('hello world');
    });

    test('should not trim when trim option is false', () => {
      const result = sanitizeString('  hello world  ', { trim: false });
      expect(result).toBe('  hello world  ');
    });

    test('should truncate string exceeding maxLength', () => {
      const result = sanitizeString('a'.repeat(2000), { maxLength: 100 });
      expect(result).toBe('a'.repeat(100));
    });

    test('should use default maxLength of 1000', () => {
      const result = sanitizeString('a'.repeat(1500));
      expect(result).toBe('a'.repeat(1000));
    });

    test('should return null for null input', () => {
      const result = sanitizeString(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined input', () => {
      const result = sanitizeString(undefined);
      expect(result).toBeNull();
    });

    test('should return null for non-string input', () => {
      expect(sanitizeString(123)).toBeNull();
      expect(sanitizeString({})).toBeNull();
      expect(sanitizeString([])).toBeNull();
    });

    test('should handle string with special characters', () => {
      const result = sanitizeString('Hello <script>alert("xss")</script>');
      expect(result).toBe('Hello <script>alert("xss")</script>');
    });

    test('should handle empty string', () => {
      const result = sanitizeString('');
      expect(result).toBe('');
    });
  });

  describe('isValidPhone', () => {
    test('should validate valid Chinese mobile numbers', () => {
      expect(isValidPhone('13812345678')).toBe(true);
      expect(isValidPhone('15987654321')).toBe(true);
      expect(isValidPhone('18612345678')).toBe(true);
    });

    test('should reject invalid phone numbers', () => {
      expect(isValidPhone('12345678901')).toBe(false); // Starts with 2
      expect(isValidPhone('1381234567')).toBe(false); // Too short
      expect(isValidPhone('138123456789')).toBe(false); // Too long
      expect(isValidPhone('1381234567a')).toBe(false); // Contains letter
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(null)).toBe(false);
      expect(isValidPhone(undefined)).toBe(false);
    });

    test('should reject non-string input', () => {
      expect(isValidPhone(13812345678)).toBe(false);
      expect(isValidPhone({})).toBe(false);
    });
  });

  describe('isValidEmail', () => {
    test('should validate valid email addresses', () => {
      expect(isValidEmail('user@example.com')).toBe(true);
      expect(isValidEmail('test.user@domain.co.uk')).toBe(true);
      expect(isValidEmail('user+tag@example.org')).toBe(true);
    });

    test('should reject invalid email addresses', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user@.com')).toBe(false);
      expect(isValidEmail('user@@example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(null)).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });

    test('should reject non-string input', () => {
      expect(isValidEmail(123)).toBe(false);
      expect(isValidEmail({})).toBe(false);
    });
  });

  describe('isValidDate', () => {
    test('should validate valid ISO date strings', () => {
      expect(isValidDate('2023-01-01')).toBe(true);
      expect(isValidDate('2023-12-31')).toBe(true);
      expect(isValidDate('2020-02-29')).toBe(true); // Leap year
    });

    test('should validate valid ISO datetime strings', () => {
      expect(isValidDate('2023-01-01T00:00:00Z')).toBe(true);
      expect(isValidDate('2023-01-01T12:30:45.123Z')).toBe(true);
    });

    test('should reject invalid date strings', () => {
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('2023-13-01')).toBe(false); // Invalid month
      expect(isValidDate('2023-02-30')).toBe(false); // Invalid day
      expect(isValidDate('')).toBe(false);
      expect(isValidDate(null)).toBe(false);
      expect(isValidDate(undefined)).toBe(false);
    });

    test('should reject non-string input', () => {
      expect(isValidDate(123)).toBe(false);
      expect(isValidDate({})).toBe(false);
    });
  });

  describe('whitelists', () => {
    test('should have predefined whitelists', () => {
      expect(whitelists).toBeDefined();
      expect(whitelists.couple).toEqual(['couple_name', 'anniversary_date', 'theme_color']);
      expect(whitelists.user).toEqual(['nickname', 'avatar_url', 'push_enabled', 'push_time']);
      expect(whitelists.answer).toEqual(['answer_text', 'sentiment', 'sentiment_score']);
    });

    test('couple whitelist should work with whitelistFilter', () => {
      const data = {
        couple_name: 'My Couple',
        anniversary_date: '2023-01-01',
        theme_color: '#FF5733',
        malicious_field: 'should be removed'
      };

      const result = whitelistFilter(data, whitelists.couple);
      expect(result).toEqual({
        couple_name: 'My Couple',
        anniversary_date: '2023-01-01',
        theme_color: '#FF5733'
      });
    });

    test('user whitelist should work with whitelistFilter', () => {
      const data = {
        nickname: 'John',
        avatar_url: 'https://example.com/avatar.jpg',
        push_enabled: true,
        push_time: '21:00',
        malicious_field: 'should be removed'
      };

      const result = whitelistFilter(data, whitelists.user);
      expect(result).toEqual({
        nickname: 'John',
        avatar_url: 'https://example.com/avatar.jpg',
        push_enabled: true,
        push_time: '21:00'
      });
    });

    test('answer whitelist should work with whitelistFilter', () => {
      const data = {
        answer_text: 'My answer',
        sentiment: 'positive',
        sentiment_score: 75,
        malicious_field: 'should be removed'
      };

      const result = whitelistFilter(data, whitelists.answer);
      expect(result).toEqual({
        answer_text: 'My answer',
        sentiment: 'positive',
        sentiment_score: 75
      });
    });
  });
});
