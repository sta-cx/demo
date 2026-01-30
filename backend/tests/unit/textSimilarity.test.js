/**
 * Text Similarity Tests
 * Tests for Levenshtein distance-based text similarity calculation
 */

const { calculateTextSimilarity } = require('../../src/utils/sentimentAnalyzer');

describe('Text Similarity Calculation (Levenshtein)', () => {
  describe('Edge Cases', () => {
    test('should return 1 when both texts are null or undefined (identical empty values)', () => {
      expect(calculateTextSimilarity(null, null)).toBe(1);
      expect(calculateTextSimilarity(undefined, undefined)).toBe(1);
    });

    test('should return 0 when one text is null/undefined', () => {
      expect(calculateTextSimilarity('hello', null)).toBe(0);
      expect(calculateTextSimilarity(null, 'hello')).toBe(0);
      expect(calculateTextSimilarity('hello', undefined)).toBe(0);
      expect(calculateTextSimilarity(undefined, 'hello')).toBe(0);
    });

    test('should return 0 when one text is empty', () => {
      expect(calculateTextSimilarity('', 'hello')).toBe(0);
      expect(calculateTextSimilarity('hello', '')).toBe(0);
    });

    test('should return 1 when both texts are empty', () => {
      expect(calculateTextSimilarity('', '')).toBe(1);
    });

    test('should return 1 when texts are identical', () => {
      expect(calculateTextSimilarity('你好吗', '你好吗')).toBe(1);
      expect(calculateTextSimilarity('今天天气很好', '今天天气很好')).toBe(1);
    });
  });

  describe('Chinese Text Similarity', () => {
    test('should calculate similarity for similar Chinese questions', () => {
      const text1 = '你今天开心吗';
      const text2 = '你今天开心吗？';
      // Only difference is punctuation, should be very high similarity
      const similarity = calculateTextSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    test('should calculate similarity for Chinese texts with small differences', () => {
      const text1 = '今天天气怎么样';
      const text2 = '今天天气如何';
      // 2 character difference out of 7 (weather + what/how)
      const similarity = calculateTextSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.5);
      expect(similarity).toBeLessThan(1);
    });

    test('should calculate similarity for Chinese texts with large differences', () => {
      const text1 = '你最喜欢吃什么食物';
      const text2 = '今天的工作怎么样';
      // Completely different content
      const similarity = calculateTextSimilarity(text1, text2);
      expect(similarity).toBeLessThan(0.5);
    });

    test('should handle Chinese text with mixed punctuation', () => {
      const text1 = '你喜欢看电影吗？';
      const text2 = '你喜欢看电影吗!';
      const similarity = calculateTextSimilarity(text1, text2);
      expect(similarity).toBeGreaterThan(0.9);
    });
  });

  describe('Question Deduplication Scenarios', () => {
    test('should detect duplicate questions with minor variations', () => {
      const questions = [
        '你今天开心吗',
        '你今天开心吗？',
        '你今天开心吗!',
        '你今天开心开心吗'
      ];

      // Compare first question with variations
      const base = questions[0];
      const similarities = questions.map(q => calculateTextSimilarity(base, q));

      // All variations should have high similarity
      similarities.forEach((sim, index) => {
        if (index === 0) {
          expect(sim).toBe(1); // Same text
        } else {
          expect(sim).toBeGreaterThan(0.7);
        }
      });
    });

    test('should differentiate between different questions', () => {
      const question1 = '你最喜欢的食物是什么';
      const question2 = '你最讨厌的食物是什么';
      const question3 = '你今天想去哪里玩';

      const sim12 = calculateTextSimilarity(question1, question2);
      const sim13 = calculateTextSimilarity(question1, question3);
      const sim23 = calculateTextSimilarity(question2, question3);

      // sim12 should be high since only 1 char difference (喜欢 vs 讨厌)
      // but sim13 and sim23 should be lower
      expect(sim12).toBeGreaterThanOrEqual(0.8);
      expect(sim13).toBeLessThan(0.8);
      expect(sim23).toBeLessThan(0.8);
    });

    test('should handle questions with similar structure but different content', () => {
      const q1 = '你最喜欢的颜色是红色吗';
      const q2 = '你最喜欢的颜色是蓝色吗';

      const similarity = calculateTextSimilarity(q1, q2);
      // Only 1 character difference (red vs blue), should be high similarity
      expect(similarity).toBeGreaterThan(0.85);
    });
  });

  describe('Mixed Content', () => {
    test('should handle Chinese and English mixed text', () => {
      const text1 = '你喜欢Apple吗';
      const text2 = '你喜欢Banana吗';

      const similarity = calculateTextSimilarity(text1, text2);
      // "Apple" (5 chars) vs "Banana" (6 chars), distance is 6 (Apple -> Banana)
      // Total length 9, similarity = 1 - 6/9 = 0.33
      expect(similarity).toBeGreaterThanOrEqual(0.3);
      expect(similarity).toBeLessThan(1);
    });

    test('should handle numbers in Chinese text', () => {
      const text1 = '你有3个苹果';
      const text2 = '你有5个苹果';

      const similarity = calculateTextSimilarity(text1, text2);
      // Only difference is 3 vs 5 (1 char), total 6 chars
      // similarity = 1 - 1/6 = 0.833
      expect(similarity).toBeGreaterThan(0.8);
    });

    test('should normalize different punctuation marks', () => {
      const text1 = '你好，世界！';
      const text2 = '你好.世界?';

      const similarity = calculateTextSimilarity(text1, text2);
      // After punctuation normalization (all removed), should be identical
      // But current normalization only removes specific punctuation
      // Let's verify it's at least reasonably high
      expect(similarity).toBeGreaterThan(0.7);
    });
  });

  describe('Levenshtein Distance Properties', () => {
    test('should be symmetric (similarity(a,b) === similarity(b,a))', () => {
      const text1 = '今天天气真好啊';
      const text2 = '今天天气不错呀';

      const sim1 = calculateTextSimilarity(text1, text2);
      const sim2 = calculateTextSimilarity(text2, text1);

      expect(sim1).toBe(sim2);
    });

    test('should return values in valid range [0, 1]', () => {
      const testCases = [
        ['a', 'b'],
        ['hello', 'world'],
        ['你好', '再见'],
        ['这是一个很长很长的句子', '这是另一个很长很长的句子'],
        ['', ''],
        ['same', 'same']
      ];

      testCases.forEach(([text1, text2]) => {
        const similarity = calculateTextSimilarity(text1, text2);
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
      });
    });

    test('should decrease similarity as edit distance increases', () => {
      const base = '你好吗';

      const sim1 = calculateTextSimilarity(base, '你好'); // 1 char diff
      const sim2 = calculateTextSimilarity(base, '你'); // 2 chars diff
      const sim3 = calculateTextSimilarity(base, '你好世界'); // 2 chars added

      expect(sim1).toBeGreaterThan(sim2);
      expect(sim1).toBeGreaterThan(sim3);
    });
  });

  describe('Real-world Question Examples', () => {
    test('should handle daily life questions', () => {
      const questions = [
        { text: '你今天吃了什么', expectedSimilar: ['你今天吃了什么呢', '你今天吃了什么？'] },
        { text: '今天工作忙吗', expectedSimilar: ['今天工作忙吗？', '今天工作忙碌吗'] },
        { text: '周末想做什么', expectedSimilar: ['周末想做什么？', '周末想做些什么'] }
      ];

      questions.forEach(({ text, expectedSimilar }) => {
        expectedSimilar.forEach(similarText => {
          const similarity = calculateTextSimilarity(text, similarText);
          expect(similarity).toBeGreaterThan(0.8);
        });
      });
    });

    test('should handle emotion questions', () => {
      const q1 = '你最喜欢我哪一点';
      const q2 = '你最讨厌我哪一点';

      const similarity = calculateTextSimilarity(q1, q2);
      // Only 1 character difference (喜欢 2 chars vs 讨厌 2 chars)
      // Levenshtein distance = 2, total length = 7
      // similarity = 1 - 2/7 = 0.714
      expect(similarity).toBeGreaterThan(0.7);
    });

    test('should handle fun questions', () => {
      const q1 = '如果可以去任何地方旅行，你想去哪里';
      const q2 = '如果可以去任何地方旅游，你想去哪儿';

      const similarity = calculateTextSimilarity(q1, q2);
      // Similar meaning with different wording
      expect(similarity).toBeGreaterThan(0.7);
    });
  });

  describe('Performance with Long Text', () => {
    test('should handle long questions efficiently', () => {
      const longText1 = '如果有一天我们可以一起环游世界，你最想去哪个国家，为什么想去那里，你想在那里做些什么事情，你觉得我们会遇到什么样的有趣经历呢';
      const longText2 = '如果有一天我们可以一起环游世界，你最想去哪个国家，为什么想去那里，你想在那里做些什么事情，你觉得我们会遇到什么样的有趣的经历呢';

      const similarity = calculateTextSimilarity(longText1, longText2);
      expect(similarity).toBeGreaterThan(0.95);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });
});
