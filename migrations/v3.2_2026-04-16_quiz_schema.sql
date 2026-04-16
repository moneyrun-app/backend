-- ========== v3.2 퀴즈 스키마 개선 ==========
-- 1. 퀴즈 구분코드 (Q00001)
-- 2. 난이도 3단계 (초급/심화/마스터)
-- 3. 힌트 컬럼
-- 4. 집계 컬럼 (일배치: 푼사람수, 정답자수, 정답률)

-- ========== 1. 퀴즈 구분코드 ==========

-- 시퀀스 생성
CREATE SEQUENCE IF NOT EXISTS quiz_code_seq START WITH 1;

-- quiz_code 컬럼 추가
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS quiz_code TEXT UNIQUE;

-- 기존 데이터 백필 (생성순으로 Q00001, Q00002, ...)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
  FROM quizzes
)
UPDATE quizzes SET quiz_code = 'Q' || LPAD(numbered.rn::text, 5, '0')
FROM numbered WHERE quizzes.id = numbered.id AND quizzes.quiz_code IS NULL;

-- 시퀀스를 현재 최대값으로 맞춤
SELECT setval('quiz_code_seq',
  COALESCE((SELECT MAX(REPLACE(quiz_code, 'Q', '')::int) FROM quizzes WHERE quiz_code IS NOT NULL), 0)
);

-- NOT NULL + DEFAULT 설정
ALTER TABLE quizzes ALTER COLUMN quiz_code SET NOT NULL;
ALTER TABLE quizzes ALTER COLUMN quiz_code SET DEFAULT 'Q' || LPAD(nextval('quiz_code_seq')::text, 5, '0');

-- ========== 2. 난이도 3단계 변경 ==========
-- difficulty_level INT(1~5) → INT(1~3) 매핑: 1~2→1(초급), 3~4→2(심화), 5→3(마스터)

UPDATE quizzes SET difficulty_level = CASE
  WHEN difficulty_level <= 2 THEN 1
  WHEN difficulty_level <= 4 THEN 2
  ELSE 3
END
WHERE difficulty_level > 3;

-- users.quiz_level도 동일 매핑
UPDATE users SET quiz_level = CASE
  WHEN quiz_level <= 2 THEN 1
  WHEN quiz_level <= 4 THEN 2
  ELSE 3
END
WHERE quiz_level IS NOT NULL AND quiz_level > 3;

-- ========== 3. 힌트 컬럼 ==========

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS hint TEXT;

-- ========== 4. 집계 컬럼 (일배치용) ==========

ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS total_attempts INT DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS correct_count INT DEFAULT 0;
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS correct_rate NUMERIC(5,2) DEFAULT 0;

-- 초기 데이터 일괄 반영 (기존 quiz_answers 기반)
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

-- ========== 5. 일배치 함수 (정기 실행용) ==========

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

-- 일배치 호출: SELECT refresh_quiz_stats();
