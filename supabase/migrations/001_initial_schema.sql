-- 머니런 MVP 초기 스키마
-- v2.0 — 2026.04.02

-- 1. users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id BIGINT UNIQUE NOT NULL,
  nickname VARCHAR(50) NOT NULL,
  email VARCHAR(255),
  marketing_consent BOOLEAN DEFAULT FALSE,
  has_completed_onboarding BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. finance_profiles
CREATE TABLE IF NOT EXISTS finance_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  age INTEGER NOT NULL,
  monthly_income INTEGER NOT NULL, -- 원(₩) 정수
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. good_spendings
CREATE TABLE IF NOT EXISTS good_spendings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL, -- savings, investment, pension_savings, irp, insurance
  label VARCHAR(50) NOT NULL,
  amount INTEGER NOT NULL, -- 원(₩) 정수
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_good_spendings_user_id ON good_spendings(user_id);

-- 4. fixed_expenses
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rent INTEGER NOT NULL DEFAULT 0, -- 원(₩) 정수
  utilities INTEGER NOT NULL DEFAULT 0,
  phone INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. pacemaker_messages
CREATE TABLE IF NOT EXISTS pacemaker_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  message TEXT NOT NULL,
  grade VARCHAR(10) NOT NULL, -- RED, YELLOW, GREEN
  daily_surplus INTEGER NOT NULL,
  actions JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pacemaker_user_date ON pacemaker_messages(user_id, date);

-- 6. detailed_reports
CREATE TABLE IF NOT EXISTS detailed_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  summary TEXT,
  content TEXT NOT NULL, -- 마크다운 본문
  grade VARCHAR(10) NOT NULL,
  surplus JSONB, -- { monthly, daily }
  analysis JSONB, -- { wellDone, improvement, actionPlan }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_detailed_reports_user_id ON detailed_reports(user_id);

-- 7. weekly_reports
CREATE TABLE IF NOT EXISTS weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  summary TEXT,
  guide TEXT, -- 마크다운 본문 (한 쪽짜리 가이드)
  user_input JSONB, -- { overallFeeling, memo }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_weekly_reports_user_id ON weekly_reports(user_id);

-- 8. learn_contents
CREATE TABLE IF NOT EXISTS learn_contents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL, -- 마크다운 본문
  grade VARCHAR(10) NOT NULL, -- RED, YELLOW, GREEN
  read_minutes INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. user_content_reads
CREATE TABLE IF NOT EXISTS user_content_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES learn_contents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- 10. user_content_scraps
CREATE TABLE IF NOT EXISTS user_content_scraps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL REFERENCES learn_contents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, content_id)
);

-- 11. system_config
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: system_config 초기 데이터
INSERT INTO system_config (key, value) VALUES
  ('seoul_avg_rent', '730000'),
  ('avg_food', '420000'),
  ('avg_transport', '80000'),
  ('avg_subscription', '50000'),
  ('avg_shopping', '150000'),
  ('avg_leisure', '220000'),
  ('avg_etc', '100000'),
  ('inflation_rate', '0.025')
ON CONFLICT (key) DO NOTHING;

