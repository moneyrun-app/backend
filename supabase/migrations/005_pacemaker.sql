-- 5단계: 페이스메이커 로그 테이블

CREATE TABLE IF NOT EXISTS pacemaker_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  context JSONB,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pacemaker_logs_user ON pacemaker_logs(user_id, created_at DESC);

ALTER TABLE pacemaker_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자기 발화 로그만 접근 가능" ON pacemaker_logs
  FOR ALL USING (auth.uid() = user_id);
