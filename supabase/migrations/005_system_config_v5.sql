-- 머니런 system_config 확장: 상세 리포트 v5용 상수 데이터
-- 2026.04.06

-- =============================================
-- 1. 컬럼 추가: 카테고리, 출처, 검토주기, 단위, 설명
-- =============================================

ALTER TABLE system_config
  ADD COLUMN IF NOT EXISTS category VARCHAR(50),
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS unit VARCHAR(20),
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS review_cycle VARCHAR(20);

-- content_updated_at 불필요 → updated_at 하나로 통일
-- updated_at: 값이 수정될 때마다 갱신

COMMENT ON COLUMN system_config.category IS '분류: peer, simulation, retirement, life_event, global, cost_avg, product_rate, general';
COMMENT ON COLUMN system_config.unit IS '값의 단위: 원, 달러, %, JSON';
COMMENT ON COLUMN system_config.source IS '데이터 출처 (통계청, OECD 등)';
COMMENT ON COLUMN system_config.review_cycle IS '검토 주기. 실제 변동 주기보다 타이트하게 설정';

-- =============================================
-- 2. 기존 8개 row 업데이트
-- =============================================

UPDATE system_config SET category = 'cost_avg', unit = '원', source = 'KB부동산 월세통계', review_cycle = '3개월', description = '서울 평균 월세' WHERE key = 'seoul_avg_rent';
UPDATE system_config SET category = 'cost_avg', unit = '원', source = '통계청 가계동향조사', review_cycle = '3개월', description = '평균 식비' WHERE key = 'avg_food';
UPDATE system_config SET category = 'cost_avg', unit = '원', source = '통계청 가계동향조사', review_cycle = '3개월', description = '평균 교통비' WHERE key = 'avg_transport';
UPDATE system_config SET category = 'cost_avg', unit = '원', source = '통계청 가계동향조사', review_cycle = '3개월', description = '평균 구독료' WHERE key = 'avg_subscription';
UPDATE system_config SET category = 'cost_avg', unit = '원', source = '통계청 가계동향조사', review_cycle = '3개월', description = '평균 쇼핑' WHERE key = 'avg_shopping';
UPDATE system_config SET category = 'cost_avg', unit = '원', source = '통계청 가계동향조사', review_cycle = '3개월', description = '평균 여가비' WHERE key = 'avg_leisure';
UPDATE system_config SET category = 'cost_avg', unit = '원', source = '통계청 가계동향조사', review_cycle = '3개월', description = '평균 기타 지출' WHERE key = 'avg_etc';
UPDATE system_config SET value = '2.5', category = 'general', unit = '%', source = '한국은행 소비자물가지수', review_cycle = '3개월', description = '인플레이션율' WHERE key = 'inflation_rate';
UPDATE system_config SET category = 'general', unit = '달러', source = '국제에너지기구(IEA)', review_cycle = '1주', description = '국제 유가 (배럴당)' WHERE key = 'oil_price';

-- =============================================
-- 3. 신규 데이터 삽입
-- =============================================

INSERT INTO system_config (key, value, category, unit, description, source, review_cycle) VALUES

-- ----- 또래 비교 (Section A, B) -----

  ('peer_avg_income', '{"20s":2800000,"30s":3500000,"40s":4200000,"50s":4800000}',
   'peer', 'JSON', '나이대별 평균 소득', '통계청 가계금융복지조사 2025', '6개월'),

  ('peer_avg_savings_rate', '{"20s":18,"30s":22,"40s":25,"50s":28}',
   'peer', 'JSON', '나이대별 평균 저축률', '통계청 가계금융복지조사 2025', '6개월'),

  ('peer_avg_expense_ratio', '{"20s":65,"30s":60,"40s":55,"50s":52}',
   'peer', 'JSON', '나이대별 평균 지출비율', '통계청 가계금융복지조사 2025', '6개월'),

  ('peer_avg_fixed_ratio', '{"20s":35,"30s":38,"40s":40,"50s":42}',
   'peer', 'JSON', '나이대별 평균 고정비 비율', '통계청 가계금융복지조사 2025', '6개월'),

  ('peer_avg_variable_ratio', '{"20s":30,"30s":28,"40s":25,"50s":22}',
   'peer', 'JSON', '나이대별 평균 변동비 비율', '통계청 가계금융복지조사 2025', '6개월'),

  ('peer_avg_surplus_ratio', '{"20s":18,"30s":22,"40s":25,"50s":28}',
   'peer', 'JSON', '나이대별 평균 잉여비율', '통계청 가계금융복지조사 2025', '6개월'),

