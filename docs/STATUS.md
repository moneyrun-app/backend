# 머니런 백엔드 — 작업 현황 (STATUS)

> 마지막 업데이트: 2026-04-03
> 다른 세션에서 이어서 작업할 때 이 문서를 먼저 읽을 것.

---

## 현재 상태: Phase 10/10 완료 (코드 작성 완료, 테스트 미완료)

---

## 완료된 작업

### 1. 프로젝트 기반
- [x] NestJS 프로젝트 스캐폴딩
- [x] CLAUDE.md 작성
- [x] docs/ 폴더 (기획서, API 명세, 플로우, 기술결정, CHANGELOG)
- [x] .gitignore
- [x] .env 구조 (Supabase 연결됨, 포트 3001)
- [x] 의존성 설치 완료

### 2. 공통 인프라 (common/)
- [x] SupabaseModule/Service (Global)
- [x] ResponseInterceptor — `{ success: true, data }` 래핑
- [x] HttpExceptionFilter — `{ success: false, message, code }` 에러 응답
- [x] JwtAuthGuard
- [x] @CurrentUser() 데코레이터

### 3. Supabase DB
- [x] 11개 테이블 생성 (Supabase MCP로 마이그레이션 적용됨)
- [x] system_config seed 8건
- [x] learn_contents seed 7건 (초안 콘텐츠 포함)
- [x] 마이그레이션 SQL: `supabase/migrations/001_initial_schema.sql`

### 4. API 엔드포인트 23개 전부 코드 작성됨
- [x] POST /auth/kakao
- [x] POST /onboarding
- [x] GET/PATCH/DELETE /users/me
- [x] GET/PATCH /finance/profile
- [x] POST/PATCH/DELETE /finance/good-spendings
- [x] PATCH /finance/fixed-expenses
- [x] GET /pacemaker/today (AI 생성 + 캐싱)
- [x] GET /pacemaker/history
- [x] GET /book/detailed-reports, GET /book/detailed-reports/:id
- [x] GET/POST /book/weekly-reports, GET /book/weekly-reports/:id
- [x] GET /book/learn, GET /book/learn/:id
- [x] POST /book/learn/:id/scrap
- [x] GET /book/scraps
- [x] GET /constants

### 5. 비즈니스 로직
- [x] surplus.calculator.ts (잉여자금 계산)
- [x] grade.calculator.ts (등급 판정 RED/YELLOW/GREEN)
- [x] message.generator.ts (Claude API → 페이스메이커 메시지)
- [x] report.generator.ts (Claude API → 상세/주간 리포트)
- [x] 재무 변경 → 상세 리포트 비동기 자동 트리거 (30일 제한)

---

## 실제 테스트 결과

| 항목 | 상태 | 비고 |
|---|---|---|
| TypeScript 빌드 | **통과** | `npx nest build` 에러 없음 |
| 서버 부팅 | **통과** | 23개 라우트 전부 매핑 확인 |
| GET /constants | **통과** | Supabase 연결 + seed 데이터 정상 반환 |
| POST /auth/kakao | **미테스트** | 카카오 accessToken 필요 |
| POST /onboarding | **미테스트** | JWT 필요 |
| GET/PATCH/DELETE /users/me | **미테스트** | JWT 필요 |
| /finance/* | **미테스트** | JWT 필요 |
| /pacemaker/* | **미테스트** | JWT + ANTHROPIC_API_KEY 필요 |
| /book/* | **미테스트** | JWT + ANTHROPIC_API_KEY 필요 |

---

## 아직 안 된 것 / 해야 할 것

### 우선순위 높음 (다음 세션에서 바로)
1. **`.env` 키 설정** — KAKAO_CLIENT_ID, KAKAO_CLIENT_SECRET, ANTHROPIC_API_KEY 빈값
2. **API 통합 테스트** — JWT 발급 후 인증 필요 API 전부 테스트
3. **카카오 로그인 실제 연동 확인** — 카카오 개발자 앱 등록 필요

### 우선순위 중간
4. **페이스메이커 AI 메시지 품질 튜닝** — 프롬프트 조정, 톤 검증
5. **상세 리포트 AI 생성 품질** — 프롬프트 조정, 분량 확인
6. **에러 핸들링 보강** — 각 서비스에서 Supabase 에러 세분화

### 우선순위 낮음
7. **Render 배포 설정** — Dockerfile 또는 render.yaml
8. **CORS 설정** — 프론트 도메인 확정 후
9. **Rate limiting** — AI API 비용 관리
10. **로깅** — 운영 모니터링용

---

## 빠른 시작 (이어서 작업할 때)

```bash
cd /Users/sieun/Documents/moneyrun/backend

# 서버 시작
npm run start:dev

# 빌드 확인
npx nest build

# 인증 없이 테스트 가능한 API
curl http://localhost:3001/constants
```

### JWT 테스트용 토큰 발급 방법
카카오 키 없이 테스트하려면, auth.service.ts의 `getKakaoUserInfo`를 임시로 mock하거나,
Supabase에 직접 유저를 INSERT한 후 JWT를 수동 발급해야 함.

---

## 파일 구조 요약

```
src/
  ├── main.ts                    ← 엔트리 (포트 3001, CORS, 글로벌 파이프/필터/인터셉터)
  ├── app.module.ts              ← 모듈 임포트 허브
  ├── common/                    ← Supabase, 인터셉터, 필터, 가드, 데코레이터
  ├── auth/                      ← 카카오 로그인 + JWT (1 엔드포인트)
  ├── users/                     ← 유저 CRUD (3 엔드포인트)
  ├── onboarding/                ← 온보딩 (1 엔드포인트)
  ├── finance/                   ← 재무 프로필 + 좋은소비 + 고정소비 (6 엔드포인트)
  ├── pacemaker/                 ← AI 일일 메시지 (2 엔드포인트)
  ├── book/                      ← 리포트 + 학습 + 스크랩 (9 엔드포인트)
  └── constants/                 ← 운영 상수 (1 엔드포인트)
```

---

*마지막 커밋 전 상태 — 2026-04-03*
