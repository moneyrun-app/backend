-- ============================================================
-- 머니런 v3.1 진단퀴즈 오답노트 지원
-- 날짜: 2026-04-16
-- ============================================================

-- 1. wrong_notes에 diagnostic_quiz_id 컬럼 추가
ALTER TABLE wrong_notes
  ADD COLUMN IF NOT EXISTS diagnostic_quiz_id UUID REFERENCES diagnostic_quizzes(id);

-- 2. quiz_id를 nullable로 변경 (diagnostic만 있는 경우 허용)
ALTER TABLE wrong_notes
  ALTER COLUMN quiz_id DROP NOT NULL;

-- 3. CHECK 제약: quiz_id 또는 diagnostic_quiz_id 중 하나는 반드시 존재
ALTER TABLE wrong_notes
  ADD CONSTRAINT chk_wrong_notes_quiz_source
  CHECK (quiz_id IS NOT NULL OR diagnostic_quiz_id IS NOT NULL);

-- 4. 인덱스
CREATE INDEX IF NOT EXISTS idx_wrong_notes_diagnostic_quiz
  ON wrong_notes(diagnostic_quiz_id) WHERE diagnostic_quiz_id IS NOT NULL;

-- 5. upsert용 유니크 제약 (진단퀴즈 중복 오답 방지)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wrong_notes_user_diagnostic
  ON wrong_notes(user_id, diagnostic_quiz_id) WHERE diagnostic_quiz_id IS NOT NULL;

-- ============================================================
-- 마이그레이션 완료
-- ============================================================
