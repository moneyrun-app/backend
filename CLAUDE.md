# CLAUDE.md — 머니런 백엔드

> Claude Code가 이 프로젝트를 이해하기 위한 메인 문서.
> **코드 작성 전 반드시 읽을 것.**

---

## 프로젝트 개요

**머니런(MoneyRun)** — AI가 매일 내 돈 관리를 잔소리해주는 금융 코칭 서비스.
MVP는 **페이스메이커 + 마이북** 2가지 핵심에 집중. 3페이지(홈/마이북/마이페이지).

---

## 관련 문서

| 문서 | 설명 |
|---|---|
| `docs/01_머니런_프로덕트_기획서_v2.0.md` | 기획 원본 |
| `docs/02_머니런_API_통합_명세서_v2.0.md` | 유일한 API 문서 |
| `docs/03_머니런_전체_플로우_정의서_v2.0.md` | 유저 여정 + 데이터 흐름 |
| `docs/07_머니런_기술결정사항_DECISIONS.md` | 기술 결정 이력 |
| `docs/CHANGELOG.md` | 문서 버전 변경 이력 |

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | NestJS (TypeScript) |
| DB | Supabase (PostgreSQL) — **ORM 없음**, @supabase/supabase-js 직접 사용 |
| 인증 | 카카오 OAuth2 + 자체 JWT |
| AI | Anthropic Claude API (페이스메이커 메시지 + 리포트 생성) |
| 인프라 | Render |

---

## 폴더 구조

```
src/
  ├── main.ts
  ├── app.module.ts
  │
  ├── auth/                     ← POST /auth/kakao
  │   ├── auth.module.ts
  │   ├── auth.controller.ts
  │   ├── auth.service.ts
  │   ├── jwt.strategy.ts
  │   └── dto/
  │
  ├── users/                    ← GET/PATCH/DELETE /users/me
  │   ├── users.module.ts
  │   ├── users.controller.ts
  │   └── users.service.ts
  │
  ├── onboarding/               ← POST /onboarding
  │   ├── onboarding.module.ts
  │   ├── onboarding.controller.ts
  │   ├── onboarding.service.ts
  │   └── dto/
  │
  ├── finance/                  ← /finance/profile, /finance/good-spendings, /finance/fixed-expenses
  │   ├── finance.module.ts
  │   ├── finance.controller.ts
  │   ├── finance.service.ts
  │   ├── surplus.calculator.ts ← 잉여자금 계산 핵심 로직
  │   ├── grade.calculator.ts   ← 등급 판정 로직
  │   └── dto/
  │
  ├── pacemaker/                ← GET /pacemaker/today, /pacemaker/history
  │   ├── pacemaker.module.ts
  │   ├── pacemaker.controller.ts
  │   ├── pacemaker.service.ts
  │   └── message.generator.ts ← Claude API 호출 → 일일 메시지 생성
  │
  ├── book/                     ← /book/detailed-reports, /book/weekly-reports, /book/learn, /book/scraps
  │   ├── book.module.ts
  │   ├── book.controller.ts
  │   ├── book.service.ts
  │   └── report.generator.ts  ← AI 리포트 생성
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
          └── response.interceptor.ts  ← { success, data } 래핑
```

---

## DB 테이블

| 테이블 | 설명 |
|---|---|
| `users` | 유저 기본 (카카오 ID, 이메일, 닉네임, 온보딩 완료 여부) |
| `finance_profiles` | 재무 프로필 (나이, 월 실수령액) |
| `good_spendings` | 좋은 소비 — 유저별 복수 행 (type, label, amount) |
| `fixed_expenses` | 고정 소비 — 유저별 1행 (rent, utilities, phone) |
| `pacemaker_messages` | 일일 메시지 (user_id, date, message, grade, actions JSON) |
| `detailed_reports` | AI 상세 리포트 (title, content, grade) |
| `weekly_reports` | AI 주간 리포트 (week_start, summary, guide) |
| `learn_contents` | 학습 콘텐츠 (slug, title, content, grade, read_minutes) |
| `user_content_reads` | 읽음 기록 (user_id, content_id) |
| `user_content_scraps` | 스크랩 기록 (user_id, content_id) |
| `system_config` | 운영 상수 (key, value) |

---

## 핵심 비즈니스 로직

### 1. 인증

```
NextAuth → 카카오 토큰 → POST /auth/kakao { accessToken }
→ 카카오 API로 유저 확인 → DB 조회/생성 → NestJS JWT 발급
```

### 2. 잉여자금 계산 (surplus.calculator.ts)

```typescript
function calculateSurplus(monthlyIncome: number, goodSpendings: GoodSpending[], fixedExpenses: FixedExpenses) {
  const goodTotal = goodSpendings.reduce((sum, g) => sum + g.amount, 0);
  const fixedTotal = fixedExpenses.rent + fixedExpenses.utilities + fixedExpenses.phone;

  const monthly = monthlyIncome - goodTotal - fixedTotal;
  const weekly = Math.floor(monthly / 4.3);
  const daily = Math.floor(monthly / 30);

  return { monthly, weekly, daily };
}
```

### 3. 등급 판정 (grade.calculator.ts)

```typescript
function calculateGrade(monthlyIncome: number, goodSpendingTotal: number): Grade {
  if (goodSpendingTotal === 0) return 'RED';
  const ratio = goodSpendingTotal / monthlyIncome;
  if (ratio < 0.10) return 'RED';
  if (ratio < 0.20) return 'YELLOW';
  return 'GREEN';
}
```

### 4. 페이스메이커 메시지 생성 (message.generator.ts)

```
GET /pacemaker/today 호출 시:
  1. 오늘 날짜로 pacemaker_messages 조회
  2. 이미 있으면 → 캐시된 메시지 반환
  3. 없으면 → AI 생성:
     a. 참조 데이터 수집 (재무 프로필, 리포트, 스크랩, system_config, 날짜)
     b. Claude API 프롬프트 구성 (데이터 직접 삽입, AI는 메시지 작성만)
     c. 메시지 + 추천 행동(actions) 생성
     d. pacemaker_messages에 저장
     e. 반환
```

### 5. 상세 리포트 생성 (프로필 변경 트리거)

재무 프로필 변경 시 → 30일 경과 확인 → AI 리포트 생성 → DB 저장

### 6. 주간 리포트 생성 (유저 입력 기반)

유저 입력 (체감 + 메모) → 참조 데이터 수집 → Claude API → 가이드 생성

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
NODE_ENV=development
```

---

## 개발 규칙

1. **ORM 금지** — Supabase 클라이언트 직접 사용
2. **금액은 원 정수** — 2300000 (O), 230 (X)
3. **system_config 하드코딩 금지** — DB에서 조회
4. **페이스메이커 메시지는 하루 1번 생성** — 같은 날 재조회 시 캐시 반환
5. **AI가 수치를 만들지 않게** — 수치는 직접 삽입, AI는 분석/서술만
6. **공통 응답 형식** — `{ success: true, data }` / `{ success: false, message, code }`

---

*머니런 백엔드 CLAUDE.md v2.0 — 2026.04.02*
