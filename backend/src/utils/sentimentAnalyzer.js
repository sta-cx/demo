/**
 * Sentiment Analysis Utility
 * Shared sentiment analysis and text processing utilities
 */

const logger = require('./logger');
const levenshtein = require('fast-levenshtein');

// Positive and negative sentiment keywords
const POSITIVE_WORDS = ['开心', '快乐', '幸福', '爱', '喜欢', '美好', '棒', '好', '满意', '激动', '兴奋', '愉快', '甜蜜'];
const NEGATIVE_WORDS = ['难过', '伤心', '生气', '讨厌', '糟糕', '差', '不好', '失望', '痛苦', '烦恼', '焦虑', '沮丧'];

/**
 * Simple sentiment analysis using keyword matching
 * @param {string} text - Text to analyze
 * @returns {Object|null} Analysis result with sentiment, score, and keywords
 */
function simpleSentimentAnalysis(text) {
  if (!text) return null;

  // Remove extra whitespace
  const cleanText = text.trim();
  if (cleanText.length === 0) return null;

  // Count positive and negative words
  const positiveCount = POSITIVE_WORDS.filter(word => cleanText.includes(word)).length;
  const negativeCount = NEGATIVE_WORDS.filter(word => cleanText.includes(word)).length;

  // Determine sentiment and score
  let sentiment = 'neutral';
  let score = 50;

  if (positiveCount > negativeCount) {
    sentiment = 'positive';
    score = Math.min(50 + positiveCount * 10, 100);
  } else if (negativeCount > positiveCount) {
    sentiment = 'negative';
    score = Math.max(50 - negativeCount * 10, 0);
  }

  // Extract keywords
  const keywords = extractKeywords(cleanText);

  return {
    sentiment,
    sentiment_score: score,
    keywords
  };
}

/**
 * Extract keywords from text
 * @param {string} text - Text to extract keywords from
 * @param {number} maxKeywords - Maximum number of keywords to extract (default: 5)
 * @returns {Array} Array of keywords
 */
function extractKeywords(text, maxKeywords = 5) {
  if (!text) return [];

  // Remove punctuation and split into words
  const words = text
    .replace(/[，。！？；：""''（）《》【】、\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 1); // Only keep words with more than 1 character

  // Return top N keywords
  return words.slice(0, maxKeywords);
}

/**
 * Calculate text similarity using Levenshtein distance
 * @param {string} text1 - First text
 * @param {string} text2 - Second text
 * @returns {number} Similarity score (0-1)
 */
function calculateTextSimilarity(text1, text2) {
  if (!text1 && !text2) return 1; // Both empty/null = identical
  if (!text1 || !text2) return 0;  // One empty/null = no similarity

  // Normalize texts
  const normalized1 = normalizeText(text1);
  const normalized2 = normalizeText(text2);

  // Handle empty strings after normalization
  if (normalized1.length === 0 && normalized2.length === 0) return 1;
  if (normalized1.length === 0 || normalized2.length === 0) return 0;

  // Calculate Levenshtein distance
  const distance = levenshtein.get(normalized1, normalized2);

  // Calculate similarity based on the maximum length
  const maxLength = Math.max(normalized1.length, normalized2.length);

  // Convert distance to similarity (0-1)
  // Similarity = 1 - (distance / maxLength)
  const similarity = 1 - (distance / maxLength);

  return Math.max(0, Math.min(1, similarity));
}

/**
 * Check if question text is duplicate of any used texts
 * @param {string} questionText - New question text
 * @param {Array} usedTexts - Array of already used question texts
 * @param {number} threshold - Similarity threshold (default: 0.8)
 * @returns {boolean} True if duplicate is found
 */
function checkQuestionDuplicate(questionText, usedTexts, threshold = 0.8) {
  if (!usedTexts || usedTexts.length === 0) {
    return false;
  }

  const normalizedNew = normalizeText(questionText);

  return usedTexts.some(usedText => {
    const normalizedUsed = normalizeText(usedText);

    // Check for exact match
    if (normalizedNew === normalizedUsed) {
      return true;
    }

    // Check similarity
    const similarity = calculateTextSimilarity(normalizedNew, normalizedUsed);
    return similarity > threshold;
  });
}

/**
 * Normalize text for comparison
 * @param {string} text - Text to normalize
 * @returns {string} Normalized text
 */
function normalizeText(text) {
  if (!text) return '';

  return text
    .replace(/[？?。！!，,]/g, '') // Remove common punctuation
    .trim()
    .toLowerCase();
}

/**
 * Analyze sentiment with fallback chain
 * Tries primary AI, then secondary AI, then falls back to simple analysis
 * @param {string} text - Text to analyze
 * @param {Object} primaryAI - Primary AI service
 * @param {Object} secondaryAI - Secondary AI service (optional)
 * @returns {Promise<Object>} Sentiment analysis result
 */
async function analyzeSentimentWithFallback(text, primaryAI, secondaryAI = null) {
  // Try primary AI
  try {
    logger.info('Attempting primary AI sentiment analysis...');
    const result = await primaryAI.analyzeSentiment(text);
    logger.info('Primary AI sentiment analysis succeeded');
    return result;
  } catch (error) {
    logger.warn('Primary AI sentiment analysis failed', {
      error: error.message
    });
  }

  // Try secondary AI if available
  if (secondaryAI) {
    try {
      const ollamaAvailable = await secondaryAI.isAvailable();
      if (ollamaAvailable) {
        logger.info('Attempting secondary AI sentiment analysis...');
        const result = await secondaryAI.analyzeSentiment(text);
        logger.info('Secondary AI sentiment analysis succeeded');
        return result;
      }
    } catch (error) {
      logger.warn('Secondary AI sentiment analysis failed', {
        error: error.message
      });
    }
  }

  // Fallback to simple analysis
  logger.info('Using simple sentiment analysis as fallback');
  return simpleSentimentAnalysis(text);
}

/**
 * Get sentiment keywords for testing/configuration
 * @returns {Object} Object with positiveWords and negativeWords arrays
 */
function getSentimentKeywords() {
  return {
    positiveWords: [...POSITIVE_WORDS],
    negativeWords: [...NEGATIVE_WORDS]
  };
}

module.exports = {
  simpleSentimentAnalysis,
  extractKeywords,
  calculateTextSimilarity,
  checkQuestionDuplicate,
  normalizeText,
  analyzeSentimentWithFallback,
  getSentimentKeywords
};
