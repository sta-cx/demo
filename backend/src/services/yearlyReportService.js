const { query } = require('../utils/database');
const { generateWithAI } = require('./aiService');
const logger = require('../utils/logger');

class YearlyReportService {
  /**
   * 为所有情侣生成年度报告
   */
  static async generateYearlyReportsForAll() {
    const result = {
      total_processed: 0,
      success: [],
      errors: []
    };

    try {
      // 获取所有活跃情侣
      const couplesSql = `
        SELECT c.*,
               u1.nickname as user1_nickname, u2.nickname as user2_nickname
        FROM couples c
        JOIN users u1 ON c.user1_id = u1.id
        JOIN users u2 ON c.user2_id = u2.id
        WHERE c.status = 'active'
      `;
      const couplesResult = await query(couplesSql);
      const couples = couplesResult.rows;

      logger.info(`Found ${couples.length} active couples for yearly report generation`);

      for (const couple of couples) {
        try {
          const report = await this.generateYearlyReport(couple.id);
          result.success.push({
            couple_id: couple.id,
            report_id: report.id
          });
        } catch (error) {
          result.errors.push({
            couple_id: couple.id,
            error: error.message
          });
        }
        result.total_processed++;
      }

    } catch (error) {
      logger.error('Error generating yearly reports:', error);
      throw error;
    }

    return result;
  }

  /**
   * 为单个情侣生成年度报告
   */
  static async generateYearlyReport(coupleId) {
    const currentYear = new Date().getFullYear();
    const startDate = `${currentYear - 1}-01-01`;
    const endDate = `${currentYear}-12-31`;

    // 获取年度数据
    const data = await this.getYearlyData(coupleId, startDate, endDate);

    // 生成AI报告
    const reportContent = await this.generateAIReport(data, currentYear);

    // 保存报告
    const report = await this.saveReport(coupleId, currentYear, reportContent, data);

    logger.info(`Generated yearly report ${report.id} for couple ${coupleId}`);

    return report;
  }

