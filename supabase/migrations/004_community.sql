-- 4단계: 커뮤니티 테이블

-- 익명 프로필 (유저별 고유 닉네임/아바타)
CREATE TABLE IF NOT EXISTS anonymous_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  anonymous_nickname TEXT NOT NULL,
  avatar_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 게시글
CREATE TABLE IF NOT EXISTS community_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  income_group TEXT NOT NULL CHECK (income_group IN ('basic', 'middle', 'high')),
  signal_grade TEXT NOT NULL CHECK (signal_grade IN ('red', 'yellow', 'green')),
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0,
  is_trending BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 좋아요
CREATE TABLE IF NOT EXISTS community_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_id)
);

-- 댓글
CREATE TABLE IF NOT EXISTS community_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Top Creators 점수
CREATE TABLE IF NOT EXISTS top_creators (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  post_count INTEGER NOT NULL DEFAULT 0,
  total_likes INTEGER NOT NULL DEFAULT 0,
  total_comments INTEGER NOT NULL DEFAULT 0,
  score NUMERIC(10,2) NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 트리거
CREATE TRIGGER community_posts_updated_at
  BEFORE UPDATE ON community_posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER community_comments_updated_at
  BEFORE UPDATE ON community_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_posts_room ON community_posts(income_group, signal_grade, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON community_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_trending ON community_posts(is_trending) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_likes_post ON community_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_post ON community_likes(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON community_comments(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_top_creators_score ON top_creators(score DESC);

-- RLS
ALTER TABLE anonymous_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE top_creators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "유저는 자기 익명 프로필만 접근" ON anonymous_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "게시글은 모두 조회 가능, 수정은 본인만" ON community_posts FOR SELECT USING (true);
CREATE POLICY "게시글 CUD는 본인만" ON community_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "게시글 수정은 본인만" ON community_posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "게시글 삭제는 본인만" ON community_posts FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "좋아요는 모두 조회 가능" ON community_likes FOR SELECT USING (true);
CREATE POLICY "좋아요 CUD는 본인만" ON community_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "좋아요 삭제는 본인만" ON community_likes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "댓글은 모두 조회 가능" ON community_comments FOR SELECT USING (true);
CREATE POLICY "댓글 작성은 본인만" ON community_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "댓글 수정은 본인만" ON community_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Top Creators는 모두 조회 가능" ON top_creators FOR SELECT USING (true);
