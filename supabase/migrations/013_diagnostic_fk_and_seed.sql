-- ============================================================
-- 진단퀴즈 스키마 정리 + 예적금 10문제 시드
-- 날짜: 2026-04-18
-- 변경사항:
--   1. diagnostic_quizzes.course_category_id FK 추가 + 백필
--   2. detailed_explanation 컬럼 추가
--   3. category TEXT 컬럼 삭제
--   4. 예적금 진단퀴즈 10문제 시드
-- ============================================================

BEGIN;

-- ========== 1. course_category_id FK 추가 ==========
ALTER TABLE diagnostic_quizzes
  ADD COLUMN IF NOT EXISTS course_category_id UUID REFERENCES course_categories(id);

UPDATE diagnostic_quizzes dq
SET course_category_id = cc.id
FROM course_categories cc
WHERE dq.category = cc.name
  AND dq.course_category_id IS NULL;

-- ========== 2. detailed_explanation 추가 ==========
ALTER TABLE diagnostic_quizzes
  ADD COLUMN IF NOT EXISTS detailed_explanation TEXT;

-- ========== 3. category TEXT 제거 (FK로 통일) ==========
DROP INDEX IF EXISTS idx_diagnostic_quizzes_category;
ALTER TABLE diagnostic_quizzes DROP COLUMN IF EXISTS category;

-- FK NOT NULL 전환 + 인덱스
ALTER TABLE diagnostic_quizzes
  ALTER COLUMN course_category_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_diagnostic_quizzes_course_category_id
  ON diagnostic_quizzes(course_category_id);

-- ========== 4. 예적금 진단퀴즈 10문제 시드 ==========
-- difficulty_weight 분포: 1×2, 2×3, 3×3, 4×2 (avg 2.5)

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '예금과 적금 중 ''매달 일정액을 나누어 납입''하는 상품은?',
  '["예금","적금","CMA","MMF"]'::jsonb,
  2, 1, '적금=매달 납입',
  '예금은 목돈을 한 번에 맡기는 상품이고, 적금은 매달 일정 금액을 나누어 납입합니다. CMA·MMF는 증권사 단기 자금 관리 상품입니다.',
  '매달 나눠서 내는 상품'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '은행이 파산하면 예금자 보호법에 따라 1인당 한 금융회사에서 원금+이자 합쳐 얼마까지 보호받을까요?',
  '["1천만원","3천만원","5천만원","1억원"]'::jsonb,
  3, 1, '5천만원 한도',
  '예금자보호법상 1인당 한 금융회사 기준 원금과 이자 합계 5천만원까지 보호됩니다. 여러 은행에 분산하면 각각 한도가 적용됩니다.',
  '금융회사별 한도'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '''단리''와 ''복리''를 비교한 설명으로 맞는 것은?',
  '["단리는 원금에만 이자, 복리는 이자에도 이자가 붙는다","단리가 항상 유리하다","둘 다 동일하게 계산된다","복리는 세금이 없다"]'::jsonb,
  1, 2, '복리=이자에도 이자',
  '단리는 원금에만 이자가 붙고, 복리는 발생한 이자가 원금에 합산되어 다시 이자를 발생시킵니다. 장기로 갈수록 복리의 효과가 기하급수적으로 커집니다.',
  '눈덩이 효과'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '자유적금과 정기적금의 차이로 맞는 것은?',
  '["자유적금은 납입일·금액을 자유롭게 결정, 정기적금은 매달 정해진 금액 납입","자유적금이 더 비싸다","정기적금은 중도 해지가 불가능","차이 없음"]'::jsonb,
  1, 2, '납입 자유도 차이',
  '자유적금은 납입 날짜와 금액을 본인이 자유롭게 정할 수 있고, 정기적금은 매달 약정한 날짜에 약정 금액을 납입해야 합니다. 우대금리 조건은 자유적금이 더 까다로운 편.',
  '자유 vs 정기'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '우대금리(최고금리)를 받기 위한 전형적인 조건이 아닌 것은?',
  '["급여이체 실적","카드 사용 실적","해당 은행 앱 설치/가입","부양가족 수 증명"]'::jsonb,
  4, 2, '부양가족은 해당 없음',
  '우대금리는 은행과의 거래 실적(급여이체·카드·자동이체·앱 가입 등) 기반입니다. 부양가족 수는 일반적으로 조건에 포함되지 않습니다.',
  '거래 실적 기반'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '금리가 ''연 4%''인 1년 만기 적금을 매달 납입할 때 실제 수령 이자 비율에 대한 설명으로 맞는 것은?',
  '["총 납입금의 4%를 그대로 받는다","매달 납입이라 평균적으로 연 금리의 약 절반 수준의 실질 수익률","4%는 세후라 원금의 4%를 정확히 받는다","월 4% 이자가 붙는다"]'::jsonb,
  2, 3, '평균 절반 수준',
  '적금은 매달 납입액에 대해 잔여 개월수만큼만 이자가 붙으므로, 1년 만기 시 전체 납입 원금 대비 실질 수익률은 명목 금리의 약 절반 수준(4%면 약 2%대)에 가깝습니다.',
  '기간별 이자 부과'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '특판 예적금의 일반적 특징으로 옳은 것은?',
  '["한시적·한정판매로 금리가 높지만 가입 한도/기간 제한이 있다","금리가 항상 낮다","예금자 보호가 안 된다","고령자만 가입 가능"]'::jsonb,
  1, 3, '한정·고금리',
  '특판은 은행이 한시적으로 높은 금리를 내세우는 상품으로, 선착순·금액 한도·가입 자격 제한이 붙는 경우가 많습니다. 예금자 보호는 동일하게 적용됩니다.',
  '특별 판매'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '이자소득 일반과세 기준(15.4%)을 반영해 세전 연 5% 예금의 세후 실질 수익률은?',
  '["약 3.85%","약 4.23%","약 4.50%","약 4.85%"]'::jsonb,
  2, 3, '5% × 0.846 ≈ 4.23%',
  '이자소득에는 소득세 14% + 지방소득세 1.4% = 15.4%가 원천징수됩니다. 세후 금리 = 세전 × (1 - 0.154) = 5% × 0.846 ≈ 4.23%.',
  '15.4% 차감'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, '명목금리 3%, 물가상승률 5%일 때 실질금리는?',
  '["+8%","+2%","-2%","0%"]'::jsonb,
  3, 4, '실질=명목-물가',
  '실질금리 ≈ 명목금리 - 인플레이션율. 3% - 5% = -2%. 예금에 넣어두면 구매력이 오히려 줄어듭니다.',
  '인플레이션이 더 높으면?'
FROM course_categories WHERE name = '예적금';

INSERT INTO diagnostic_quizzes (course_category_id, question, choices, correct_answer, difficulty_weight, brief_explanation, detailed_explanation, hint)
SELECT id, 'ISA(개인종합자산관리계좌) 일반형에 예금을 편입했을 때 절세 구조는?',
  '["이자 전액 비과세","3년간 발생 이자 중 200만원까지 비과세, 초과분 9.9% 분리과세","고령자만 비과세","이자에 22% 과세"]'::jsonb,
  2, 4, '200만원 비과세+9.9%',
  'ISA는 3년 의무가입 기준으로 발생한 이자·배당 수익 중 일반형 200만원(서민형 400만원)까지 비과세, 초과분은 9.9%로 분리과세되어 금융소득 종합과세 대상에서 제외됩니다.',
  '분리과세 9.9%'
FROM course_categories WHERE name = '예적금';

COMMIT;
