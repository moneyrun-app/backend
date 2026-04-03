-- MoneyRun v2.0 → v3.0 Schema Migration
-- 실행 전 백업 필수!

-- ============================================================
-- 1. finance_profiles 테이블 변경
-- ============================================================

-- 새 컬럼 추가
ALTER TABLE finance_profiles
  ADD COLUMN IF NOT EXISTS monthly_fixed_cost integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_return numeric(5,2) DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS investment_years integer,
  ADD COLUMN IF NOT EXISTS variable_cost_monthly integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variable_cost_weekly integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS variable_cost_daily integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS grade text DEFAULT 'YELLOW';

-- ============================================================
-- 2. 사용하지 않는 테이블 삭제
-- ============================================================

DROP TABLE IF EXISTS good_spendings CASCADE;
DROP TABLE IF EXISTS fixed_expenses CASCADE;

-- ============================================================
-- 3. pacemaker_messages 테이블 변경
-- ============================================================

-- daily_surplus → daily_variable_cost 마이그레이션
ALTER TABLE pacemaker_messages
  ADD COLUMN IF NOT EXISTS daily_variable_cost integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS spending_status jsonb DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS refresh_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS disclaimer text DEFAULT '참고용 조언이며, 개인 상황에 따라 다를 수 있어요';

-- 기존 데이터 마이그레이션 (daily_surplus → daily_variable_cost)
UPDATE pacemaker_messages
  SET daily_variable_cost = COALESCE(daily_surplus, 0)
  WHERE daily_variable_cost = 0 AND daily_surplus IS NOT NULL;

-- ============================================================
-- 4. 새 테이블: pacemaker_actions (추천 행동)
-- ============================================================

CREATE TABLE IF NOT EXISTS pacemaker_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES pacemaker_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'learn_content',
  content_id uuid,
  title text NOT NULL,
  label text NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending / completed / cancelled
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pacemaker_actions_user_date
  ON pacemaker_actions (user_id, created_at);

-- ============================================================
-- 5. 새 테이블: pacemaker_feedback (피드백/신고)
-- ============================================================

CREATE TABLE IF NOT EXISTS pacemaker_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES pacemaker_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,  -- inaccurate / offensive / other
  content text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 6. detailed_reports 테이블 변경
-- ============================================================

ALTER TABLE detailed_reports
  ADD COLUMN IF NOT EXISTS pdf_url text,
  ADD COLUMN IF NOT EXISTS is_free boolean DEFAULT false;

-- ============================================================
-- 7. weekly_reports 테이블 변경
-- ============================================================

ALTER TABLE weekly_reports
  ADD COLUMN IF NOT EXISTS weekly_stats jsonb DEFAULT '{}';

-- ============================================================
-- 8. 새 테이블: external_scraps (외부 URL 스크랩)
-- ============================================================

CREATE TABLE IF NOT EXISTS external_scraps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  url text NOT NULL,
  channel text NOT NULL DEFAULT 'other',  -- youtube / threads / instagram / other
  creator text,
  content_date date,
  title text,
  ai_summary text,
  scrap_count integer DEFAULT 1,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_external_scraps_user
  ON external_scraps (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_external_scraps_url
  ON external_scraps (url);

-- ============================================================
-- 9. 새 테이블: report_payments (결제 이력)
-- ============================================================

CREATE TABLE IF NOT EXISTS report_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES detailed_reports(id) ON DELETE SET NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',  -- pending / completed / failed / refunded
  payment_token text,
  created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 10. system_config 추가 키
-- ============================================================

INSERT INTO system_config (key, value)
VALUES
  ('exchange_rate', '1350'),
  ('oil_price', '75.5'),
  ('min_pension_goal', '1300000')
ON CONFLICT (key) DO NOTHING;