  /**
   * 获取年度数据
   */
  static async getYearlyData(coupleId, startDate, endDate) {
    const sql = `
      SELECT
        -- 基本统计
        COUNT(DISTINCT a.id) as total_answers,
        COUNT(DISTINCT a.answer_date) as active_days,
        COUNT(DISTINCT a.question_id) as unique_questions,

        -- 情感分布
        COUNT(CASE WHEN a.sentiment = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN a.sentiment = 'neutral' THEN 1 END) as neutral_count,
        COUNT(CASE WHEN a.sentiment = 'negative' THEN 1 END) as negative_count,

        -- 问题类型分布
        COUNT(CASE WHEN q.category = 'relationship' THEN 1 END) as relationship_count,
        COUNT(CASE WHEN q.category = 'lifestyle' THEN 1 END) as lifestyle_count,
        COUNT(CASE WHEN q.category = 'hobbies' THEN 1 END) as hobbies_count,
        COUNT(CASE WHEN q.category = 'values' THEN 1 END) as values_count,
        COUNT(CASE WHEN q.category = 'future' THEN 1 END) as future_count,

        -- 用户1统计
        (SELECT COUNT(*) FROM answers a1 WHERE a1.user_id IN (SELECT user1_id FROM couples WHERE id = $1) AND a1.answer_date BETWEEN $2 AND $3) as user1_answers,
        (SELECT COUNT(DISTINCT answer_date) FROM answers a1 WHERE a1.user_id IN (SELECT user1_id FROM couples WHERE id = $1) AND a1.answer_date BETWEEN $2 AND $3) as user1_active_days,

        -- 用户2统计
        (SELECT COUNT(*) FROM answers a2 WHERE a2.user_id IN (SELECT user2_id FROM couples WHERE id = $1) AND a2.answer_date BETWEEN $2 AND $3) as user2_answers,
        (SELECT COUNT(DISTINCT answer_date) FROM answers a2 WHERE a2.user_id IN (SELECT user2_id FROM couples WHERE id = $1) AND a2.answer_date BETWEEN $2 AND $3) as user2_active_days,

        -- 连续打卡
        (SELECT MAX(streak) FROM (
          WITH RECURSIVE date_series AS (
            SELECT
              (SELECT MAX(answer_date) FROM answers a WHERE a.user_id IN (SELECT user1_id FROM couples WHERE id = $1) AND a.answer_date BETWEEN $2 AND $3) as date,
              1 as streak
            UNION ALL
            SELECT date - 1, streak + 1
            FROM date_series
            WHERE EXISTS (
              SELECT 1 FROM answers a
              WHERE a.user_id IN (SELECT user1_id FROM couples WHERE id = $1)
              AND a.answer_date = date - 1
              AND a.answer_date BETWEEN $2 AND $3
            )
          )
          SELECT streak FROM date_series LIMIT 1
        )) as user1_max_streak,

        (SELECT MAX(streak) FROM (
          WITH RECURSIVE date_series AS (
            SELECT
              (SELECT MAX(answer_date) FROM answers a WHERE a.user_id IN (SELECT user2_id FROM couples WHERE id = $1) AND a.answer_date BETWEEN $2 AND $3) as date,
              1 as streak
            UNION ALL
            SELECT date - 1, streak + 1
            FROM date_series
            WHERE EXISTS (
              SELECT 1 FROM answers a
              WHERE a.user_id IN (SELECT user2_id FROM couples WHERE id = $1)
              AND a.answer_date = date - 1
              AND a.answer_date BETWEEN $2 AND $3
            )
          )
          SELECT streak FROM date_series LIMIT 1
        )) as user2_max_streak

      FROM answers a
      LEFT JOIN questions q ON a.question_id = q.id
      WHERE a.couple_id = $1 AND a.answer_date BETWEEN $2 AND $3
    `;

    const result = await query(sql, [coupleId, startDate, endDate]);
    const data = result.rows[0];

    // 获取有趣的问答
    const highlightsSql = `
      SELECT
        a.answer_text,
        a.sentiment,
        q.question_text,
        q.category,
        a.created_at,
        u.nickname
      FROM answers a
      JOIN questions q ON a.question_id = q.id
      JOIN users u ON a.user_id = u.id
      WHERE a.couple_id = $1 AND a.answer_date BETWEEN $2 AND $3
        AND a.answer_text IS NOT NULL AND LENGTH(a.answer_text) > 20
      ORDER BY RANDOM()
      LIMIT 10
    `;

    const highlightsResult = await query(highlightsSql, [coupleId, startDate, endDate]);

    // 获取里程碑
    const milestonesSql = `
      SELECT milestone_type, title, completed_at
      FROM milestones
      WHERE couple_id = $1 AND completed_at BETWEEN $2 AND $3
      ORDER BY completed_at
    `;

    const milestonesResult = await query(milestonesSql, [coupleId, startDate, endDate]);

    return {
      total_answers: parseInt(data.total_answers) || 0,
      active_days: parseInt(data.active_days) || 0,
      unique_questions: parseInt(data.unique_questions) || 0,
      sentiment: {
        positive: parseInt(data.positive_count) || 0,
        neutral: parseInt(data.neutral_count) || 0,
        negative: parseInt(data.negative_count) || 0
      },
      categories: {
        relationship: parseInt(data.relationship_count) || 0,
        lifestyle: parseInt(data.lifestyle_count) || 0,
        hobbies: parseInt(data.hobbies_count) || 0,
        values: parseInt(data.values_count) || 0,
        future: parseInt(data.future_count) || 0
      },
      user1: {
        answers: parseInt(data.user1_answers) || 0,
        active_days: parseInt(data.user1_active_days) || 0,
        max_streak: parseInt(data.user1_max_streak) || 0
      },
      user2: {
        answers: parseInt(data.user2_answers) || 0,
        active_days: parseInt(data.user2_active_days) || 0,
        max_streak: parseInt(data.user2_max_streak) || 0
      },
      highlights: highlightsResult.rows,
      milestones: milestonesResult.rows
    };
  }

