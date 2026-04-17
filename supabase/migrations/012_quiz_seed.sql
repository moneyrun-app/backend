-- ============================================================
-- 퀴즈 시드 데이터: 6 카테고리 × 3 레벨 × 5 문제 = 90문제
-- 날짜: 2026-04-18
-- 구조: choices JSONB 배열(1-indexed correct_answer)
-- ============================================================

BEGIN;

-- 헬퍼: 카테고리 ID 캐싱 (간결한 참조용)
CREATE TEMP TABLE _cc AS
SELECT name, id FROM course_categories;

-- ============================================================
-- 1. 예적금
-- ============================================================

-- Level 1 (초급)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '예금과 적금의 가장 큰 차이는 무엇인가요?',
  '["예금은 이자가 없고 적금은 이자가 있다","예금은 목돈을 한 번에 맡기고 적금은 매달 나누어 넣는다","예금은 원금 보장이 안 되고 적금은 보장된다","예금은 은행에서만, 적금은 증권사에서만 가능하다"]'::jsonb,
  2, '예금=목돈 일괄, 적금=매달 납입',
  '예금은 한 번에 큰 돈을 맡겨두는 상품이고, 적금은 매달 일정 금액을 나누어 저축하는 상품입니다. 둘 다 은행에서 취급하며 예금자 보호가 적용됩니다.',
  '목돈이 있는지 없는지 생각해 보세요', 1, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '단리와 복리의 차이는?',
  '["단리는 원금에만, 복리는 원금+이자에도 이자를 붙인다","단리는 세금이 없고 복리는 세금이 있다","단리는 단기, 복리는 장기 상품에만 적용된다","차이 없이 용어만 다르다"]'::jsonb,
  1, '복리는 이자에도 이자가 붙어요',
  '단리는 원금에 대해서만 이자를 계산하고, 복리는 이자가 원금에 합산되어 다시 이자를 발생시킵니다. 장기일수록 복리의 효과가 커집니다.',
  '눈덩이 효과를 떠올려 보세요', 1, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '예금자 보호법에 따른 1인당 보호 한도는?',
  '["1천만원","3천만원","5천만원","1억원"]'::jsonb,
  3, '원금+이자 합쳐 5천만원',
  '예금자보호법은 은행이 파산해도 1인당 한 금융회사에서 원금과 이자를 합쳐 최대 5천만원까지 보호합니다.',
  '금융회사별로 한도가 정해져 있어요', 1, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '자유적금의 특징은?',
  '["매달 정해진 날짜에만 납입 가능","납입일/금액을 자유롭게 설정 가능","만기 전 해지 시 원금이 손실됨","이자율이 정기예금보다 항상 높다"]'::jsonb,
  2, '납입 시기·금액이 자유',
  '자유적금은 정해진 날짜나 금액 없이 본인이 원할 때 원하는 금액을 납입할 수 있는 적금입니다. 정기적금은 매달 정해진 금액을 납입해야 합니다.',
  '이름 그대로 자유로움', 1, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '금리가 ''연 3%''로 표시된 적금의 의미는?',
  '["매달 3%의 이자를 준다","납입 전체에 대해 1년 기준 3%의 이자를 계산한다","1년 후 납입한 원금의 3%를 이자로 받는다","3%는 세전이므로 실제로는 더 낮다"]'::jsonb,
  3, '연 금리는 1년 단위 이자율',
  '연 금리는 1년을 기준으로 한 이자율입니다. 적금의 경우 매달 납입액에 대해 잔여 개월수만큼 이자가 붙으므로 실제 수령액은 단순히 총액×금리가 아닙니다. 1년 만기 시 평균적으로 연 금리의 약 절반 정도 수익률이 됩니다.',
  '기간 단위를 확인하세요', 1, id
FROM _cc WHERE name = '예적금';

