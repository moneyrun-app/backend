-- 상세 리포트 v6 스키마 변경
-- 2026.04.06

-- 1. detailed_reports 컬럼 추가
ALTER TABLE detailed_reports
  ADD COLUMN IF NOT EXISTS sections JSONB,
  ADD COLUMN IF NOT EXISTS report_version VARCHAR(10) DEFAULT 'v1',
  ADD COLUMN IF NOT EXISTS user_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- 2. 금융 용어 사전 (마이북 선물)
CREATE TABLE IF NOT EXISTS user_glossaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id UUID REFERENCES detailed_reports(id) ON DELETE SET NULL,
  terms JSONB NOT NULL,
  grade VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_glossaries_user_id ON user_glossaries(user_id);
