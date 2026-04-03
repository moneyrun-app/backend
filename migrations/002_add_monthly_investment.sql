-- finance_profiles에 monthly_investment 컬럼 추가
ALTER TABLE finance_profiles
  ADD COLUMN IF NOT EXISTS monthly_investment integer NOT NULL DEFAULT 0;
