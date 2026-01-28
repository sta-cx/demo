-- 数据库迁移汇总脚本
-- 执行: psql -d your_database -f ALL_MIGRATIONS.sql
-- 注意: 如果表已存在，请单独执行每个迁移脚本

-- ==================== 里程碑表 ====================
CREATE TABLE IF NOT EXISTS milestones (
    id SERIAL PRIMARY KEY,
    couple_id INTEGER NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone_type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT milestone_type_check CHECK (
        milestone_type IN (
            'first_answer', 'week_streak', 'month_streak', 'hundred_days',
            'anniversary', 'fifty_answers', 'first_week', 'first_month',
            'deep_conversation', 'travel_together', 'first_photo',
            'meet_partner', 'first_call'
        )
    )
);

CREATE INDEX IF NOT EXISTS idx_milestones_couple_id ON milestones(couple_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_milestones_completed_at ON milestones(completed_at DESC);

-- ==================== 用户设置表 ====================
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    notification_enabled BOOLEAN DEFAULT true,
    notification_time TIME DEFAULT '21:00:00',
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,
    profile_visible BOOLEAN DEFAULT true,
    show_answers_count BOOLEAN DEFAULT true,
    show_streak BOOLEAN DEFAULT true,
    question_category VARCHAR(100)[] DEFAULT ARRAY['relationship', 'lifestyle', 'hobbies', 'values', 'future'],
    ai_question_ratio INTEGER DEFAULT 70,
    language VARCHAR(10) DEFAULT 'zh-CN',
    theme VARCHAR(20) DEFAULT 'light',
    daily_reminder BOOLEAN DEFAULT true,
    streak_reminder BOOLEAN DEFAULT true,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 自动更新updated_at触发器
CREATE OR REPLACE FUNCTION update_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_user_settings_updated ON user_settings;
CREATE TRIGGER trigger_user_settings_updated
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_user_settings_timestamp();

-- ==================== 年度报告表 ====================
CREATE TABLE IF NOT EXISTS yearly_reports (
    id SERIAL PRIMARY KEY,
    couple_id INTEGER NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    content TEXT,
    data_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_yearly_report UNIQUE (couple_id, year)
);

CREATE INDEX IF NOT EXISTS idx_yearly_reports_couple_id ON yearly_reports(couple_id);
CREATE INDEX IF NOT EXISTS idx_yearly_reports_year ON yearly_reports(year);

-- ==================== 回答表增加语音/图片支持 ====================
-- 添加回答类型（如果是枚举类型）
-- ALTER TYPE answer_type ADD VALUE IF NOT EXISTS 'voice';
-- ALTER TYPE answer_type ADD VALUE IF NOT EXISTS 'image';

-- 添加语音/图片相关字段
ALTER TABLE answers ADD COLUMN IF NOT EXISTS media_duration INTEGER;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS media_size INTEGER;
ALTER TABLE answers ADD COLUMN IF NOT EXISTS thumbnail_url VARCHAR(500);

-- ==================== 连续打卡记录表 ====================
CREATE TABLE IF NOT EXISTS streak_records (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    couple_id INTEGER NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    streak_date DATE NOT NULL,
    streak_count INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_streak_record UNIQUE (user_id, couple_id, streak_date)
);

CREATE INDEX IF NOT EXISTS idx_streak_records_user ON streak_records(user_id);
CREATE INDEX IF NOT EXISTS idx_streak_records_couple ON streak_records(couple_id);
CREATE INDEX IF NOT EXISTS idx_streak_records_date ON streak_records(streak_date DESC);

-- ==================== 完成 ====================
DO $$
BEGIN
    RAISE NOTICE '所有迁移已完成执行';
END $$;
