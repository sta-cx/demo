/**
 * Input Validation Utilities
 * Provides whitelist-based filtering to prevent mass assignment attacks
 * and ensure only expected fields are processed.
 */

/**
 * Filter object to only include whitelisted keys
 * @param {Object} data - The input object to filter
 * @param {Array<string>} whitelist - Array of allowed keys
 * @param {Object} options - Optional configuration
 * @param {boolean} options.stripUndefined - Remove undefined values (default: true)
 * @param {boolean} options.stripNull - Remove null values (default: false)
 * @param {boolean} options.stripEmptyString - Remove empty strings (default: false)
 * @returns {Object} Filtered object with only whitelisted keys
 */
function whitelistFilter(data, whitelist, options = {}) {
  const {
    stripUndefined = true,
    stripNull = false,
    stripEmptyString = false
  } = options;

  if (!data || typeof data !== 'object') {
    return {};
  }

  if (!Array.isArray(whitelist) || whitelist.length === 0) {
    return {};
  }

  // Convert whitelist to Set for O(1) lookup
  const allowedKeys = new Set(whitelist);
  const result = {};

  for (const key of Object.keys(data)) {
    // Check if key is in whitelist
    if (!allowedKeys.has(key)) {
      continue;
    }

    const value = data[key];

    // Skip based on options
    if (stripUndefined && value === undefined) {
      continue;
    }

    if (stripNull && value === null) {
      continue;
    }

    if (stripEmptyString && value === '') {
      continue;
    }

    result[key] = value;
  }

  return result;
}

/**
 * Validate required fields exist in data
 * @param {Object} data - The input object to validate
 * @param {Array<string>} requiredFields - Array of required field names
 * @returns {Object} Validation result with isValid flag and missing fields array
 */
function validateRequired(data, requiredFields) {
  if (!data || typeof data !== 'object') {
    return {
      isValid: false,
      missing: requiredFields || []
    };
  }

  if (!Array.isArray(requiredFields)) {
    return {
      isValid: true,
      missing: []
    };
  }

  const missing = [];

  for (const field of requiredFields) {
    if (!(field in data) || data[field] === undefined || data[field] === null || data[field] === '') {
      missing.push(field);
    }
  }

  return {
    isValid: missing.length === 0,
    missing
  };
}

/**
 * Sanitize string input by trimming and limiting length
 * @param {string} str - Input string to sanitize
 * @param {Object} options - Optional configuration
 * @param {number} options.maxLength - Maximum allowed length (default: 1000)
 * @param {boolean} options.trim - Trim whitespace (default: true)
 * @returns {string|null} Sanitized string or null if invalid
 */
function sanitizeString(str, options = {}) {
  const { maxLength = 1000, trim = true } = options;

  if (str === null || str === undefined) {
    return null;
  }

  if (typeof str !== 'string') {
    return null;
  }

  let result = str;

  if (trim) {
    result = result.trim();
  }

  // Truncate if exceeds max length
  if (result.length > maxLength) {
    result = result.substring(0, maxLength);
  }

  return result;
}

/**
 * Validate phone number format (Chinese mobile)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid Chinese mobile number
 */
function isValidPhone(phone) {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Chinese mobile number pattern: 1 followed by 3-9, then 9 digits
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate email format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate date string
 * @param {string} dateStr - Date string to validate
 * @returns {boolean} True if valid ISO date string
 */
function isValidDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return false;
  }

  const date = new Date(dateStr);

  // Check if date is valid
  if (isNaN(date.getTime())) {
    return false;
  }

  // Additional check: ensure the parsed date matches the input
  // This catches cases like "2023-02-30" which JavaScript parses as "2023-03-02"
  // We need to verify the year, month, and day match
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    const parsedYear = date.getFullYear();
    const parsedMonth = String(date.getMonth() + 1).padStart(2, '0');
    const parsedDay = String(date.getDate()).padStart(2, '0');

    if (year !== String(parsedYear) ||
        month !== parsedMonth ||
        day !== parsedDay) {
      return false;
    }
  }

  return true;
}

/**
 * Predefined whitelists for common update operations
 */
const whitelists = {
  couple: ['couple_name', 'anniversary_date', 'theme_color'],
  user: ['nickname', 'avatar_url', 'push_enabled', 'push_time'],
  answer: ['answer_text', 'sentiment', 'sentiment_score']
};

module.exports = {
  whitelistFilter,
  validateRequired,
  sanitizeString,
  isValidPhone,
  isValidEmail,
  isValidDate,
  whitelists
};
