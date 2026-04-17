# CLAUDE.md — 머니런 백엔드

**머니런** — 금융 학습 웹 MVP. 온보딩 → 코스 배정 → AI 마이북 → 퀴즈/미션/페이스메이커 루프.

## 스택
- NestJS (TypeScript)
- Supabase (PostgreSQL) — **ORM 금지**, @supabase/supabase-js 직접 사용
- 카카오 OAuth2 + JWT
- Anthropic Claude API
- Render 배포

## 규칙
1. ORM 쓰지 말 것
2. 금액은 원(₩) 정수
3. system_config 하드코딩 금지
4. 커밋/배포는 유저가 지시할 때만
5. AI가 수치를 만들지 말 것 — 데이터는 직접 삽입, AI는 서술만

## 폴더
`src/` 아래 도메인별 모듈 (auth, course, quiz, my-book, money-book, pacemaker, finance, book, admin 등).
마이그레이션은 `supabase/migrations/`.

## 참고 문서
필요할 때 `docs/` 폴더의 최신 기획서 읽을 것.
