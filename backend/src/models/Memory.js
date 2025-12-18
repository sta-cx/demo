const { Pool } = require('../utils/database');
const logger = require('../utils/logger');

class Memory {
  /**
   * 创建回忆录
   * @param {Object} memoryData - 回忆录数据
   * @returns {Object} 创建的回忆录
   */
  static async create(memoryData) {
    try {
      const {
        couple_id,
        period_type,
        period_date,
        title,
        content,
        summary,
        cover_image_url,
        stats
      } = memoryData;

      const query = `
        INSERT INTO memories (
          couple_id, period_type, period_date, title, 
          content, summary, cover_image_url, stats
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const values = [
        couple_id,
        period_type,
        period_date,
        title,
        JSON.stringify(content),
        summary,
        cover_image_url,
        JSON.stringify(stats)
      ];

      const result = await Pool.query(query, values);
      const memory = result.rows[0];

      // 解析JSON字段
      memory.content = JSON.parse(memory.content);
      memory.stats = JSON.parse(memory.stats);

      logger.info(`Memory created: ${memory.id} for couple ${couple_id}`);
      return memory;
    } catch (error) {
      logger.error('Error creating memory:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取回忆录
   * @param {string} id - 回忆录ID
   * @returns {Object|null} 回忆录数据
   */
  static async findById(id) {
    try {
      const query = 'SELECT * FROM memories WHERE id = $1';
      const result = await Pool.query(query, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      const memory = result.rows[0];
      
      // 解析JSON字段
      memory.content = JSON.parse(memory.content);
      memory.stats = JSON.parse(memory.stats);

      return memory;
    } catch (error) {
      logger.error(`Error finding memory by id ${id}:`, error);
      throw error;
    }
  }

  /**
   * 获取情侣的回忆录列表
   * @param {string} coupleId - 情侣ID
   * @param {Object} options - 查询选项
   * @returns {Array} 回忆录列表
   */
  static async findByCouple(coupleId, options = {}) {
    try {
      const {
        period_type,
        limit = 10,
        offset = 0,
        order_by = 'created_at DESC'
      } = options;

      let query = 'SELECT * FROM memories WHERE couple_id = $1';
      const values = [coupleId];

      if (period_type) {
        query += ' AND period_type = $2';
        values.push(period_type);
      }

      query += ` ORDER BY ${order_by} LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
      values.push(limit, offset);

      const result = await Pool.query(query, values);

      // 解析JSON字段
      return result.rows.map(memory => {
        memory.content = JSON.parse(memory.content);
        memory.stats = JSON.parse(memory.stats);
        return memory;
      });
    } catch (error) {
      logger.error(`Error finding memories for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 检查指定期间是否已有回忆录
   * @param {string} coupleId - 情侣ID
   * @param {string} periodType - 期间类型
   * @param {string} periodDate - 期间日期
   * @returns {boolean} 是否已存在
   */
  static async existsByPeriod(coupleId, periodType, periodDate) {
    try {
      const query = `
        SELECT id FROM memories 
        WHERE couple_id = $1 AND period_type = $2 AND period_date = $3
      `;
      const result = await Pool.query(query, [coupleId, periodType, periodDate]);
      
      return result.rows.length > 0;
    } catch (error) {
      logger.error('Error checking memory existence:', error);
      throw error;
    }
  }

  /**
   * 更新回忆录
   * @param {string} id - 回忆录ID
   * @param {Object} updateData - 更新数据
   * @returns {Object|null} 更新后的回忆录
   */
  static async update(id, updateData) {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      // 动态构建更新字段
      Object.keys(updateData).forEach(key => {
        if (updateData[key] !== undefined) {
          fields.push(`${key} = $${paramIndex}`);
          
          if (key === 'content' || key === 'stats') {
            values.push(JSON.stringify(updateData[key]));
          } else {
            values.push(updateData[key]);
          }
          
          paramIndex++;
        }
      });

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      const query = `
        UPDATE memories 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      values.push(id);
      const result = await Pool.query(query, values);

      if (result.rows.length === 0) {
        return null;
      }

      const memory = result.rows[0];
      
      // 解析JSON字段
      memory.content = JSON.parse(memory.content);
      memory.stats = JSON.parse(memory.stats);

      logger.info(`Memory updated: ${id}`);
      return memory;
    } catch (error) {
      logger.error(`Error updating memory ${id}:`, error);
      throw error;
    }
  }

  /**
   * 删除回忆录
   * @param {string} id - 回忆录ID
   * @returns {boolean} 是否删除成功
   */
  static async delete(id) {
    try {
      const query = 'DELETE FROM memories WHERE id = $1 RETURNING id';
      const result = await Pool.query(query, [id]);
      
      const deleted = result.rows.length > 0;
      
      if (deleted) {
        logger.info(`Memory deleted: ${id}`);
      }
      
      return deleted;
    } catch (error) {
      logger.error(`Error deleting memory ${id}:`, error);
      throw error;
    }
  }

  /**
   * 获取回忆录统计
   * @param {string} coupleId - 情侣ID
   * @returns {Object} 统计数据
   */
  static async getStats(coupleId) {
    try {
      const query = `
        SELECT 
          period_type,
          COUNT(*) as count,
          MAX(created_at) as latest_created
        FROM memories 
        WHERE couple_id = $1
        GROUP BY period_type
      `;

      const result = await Pool.query(query, [coupleId]);
      
      const stats = {
        weekly: { count: 0, latest_created: null },
        monthly: { count: 0, latest_created: null },
        yearly: { count: 0, latest_created: null },
        total: 0
      };

      result.rows.forEach(row => {
        stats[row.period_type] = {
          count: parseInt(row.count),
          latest_created: row.latest_created
        };
        stats.total += parseInt(row.count);
      });

      return stats;
    } catch (error) {
      logger.error(`Error getting memory stats for couple ${coupleId}:`, error);
      throw error;
    }
  }

  /**
   * 生成分享数据
   * @param {string} id - 回忆录ID
   * @returns {Object} 分享数据
   */
  static async generateShareData(id) {
    try {
      const memory = await this.findById(id);
      if (!memory) {
        throw new Error('Memory not found');
      }

      // 生成分享内容
      const shareData = {
        id: memory.id,
        title: memory.title,
        summary: memory.summary,
        period_type: memory.period_type,
        period_date: memory.period_date,
        stats: memory.stats,
        created_at: memory.created_at,
        // 移除敏感内容，只保留分享所需信息
        content: {
          highlights: memory.content.highlights || [],
          moments: memory.content.moments?.slice(0, 3) || []
        }
      };

      return shareData;
    } catch (error) {
      logger.error(`Error generating share data for memory ${id}:`, error);
      throw error;
    }
  }

  /**
   * 批量创建回忆录
   * @param {Array} memoriesData - 回忆录数据数组
   * @returns {Array} 创建的回忆录列表
   */
  static async createBatch(memoriesData) {
    try {
      const createdMemories = [];
      
      for (const memoryData of memoriesData) {
        try {
          const memory = await this.create(memoryData);
          createdMemories.push(memory);
        } catch (error) {
          logger.error('Error creating memory in batch:', error);
          // 继续处理其他回忆录
        }
      }

      logger.info(`Batch created ${createdMemories.length} memories`);
      return createdMemories;
    } catch (error) {
      logger.error('Error in batch memory creation:', error);
      throw error;
    }
  }

  /**
   * 清理过期回忆录
   * @param {number} daysToKeep - 保留天数
   * @returns {number} 删除的数量
   */
  static async cleanupOldMemories(daysToKeep = 730) {
    try {
      const query = `
        DELETE FROM memories 
        WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'
        RETURNING id
      `;

      const result = await Pool.query(query);
      const deletedCount = result.rows.length;

      if (deletedCount > 0) {
        logger.info(`Cleaned up ${deletedCount} old memories`);
      }

      return deletedCount;
    } catch (error) {
      logger.error('Error cleaning up old memories:', error);
      throw error;
    }
  }

  /**
   * 转换为JSON格式（用于API响应）
   */
  toJSON() {
    return {
      id: this.id,
      couple_id: this.couple_id,
      period_type: this.period_type,
      period_date: this.period_date,
      title: this.title,
      content: this.content,
      summary: this.summary,
      cover_image_url: this.cover_image_url,
      stats: this.stats,
      created_at: this.created_at
    };
  }

  /**
   * 转换为详细JSON格式（包含更多字段）
   */
  toDetailedJSON() {
    return {
      ...this.toJSON(),
      // 可以添加更多详细字段
    };
  }
}

module.exports = Memory;