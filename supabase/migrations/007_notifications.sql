-- 7단계: 알림 테이블

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'expense_alert',     -- 지출 알림 (일 예산 초과 등)
    'badge_earned',      -- 뱃지 획득
    'grade_changed',     -- 신호등 등급 변화
    'scrap_summary',     -- 스크랩 AI 요약 완료
    'community_like',    -- 게시글 좋아요
    'community_comment', -- 게시글 댓글
    'system'             -- 시스템 공지
  )),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,                      -- 추가 데이터 (게시글 ID, 거래 ID 등)
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자기 알림만 접근 가능" ON notifications
  FOR ALL USING (auth.uid() = user_id);
