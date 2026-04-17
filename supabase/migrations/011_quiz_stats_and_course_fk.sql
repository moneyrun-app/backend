-- ============================================================
-- 퀴즈 통계 복구 + courses ↔ course_categories 연결
-- 날짜: 2026-04-18
-- 변경사항:
--   1. correct_rate 컬럼 복구 (일배치 통계)
--   2. refresh_quiz_stats() 함수 재정의
--   3. courses.category 리네임 (세금_연말정산→세금, 소비_저축→소비)
--   4. 예적금 3레벨 코스 추가
--   5. courses.course_category_id FK 추가 + 백필
--   6. onboarding_progress / diagnostic_quizzes 카테고리 값 동기화
-- ============================================================

BEGIN;

-- ========== 1. correct_rate 복구 ==========
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS correct_rate NUMERIC(5,2) DEFAULT 0;

-- ========== 2. refresh_quiz_stats() 재정의 ==========
CREATE OR REPLACE FUNCTION refresh_quiz_stats()
RETURNS void AS $$
BEGIN
  UPDATE quizzes q SET
    total_attempts = COALESCE(stats.total, 0),
    correct_count = COALESCE(stats.correct, 0),
    correct_rate = CASE
      WHEN COALESCE(stats.total, 0) > 0
      THEN ROUND(COALESCE(stats.correct, 0)::numeric / stats.total * 100, 2)
      ELSE 0
    END
  FROM (
    SELECT quiz_id,
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE correct = true) AS correct
    FROM quiz_answers
    GROUP BY quiz_id
  ) stats
  WHERE q.id = stats.quiz_id;
END;
$$ LANGUAGE plpgsql;

-- ========== 3. courses.category 리네임 ==========
UPDATE courses SET category = '세금' WHERE category = '세금_연말정산';
UPDATE courses SET category = '소비' WHERE category = '소비_저축';

-- ========== 4. onboarding_progress / diagnostic_quizzes 동기화 ==========
UPDATE onboarding_progress SET selected_category = '세금' WHERE selected_category = '세금_연말정산';
UPDATE onboarding_progress SET selected_category = '소비' WHERE selected_category = '소비_저축';
UPDATE diagnostic_quizzes SET category = '세금' WHERE category = '세금_연말정산';
UPDATE diagnostic_quizzes SET category = '소비' WHERE category = '소비_저축';

-- ========== 5. 예적금 3레벨 추가 ==========
INSERT INTO courses (category, level, title, description) VALUES
  ('예적금', '기초', '예적금 기초 과정', '예금과 적금의 차이부터 금리 구조까지, 안전 자산의 기본기'),
  ('예적금', '심화', '예적금 심화 과정', '우대금리·특판·세제혜택 상품까지 알뜰하게 굴리는 법'),
  ('예적금', '마스터', '예적금 마스터 과정', '예적금 포트폴리오 설계와 목돈 마련 고급 전략')
ON CONFLICT (category, level) DO NOTHING;

-- ========== 6. courses.course_category_id FK ==========
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS course_category_id UUID REFERENCES course_categories(id);

UPDATE courses c SET course_category_id = cc.id
FROM course_categories cc
WHERE c.category = cc.name AND c.course_category_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_courses_course_category_id
  ON courses(course_category_id);

COMMIT;