-- ----- 시뮬레이션 이자율/수익률 (Section C) -----

  ('savings_interest_rate', '3.5',
   'simulation', '%', '적금 평균 이율', '한국은행 금융통계정보시스템', '2주'),

  ('avg_stock_return_kr', '8.2',
   'simulation', '%', '국내 주식 장기 평균 수익률 (KOSPI 20년)', 'KRX 한국거래소', '3개월'),

  ('avg_stock_return_global', '10.5',
   'simulation', '%', '해외 주식 장기 평균 수익률 (S&P500 30년)', 'S&P Global', '3개월'),

  ('avg_bond_return', '4.0',
   'simulation', '%', '채권 평균 수익률', '한국은행 채권통계', '1개월'),

-- ----- 은퇴 (Section C) -----

  ('national_pension_avg_monthly', '600000',
   'retirement', '원', '국민연금 평균 수령액', '국민연금공단 통계연보', '6개월'),

  ('min_living_cost_retirement', '1300000',
   'retirement', '원', '은퇴 후 최소 생활비 (1인)', '국민연금연구원 노후보장패널', '6개월'),

  ('comfortable_living_cost_retirement', '2500000',
   'retirement', '원', '은퇴 후 적정 생활비 (1인)', '국민연금연구원 노후보장패널', '6개월'),

-- ----- 생애 이벤트 (Section C 변수) -----

  ('life_event_costs', '{"wedding":35000000,"jeonse_seoul":320000000,"child_0_18":350000000,"car_5yr":50000000}',
   'life_event', 'JSON', '주요 생애 이벤트 평균 비용. wedding=결혼, jeonse_seoul=서울전세, child_0_18=자녀양육0~18세, car_5yr=차량구매+5년유지', '통계청·KB부동산·보건복지부 종합', '6개월'),

-- ----- 글로벌 통계 (Section D) -----

  ('global_savings_rate', '{"KR":35.5,"US":4.6,"JP":25.3,"DE":20.2,"GB":10.1,"CN":33.4}',
   'global', 'JSON', '국가별 가계 저축률', 'OECD Data 2024', '6개월'),

  ('global_household_debt_gdp', '{"KR":105.0,"AU":111.4,"CA":101.6,"US":73.5,"JP":68.2,"DE":52.1}',
   'global', 'JSON', '국가별 가계부채/GDP 비율', 'BIS Statistics 2024', '6개월'),

  ('global_pension_replacement', '{"NL":80.2,"IT":74.6,"US":39.2,"KR":31.2,"JP":32.4,"GB":28.4}',
   'global', 'JSON', '국가별 연금 소득대체율', 'OECD Pensions at a Glance 2023', '6개월'),

  ('global_retirement_age', '{"KR":{"legal":60,"actual":49,"pension":65},"US":{"legal":67,"actual":62,"pension":67},"JP":{"legal":65,"actual":60,"pension":65},"DE":{"legal":67,"actual":63,"pension":67},"GB":{"legal":66,"actual":64,"pension":66}}',
   'global', 'JSON', '국가별 법정/실질 은퇴나이 + 연금수령나이', 'OECD Employment Outlook 2024', '6개월'),

  ('global_investment_participation', '{"US":55,"AU":37,"GB":33,"JP":18,"DE":14,"KR":12}',
   'global', 'JSON', '국가별 주식 투자 참여율', 'Statista·각국 금융감독원 2024', '6개월'),

-- ----- 비용 평균 추가분 (Section F) -----

  ('avg_insurance', '150000',
   'cost_avg', '원', '평균 보험료', '보험개발원 통계', '3개월'),

  ('avg_telecom', '65000',
   'cost_avg', '원', '평균 통신비', '과학기술정보통신부 통신요금통계', '3개월'),

  ('avg_delivery_per_order', '15000',
   'cost_avg', '원', '배달 1회 평균 비용', '배달의민족 트렌드리포트', '3개월'),

-- ----- 금융 상품 이율 범위 (Section G) -----

  ('product_parking_rate', '1.5~3.0',
   'product_rate', '%', '파킹통장 이율 범위', '금융감독원 금융상품비교공시', '2주'),

  ('product_savings_rate', '3.0~4.5',
   'product_rate', '%', '정기적금 이율 범위', '금융감독원 금융상품비교공시', '2주'),

  ('product_cma_rate', '2.0~3.5',
   'product_rate', '%', 'CMA 이율 범위', '금융감독원 금융상품비교공시', '2주'),

  ('product_youth_account_rate', '6.0',
   'product_rate', '%', '청년도약계좌 금리', '서민금융진흥원', '3개월'),

  ('product_pension_fund_return', '7~10',
   'product_rate', '%', '연금저축펀드 예상 수익률 범위', '금융감독원 연금저축 비교공시', '3개월'),

-- ----- 기타 -----

  ('exchange_rate_usd', '1350',
   'general', '원', '원/달러 환율', '한국은행 환율정보', '1주')

ON CONFLICT (key) DO NOTHING;

