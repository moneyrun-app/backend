# CLAUDE.md — 머니런 백엔드

> Claude Code가 이 프로젝트를 이해하기 위한 메인 문서. **코드 작성 전 반드시 읽을 것.**

---

## 프로젝트 개요

**머니런(MoneyRun)** — 비로그인 시뮬레이션 → 로그인 후 AI 리포트(마이북) + AI 코칭(페이스메이커)으로 재방문 유도하는 웹 MVP.

---

## 관련 문서

| 문서 | 설명 |
|---|---|
| `docs/01_기획서_v3.0.md` | 기획 원본 |
| `docs/02_API_v3.0.md` | 유일한 API 문서 |
| `docs/07_DECISIONS.md` | 기술 결정 이력 |
| `docs/08_FLOW.md` | 전체 플로우 |

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | NestJS (TypeScript) |
| DB | Supabase (PostgreSQL) — **ORM 없음**, @supabase/supabase-js 직접 사용 |
| 인증 | 카카오 OAuth2 + 자체 JWT |
| AI | Anthropic Claude API |
| 결제 | 미정 (토스페이먼츠 등) |
| 인프라 | Render |

---

## 폴더 구조

```
src/
  ├── main.ts
  ├── app.module.ts
  │
  ├── auth/                     ← POST /auth/kakao, POST /auth/onboarding
  │   ├── auth.module.ts
  │   ├── auth.controller.ts
  │   ├── auth.service.ts
  │   ├── jwt.strategy.ts
  │   └── dto/
  │       ├── kakao-login.dto.ts
  │       └── onboarding.dto.ts
  │
  ├── users/                    ← /users/me
  │   ├── users.module.ts
  │   ├── users.controller.ts
  │   ├── users.service.ts
  │   └── dto/
  │       └── update-user.dto.ts
  │
  ├── finance/                  ← /finance/profile
  │   ├── finance.module.ts
  │   ├── finance.controller.ts
  │   ├── finance.service.ts
  │   ├── variable-cost.calculator.ts  ← 변동비 계산
  │   ├── grade.calculator.ts          ← 투자 체급 판정
  │   └── dto/
  │       └── update-profile.dto.ts
  │
  ├── simulation/               ← POST /simulation/calculate (비로그인)
  │   ├── simulation.module.ts
  │   ├── simulation.controller.ts
  │   ├── simulation.service.ts
  │   └── dto/
  │       └── simulation.dto.ts
  │
  ├── pacemaker/                ← /pacemaker/*
  │   ├── pacemaker.module.ts
  │   ├── pacemaker.controller.ts
  │   ├── pacemaker.service.ts
  │   ├── message.generator.ts ← Claude API → 일일 메시지
  │   └── dto/
  │       └── feedback.dto.ts
  │
  ├── book/                     ← /book/*
  │   ├── book.module.ts
  │   ├── book.controller.ts
  │   ├── book.service.ts
  │   ├── report.generator.ts  ← AI 상세/주간 리포트
  │   ├── scraper.service.ts   ← 외부 URL 메타/AI 요약
  │   └── dto/
  │       ├── create-weekly-report.dto.ts
  │       ├── create-scrap.dto.ts
  │       └── generate-report.dto.ts
  │
  ├── payment/                  ← 결제 처리 (스텁)
  │   ├── payment.module.ts
  │   └── payment.service.ts
  │
  ├── constants/                ← GET /constants
  │   ├── constants.module.ts
  │   ├── constants.controller.ts
  │   └── constants.service.ts
  │
  └── common/
      ├── supabase/
      │   ├── supabase.module.ts
      │   └── supabase.service.ts
      ├── decorators/
      │   └── current-user.decorator.ts
      ├── filters/
      │   └── http-exception.filter.ts
      ├── guards/
      │   └── jwt-auth.guard.ts
      └── interceptors/
          └── response.interceptor.ts
```

---

## 핵심 비즈니스 로직

### 1. 변동비 계산 (variable-cost.calculator.ts)

```typescript
function calculateVariableCost(monthlyIncome: number, monthlyFixedCost: number) {
  const monthly = monthlyIncome - monthlyFixedCost;
  return {
    monthly,
    weekly: Math.floor(monthly / 4.3),
    daily: Math.floor(monthly / 30),
  };
}
```

