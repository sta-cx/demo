-- 年度报告表 migration
-- 执行: psql -d your_database -f 005_create_yearly_reports.sql

-- 创建年度报告表
CREATE TABLE IF NOT EXISTS yearly_reports (
    id SERIAL PRIMARY KEY,
    couple_id INTEGER NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    content TEXT,
    data_summary JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 唯一约束
    CONSTRAINT unique_yearly_report UNIQUE (couple_id, year)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_yearly_reports_couple_id ON yearly_reports(couple_id);
CREATE INDEX IF NOT EXISTS idx_yearly_reports_year ON yearly_reports(year);

-- 添加评论
COMMENT ON TABLE yearly_reports IS '年度回忆报告表';
COMMENT ON COLUMN yearly_reports.content IS 'AI生成的年度总结内容(Markdown格式)';
COMMENT ON COLUMN yearly_reports.data_summary IS '年度数据汇总JSON';