-- Level 2 (심화)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '우대금리를 받기 위한 일반적인 조건이 아닌 것은?',
  '["급여이체 실적","신용카드 사용 실적","해당 은행 앱 가입","가족 구성원 수 증명"]'::jsonb,
  4, '가족 수는 보통 조건이 아님',
  '우대금리는 주로 급여이체, 자동이체, 카드 사용, 앱 가입 등 은행과의 거래 실적을 기준으로 산정됩니다. 가족 수는 일반적으로 우대금리 조건에 해당하지 않습니다.',
  '은행과의 거래 실적 기반', 2, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '특판 상품의 일반적 특징은?',
  '["금리가 일반 상품보다 낮다","가입 기간/금액 한도가 제한된다","중도 해지 시 벌금이 없다","예금자 보호가 안 된다"]'::jsonb,
  2, '한정판매가 특징',
  '특판은 은행이 한시적으로 고금리를 제공하는 상품으로, 가입 기간·금액·고객 조건 등이 제한됩니다. 선착순인 경우가 많습니다.',
  '''특별 판매''를 떠올려 보세요', 2, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '비과세 종합저축의 대상이 아닌 사람은?',
  '["만 65세 이상","장애인","20대 직장인","기초생활수급자"]'::jsonb,
  3, '고령·취약계층 대상',
  '비과세 종합저축은 만 65세 이상, 장애인, 기초생활수급자, 유공자 등 특정 대상자가 5천만원 한도 내에서 이자소득세(15.4%)를 면제받는 제도입니다.',
  '일반 직장인은 대상 아님', 2, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '적금 풍차돌리기 전략의 목적은?',
  '["이자율을 은행별로 평균화","매달 만기가 돌아오게 하여 유동성 확보","세금을 분산시켜 절세","복리 효과 극대화"]'::jsonb,
  2, '매달 만기 현금흐름',
  '풍차돌리기는 매달 새로운 적금에 가입하여 12개월 후부터 매달 만기 현금을 받는 전략입니다. 유동성 관리와 저축 습관 형성에 유리합니다.',
  '매달 만기되는 구조', 2, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'CMA 통장의 특징으로 옳은 것은?',
  '["은행이 취급하며 예금자 보호가 된다","증권사가 취급하며 대부분 예금자 보호가 안 된다","이자가 없고 환급만 가능하다","가입에 나이 제한이 있다"]'::jsonb,
  2, 'CMA는 증권사 상품',
  'CMA(Cash Management Account)는 증권사가 운영하는 단기 자금 관리 계좌로, RP·MMF 등에 자동 투자됩니다. 종금형 CMA를 제외하면 예금자 보호 대상이 아닙니다.',
  '증권사 상품인지 확인', 2, id
FROM _cc WHERE name = '예적금';

-- Level 3 (마스터)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '세전 금리 연 4%인 예금의 세후 실수령 금리는? (일반 과세 15.4%)',
  '["약 3.08%","약 3.38%","약 3.68%","약 3.84%"]'::jsonb,
  2, '4% × (1 - 0.154) ≈ 3.384%',
  '이자소득세 15.4%(소득세 14% + 지방세 1.4%)가 원천징수되므로 세후 금리는 세전 금리 × (1 - 0.154)로 계산합니다. 4% × 0.846 ≈ 3.384%.',
  '15.4%를 차감하면?', 3, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '명목금리 3%, 물가상승률 4%일 때 실질금리는?',
  '["+7%","+1%","-1%","0%"]'::jsonb,
  3, '실질 = 명목 - 물가상승',
  '실질금리 ≈ 명목금리 - 인플레이션율. 3% - 4% = -1%로, 예금에 넣어두면 구매력이 오히려 1% 줄어듭니다.',
  '인플레이션이 더 높으면?', 3, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '예금 담보대출의 특징은?',
  '["예금을 해지하지 않고도 예금을 담보로 대출","대출 시 예금이 자동 해지됨","대출 금리가 예금 금리보다 항상 낮다","신용점수가 필요 없다"]'::jsonb,
  1, '예금 유지 + 대출',
  '예금 담보대출은 만기 전 해지로 이자 손실을 피하면서 필요 자금을 조달하는 상품입니다. 대출 금리는 보통 예금 금리 + 1.0~1.5%p 수준입니다.',
  '해지 vs 담보의 차이', 3, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'ISA 계좌에 예금을 편입할 때 장점은?',
  '["이자에 세금이 전혀 없다","일정 금액까지 비과세, 초과분은 9.9% 분리과세","모든 금액이 비과세","예금자 보호 한도가 2배가 된다"]'::jsonb,
  2, '200만원 비과세 + 초과 9.9%',
  'ISA는 일반형 기준 3년간 발생한 이자·배당 수익 중 200만원(서민형 400만원)까지 비과세, 초과분은 9.9% 분리과세로 종합과세 대상에서 제외됩니다.',
  '절세와 분리과세', 3, id
FROM _cc WHERE name = '예적금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '금리 스프레드(예대마진)가 커진다는 것의 의미는?',
  '["은행의 예금 고객이 늘어난다","은행이 빌려주는 이자와 받는 이자 차이가 커진다","예금 금리가 대출 금리보다 높아진다","정부가 금리를 규제한다"]'::jsonb,
  2, '대출금리 - 예금금리',
  '예대마진은 대출금리 - 예금금리로, 커질수록 은행 수익이 늘지만 소비자는 불리합니다. 금리 인상기에 확대되는 경향이 있습니다.',
  '은행의 마진 구조', 3, id
FROM _cc WHERE name = '예적금';

-- ============================================================
-- 2. 연금
-- ============================================================

-- Level 1 (초급)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '국민연금의 의무 가입 대상은?',
  '["만 18세 이상 60세 미만의 국내 거주 국민","모든 국민","사업자만 해당","공무원 제외 모든 근로자"]'::jsonb,
  1, '18세 ~ 60세 미만',
  '국민연금은 만 18세 이상 60세 미만의 국내 거주 국민이 의무 가입 대상입니다. 공무원·군인·사립학교 교직원은 별도 공적연금에 가입합니다.',
  '정년 이전 성인이 대상', 1, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '퇴직연금 DB형과 DC형의 가장 큰 차이는?',
  '["DB형은 회사가 운용, DC형은 근로자가 운용","둘 다 근로자가 운용하지만 세금이 다르다","DB형은 중소기업용, DC형은 대기업용","DC형은 회사가 폐업하면 받을 수 없다"]'::jsonb,
  1, 'DB=회사, DC=근로자',
  'DB(Defined Benefit)는 회사가 적립금을 운용하며 근로자는 확정된 퇴직금을 받습니다. DC(Defined Contribution)는 근로자가 상품을 선택·운용하며 수익률에 따라 수령액이 달라집니다.',
  '운용 주체가 누구인가', 1, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'IRP(개인형 퇴직연금) 계좌의 주요 목적은?',
  '["주택 청약 자금 적립","은퇴 자금 마련 + 세액공제","자녀 학자금 마련","단기 여행 자금 저축"]'::jsonb,
  2, '은퇴자금 + 세액공제',
  'IRP는 개인이 스스로 은퇴자금을 적립하는 계좌로, 연 900만원(연금저축 합산) 한도까지 세액공제를 받을 수 있습니다.',
  '연금+세제혜택', 1, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '연금저축의 연간 세액공제 한도는?',
  '["300만원","400만원","600만원","1,000만원"]'::jsonb,
  3, '연금저축 단독 600만원',
  '연금저축 단독 최대 600만원까지 공제 가능하며, IRP와 합산하면 900만원까지 공제 대상이 됩니다. 공제율은 총급여에 따라 13.2% 또는 16.5%.',
  '연금저축은 600만원', 1, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '국민연금 노령연금의 일반적 수급 개시 연령은?',
  '["만 55세","만 60세","출생연도에 따라 만 62~65세","만 70세"]'::jsonb,
  3, '출생연도별 단계 상향',
  '국민연금 수급 개시 연령은 출생연도에 따라 단계적으로 상향됩니다. 1953~56년생은 61세부터, 1969년 이후 출생은 65세부터 수령합니다.',
  '세대별로 다름', 1, id
FROM _cc WHERE name = '연금';

-- Level 2 (심화)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'DC형 퇴직연금을 방치하면 어떤 문제가 생기나?',
  '["원금이 자동으로 절반으로 줄어든다","저수익의 원리금 보장 상품에 머무르며 물가상승분을 놓친다","회사가 해지한다","세금이 추가로 발생한다"]'::jsonb,
  2, '방치 = 저수익 고착',
  'DC형은 본인이 직접 운용하지 않으면 원리금 보장형(저금리 예금/보험)에 머물러 인플레이션 대비 실질 수익률이 낮아집니다. 주기적 리밸런싱이 필요합니다.',
  '운용 주체 = 본인', 2, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '연금저축+IRP 통합 연간 세액공제 한도는?',
  '["400만원","700만원","900만원","1,200만원"]'::jsonb,
  3, '합산 900만원',
  '연금저축 600만원 + IRP 300만원 조합 등 합산 최대 900만원까지 세액공제 대상입니다. 총급여 5,500만원 이하 근로자는 16.5%, 초과는 13.2% 공제율.',
  '연금저축 한도 + 추가 300만원', 2, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '연금 수령 시 연령별 연금소득세율 차이는?',
  '["연령 무관 동일","나이가 많을수록 세율이 낮아진다","나이가 적을수록 세율이 낮아진다","55세 전후만 차이가 있다"]'::jsonb,
  2, '고령 수령이 세율 낮음',
  '연금소득세는 55~69세 5.5%, 70~79세 4.4%, 80세 이상 3.3%(지방세 포함)로 연령이 올라갈수록 세율이 낮아져 늦게 수령할수록 유리합니다.',
  '오래 묵을수록 유리', 2, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '종신형 연금과 확정기간형의 차이로 맞는 것은?',
  '["종신형은 사망 시까지, 확정형은 정해진 기간만 지급","확정형이 무조건 유리","종신형은 상속 가능, 확정형은 불가","종신형은 세금이 없다"]'::jsonb,
  1, '종신 vs 기간',
  '종신형은 사망 시까지 평생 연금을 지급(장수 리스크 헤지), 확정기간형은 10~30년 등 정해진 기간만 지급합니다. 기대수명에 따라 유불리가 달라집니다.',
  '지급 기간 차이', 2, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '국민연금 추후납부(추납) 제도의 효과는?',
  '["과거 미납 기간을 메워 가입기간을 늘려 수령액 증가","연금을 즉시 받는다","세금 환급을 받는다","미납 시 자동으로 적용된다"]'::jsonb,
  1, '가입기간 늘려 연금↑',
  '추납은 실직·군복무 등으로 납부 예외였던 기간의 보험료를 나중에 납부해 가입기간을 늘리는 제도로, 노령연금 수령액이 증가합니다.',
  '못 낸 기간을 메운다', 2, id
FROM _cc WHERE name = '연금';

-- Level 3 (마스터)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '은퇴 후 연금 포트폴리오의 ''인출 순서'' 전략으로 일반적으로 권장되는 것은?',
  '["과세 계좌 → 세제혜택 계좌 순으로 인출","세제혜택 계좌부터 먼저 소진","모든 계좌에서 동일 비율 인출","위험자산만 먼저 매각"]'::jsonb,
  1, '과세 먼저, 세제혜택 나중',
  '과세 자산(일반 계좌)을 먼저 소진하고 IRP·연금저축 등 세제혜택 계좌는 나중에 인출하는 것이 세금 이연 효과를 극대화합니다.',
  '세금 이연 효과', 3, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'TDF(Target Date Fund)의 ''글라이드패스''란?',
  '["시간에 따라 자동으로 주식 비중을 낮추고 채권 비중을 높이는 자산배분 경로","수수료를 점차 낮추는 구조","은퇴 시점에 전액 현금화하는 전략","환헷지 비율 조정 방식"]'::jsonb,
  1, '나이 들수록 안전자산↑',
  'TDF는 은퇴 목표시점(Target Date)이 가까워질수록 주식 비중을 낮추고 채권 비중을 높이는 글라이드패스를 따라 자동 리밸런싱하는 연금형 펀드입니다.',
  '자산비중의 시간 경로', 3, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '사적연금 수령액이 연 1,500만원을 초과하면 어떻게 과세되나?',
  '["무조건 분리과세 5.5%","종합과세 또는 16.5% 분리과세 중 선택","전액 면세","지방세만 부과"]'::jsonb,
  2, '종합 vs 분리 선택',
  '2024년부터 사적연금 연 수령액이 1,500만원을 초과하면 종합과세 또는 16.5% 분리과세 중 유리한 방식을 선택할 수 있습니다(기존은 1,200만원 기준).',
  '한도 초과 시 선택 가능', 3, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '4% 룰(Bengen''s rule)이란?',
  '["매년 포트폴리오 초기 자산의 4%씩 인출하면 30년간 고갈되지 않는다는 경험칙","연 4% 이자를 받는 채권에 투자하는 전략","주식 수익률의 4%만 소비하는 규칙","인플레이션이 4%를 넘으면 투자를 멈추는 규칙"]'::jsonb,
  1, '초기 자산 4% 인출',
  '은퇴 첫해 포트폴리오의 4%를 인출하고 이후 인플레이션만큼 증액하면 30년간 자금이 고갈되지 않는다는 경험칙으로, 주식 50~75% 포트폴리오 기반 백테스트 결과입니다.',
  '안전 인출률의 대표값', 3, id
FROM _cc WHERE name = '연금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '연금저축을 55세 이전에 중도 해지할 때 세무상 불이익은?',
  '["세액공제 받았던 금액과 운용수익 전체에 16.5% 기타소득세 부과","5.5% 연금소득세만 부과","아무런 불이익 없음","종합소득세에 합산되어 최고 세율 적용"]'::jsonb,
  1, '16.5% 기타소득세',
  '연금 외 수령(중도해지 포함) 시 세액공제 받은 원금과 운용수익에 대해 16.5%의 기타소득세가 원천징수됩니다. 연금으로 수령해야 낮은 연금소득세(5.5~3.3%)가 적용됩니다.',
  '연금 아닌 수령은 불이익', 3, id
FROM _cc WHERE name = '연금';

-- ============================================================
-- 3. 주식
-- ============================================================

-- Level 1 (초급)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주식과 채권의 가장 큰 차이는?',
  '["주식은 지분(소유권), 채권은 빚(채권자)","주식은 원금 보장, 채권은 보장 안 됨","주식은 해외, 채권은 국내만 가능","차이 없음"]'::jsonb,
  1, '지분 vs 채권',
  '주식은 회사의 지분을 소유하는 것이고, 채권은 회사나 정부에 돈을 빌려주는 것입니다. 주식은 배당과 시세차익, 채권은 이자와 원금 상환을 기대합니다.',
  '소유인가 빚인가', 1, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '코스피와 코스닥의 차이는?',
  '["상장 요건이 다르며, 코스닥은 중소·벤처 기업이 많다","코스피는 한국, 코스닥은 미국 시장","코스닥이 더 크다","차이 없음"]'::jsonb,
  1, '대형 vs 중소벤처',
  '코스피는 대기업 중심의 유가증권 시장, 코스닥은 기술·벤처 기업 중심의 2부 시장입니다. 상장 요건·시가총액 규모가 다릅니다.',
  '대형주 시장은 코스피', 1, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주식 배당금이란?',
  '["주식을 팔 때 받는 차익","회사 이익 일부를 주주에게 분배하는 돈","은행 이자","세금 환급금"]'::jsonb,
  2, '이익을 주주에게 분배',
  '배당금은 회사가 번 이익의 일부를 주주에게 현금이나 주식으로 분배하는 것입니다. 배당기준일 현재 주주 명부에 등재되어야 받을 수 있습니다.',
  '주주에게 나눠주는 돈', 1, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '국내 주식의 정규 장중 거래 시간은?',
  '["09:00 ~ 15:30","08:00 ~ 18:00","10:00 ~ 14:00","24시간"]'::jsonb,
  1, '평일 9시~3시30분',
  '국내 주식 정규 거래는 평일 09:00~15:30이며, 이전/이후에 시간외 단일가·대량매매 등이 진행됩니다. 주말·공휴일은 휴장.',
  '9시 개장, 3시반 마감', 1, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'ETF(상장지수펀드)의 특징은?',
  '["지수를 추종하며 주식처럼 거래된다","만기가 정해진 채권형 상품이다","예금자 보호를 받는다","증권사에서만 매수할 수 있다"]'::jsonb,
  1, '지수추종+주식처럼 거래',
  'ETF는 KOSPI200 등 특정 지수를 추종하도록 구성된 펀드로, 주식처럼 실시간 매매가 가능합니다. 분산투자 효과와 낮은 수수료가 장점.',
  '펀드지만 주식처럼', 1, id
FROM _cc WHERE name = '주식';

-- Level 2 (심화)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'PER(주가수익비율)이 의미하는 것은?',
  '["주가 ÷ 주당순이익(EPS), 순이익 대비 주가 수준","주가 ÷ 매출","주가 ÷ 배당","주가의 변동폭"]'::jsonb,
  1, '주가/EPS',
  'PER은 주가를 주당순이익(EPS)으로 나눈 값으로, 회사가 버는 이익에 비해 주가가 얼마나 비싼지를 보여주는 대표적 밸류에이션 지표입니다.',
  '이익 대비 주가', 2, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '포트폴리오 리밸런싱(rebalancing)이란?',
  '["자산 비중이 목표에서 벗어났을 때 원래 비중으로 조정하는 것","손실난 종목을 모두 매도","수익난 종목에 몰빵","해외주식으로 전부 교체"]'::jsonb,
  1, '목표 비중 복원',
  '리밸런싱은 시장 변동으로 자산비중이 달라졌을 때 다시 목표 비중으로 맞추는 작업입니다. 주기적 또는 이탈 허용치(예: ±5%) 기준으로 실행합니다.',
  '비중 복원 작업', 2, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '공매도(short selling)의 기본 원리는?',
  '["주식을 빌려서 팔고 나중에 싸게 되사서 갚아 차익 획득","자기 주식을 평소보다 싸게 파는 것","배당을 포기하는 대신 주식을 장기 보유","외국인만 할 수 있는 거래"]'::jsonb,
  1, '빌려팔고 싸게 되사기',
  '공매도는 주식을 빌려서 먼저 매도한 뒤, 가격이 하락하면 싸게 매수해 갚는 방식으로 하락장에서 수익을 내는 거래 기법입니다.',
  '하락 베팅', 2, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '옵션 상품에서 ''콜옵션''의 의미는?',
  '["정해진 가격에 살 수 있는 권리","정해진 가격에 팔 수 있는 권리","배당받을 권리","의결권"]'::jsonb,
  1, '살 권리=콜, 팔 권리=풋',
  '콜옵션은 미래 특정 시점에 정해진 가격(행사가)으로 기초자산을 ''살 수 있는 권리''이고, 풋옵션은 ''팔 수 있는 권리''입니다.',
  'Call=Buy, Put=Sell', 2, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '분산투자의 가장 큰 효과는?',
  '["개별 종목 위험(비체계적 위험) 감소","시장 전체 위험을 없앰","수익률이 항상 2배","세금 면제"]'::jsonb,
  1, '비체계적 위험 감소',
  '분산투자는 서로 다른 자산/종목을 조합해 개별 기업·산업 고유 위험(비체계적 위험)을 줄입니다. 시장 전체 위험(체계적 위험)은 분산으로 제거되지 않습니다.',
  '개별 종목 리스크 완화', 2, id
FROM _cc WHERE name = '주식';

-- Level 3 (마스터)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'ROE(자기자본이익률)가 높다는 것의 의미는?',
  '["자기자본 대비 순이익이 높아 경영 효율이 좋다","부채가 많다","배당성향이 높다","주가가 저평가다"]'::jsonb,
  1, '순이익/자기자본',
  'ROE = 순이익 ÷ 자기자본. 주주가 맡긴 자본으로 얼마나 효율적으로 이익을 냈는지 보여주는 지표로, 지속적으로 15% 이상이면 우량 기업으로 평가.',
  '자본 효율의 대표값', 3, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'EV/EBITDA 지표의 용도는?',
  '["부채 포함 기업가치를 현금흐름 대비로 평가해 PER의 한계를 보완","부채를 측정","주가 변동성을 측정","배당률을 계산"]'::jsonb,
  1, '부채 포함 밸류에이션',
  'EV(Enterprise Value)는 시가총액 + 순부채로, EBITDA로 나누면 감가상각·자본구조 영향을 배제한 기업가치 비교가 가능해 업종·국가 간 비교에 유리합니다.',
  'PER 보완지표', 3, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'DCF(현금흐름할인법)의 핵심 개념은?',
  '["미래 현금흐름을 할인율로 현재가치로 환산해 기업가치를 평가","과거 매출을 평균내는 방법","시장 평균 PER을 곱하는 방법","배당만 고려하는 방법"]'::jsonb,
  1, '미래 현금흐름 → 현재가치',
  'DCF는 미래 예상 자유현금흐름(FCF)을 가중평균자본비용(WACC)으로 할인해 기업의 내재가치를 산출하는 절대가치 평가법입니다.',
  '시간가치 × 미래 현금', 3, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '샤프지수(Sharpe Ratio)가 높을수록 의미하는 것은?',
  '["감수한 변동성 대비 초과수익이 크다","수익률이 무조건 높다","수수료가 낮다","거래량이 많다"]'::jsonb,
  1, '위험 대비 초과수익',
  '샤프지수 = (포트폴리오 수익률 - 무위험 수익률) ÷ 표준편차. 1 이상이면 양호, 2 이상이면 우수한 위험조정수익률로 평가됩니다.',
  '리스크 조정 수익률', 3, id
FROM _cc WHERE name = '주식';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주식 포트폴리오에서 ''헤징(hedging)''을 구현하는 대표 방법은?',
  '["풋옵션 매수, 인버스 ETF 편입 등 하락 보호 수단 추가","레버리지 ETF를 사서 수익 극대화","배당주 비중 축소","전액 현금화"]'::jsonb,
  1, '하락 방어 포지션',
  '헤징은 보유 포지션의 반대 방향 포지션을 추가해 손실을 제한하는 전략입니다. 풋옵션, 인버스 ETF, 선물 매도 등이 대표적입니다.',
  '반대방향 포지션', 3, id
FROM _cc WHERE name = '주식';

-- ============================================================
-- 4. 부동산
-- ============================================================

-- Level 1 (초급)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '전세와 월세의 가장 큰 차이는?',
  '["전세는 보증금만 맡기고 월세는 매달 임차료를 낸다","전세는 집주인이 세금을 내고 월세는 안 낸다","전세는 단기, 월세는 장기 계약","차이 없음"]'::jsonb,
  1, '보증금 vs 월 임차료',
  '전세는 큰 보증금을 집주인에게 맡기고 만기 후 돌려받는 임대 방식, 월세는 보증금을 소액 두고 매달 임차료를 지불하는 방식입니다.',
  '목돈 vs 월 지불', 1, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '등기부등본에서 확인해야 할 가장 기본 정보는?',
  '["표제부(물건 정보), 갑구(소유권), 을구(권리관계/근저당)","소유자 이름만","세금 정보만","건물 모양"]'::jsonb,
  1, '표제/갑구/을구',
  '등기부등본은 표제부(물건 표시), 갑구(소유권 관련), 을구(저당권·임차권 등 소유권 외 권리)로 구성되며, 계약 전 반드시 확인해야 할 필수 서류입니다.',
  '3구조 확인', 1, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주택청약종합저축의 특징은?',
  '["국민/민영 아파트 청약이 모두 가능한 범용 저축","분양가를 대신 납부","은행별로 상품이 완전 다름","외국인 전용"]'::jsonb,
  1, '국민+민영 범용',
  '주택청약종합저축은 2009년 도입된 통합형 상품으로, 국민주택과 민영주택 청약에 모두 사용할 수 있어 가장 널리 쓰입니다.',
  '범용 청약 상품', 1, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '전세보증금 반환보증의 주요 목적은?',
  '["만기 시 보증금을 집주인이 돌려주지 못할 경우 보증기관이 대신 지급","월세를 할인","세금을 돌려받음","대출 없이 전세 계약"]'::jsonb,
  1, '보증금 안전장치',
  '집주인의 보증금 미반환 리스크를 HUG/HF/SGI 등 보증기관이 대신 보장해 주는 상품으로, 깡통전세·역전세 리스크 대비에 필수.',
  '미반환 리스크 보호', 1, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주택 매매 중개수수료의 법정 상한은?',
  '["거래가액에 따라 정해진 상한 요율이 있다","무조건 1%","협의만으로 결정","상한 없음"]'::jsonb,
  1, '거래가액 구간별 상한',
  '공인중개사법에 따라 매매/임대 모두 거래가 구간별로 상한 요율이 정해져 있으며(매매 최대 0.7% 등), 지자체 조례로 세분화됩니다.',
  '가액 구간별 차등', 1, id
FROM _cc WHERE name = '부동산';

-- Level 2 (심화)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'LTV, DTI, DSR의 의미를 바르게 짝지은 것은?',
  '["LTV=담보인정비율, DTI=총부채상환비율, DSR=총부채원리금상환비율","LTV=대출기간, DTI=이자율, DSR=수수료","모두 세율 지표","모두 임차 지표"]'::jsonb,
  1, '담보·총부채·전체 원리금',
  'LTV는 담보가액 대비 대출 한도, DTI는 연소득 대비 주담대 원리금, DSR은 연소득 대비 ''모든 대출'' 원리금 비율로 대출 규제의 3대 지표입니다.',
  '규제 3대 지표', 2, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주택담보대출 원리금균등상환 방식의 특징은?',
  '["매달 원리금 총액이 동일(초기엔 이자 비중↑)","매달 원금만 상환","이자가 없다","만기에만 한꺼번에 갚는다"]'::jsonb,
  1, '매달 동일 원리금',
  '원리금균등은 매월 상환액이 동일해 계획이 쉬우나 초기 이자 비중이 크고 총이자가 많습니다. 원금균등은 매월 원금이 고정돼 이자 총액은 적지만 초기 부담이 큽니다.',
  '매달 총액 동일', 2, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주택 취득세율의 일반적인 구조는?',
  '["취득가액과 다주택 여부에 따라 1.1%~12% 차등 부과","모든 거래 3% 단일","매도자가 부담","면제"]'::jsonb,
  1, '가액·주택수 차등',
  '취득세는 주택 가격, 전용면적, 소유 주택 수 등에 따라 1.1~3.5%(1주택), 8~12%(다주택/조정지역) 등으로 차등 부과됩니다.',
  '주택수와 가격 기준', 2, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '재건축과 재개발의 차이는?',
  '["재건축=기존 건물 교체(기반시설 양호), 재개발=기반시설 정비 포함","재건축이 항상 수익률이 높다","재개발은 단독주택만 가능","차이 없음"]'::jsonb,
  1, '건물만 vs 기반시설 포함',
  '재건축은 주로 아파트 등 건물을 새로 짓는 사업, 재개발은 도로·공원 등 기반시설까지 정비하는 사업입니다. 조합원 자격과 세제도 상이.',
  '기반시설 포함 여부', 2, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '전세가율이 80%를 넘는 지역에서 주의할 점은?',
  '["깡통전세·역전세 리스크가 커져 보증보험 가입이 중요","무조건 매수에 유리","절세 혜택이 있다","공시지가가 오른다"]'::jsonb,
  1, '깡통전세 위험',
  '전세가율 = 전세가 ÷ 매매가. 80% 이상이면 매매가가 조금만 내려도 보증금 미반환 위험이 커지므로 보증보험·임차권 등기 등 안전장치가 필요합니다.',
  '보증금 리스크', 2, id
FROM _cc WHERE name = '부동산';

-- Level 3 (마스터)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '1세대 1주택 양도소득세 비과세 기본 요건은?',
  '["2년 이상 보유(조정지역은 2년 이상 거주 포함), 12억 이하","1년 보유만 하면 됨","주택 수와 무관","가액 무관"]'::jsonb,
  1, '2년 보유/거주 + 12억',
  '1세대 1주택 비과세는 2년 이상 보유(조정대상지역은 2년 거주까지), 양도가액 12억 이하 요건을 충족해야 하며 12억 초과분은 과세됩니다.',
  '보유·거주·가액', 3, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '종합부동산세(종부세)의 과세 구조는?',
  '["공시가격 합계가 일정 기준 초과 시 누진 세율 부과","모든 주택 소유자에게 동일 부과","취득 시 1회만 부과","양도 시 부과"]'::jsonb,
  1, '공시가격 누진',
  '종부세는 1인 기준 주택 공시가격 합계가 일정 기준(1세대1주택 12억, 그 외 9억) 초과 시 누진세율이 적용되는 보유세입니다.',
  '보유세 중 누진형', 3, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '주택임대사업자 등록 시 대표적 세제혜택은?',
  '["재산세 감면, 종부세 합산배제 등(조건 충족 시)","양도세 면제(예외 없이)","취득세 면제(항상)","소득세 없음"]'::jsonb,
  1, '조건부 혜택',
  '임대기간·임대료 증액 제한 등 요건 충족 시 재산세 감면·종부세 합산배제·장기보유특별공제 등이 주어지나 2020년 이후 대폭 축소되어 조건 확인이 필수입니다.',
  '조건 충족 시 한정', 3, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '상가 투자에서 ''순수익률(Net yield)'' 계산은?',
  '["(연 임대료 - 제비용) ÷ 총투자금 × 100","월 임대료만 ÷ 매매가","분양가 ÷ 면적","전세가율과 동일"]'::jsonb,
  1, '순임대료/총투자',
  '순수익률 = (연 임대료 - 관리비·재산세·공실비용) ÷ 총 투자금. 총 투자금에는 매입가, 취득세, 리모델링비 등이 포함됩니다.',
  '수수료 차감 후', 3, id
FROM _cc WHERE name = '부동산';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'REITs(리츠) 투자의 특징은?',
  '["부동산 간접투자이며 주식처럼 거래되고 배당성향이 높다","아파트를 직접 매수","은행 예금과 동일","원금 보장 상품"]'::jsonb,
  1, '상장 부동산 펀드',
  'REITs는 부동산에 투자하고 수익의 대부분(90% 이상)을 배당하는 상장 부동산펀드입니다. 소액으로 부동산 분산투자와 주기적 배당이 가능하나 주식처럼 가격 변동성이 있습니다.',
  '상장+배당', 3, id
FROM _cc WHERE name = '부동산';

-- ============================================================
-- 5. 세금
-- ============================================================

-- Level 1 (초급)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '근로소득세의 기본 구조는?',
  '["총급여에서 공제를 빼고 남은 과세표준에 누진세율 적용","월급의 10% 고정","매년 환급","소득과 무관하게 동일"]'::jsonb,
  1, '누진세율 적용',
  '총급여 - 근로소득공제 - 인적·특별공제 = 과세표준에 6~45% 누진세율을 적용해 산출세액을 계산합니다. 여기서 세액공제를 빼면 결정세액.',
  '과세표준에 누진', 1, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '연말정산이란?',
  '["매달 간이세액으로 낸 세금을 연간 실제 세액과 비교해 정산하는 절차","연말에 받는 보너스","세금 자동 삭감","모든 근로자에게 환급"]'::jsonb,
  1, '원천징수 사후정산',
  '매월 원천징수된 세금과 연간 실제 결정세액을 맞춰, 더 낸 경우 환급, 덜 낸 경우 추가 납부하는 사후정산 절차입니다.',
  '사후 정산', 1, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '소득공제와 세액공제의 차이는?',
  '["소득공제=과세표준 감소, 세액공제=산출세액에서 직접 차감","같은 개념","소득공제는 자영업자만","세액공제는 연봉 높은 사람만"]'::jsonb,
  1, '과표감소 vs 세액 차감',
  '소득공제는 과세표준을 줄여 세율을 곱하기 전 단계에서, 세액공제는 산출된 세액에서 직접 차감합니다. 고소득자는 소득공제, 저소득자는 세액공제가 유리한 경향.',
  '적용 단계가 다름', 1, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '종합소득세의 대상 소득에 해당하지 않는 것은?',
  '["근로소득","사업소득","이자·배당소득","복권 당첨금(일부 분리과세)"]'::jsonb,
  4, '복권은 분리과세',
  '종합소득세는 이자·배당·사업·근로·연금·기타소득을 합산과세합니다. 복권·경품 등은 분리과세 대상으로 종합소득에 합산되지 않습니다.',
  '분리과세 여부', 1, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '원천징수의 의미는?',
  '["소득을 지급하는 자가 미리 세금을 떼어 납부하는 제도","자진 신고 납부","연말에만 내는 세금","면세 제도"]'::jsonb,
  1, '지급자가 미리 공제',
  '월급·이자·배당 등을 지급하는 자가 법정 세율을 적용해 세금을 먼저 공제하여 국가에 납부하는 제도입니다.',
  '지급자가 떼어감', 1, id
FROM _cc WHERE name = '세금';

-- Level 2 (심화)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '신용카드 소득공제의 기본 조건은?',
  '["총급여의 25% 초과분에 대해 일정률 공제","모든 카드 사용액 공제","한도 무제한","체크카드만 공제"]'::jsonb,
  1, '총급여 25% 초과분',
  '신용카드 사용액이 총급여의 25%를 초과한 부분부터 신용 15%, 체크·현금영수증 30%, 전통시장·대중교통 40%로 공제되며 한도(최대 300만원 등)가 있습니다.',
  '25% 초과 + 한도', 2, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '의료비 세액공제의 대상 기준은?',
  '["총급여의 3% 초과분에 대해 15% 세액공제(본인·부양가족 의료비)","모든 의료비","미용 시술 포함","공제율 100%"]'::jsonb,
  1, '총급여 3% 초과분',
  '총급여의 3%를 초과한 의료비에 대해 15% 세액공제. 본인·장애인·65세 이상 공제는 한도 없이 전액, 일반 부양가족은 연 700만원 한도.',
  '3% 초과 + 15%', 2, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '월세 세액공제의 요건은?',
  '["총급여 7천만원 이하 + 무주택 세대주/세대원 + 확정일자","무조건 적용","자가 보유자도 가능","1억 초과 소득자만"]'::jsonb,
  1, '무주택+총급여 기준',
  '총급여 7천만원 이하 무주택 근로자가 국민주택규모 이하 주택에 임차하며 확정일자를 받은 경우, 연 750만원 한도로 15~17% 세액공제.',
  '무주택+기준금액', 2, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '부양가족 인적공제 기본 요건(직계존속 기준)은?',
  '["만 60세 이상 + 연간 소득금액 100만원 이하(근로소득 500만원 이하)","소득 무관","40세 이상","동거만 하면 됨"]'::jsonb,
  1, '나이+소득 요건',
  '인적공제는 나이 요건(직계존속 60세↑, 직계비속 20세↓)과 소득 요건(연 소득금액 100만원 이하, 근로소득만 있으면 총급여 500만원 이하)을 모두 충족해야 합니다.',
  '나이 + 소득 둘 다', 2, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '기부금 세액공제의 구조는?',
  '["기부금액의 15%(1천만원 초과분 30%) 세액공제","30% 정액","종교기부는 안 됨","자영업자만 가능"]'::jsonb,
  1, '15%/30% 차등',
  '지정·법정 기부금은 기부금액의 15%(1천만원 초과분 30%) 세액공제. 종교단체·공익법인 등 인정 기관별 한도가 다릅니다.',
  '1천만원 초과 시 30%', 2, id
FROM _cc WHERE name = '세금';

-- Level 3 (마스터)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '금융소득 종합과세의 기준 금액은?',
  '["연 2,000만원 초과 시 다른 종합소득과 합산과세","연 500만원","연 1억원 초과","금액 무관 항상 합산"]'::jsonb,
  1, '2,000만원 초과',
  '이자·배당 금융소득이 연 2,000만원 이하면 15.4% 분리과세로 종료, 초과하면 2,000만원까지는 분리과세+초과분은 종합과세(6~45%)됩니다.',
  '2천만원 라인', 3, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '분리과세와 종합과세 중 유리한 것을 비교하는 기준은?',
  '["본인의 한계세율과 분리과세율 비교","항상 분리과세가 유리","항상 종합과세가 유리","금액 크기만"]'::jsonb,
  1, '한계세율 vs 분리세율',
  '내 종합소득 한계세율(최고 구간세율)이 분리과세율(예: 14%)보다 높으면 분리과세가 유리, 낮으면 종합과세가 유리합니다.',
  '본인 세율과 비교', 3, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '1세대 1주택 양도세 비과세의 보유·거주 요건은?',
  '["2년 이상 보유(조정대상지역은 2년 거주까지 필요)","5년 보유","요건 없음","10년 거주"]'::jsonb,
  1, '2년 보유+(거주)',
  '비조정지역은 2년 이상 보유만, 조정대상지역은 2년 이상 거주까지 충족해야 하며 취득 시점에 조정지역 여부가 기준입니다. 양도가 12억 이하 요건도 별도.',
  '조정지역은 거주까지', 3, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '증여세 배우자 비과세 한도는?',
  '["10년간 6억원","1억원","5천만원","20억원"]'::jsonb,
  1, '배우자 10년 6억',
  '배우자 간 증여는 10년 합산 6억원, 직계존비속 간은 5천만원(미성년자 2천만원), 기타친족은 1천만원까지 공제됩니다.',
  '배우자는 6억', 3, id
FROM _cc WHERE name = '세금';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '해외주식 양도차익의 과세 방식은?',
  '["연간 손익 통산 후 250만원 초과분에 대해 22% 분리과세","국내주식과 동일 면세","종합과세 자동 합산","일괄 15.4%"]'::jsonb,
  1, '손익통산+22%',
  '해외주식 양도차익은 다른 해외주식 손실과 통산한 뒤, 250만원 기본공제를 적용하고 초과분에 22%(지방세 포함) 분리과세됩니다. 다음 해 5월에 신고.',
  '공제+분리과세', 3, id
FROM _cc WHERE name = '세금';

-- ============================================================
-- 6. 소비
-- ============================================================

-- Level 1 (초급)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '고정비와 변동비의 구분 예시로 맞는 것은?',
  '["고정비=월세·통신비, 변동비=외식·쇼핑","고정비=외식비, 변동비=월세","고정비=세금만, 변동비=월급","구분 없음"]'::jsonb,
  1, '월세=고정, 쇼핑=변동',
  '고정비는 매달 거의 일정한 지출(월세·통신·보험료·대출이자), 변동비는 소비 습관과 상황에 따라 달라지는 지출(외식·쇼핑·여가)입니다.',
  '매달 같은가?', 1, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '50-30-20 법칙이란?',
  '["필수 50% + 선택 30% + 저축·투자 20%","수입 50% 저축","수입의 50%만 투자","세금 50%"]'::jsonb,
  1, '필수/선택/저축 비율',
  '세후 소득의 50%는 필수지출(주거·식비), 30%는 선택적 지출(여가·쇼핑), 20%는 저축·투자·부채상환에 배분하라는 기본 가계 원칙입니다.',
  '필수·선택·저축 비율', 1, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '비상금(emergency fund)으로 일반적으로 권장되는 규모는?',
  '["3~6개월 치 생활비","1개월 치","1년 치","10만원"]'::jsonb,
  1, '3~6개월 생활비',
  '실직·병환 등 갑작스런 수입 단절에 대비해 3~6개월치 필수 생활비를 즉시 인출 가능한 형태(CMA·파킹통장)로 보유하는 것이 권장됩니다.',
  '몇 달을 버틸 수 있는 돈', 1, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '소득 대비 지출 비율(지출 비율)을 낮출 때 가장 효과적인 단기 방법은?',
  '["고정비 항목의 구독·통신·보험 재검토","로또 구매 늘리기","카드 한도를 올리기","예금 해지"]'::jsonb,
  1, '고정비 최적화',
  '변동비는 매달 변동이 크지만 고정비(구독·통신·보험·이자)는 한 번 정비하면 지속적으로 절약 효과가 나므로 단기에 가장 효율적입니다.',
  '한번 조정하면 지속', 1, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '가계부 작성의 핵심 목적은?',
  '["지출 패턴을 파악해 새는 돈을 찾아내고 예산을 세우는 것","부자인 척하기","세금 환급","저축 이자 증가"]'::jsonb,
  1, '지출 가시화',
  '가계부는 기록 자체가 아닌 패턴 파악이 목적입니다. 카테고리별 누수를 확인하고 월별 예산을 재조정하는 근거가 됩니다.',
  '패턴 파악 도구', 1, id
FROM _cc WHERE name = '소비';

-- Level 2 (심화)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '체크카드와 신용카드의 가장 큰 차이는?',
  '["체크=즉시 계좌 차감, 신용=후불 결제(신용평가 필요)","혜택은 완전히 동일","체크카드는 해외 사용 불가","신용카드는 세금 면제"]'::jsonb,
  1, '즉시 차감 vs 후불',
  '체크카드는 결제 즉시 계좌에서 차감되어 한도가 잔액이고, 신용카드는 후불 결제로 신용평가가 필요합니다. 세제 공제율과 혜택 구조도 다릅니다.',
  '결제 방식 차이', 2, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '카테고리별 소비 패턴 분석의 목적은?',
  '["어떤 카테고리에서 예산 이탈이 반복되는지 파악해 개선하는 것","카드 사용량 자랑","세금을 줄이는 것이 유일한 목적","가족의 소비를 비교"]'::jsonb,
  1, '예산 이탈 카테고리 식별',
  '식비·쇼핑·여가 등 카테고리별 월간 추이를 보면 반복 이탈 항목이 보이고, 해당 카테고리에 규칙(예: 외식 주 1회)을 걸어 개선할 수 있습니다.',
  '반복 이탈 찾기', 2, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '구독경제 지출 관리의 효과적 방법은?',
  '["사용 빈도별 분기 재검토, 중복 서비스 해지","모두 유지","모두 해지","무조건 연간결제로 전환"]'::jsonb,
  1, '사용 빈도 기준 점검',
  '구독은 ''기억나지 않는 고정비''가 되기 쉽습니다. 분기마다 명세서를 확인해 사용 빈도가 낮거나 기능이 겹치는 서비스를 정리하면 고정비를 크게 줄일 수 있습니다.',
  '보이지 않는 고정비', 2, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '대출 이자와 투자 수익률 비교 원칙은?',
  '["세후 기준으로 비교, 이자율이 기대수익률보다 높으면 상환 우선","세전 기준으로만 비교","항상 투자가 유리","항상 상환이 유리"]'::jsonb,
  1, '세후 비교, 이자>수익 시 상환',
  '대출 이자는 세후 확정 비용이므로 투자 기대수익률(세후 기대치)과 비교해야 합니다. 고금리 대출은 확정적으로 수익 이상을 ''갚는 것''과 같습니다.',
  '세후 확정 vs 기대', 2, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '무지출 챌린지의 주된 효과는?',
  '["소비 트리거를 식별하고 지출 습관을 리셋","평생 돈을 쓰지 않게 만드는 것","소득 증가","세금 공제"]'::jsonb,
  1, '습관 리셋',
  '일정 기간 필수 외 지출을 중단함으로써 평소 무의식적 소비 트리거(광고·스트레스·알림)를 파악하고 습관을 재설정하는 데 목적이 있습니다.',
  '트리거 파악과 리셋', 2, id
FROM _cc WHERE name = '소비';

-- Level 3 (마스터)
INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '경제학에서 ''기회비용''의 올바른 정의는?',
  '["선택한 대안 때문에 포기한 차선(次善) 대안의 가치","지불한 실제 현금","평균 지출","세금 비용"]'::jsonb,
  1, '포기한 차선 가치',
  '기회비용은 회계상 비용이 아닌 경제학적 비용으로, 어떤 선택을 함으로써 ''포기해야 했던 최선의 다른 대안''의 가치입니다. 합리적 의사결정의 핵심.',
  '포기한 차선', 3, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '가계 재무 건전성 지표 중 ''지출비율''의 권장 수준은?',
  '["소득 대비 총지출 70% 이하(20% 저축 여력 확보)","90%","100%","50%"]'::jsonb,
  1, '지출 70% 이하',
  '일반적 가이드라인은 지출 ≤ 소득의 70%, 저축·투자 ≥ 20%, 비상금 3~6개월치입니다. 70%를 넘으면 장기 재무 목표 달성이 어려워집니다.',
  '저축 여력 20%', 3, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT 'FIRE 운동에서 ''재정 자립 자산 규모''의 일반적 목표는?',
  '["연간 지출의 25배(4% 인출 기준)","연간 수입의 10배","연간 저축의 5배","자산과 무관"]'::jsonb,
  1, '연지출 × 25',
  'FIRE는 연간 지출의 25배 자산을 쌓은 뒤 4% 룰로 인출하며 살아가는 재정 자립 전략입니다. 지출을 줄이면 목표 규모도 함께 줄어듭니다.',
  '4% 룰의 역수', 3, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '자산 배분의 ''100-나이 룰''이 의미하는 것은?',
  '["주식 비중 = 100 - 본인 나이, 나머지는 안전자산","나이만큼 저축","100세까지 같은 비중","매년 100만원 투자"]'::jsonb,
  1, '주식비중=100-나이',
  '나이에 따라 주식 비중을 조정하는 경험칙. 30세면 주식 70%, 채권 30% 식. 최근엔 장수시대를 반영해 ''120-나이''도 많이 쓰입니다.',
  '나이 들수록 안전자산↑', 3, id
FROM _cc WHERE name = '소비';

INSERT INTO quizzes (question, choices, correct_answer, brief_explanation, detailed_explanation, hint, difficulty_level, course_category_id)
SELECT '행동경제학의 ''현상유지 편향''이 소비에 미치는 영향은?',
  '["구독·요금제를 계속 유지하게 만들어 재점검 저항을 일으킴","새로운 상품을 자주 사게 함","저축 습관을 만들어 줌","항상 합리적으로 행동하게 함"]'::jsonb,
  1, '기본값에 머무름',
  '현상유지 편향은 특별한 이유가 없으면 기존 선택을 유지하는 성향으로, 자동결제·연장구독을 방치하게 만듭니다. 주기적 재점검 장치(알림·캘린더)로 극복.',
  '기본값 유지 경향', 3, id
FROM _cc WHERE name = '소비';

DROP TABLE _cc;

COMMIT;
