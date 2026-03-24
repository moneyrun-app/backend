-- 6단계: 마이북 테이블

-- 스크랩
CREATE TABLE IF NOT EXISTS scraps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('youtube', 'threads', 'community', 'etc')),
  source_method TEXT NOT NULL CHECK (source_method IN ('share', 'copy')),
  creator_name TEXT,
  content_title TEXT,
  content_date TIMESTAMPTZ,
  summary_short TEXT,
  summary_full TEXT,
  summary_status TEXT NOT NULL DEFAULT 'pending' CHECK (summary_status IN ('pending', 'completed', 'failed')),
  summary_retry_count INTEGER NOT NULL DEFAULT 0,
  thumbnail_url TEXT,
  is_bookmarked BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 공유 요약 캐시 (같은 URL이면 재활용)
CREATE TABLE IF NOT EXISTS summary_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  summary_short TEXT,
  summary_full TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 관심 키워드
CREATE TABLE IF NOT EXISTS user_keywords (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, keyword)
);

-- 머니런 추천 콘텐츠
CREATE TABLE IF NOT EXISTS recommended_contents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  category TEXT,
  target_grades TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거
CREATE TRIGGER scraps_updated_at
  BEFORE UPDATE ON scraps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_scraps_user ON scraps(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scraps_channel ON scraps(user_id, channel);
CREATE INDEX IF NOT EXISTS idx_scraps_expires ON scraps(expires_at) WHERE expires_at IS NOT NULL AND is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_summary_cache_url ON summary_cache(url);
CREATE INDEX IF NOT EXISTS idx_user_keywords_user ON user_keywords(user_id);

-- RLS
ALTER TABLE scraps ENABLE ROW LEVEL SECURITY;
ALTER TABLE summary_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommended_contents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자기 스크랩만 접근" ON scraps FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "요약 캐시는 서비스만 접근" ON summary_cache FOR SELECT USING (true);
CREATE POLICY "유저는 자기 키워드만 접근" ON user_keywords FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "추천 콘텐츠는 모두 조회 가능" ON recommended_contents FOR SELECT USING (true);