  /**
   * 使用AI生成年度报告内容
   */
  static async generateAIReport(data, year) {
    const prompt = `请为情侣生成一份温馨的${year}年度总结报告，基于以下数据：

**年度数据统计**
- 总共回答了 ${data.total_answers} 个问题
- 共有 ${data.active_days} 天共同回答问题
- 回答了 ${data.unique_questions} 个不同的问题

**情感分布**
- 积极回答: ${data.sentiment.positive} 次
- 中性回答: ${data.sentiment.neutral} 次
- 需要关注的回答: ${data.sentiment.negative} 次

**问题类型分布**
- 感情类: ${data.categories.relationship} 个
- 生活类: ${data.categories.lifestyle} 个
- 兴趣爱好: ${data.categories.hobbies} 个
- 价值观: ${data.categories.values} 个
- 未来规划: ${data.categories.future} 个

**双方参与情况**
- 用户1: ${data.user1.answers} 次回答，${data.user1.active_days} 天参与，最高连续 ${data.user1.max_streak} 天
- 用户2: ${data.user2.answers} 次回答，${data.user2.active_days} 天参与，最高连续 ${data.user2.max_streak} 天

请用温暖、甜蜜的语言生成一份包含以下部分的年度总结：
1. 开篇温情寄语
2. 年度数据亮点
3. 情感趋势分析
4. 两人互动特点
5. 里程碑回顾
6. 新年祝福与期待

请使用Markdown格式，控制在800字以内。`;

    try {
      const content = await generateWithAI(prompt, 'yearly_report');
      return content;
    } catch (error) {
      logger.error('AI report generation failed, using fallback:', error);
      return this.generateFallbackReport(data, year);
    }
  }

  /**
   * 生成备用报告（当AI不可用时）
   */
  static generateFallbackReport(data, year) {
    const totalAnswers = data.total_answers;
    const activeDays = data.activeDays;
    const positiveRate = totalAnswers > 0
      ? Math.round((data.sentiment.positive / totalAnswers) * 100)
      : 0;

    return `# ${year} 年度爱情总结

## 亲爱的一年

在过去的一年里，你们一共回答了 **${totalAnswers}** 个问题，共同度过了 **${activeDays}** 个美好的日子。

## 爱的数据

- **最暖心的时刻**: 你们的回答中有 **${positiveRate}%** 充满了积极和甜蜜
- **共同成长的印记**: 你们一起探索了 **${data.unique_questions}** 个不同的话题
- **最默契的日子**: 你们一起回答问题的天数

## 我们的故事

这一年里，你们通过每日问答：
- 更加了解彼此的生活习惯
- 分享了对未来的憧憬和规划
- 发现了共同的兴趣爱好
- 加深了感情的理解和包容

## 新年寄语

新的一年，愿你们的爱情如同这些问题一样，持续温暖、不断深化。每一次回答都是一次心的交流，每一个话题都是爱的见证。

**${year + 1}**，继续携手前行！
`;
  }

  /**
   * 保存报告到数据库
   */
  static async saveReport(coupleId, year, content, data) {
    const sql = `
      INSERT INTO yearly_reports (couple_id, year, content, data_summary)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await query(sql, [
      coupleId,
      year,
      content,
      JSON.stringify(data)
    ]);

    return result.rows[0];
  }

  /**
   * 获取年度报告
   */
  static async getReport(coupleId, year) {
    const sql = `
      SELECT * FROM yearly_reports
      WHERE couple_id = $1 AND year = $2
    `;

    const result = await query(sql, [coupleId, year]);
    return result.rows[0] || null;
  }

  /**
   * 获取所有年度报告
   */
  static async getReports(coupleId) {
    const sql = `
      SELECT * FROM yearly_reports
      WHERE couple_id = $1
      ORDER BY year DESC
    `;

    const result = await query(sql, [coupleId]);
    return result.rows;
  }
}

module.exports = YearlyReportService;
