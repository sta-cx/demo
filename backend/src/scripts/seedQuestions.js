// backend/src/scripts/seedQuestions.js
const presetQuestions = require('../data/presetQuestions');
const { query } = require('../utils/database');
const logger = require('../utils/logger');

async function seedQuestions() {
  try {
    logger.info('Starting to seed preset questions...');

    // 检查是否已经初始化过
    const existingCount = await query('SELECT COUNT(*) FROM questions');
    if (parseInt(existingCount.rows[0].count) > 0) {
      logger.info(`Database already has ${existingCount.rows[0].count} questions. Skipping seed.`);
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const question of presetQuestions) {
      try {
        await query(
          `INSERT INTO questions (question_text, category, difficulty, tags, answer_type, is_active, usage_count)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            question.question_text,
            question.category,
            question.difficulty,
            JSON.stringify(question.tags),
            question.answer_type,
            true,
            0
          ]
        );
        successCount++;
      } catch (error) {
        errorCount++;
        logger.error(`Failed to insert question: ${question.question_text}`, error);
      }
    }

    logger.info(`Seed completed: ${successCount} questions inserted, ${errorCount} errors`);

    // 验证插入结果
    const result = await query('SELECT COUNT(*) FROM questions');
    logger.info(`Total questions in database: ${result.rows[0].count}`);

  } catch (error) {
    logger.error('Error seeding questions:', error);
    throw error;
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  seedQuestions()
    .then(() => {
      logger.info('Seed completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Seed failed:', error);
      process.exit(1);
    });
}

module.exports = seedQuestions;
