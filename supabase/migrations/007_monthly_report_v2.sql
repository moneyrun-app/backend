-- 월간 리포트 v2 스키마
-- 2026.04.07

-- ============================================
-- 1. monthly_snapshots — 전월 비교용 재무 스냅샷
-- ============================================
CREATE TABLE IF NOT EXISTS monthly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,           -- '2026-04'
  monthly_income INTEGER NOT NULL,
  monthly_fixed_cost INTEGER NOT NULL DEFAULT 0,
  monthly_variable_cost INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'YELLOW',
  total_spent INTEGER NOT NULL DEFAULT 0,       -- daily_checks 합산
  savings INTEGER NOT NULL DEFAULT 0,           -- income - total_spent
  surplus INTEGER NOT NULL DEFAULT 0,           -- income - fixed - variable
  fq_score INTEGER NOT NULL DEFAULT 0,          -- 금융지수
  days_tracked INTEGER NOT NULL DEFAULT 0,
  days_under INTEGER NOT NULL DEFAULT 0,        -- 절약일
  days_over INTEGER NOT NULL DEFAULT 0,         -- 초과일
  no_spend_days INTEGER NOT NULL DEFAULT 0,     -- 무지출일
  quiz_total INTEGER NOT NULL DEFAULT 0,
  quiz_correct INTEGER NOT NULL DEFAULT 0,
  best_streak INTEGER NOT NULL DEFAULT 0,       -- 최대 연속 절약일
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_user ON monthly_snapshots(user_id, month);

-- ============================================
-- 2. badges — 배지 정의
-- ============================================
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  category VARCHAR(30) NOT NULL,   -- 'spending', 'learning', 'streak', 'report'
  condition_type VARCHAR(50),      -- 'no_spend_days', 'streak_days', 'quiz_score', etc.
  condition_value INTEGER,         -- 달성 기준값
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 초기 배지 데이터
INSERT INTO badges (code, name, description, icon, category, condition_type, condition_value) VALUES
  ('no_spend_5', '무지출 챔피언', '한 달에 무지출 데이 5회 달성', '💰', 'spending', 'no_spend_days', 5),
  ('streak_30', '성실 러너', '30일 연속 지출 기록', '🏃', 'streak', 'streak_days', 30),
  ('streak_14', '꾸준한 러너', '14일 연속 지출 기록', '👟', 'streak', 'streak_days', 14),
  ('streak_7', '시작이 반', '7일 연속 지출 기록', '🌱', 'streak', 'streak_days', 7),
  ('fixed_diet', '고정비 다이어터', '상세리포트 고정비 절감 미션 달성', '✂️', 'report', 'proposal_check', 1),
  ('budget_master', '예산 마스터', '한 달 지출 예산 이내 달성', '🎯', 'spending', 'budget_under', 1),
  ('quiz_10', '금융 탐험가', '퀴즈 10개 이상 풀기', '📚', 'learning', 'quiz_total', 10),
  ('quiz_perfect', '만점왕', '퀴즈 정답률 90% 이상', '🏆', 'learning', 'quiz_accuracy', 90),
  ('fq_up_10', 'FQ 성장러', 'FQ 점수 전월 대비 10점 이상 상승', '📈', 'learning', 'fq_increase', 10),
  ('wrong_clear', '완전 정복', '오답노트 전부 클리어', '⭐', 'learning', 'wrong_clear', 1)
ON CONFLICT (code) DO NOTHING;

-- ============================================
-- 3. user_badges — 유저 배지 획득
-- ============================================
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,           -- 획득 월
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id, month)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ============================================
-- 4. monthly_reports 확장
-- ============================================
ALTER TABLE monthly_reports
  ADD COLUMN IF NOT EXISTS sections JSONB,
  ADD COLUMN IF NOT EXISTS snapshot_id UUID,
  ADD COLUMN IF NOT EXISTS badges_earned JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS proposal_checks JSONB DEFAULT '[]'::jsonb;
