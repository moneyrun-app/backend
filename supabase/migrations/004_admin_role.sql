-- 어드민 역할 추가
-- users 테이블에 role 컬럼 추가 (기본값: 'user')

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(10) NOT NULL DEFAULT 'user';

-- role 값 제한
ALTER TABLE users
  ADD CONSTRAINT chk_users_role CHECK (role IN ('user', 'admin'));
