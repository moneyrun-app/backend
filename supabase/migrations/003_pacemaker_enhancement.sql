-- 페이스메이커 고도화: 주간 요약 테이블 + 추천 행동 제거
-- v4.2 — 2026.04.06

-- ============================================
-- 1. weekly_summaries 테이블 생성
-- ============================================
CREATE TABLE IF NOT EXISTS weekly_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  days_tracked INTEGER NOT NULL DEFAULT 0,
  days_skipped INTEGER NOT NULL DEFAULT 0,
  days_under INTEGER NOT NULL DEFAULT 0,
  days_over INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  adjusted_budget INTEGER NOT NULL DEFAULT 0,
  spent_rate NUMERIC(5,1) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_weekly_summaries_user_week ON weekly_summaries(user_id, week_start);
CREATE INDEX idx_weekly_summaries_user_id ON weekly_summaries(user_id);

-- ============================================
-- 2. pacemaker_messages에 theme 컬럼 추가
-- ============================================
ALTER TABLE pacemaker_messages ADD COLUMN IF NOT EXISTS theme VARCHAR(30);
ALTER TABLE pacemaker_messages ADD COLUMN IF NOT EXISTS quote TEXT;
