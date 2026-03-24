-- 1단계: 유저 프로필 + 예산 테이블
-- 실행 전 Supabase 대시보드에서 SQL Editor로 실행하거나 supabase db push 사용

-- 유저 프로필
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname VARCHAR(20) NOT NULL,
  birth_year INTEGER NOT NULL,
  residence VARCHAR(50) NOT NULL,
  annual_income INTEGER NOT NULL,  -- 만원 단위
  is_sme BOOLEAN NOT NULL DEFAULT false,
  income_group VARCHAR(10) NOT NULL CHECK (income_group IN ('basic', 'middle', 'high')),
  goal_name VARCHAR(50),
  goal_amount INTEGER,  -- 만원 단위
  is_onboarded BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 유저 예산
CREATE TABLE IF NOT EXISTS user_budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_income INTEGER NOT NULL,    -- 원 단위
  fixed_expenses INTEGER NOT NULL,    -- 원 단위
  savings_goal INTEGER NOT NULL,      -- 원 단위
  monthly_budget INTEGER NOT NULL,    -- 원 단위 (자동 계산)
  weekly_budget INTEGER NOT NULL,     -- 원 단위 (자동 계산)
  daily_budget INTEGER NOT NULL,      -- 원 단위 (자동 계산)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_budgets_updated_at
  BEFORE UPDATE ON user_budgets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS 정책: 유저는 자기 데이터만 접근 가능
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자기 프로필만 조회/수정 가능" ON user_profiles
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "유저는 자기 예산만 조회/수정 가능" ON user_budgets
  FOR ALL USING (auth.uid() = user_id);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_budgets_user_id ON user_budgets(user_id);
