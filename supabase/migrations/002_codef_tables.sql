-- 2단계: 코드에프(MyData) 연동 테이블
-- 코드에프 커넥티드ID, 계좌, 카드, 거래 내역, 자산 스냅샷, 동기화 로그

-- 코드에프 커넥티드ID (유저별 1개)
CREATE TABLE IF NOT EXISTS codef_connected_ids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 연결된 금융기관 (은행/카드사)
CREATE TABLE IF NOT EXISTS codef_institutions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_id_ref UUID NOT NULL REFERENCES codef_connected_ids(id) ON DELETE CASCADE,
  organization_code TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  institution_type TEXT NOT NULL CHECK (institution_type IN ('bank', 'card')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- 은행 계좌
CREATE TABLE IF NOT EXISTS codef_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES codef_institutions(id) ON DELETE CASCADE,
  account_number TEXT NOT NULL,
  account_name TEXT,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  balance BIGINT NOT NULL DEFAULT 0,
  account_type TEXT,  -- 보통예금, 적금, 주식 등
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- 카드
CREATE TABLE IF NOT EXISTS codef_cards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  institution_id UUID NOT NULL REFERENCES codef_institutions(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL,
  card_name TEXT,
  card_company_code TEXT NOT NULL,
  card_company_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- 거래 내역
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID REFERENCES codef_accounts(id) ON DELETE SET NULL,
  card_id UUID REFERENCES codef_cards(id) ON DELETE SET NULL,
  transaction_date DATE NOT NULL,
  transaction_time TEXT,
  description TEXT NOT NULL,
  amount BIGINT NOT NULL,            -- 원 단위 (양수: 입금, 음수: 출금)
  balance_after BIGINT,              -- 거래 후 잔액
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  category TEXT NOT NULL DEFAULT '기타',
  tags TEXT[] NOT NULL DEFAULT '{}',
  merchant_name TEXT,
  is_investment BOOLEAN NOT NULL DEFAULT false,
  is_fixed_expense BOOLEAN NOT NULL DEFAULT false,
  codef_transaction_id TEXT,         -- 코드에프 원본 거래 고유 ID (중복 방지)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_deleted BOOLEAN NOT NULL DEFAULT false
);

-- 자산 스냅샷 (Day 0, 머니런 시작 시점)
CREATE TABLE IF NOT EXISTS asset_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_date DATE NOT NULL,
  total_balance BIGINT NOT NULL,     -- 원 단위
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 동기화 로그
CREATE TABLE IF NOT EXISTS sync_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('accounts', 'cards', 'transactions', 'full')),
  status TEXT NOT NULL CHECK (status IN ('started', 'success', 'failed', 'partial')),
  synced_count INTEGER NOT NULL DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- updated_at 자동 갱신 트리거
CREATE TRIGGER codef_connected_ids_updated_at
  BEFORE UPDATE ON codef_connected_ids
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER codef_accounts_updated_at
  BEFORE UPDATE ON codef_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER codef_cards_updated_at
  BEFORE UPDATE ON codef_cards
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_codef_institutions_user ON codef_institutions(user_id);
CREATE INDEX IF NOT EXISTS idx_codef_accounts_user ON codef_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_codef_accounts_institution ON codef_accounts(institution_id);
CREATE INDEX IF NOT EXISTS idx_codef_cards_user ON codef_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_codef_cards_institution ON codef_cards(institution_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, category);
CREATE INDEX IF NOT EXISTS idx_transactions_codef_id ON transactions(codef_transaction_id) WHERE codef_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_sync_logs_user ON sync_logs(user_id, started_at DESC);

-- RLS 정책
ALTER TABLE codef_connected_ids ENABLE ROW LEVEL SECURITY;
ALTER TABLE codef_institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE codef_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE codef_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자기 커넥티드ID만 접근 가능" ON codef_connected_ids
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "유저는 자기 금융기관만 접근 가능" ON codef_institutions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "유저는 자기 계좌만 접근 가능" ON codef_accounts
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "유저는 자기 카드만 접근 가능" ON codef_cards
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "유저는 자기 거래만 접근 가능" ON transactions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "유저는 자기 스냅샷만 접근 가능" ON asset_snapshots
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "유저는 자기 동기화 로그만 접근 가능" ON sync_logs
  FOR ALL USING (auth.uid() = user_id);
