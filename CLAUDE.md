# Money Learn API

머니런(Money Learn) — 게이미피케이션 기반 개인 재무 교육 앱의 백엔드 API 서버.

## IMPORTANT: 언어 규칙

- 모든 대화, 설명, 주석, 커밋 메시지, 문서는 한글로 작성한다.
- 코드 변수명, 함수명, 파일명 등 기술적으로 영어가 필요한 부분만 영어 사용.
- JSDoc 주석도 한글로 작성.
- 에러 메시지, 로그 메시지도 한글로 작성.

## Tech Stack

- **Runtime**: Node.js + TypeScript (strict mode)
- **Framework**: NestJS
- **Database**: Supabase (PostgreSQL) — Auth는 프론트에서 Supabase SDK로 직접 처리, 백엔드는 JWT 검증만
- **Hosting**: Render (GitHub 자동 배포)
- **External APIs**: 코드에프(Codef) MyData API, data.go.kr, 고용24 OpenAPI (추후 추가될 수 있음 — 추가 시 여기에 명시할 것)
- **AI**: MVP 이후 확정 (Claude or GPT-4o) — ai/ 모듈에 래퍼를 두고 교체 가능하게
- **Logging**: Winston + winston-daily-rotate-file

## Project Structure

```
src/
├── auth/           — JWT 검증 가드, @CurrentUser() 데코레이터
├── users/          — 유저 프로필, 온보딩
├── codef/          — 코드에프 API 연동 (계좌/카드/거래 동기화)
├── signal/         — 신호등 시스템 (빨/노/초 등급 판정)
├── blocks/         — 소비 블록 (일별/주별/월별 블록 + 러닝 속도)
├── mybook/         — 스크랩, AI 요약, 추천 콘텐츠
├── community/      — 커뮤니티 (신호등 방, 게시글, 비교 그래프)
├── pacemaker/      — AI 페이스메이커 (발화 생성, 홈 대시보드)
├── simulator/      — 동기부여 계산기 (복리 계산, 머니런 스코어)
├── notifications/  — 알림
├── ai/             — AI API 래퍼 (요약, 발화, 태그 추출 공통)
├── common/         — 가드, 인터셉터, 에러 필터, DTO, 유틸
└── app.module.ts

logs/               — Winston이 생성하는 로그 파일 (gitignore 대상)
├── 2026-03/
│   ├── 24-info.log
│   └── 24-error.log
```

## Commands

```bash
npm run start:dev     # 개발 서버
npm run build         # 프로덕션 빌드
npm run start:prod    # 프로덕션 실행
npm run test          # 단위 테스트
npm run test:e2e      # E2E 테스트
npm run lint          # ESLint
```

## Code Style

- ES modules (import/export), CommonJS(require) 사용 금지
- 모든 함수와 메서드에 TypeScript 타입 명시
- NestJS 컨벤션: Controller → Service → Repository 패턴
- DTO는 class-validator 데코레이터로 검증
- 에러는 NestJS 내장 HttpException 사용
- 환경변수는 반드시 ConfigModule/ConfigService로 접근
- 데이터베이스 쿼리는 Supabase Client 사용
- Supabase Client는 글로벌 모듈(SupabaseModule)로 만들어서 전체 앱에서 주입받아 사용
- 모든 Service 메서드와 주요 함수에 JSDoc 주석 작성 (파라미터, 리턴값, 기능 설명)
- Controller 엔드포인트에는 Swagger 데코레이터(@ApiOperation, @ApiResponse) 필수

## Auth

- IMPORTANT: 로그인/토큰 발급/갱신은 프론트가 Supabase SDK로 직접 처리한다. 백엔드에 /auth/login 같은 엔드포인트를 만들지 마라.
- 백엔드는 요청 헤더의 Bearer JWT를 Supabase 공개키로 검증만 한다.
- 인증 필요 엔드포인트에는 @UseGuards(AuthGuard) 적용.
- JWT payload에서 user_id 추출하는 @CurrentUser() 데코레이터 사용.

## Database

- Supabase PostgreSQL 사용. ORM 없이 Supabase Client로 직접 쿼리.
- 테이블에 RLS(Row Level Security) 정책 설정 필수 — 유저는 자기 데이터만 접근.
- 날짜/시간은 KST(Asia/Seoul) 기준으로 저장. 한국 전용 서비스.
- soft delete 패턴 사용 (is_deleted 컬럼).

## Logging

- Winston + winston-daily-rotate-file 사용.
- 로그 파일은 logs/ 폴더에 날짜별로 자동 생성 (예: logs/2026-03/24-info.log).
- 에러 로그는 별도 파일로 분리 (예: logs/2026-03/24-error.log).
- 개발 환경에서는 콘솔에 컬러 출력, 프로덕션에서는 JSON 포맷으로 파일 저장.
- 로그 레벨: error, warn, info, debug (프로덕션은 info 이상만).
- 하루가 지난 로그 파일은 자동으로 gzip 압축 보관 (예: 24-info.log → 24-info.log.gz).
- 압축된 로그는 삭제하지 않고 계속 보관.
- logs/ 폴더는 .gitignore에 추가.

## API

- 글로벌 prefix: `/api/v1` (NestJS setGlobalPrefix 사용)
- 모든 엔드포인트는 `/api/v1/...` 형태

## 환경변수

.env.example 참고. 필요한 환경변수 목록:

```
# Supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_JWT_SECRET=

# 코드에프 (Codef)
CODEF_CLIENT_ID=
CODEF_CLIENT_SECRET=
CODEF_API_URL=

# AI (MVP 이후 확정)
AI_API_KEY=
AI_API_PROVIDER=         # claude 또는 openai

# 서버
PORT=3000
NODE_ENV=development     # development | production
```

## Docs

기능 기획서와 도메인 상세 지식은 docs/ 폴더에 있다. 새로운 모듈 개발 전에 반드시 참고할 것.

- `docs/backend-plan.md` — 페이지별 백엔드 기능 기획서 (항상 최신 버전 유지)
- `docs/changelog.md` — 기획서 변경 이력 (v1에서 뭐가 바뀌어서 v2가 됐는지 추적)
- `docs/api-decisions.md` — 개발 중 내린 기술적 결정 사항 기록

## Git Workflow

- main 브랜치는 항상 배포 가능 상태 유지
- 기능 개발은 feature/ 브랜치에서 진행
- 커밋 메시지는 반드시 한글: "유저 온보딩 API 추가", "소비 블록 일별 계산 로직 구현"