-- Seed: learn_contents 초기 학습 콘텐츠 7건
INSERT INTO learn_contents (slug, title, content, grade, read_minutes) VALUES
  ('emergency-fund', '비상금 없으면 진짜 거지 됩니다', E'## 비상금이 왜 중요할까?\n\n갑자기 병원비가 나오면? 갑자기 실직하면? 비상금 없이는 카드론이나 대출밖에 답이 없다.\n\n### 비상금 얼마나 필요할까?\n\n최소 **월 생활비 3개월분**. 100만 원이라도 시작하자.\n\n### 어디에 모아?\n\n- CMA 통장 (입출금 자유 + 이자)\n- 파킹통장\n- 비상금 전용 적금\n\n**오늘 할 일:** 비상금 통장 하나 개설하기. 자동이체 1만 원이라도 걸어놓기.', 'RED', 1),
  ('delivery-cost', '배달비 월 30만 원 = 1년 360만 원', E'## 배달 얼마나 시키고 있어?\n\n배달 1회 평균 15,000원. 주 5회면 월 30만 원.\n\n### 1년이면?\n\n**360만 원**. 이거면 해외여행 2번 간다.\n\n### 줄이는 방법\n\n- 주 5회 → 주 2회로 줄이기 (월 18만 원 절약)\n- 도시락 싸기 (재료비 5천 원 vs 배달 1.5만 원)\n- 배달앱 삭제하고 픽업만 이용\n\n**오늘 할 일:** 이번 달 배달 내역 확인하고 총액 계산해보기.', 'RED', 1),
  ('compound-interest', '복리가 뭔지 모르면 평생 월급쟁이', E'## 복리 = 이자에 이자가 붙는 것\n\n100만 원을 연 5%로 30년 굴리면?\n\n- 단리: 250만 원\n- **복리: 432만 원**\n\n### 왜 중요?\n\n시간이 돈을 벌어준다. **빨리 시작할수록** 유리하다.\n\n### 복리 효과를 누리려면?\n\n1. 적금보다 **투자** (ETF, 연금저축)\n2. 수익을 **재투자** (인출하지 않기)\n3. **장기간** 유지 (최소 10년)\n\n**오늘 할 일:** 네이버 복리 계산기로 내 적금 30년 후 예상해보기.', 'RED', 1),
  ('youth-savings', '청년도약계좌 안 하면 정부가 주는 돈 버리는 거', E'## 청년도약계좌란?\n\n정부가 매달 최대 **2.4만 원**을 얹어주는 적금.\n\n### 조건\n\n- 만 19~34세\n- 연 소득 7,500만 원 이하\n- 월 최대 70만 원 납입\n\n### 혜택\n\n- 정부 기여금 + 비과세 이자\n- 5년 만기 시 최대 **5,000만 원+**\n\n### 안 하면?\n\n정부가 주는 무료 돈을 버리는 것.\n\n**오늘 할 일:** 청년도약계좌 가입 조건 확인하고, 주거래 은행 앱에서 신청하기.', 'YELLOW', 1),
  ('year-end-tax', '연말정산 환급 적은 이유 99% 이거', E'## 연말정산 = 세금 돌려받는 기회\n\n환급 적은 이유는 **공제 항목을 안 챙겨서**.\n\n### 놓치기 쉬운 공제\n\n1. **연금저축** — 연 400만 원까지 16.5% 세액공제\n2. **IRP** — 추가 300만 원 세액공제\n3. **체크카드** — 신용카드보다 공제율 2배\n4. **의료비/교육비** — 영수증 챙기기\n\n### 체크카드 vs 신용카드\n\n- 신용카드 공제율: 15%\n- 체크카드 공제율: **30%**\n\n**오늘 할 일:** 연금저축 + IRP 합산 연 700만 원 채우고 있는지 확인.', 'YELLOW', 1),
  ('pension-savings', '연금저축 지금 안 하면 65세에 후회', E'## 국민연금만으로 충분할까?\n\n국민연금 평균 수령액: 월 **60만 원**. 이걸로 생활이 돼?\n\n### 연금저축이 필요한 이유\n\n1. 세액공제로 **당장 세금 절약** (연 66만 원)\n2. 복리로 **장기 성장**\n3. 55세부터 **연금 수령**\n\n### 얼마나?\n\n- 월 33만 원 × 30년 × 연 7% = **약 4억 원**\n- 이걸 연금으로 받으면 월 **165만 원** 추가\n\n### 어디서?\n\n증권사 연금저축펀드 (ETF 투자 가능)\n\n**오늘 할 일:** 증권사 앱에서 연금저축펀드 계좌 개설하기.', 'GREEN', 1),
  ('etf-basics', 'ETF 모르면 적금만 하다 인플레이션에 짐', E'## 적금 이자 vs 인플레이션\n\n- 적금 이자: 연 3~4%\n- 인플레이션: 연 2.5%\n- **실질 수익: 0.5~1.5%**\n\n돈의 가치가 매년 줄어드는데 적금만 하면 제자리.\n\n### ETF란?\n\n주식 묶음 상품. 삼성전자 1주 = 7만 원이지만, S&P 500 ETF 1주로 미국 500개 기업에 분산 투자.\n\n### 초보 추천 ETF\n\n- KODEX 200 (한국 대표 200개 기업)\n- TIGER S&P500 (미국 500대 기업)\n- KODEX 미국나스닥100\n\n### 시작 방법\n\n1. 증권사 계좌 개설\n2. 연금저축 계좌에서 ETF 매수\n3. 매월 자동매수 설정\n\n**오늘 할 일:** 증권사 앱 설치하고 KODEX 200 검색해보기.', 'GREEN', 1)
ON CONFLICT (slug) DO NOTHING;
