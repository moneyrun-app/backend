-- ============================================================
-- 머니런 v2.0 DB 마이그레이션
-- 날짜: 2026-04-11
-- ============================================================

-- ========== 1. 테이블 삭제 (8개) ==========

DROP TABLE IF EXISTS daily_checks CASCADE;
DROP TABLE IF EXISTS weekly_summaries CASCADE;
DROP TABLE IF EXISTS monthly_finalizations CASCADE;
DROP TABLE IF EXISTS monthly_snapshots CASCADE;
DROP TABLE IF EXISTS monthly_reports CASCADE;
DROP TABLE IF EXISTS learn_contents CASCADE;
DROP TABLE IF EXISTS user_content_reads CASCADE;
DROP TABLE IF EXISTS user_content_scraps CASCADE;

-- ========== 2. 기존 테이블 수정 ==========

-- finance_profiles: 월 투자액 추가
ALTER TABLE finance_profiles
  ADD COLUMN IF NOT EXISTS monthly_investment INT DEFAULT 0;

-- quizzes: 난이도 레벨 추가
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS difficulty_level INT DEFAULT 1;

-- users: 퀴즈 난이도 레벨 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS quiz_level INT DEFAULT 1;

-- ========== 3. 신규 테이블 생성 (6개) ==========

-- 출석체크
CREATE TABLE IF NOT EXISTS attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id),
  is_correct BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, date);

-- 머니북 (어드민 등록 책 템플릿)
CREATE TABLE IF NOT EXISTS money_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  cover_image_url TEXT,
  required_fields JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_money_books_category ON money_books(category);

-- 머니북 챕터 템플릿
CREATE TABLE IF NOT EXISTS money_book_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES money_books(id) ON DELETE CASCADE,
  chapter_order INT NOT NULL,
  title TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(book_id, chapter_order)
);

-- 유저 구매 + AI 개인화 결과
CREATE TABLE IF NOT EXISTS user_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  book_id UUID REFERENCES money_books(id),
  source TEXT DEFAULT 'store',
  extra_onboarding_data JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'generating',
  personalized_chapters JSONB DEFAULT '[]'::jsonb,
  scrap_snapshot JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- store 구매는 같은 책 중복 불가
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_purchases_unique_store
  ON user_purchases(user_id, book_id)
  WHERE book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_purchases_user ON user_purchases(user_id);

-- 문장별 컬러 하이라이트
CREATE TABLE IF NOT EXISTS user_book_highlights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purchase_id UUID NOT NULL REFERENCES user_purchases(id) ON DELETE CASCADE,
  chapter_index INT NOT NULL,
  sentence_text TEXT NOT NULL,
  color TEXT DEFAULT 'yellow',
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_highlights_purchase ON user_book_highlights(purchase_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user ON user_book_highlights(user_id);

-- 퀴즈 스크랩 (북마크)
CREATE TABLE IF NOT EXISTS user_quiz_scraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, quiz_id)
);

CREATE INDEX IF NOT EXISTS idx_quiz_scraps_user ON user_quiz_scraps(user_id);

-- ============================================================
-- 마이그레이션 완료
-- ============================================================