### 2. 투자 체급 (신호등)

```typescript
function calculateGrade(monthlyIncome: number, monthlyVariableCost: number): Grade {
  const ratio = monthlyVariableCost / monthlyIncome;
  if (ratio > 0.70) return 'RED';      // 소비케어 집중
  if (ratio > 0.40) return 'YELLOW';   // 투자준비
  return 'GREEN';                       // 투자실습
}
```

### 3. 페이스메이커 메시지 생성

```
GET /pacemaker/today:
  1. 오늘 날짜로 DB 조회 → 있으면 캐시 반환
  2. 없으면 AI 생성:
     - 참조: 투자 체급, AI 상세 리포트, 유저 스크랩, system_config, 날짜/요일, 전날 행동 완료 여부
     - Claude API 프롬프트 (데이터 직접 삽입, AI는 메시지/행동만 작성)
     - 금지 표현 필터링 + 면책 문구 자동 삽입
  3. DB 저장 + 반환
  하루 2회 제한 (기본 1회 + 새로고침 1회)
```

### 4. AI 상세 리포트

```
최초 로그인 시: 자동 생성 (무료)
투자 체급 수정 후 재생성: 유료 결제 확인 → 생성
  → 투자 체급 세팅값 + 환경 세팅값(system_config) 기반
  → Claude API로 상세 분석 생성
  → DB 저장
```

### 5. 외부 URL 스크랩

```
POST /book/scraps { url }:
  1. URL에서 채널 자동 감지 (youtube/threads/instagram/other)
  2. 메타데이터 추출 (제목, 크리에이터)
  3. AI 요약: youtube/other → Claude API, threads/instagram → 전문 텍스트
  4. DB 저장 + scrap_count 증가
```

### 6. 주간 리포트

```
POST /book/weekly-reports { weekStatus }:
  유저 입력 + 이번 주 페이스메이커 메시지 + system_config
  → Claude API → 가이드 생성 → DB 저장
```

### 7. 6개월 업데이트 유도

```
GET /finance/profile:
  lastUpdated가 6개월 이전이면 isStale: true
```

---

## DB 테이블

| 테이블 | 설명 |
|---|---|
| `users` | 유저 (카카오 ID, 이메일, 닉네임, 마케팅 동의) |
| `finance_profiles` | 투자 체급 (나이, 실수령액, 고정비, 수익률, 투자기간, 변동비, 등급) |
| `pacemaker_messages` | 일일 메시지 (user_id, date, message, grade, actions JSON) |
| `pacemaker_actions` | 추천 행동 (message_id, action_id, status, completed_at) |
| `pacemaker_feedback` | 피드백 (message_id, type, content) |
| `detailed_reports` | AI 상세 리포트 (title, content, pdf_url, is_free) |
| `weekly_reports` | 주간 리포트 (week_start, user_input JSON, guide, weekly_stats JSON) |
| `external_scraps` | 외부 스크랩 (url, channel, creator, title, ai_summary, scrap_count) |
| `learn_contents` | 학습 콘텐츠 (slug, title, content, grade, read_minutes) |
| `user_content_reads` | 읽음 기록 |
| `user_content_scraps` | 학습 스크랩 |
| `report_payments` | 결제 이력 (user_id, report_id, amount, status) |
| `system_config` | 운영 상수 |

---

## 환경변수

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
JWT_EXPIRES_IN=7d
KAKAO_CLIENT_ID=
KAKAO_CLIENT_SECRET=
ANTHROPIC_API_KEY=
PORT=3001
NODE_ENV=production
```

---

## 개발 규칙

1. **ORM 금지** — Supabase 클라이언트 직접 사용
2. **금액은 원(₩) 정수**
3. **system_config 하드코딩 금지**
4. **페이스메이커 하루 2회 제한** (기본 1 + 새로고침 1)
5. **AI가 수치 만들지 않게** — 데이터 직접 삽입, AI는 분석/서술만
6. **금지 표현 필터링** — 확정 투자 권유 등 자동 차단

---

*머니런 백엔드 CLAUDE.md v3.0 — 2026.04.03*
