-- ============================================================
-- 머니런 v3.0 코스 시스템 DB 마이그레이션
-- 날짜: 2026-04-15
-- ============================================================

-- ========== 1. 기존 테이블 수정 (3개) ==========

-- quizzes: 코스 카테고리 매핑 컬럼 추가
ALTER TABLE quizzes
  ADD COLUMN IF NOT EXISTS course_category TEXT;

-- 기존 category → course_category 매핑
UPDATE quizzes SET course_category = CASE
  WHEN category IN ('연금') THEN '연금'
  WHEN category IN ('주식', '투자기초', '투자상품', '해외투자', '가상자산') THEN '주식'
  WHEN category IN ('부동산') THEN '부동산'
  WHEN category IN ('절세') THEN '세금_연말정산'
  WHEN category IN ('저축', '경제기초', '금융생활', '정책상품') THEN '소비_저축'
  ELSE '소비_저축'
END
WHERE course_category IS NULL;

CREATE INDEX IF NOT EXISTS idx_quizzes_course_category ON quizzes(course_category);

-- users: 온보딩 버전 추가
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_version INT DEFAULT 2;

-- pacemaker_messages: 코스 컨텍스트 추가
ALTER TABLE pacemaker_messages
  ADD COLUMN IF NOT EXISTS course_id UUID,
  ADD COLUMN IF NOT EXISTS course_chapter INT,
  ADD COLUMN IF NOT EXISTS mission_context JSONB;

-- ========== 2. 신규 테이블 생성 (6개) ==========

-- 코스 정의 (5카테고리 x 3레벨 = 15개)
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  level TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  chapter_count INT DEFAULT 5,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(category, level)
);

-- 유저-코스 연결
CREATE TABLE IF NOT EXISTS user_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id),
  status TEXT NOT NULL DEFAULT 'active',
  purchase_id UUID REFERENCES user_purchases(id),
  current_chapter INT DEFAULT 1,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 1인 1활성 코스 보장 (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_courses_active
  ON user_courses(user_id) WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_user_courses_user ON user_courses(user_id);

-- 챕터별 미션
CREATE TABLE IF NOT EXISTS course_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  chapter_number INT NOT NULL,
  mission_order INT NOT NULL DEFAULT 1,
  type TEXT NOT NULL DEFAULT 'action',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(course_id, chapter_number, mission_order)
);

CREATE INDEX IF NOT EXISTS idx_course_missions_course ON course_missions(course_id);

-- 미션 수행 이력
CREATE TABLE IF NOT EXISTS user_mission_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_course_id UUID NOT NULL REFERENCES user_courses(id) ON DELETE CASCADE,
  mission_id UUID NOT NULL REFERENCES course_missions(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  note TEXT,
  UNIQUE(user_id, mission_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_completions_user_course ON user_mission_completions(user_course_id);

-- 온보딩 진행 상태 (5단계 이어하기)
CREATE TABLE IF NOT EXISTS onboarding_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step INT NOT NULL DEFAULT 1,
  selected_category TEXT,
  diagnostic_answers JSONB,
  assigned_level TEXT,
  course_id UUID REFERENCES courses(id),
  finance_data JSONB,
  course_extra_data JSONB,
  generation_status TEXT,
  generation_purchase_id UUID,
  pacemaker_welcomed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- 진단퀴즈 풀 (카테고리별 10문제)
CREATE TABLE IF NOT EXISTS diagnostic_quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  question TEXT NOT NULL,
  choices JSONB NOT NULL,
  correct_answer INT NOT NULL,
  difficulty_weight INT NOT NULL DEFAULT 1,
  brief_explanation TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnostic_quizzes_category ON diagnostic_quizzes(category);

-- pacemaker_messages에 courses FK 추가 (ALTER 이후 테이블 생성 완료 후)
-- 참고: course_id FK는 courses 테이블 생성 후에만 가능
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'pacemaker_messages_course_id_fkey'
  ) THEN
    ALTER TABLE pacemaker_messages
      ADD CONSTRAINT pacemaker_messages_course_id_fkey
      FOREIGN KEY (course_id) REFERENCES courses(id);
  END IF;
END $$;

-- ========== 3. Seed 데이터: 15개 코스 정의 ==========

INSERT INTO courses (category, level, title, description) VALUES
  ('연금', '기초', '연금 기초 과정', '국민연금부터 퇴직연금까지, 연금의 기본 개념을 잡아보세요'),
  ('연금', '심화', '연금 심화 과정', '연금 수령 전략과 절세 방법을 배워봅시다'),
  ('연금', '마스터', '연금 마스터 과정', '연금 포트폴리오 최적화와 조기 은퇴 전략'),
  ('주식', '기초', '주식 기초 과정', '주식이란 무엇인가? 기본 용어부터 시작합니다'),
  ('주식', '심화', '주식 심화 과정', 'ETF, 배당투자, 포트폴리오 구성의 실전'),
  ('주식', '마스터', '주식 마스터 과정', '재무제표 분석, 밸류에이션, 리스크 관리'),
  ('부동산', '기초', '부동산 기초 과정', '전세/월세부터 청약까지, 부동산 기본기'),
  ('부동산', '심화', '부동산 심화 과정', '부동산 투자 분석과 세금 전략'),
  ('부동산', '마스터', '부동산 마스터 과정', '상가/오피스텔 투자와 포트폴리오 다변화'),
  ('세금_연말정산', '기초', '세금 기초 과정', '소득세, 연말정산의 기본 개념'),
  ('세금_연말정산', '심화', '세금 심화 과정', '절세 전략과 공제 항목 최적화'),
  ('세금_연말정산', '마스터', '세금 마스터 과정', '종합소득세, 양도소득세, 사업자 절세'),
  ('소비_저축', '기초', '소비·저축 기초 과정', '가계부 작성과 비상금 만들기의 첫걸음'),
  ('소비_저축', '심화', '소비·저축 심화 과정', '소비 패턴 분석과 저축 자동화 전략'),
  ('소비_저축', '마스터', '소비·저축 마스터 과정', '재무 자유를 향한 저축 고도화와 자산 배분')
ON CONFLICT (category, level) DO NOTHING;

-- ============================================================
-- 마이그레이션 완료
-- 신규 6테이블 + 기존 3테이블 수정 + 15개 코스 seed
-- ============================================================
