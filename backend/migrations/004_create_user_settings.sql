-- 用户设置表 migration
-- 执行: psql -d your_database -f 004_create_user_settings.sql

-- 创建用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,

    -- 通知设置
    notification_enabled BOOLEAN DEFAULT true,
    notification_time TIME DEFAULT '21:00:00',
    push_enabled BOOLEAN DEFAULT true,
    email_enabled BOOLEAN DEFAULT false,

    -- 隐私设置
    profile_visible BOOLEAN DEFAULT true,
    show_answers_count BOOLEAN DEFAULT true,
    show_streak BOOLEAN DEFAULT true,

    -- 偏好设置
    question_category VARCHAR(100)[] DEFAULT ARRAY['relationship', 'lifestyle', 'hobbies', 'values', 'future'],
    ai_question_ratio INTEGER DEFAULT 70,
    language VARCHAR(10) DEFAULT 'zh-CN',
    theme VARCHAR(20) DEFAULT 'light',

    -- 打卡设置
    daily_reminder BOOLEAN DEFAULT true,
    streak_reminder BOOLEAN DEFAULT true,

    -- 额外偏好 (JSONB)
    preferences JSONB DEFAULT '{}',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);

-- 添加评论
COMMENT ON TABLE user_settings IS '用户个性化设置表';
COMMENT ON COLUMN user_settings.question_category IS '偏好的问题类型数组';
COMMENT ON COLUMN user_settings.ai_question_ratio IS 'AI生成问题占比(0-100)';
COMMENT ON COLUMN user_settings.preferences IS '额外偏好设置: {font_size, auto_play, notification_sound等}';

-- 创建触发器自动更新updated_at
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
