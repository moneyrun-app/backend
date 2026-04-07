-- 월간 소비 확정 테이블
-- 2026.04.07

CREATE TABLE IF NOT EXISTS monthly_finalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month VARCHAR(7) NOT NULL,                -- '2026-04'
  expired BOOLEAN NOT NULL DEFAULT FALSE,   -- 리포트 미생성 소멸 처리
  finalized_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month)
);

CREATE INDEX IF NOT EXISTS idx_monthly_finalizations_user ON monthly_finalizations(user_id);
