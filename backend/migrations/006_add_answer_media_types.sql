-- 回答表增加语音/图片支持
-- 执行: psql -d your_database -f 006_add_answer_media_types.sql

-- 添加回答类型枚举值
ALTER TYPE answer_type ADD VALUE IF NOT EXISTS 'voice';
ALTER TYPE answer_type ADD VALUE IF NOT EXISTS 'image';

-- 如果answer_type不是枚举类型，使用文本字段的检查约束
-- ALTER TABLE answers ADD CONSTRAINT answer_type_check CHECK (answer_type IN ('text', 'choice', 'voice', 'image'));

-- 添加语音/图片相关字段
ALTER TABLE answers ADD COLUMN IF NOT EXISTS media_duration INTEGER; -- 语音时长(秒)
ALTER TABLE answers ADD COLUMN IF NOT EXISTS media_size INTEGER; -- 文件大小(字节)
ALTER TABLE answers ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500); -- 缩略图URL

-- 添加评论
COMMENT ON COLUMN answers.media_duration IS '语音回答时长(秒)';
COMMENT ON COLUMN answers.media_size IS '媒体文件大小(字节)';
COMMENT ON COLUMN answers.thumbnail_url IS '图片缩略图URL';

-- 创建连续打卡记录表
CREATE TABLE IF NOT EXISTS streak_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id INTEGER NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    streak_date DATE NOT NULL,
    streak_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT unique_streak_record UNIQUE (user_id, couple_id, streak_date)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_streak_records_user ON streak_records(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_records_couple ON streak_records(couple_id);
CREATE INDEX IF NOT EXISTS idx_streak_records_date ON streak_records(streak_date DESC);

-- 添加评论
COMMENT ON TABLE streak_records IS '用户每日打卡记录表';
COMMENT ON COLUMN streak_records.streak_count IS '累计连续打卡天数';
