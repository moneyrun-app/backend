-- 3단계: 소비 블록 + 신호등 시스템 테이블

-- 일별 소비 블록
CREATE TABLE IF NOT EXISTS daily_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  block_date DATE NOT NULL,
  total_spent BIGINT NOT NULL DEFAULT 0,       -- 해당일 총 지출 (원)
  daily_budget BIGINT NOT NULL DEFAULT 0,      -- 해당일 기준 일 예산 (원)
  block_color TEXT NOT NULL CHECK (block_color IN ('red', 'blue')),  -- red=과소비, blue=알뜰
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, block_date)
);

-- 주간 소비 블록
CREATE TABLE IF NOT EXISTS weekly_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  week INTEGER NOT NULL,                       -- ISO 주차 (1~53)
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  red_days INTEGER NOT NULL DEFAULT 0,
  blue_days INTEGER NOT NULL DEFAULT 0,
  block_color TEXT NOT NULL CHECK (block_color IN ('red', 'blue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, week)
);

-- 월간 소비 블록
CREATE TABLE IF NOT EXISTS monthly_blocks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,                      -- 1~12
  red_weeks INTEGER NOT NULL DEFAULT 0,
  blue_weeks INTEGER NOT NULL DEFAULT 0,
  block_color TEXT NOT NULL CHECK (block_color IN ('red', 'blue')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- 신호등 등급
CREATE TABLE IF NOT EXISTS signal_grades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  grade TEXT NOT NULL CHECK (grade IN ('red', 'yellow', 'green')),
  avg_income BIGINT NOT NULL DEFAULT 0,        -- 6개월 평균 소득 (원)
  avg_expense BIGINT NOT NULL DEFAULT 0,       -- 6개월 평균 지출 (원)
  expense_ratio NUMERIC(5,2) NOT NULL DEFAULT 0, -- 지출/소득 비율 (%)
  evaluated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 신호등 등급 변화 이력
CREATE TABLE IF NOT EXISTS signal_grade_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  previous_grade TEXT CHECK (previous_grade IN ('red', 'yellow', 'green')),
  new_grade TEXT NOT NULL CHECK (new_grade IN ('red', 'yellow', 'green')),
  reason TEXT,                                 -- 변경 사유
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at 트리거
CREATE TRIGGER signal_grades_updated_at
  BEFORE UPDATE ON signal_grades
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_daily_blocks_user_date ON daily_blocks(user_id, block_date);
CREATE INDEX IF NOT EXISTS idx_weekly_blocks_user ON weekly_blocks(user_id, year, week);
CREATE INDEX IF NOT EXISTS idx_monthly_blocks_user ON monthly_blocks(user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_signal_grades_user ON signal_grades(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_history_user ON signal_grade_history(user_id, changed_at DESC);

-- RLS
ALTER TABLE daily_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_grade_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자기 일별 블록만 접근 가능" ON daily_blocks
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "유저는 자기 주간 블록만 접근 가능" ON weekly_blocks
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "유저는 자기 월간 블록만 접근 가능" ON monthly_blocks
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "유저는 자기 신호등 등급만 접근 가능" ON signal_grades
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "유저는 자기 등급 이력만 접근 가능" ON signal_grade_history
  FOR ALL USING (auth.uid() = user_id);
