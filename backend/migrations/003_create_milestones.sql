-- 里程碑表 migration
-- 执行: psql -d your_database -f 003_create_milestones.sql

-- 创建里程碑表
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

    -- 索引
    CONSTRAINT milestone_type_check CHECK (
        milestone_type IN (
            'first_answer',
            'week_streak',
            'month_streak',
            'hundred_days',
            'anniversary',
            'fifty_answers',
            'first_week',
            'first_month',
            'deep_conversation',
            'travel_together',
            'first_photo',
            'meet_partner',
            'first_call'
        )
    )
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_milestones_couple_id ON milestones(couple_id);
CREATE INDEX IF NOT EXISTS idx_milestones_user_id ON milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_milestones_type ON milestones(milestone_type);
CREATE INDEX IF NOT EXISTS idx_milestones_completed_at ON milestones(completed_at DESC);

-- 添加评论
COMMENT ON TABLE milestones IS '情侣里程碑记录表';
COMMENT ON COLUMN milestones.milestone_type IS '里程碑类型: first_answer, week_streak, month_streak, hundred_days, anniversary, fifty_answers, first_week, first_month, deep_conversation, travel_together, first_photo, meet_partner, first_call';
COMMENT ON COLUMN milestones.metadata IS '额外数据JSON: {streak_days, answer_count, days_together等}';
