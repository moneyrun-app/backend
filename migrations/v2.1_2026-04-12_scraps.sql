-- ============================================================
-- 머니런 v2.1 — 스크랩 기능 개선
-- 날짜: 2026-04-12
-- ============================================================

-- external_scraps에 크롤링 본문 + 썸네일 컬럼 추가
ALTER TABLE external_scraps ADD COLUMN IF NOT EXISTS body_text TEXT;
ALTER TABLE external_scraps ADD COLUMN IF NOT EXISTS og_image_url TEXT;

-- 같은 유저가 같은 URL 중복 스크랩 방지
CREATE UNIQUE INDEX IF NOT EXISTS idx_external_scraps_user_url
  ON external_scraps (user_id, url);
