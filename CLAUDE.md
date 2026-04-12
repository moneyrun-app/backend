# CLAUDE.md — 머니런 백엔드

> Claude Code가 이 프로젝트를 이해하기 위한 메인 문서. **코드 작성 전 반드시 읽을 것.**

---

## 프로젝트 개요

**머니런(MoneyRun)** — 비로그인 시뮬레이션 → 로그인 후 AI 개인화 금융 콘텐츠(머니북) + 매일 퀴즈/코칭(페이스메이커)으로 재방문 유도하는 웹 MVP.

---

## 관련 문서

| 문서 | 설명 |
|---|---|
| `docs/기획서_v2.0_2026-04-11.md` | v2.0 전체 기획서 |
| `docs/프론트엔드_전달사항_2026-04-11.md` | 프론트엔드 API 명세 + 페이지 가이드 |
| `migrations/v2.0_2026-04-11.sql` | DB 마이그레이션 SQL |

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프레임워크 | NestJS (TypeScript) |
| DB | Supabase (PostgreSQL) — **ORM 없음**, @supabase/supabase-js 직접 사용 |
| 인증 | 카카오 OAuth2 + 자체 JWT |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| 유튜브 자막 | youtube-transcript (MVP) → 추후 YouTube Data API v3 |
| 결제 | 무료 (추후 카카오페이) |
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
  │       └── onboarding.dto.ts  (8개 필드: +monthlyInvestment)
  │
  ├── users/                    ← /users/me
  │
  ├── finance/                  ← /finance/profile
  │   ├── finance.service.ts    (availableBudget 추가)
  │   ├── variable-cost.calculator.ts  (투자액 반영)
  │   ├── grade.calculator.ts
  │   └── dto/
  │       └── update-profile.dto.ts  (+monthlyInvestment)
  │
  ├── simulation/               ← POST /simulation/calculate (비로그인)
  │
  ├── pacemaker/                ← /pacemaker/today, /pacemaker/feedback
  │   ├── pacemaker.controller.ts  (v2: 트랙타일 삭제됨)
  │   ├── pacemaker.service.ts     (출석 정보 포함)
  │   └── message.generator.ts     (투자액 데이터 반영)
  │
  ├── quiz/                     ← 퀴즈 + 출석 + 난이도 + 스크랩
  │   ├── quiz.module.ts
  │   ├── quiz.controller.ts    (v2: 출석/난이도/스크랩 엔드포인트)
  │   ├── quiz.service.ts       (v2: getTodayQuiz, submitAnswerV2, 출석/뱃지)
  │   └── dto/
  │       └── answer-quiz.dto.ts
  │
  ├── money-book/               ← 머니북 (서점) — 신규
  │   ├── money-book.module.ts
  │   ├── money-book.controller.ts     (GET 목록, GET 상세, POST 구매)
  │   ├── money-book.service.ts        (AI 개인화 책 생성)
  │   ├── admin-money-book.controller.ts (어드민 CRUD)
  │   └── dto/
  │
  ├── my-book/                  ← 마이북 (내 서재) — 신규
  │   ├── my-book.module.ts
  │   ├── my-book.controller.ts (overview, 책 열람, 하이라이트, 스크랩)
  │   ├── my-book.service.ts    (머니레터, 스크랩 기반 책 생성)
  │   └── dto/
  │
  ├── book/                     ← 상세리포트 + 외부 URL 스크랩 (유지)
  │   ├── book.service.ts       (월간리포트/학습콘텐츠 삭제됨)
  │   ├── scraper.service.ts    (유튜브: youtube-transcript 자막 기반 요약)
  │   └── report.generator.ts
  │
  ├── admin/                    ← 어드민 API
  ├── statistics/               ← 또래 비교
  ├── constants/                ← 시스템 상수
  ├── payment/                  ← 결제 (스텁)
  │
  └── common/
      ├── supabase/
      ├── decorators/
      ├── filters/
      ├── guards/              (jwt-auth.guard + admin.guard)
      └── interceptors/
```

---

## 핵심 비즈니스 로직

### 1. 변동비 계산 (variable-cost.calculator.ts)

```typescript
function calculateVariableCost(monthlyIncome, monthlyFixedCost, monthlyInvestment = 0) {
  const monthly = floor1000(monthlyIncome - monthlyFixedCost - monthlyInvestment);
  const daily = floor1000(monthly / daysInMonth);
  const weekly = floor1000(daily * 7);
}
```

### 2. 투자 체급 (신호등)

```typescript
// expenseRatio = (고정비 + 변동비) / 실수령액  (투자액은 포함 안 함)
RED:    ≥ 70%  → 소비케어 집중
YELLOW: ≥ 50%  → 투자준비
GREEN:  < 50%  → 투자실습
```

### 3. 페이스메이커 (v2)

```
GET /pacemaker/today:
  1. DB 캐시 확인 → 있으면 반환
  2. 없으면 AI 메시지 생성 (투자액 반영)
  3. todayQuiz: 1문제 (유저 레벨 기반, 이미 풀었으면 null)
  4. attendance: { checkedToday, currentStreak, totalDays }
  하루 2회 제한
```

### 4. 퀴즈/출석 시스템 (v2)

```
POST /quiz/:id/answer:
  1. 정답/오답 판정 + 오답노트 저장
  2. 출석체크 자동 (attendance_records)
  3. 뱃지 체크 (7일/30일/180일 연속, 30일/100일 누적)
  4. 난이도 변경 제안 (suggestLevelChange: up/down/null)

PATCH /quiz/level: 난이도 1~5 변경
POST /quiz/:id/scrap: 퀴즈 북마크 토글
```

### 5. 머니북 (서점)

```
GET /money-book: 카테고리별 책 목록 (isPurchased 포함)
GET /money-book/:id: 상세 + 챕터 미리보기 + requiredFields
POST /money-book/:id/purchase: 추가 온보딩 → AI 개인화 책 비동기 생성
  → 챕터별 prompt_template에 {{placeholder}} 치환 → Claude API
  → user_purchases.personalized_chapters에 저장
```

### 6. 마이북 (내 서재)

```
GET /my-book/overview: 머니레터 (상세리포트 + 구매한 책 + 스크랩 수)
GET /my-book/books/:id: 개인화된 책 열람 + 하이라이트
POST/DELETE 하이라이트: 문장별 컬러 스크랩 (5색)
GET /my-book/scraps: URL + 퀴즈 스크랩 통합
POST /my-book/generate-from-scraps: 100개 이상 → AI 맞춤 책 생성
```

### 7. 외부 URL 스크랩

```
POST /book/scraps { url }:
  1. 채널 감지 (youtube/threads/instagram/other)
  2. 메타데이터 추출
  3. 유튜브: youtube-transcript로 자막 추출 → Claude 요약
     일반: URL + 제목 기반 Claude 요약
  4. DB 저장
```

---

## DB 테이블

### 유지
| 테이블 | 설명 |
|---|---|
| `users` | 유저 (+quiz_level) |
| `finance_profiles` | 투자 체급 (+monthly_investment) |
| `pacemaker_messages` | 일일 메시지 |
| `pacemaker_feedback` | 피드백 |
| `detailed_reports` | AI 상세 리포트 (머니레터) |
| `external_scraps` | 외부 URL 스크랩 |
| `quizzes` | 퀴즈 (+difficulty_level) |
| `quiz_answers` | 퀴즈 답변 |
| `wrong_notes` | 오답 노트 |
| `badges` | 뱃지 정의 |
| `user_badges` | 유저 뱃지 |
| `user_glossaries` | 용어사전 |
| `system_config` | 운영 상수 |
| `report_payments` | 결제 이력 (스텁) |

### 신규 (v2)
| 테이블 | 설명 |
|---|---|
| `attendance_records` | 출석체크 (user_id + date UNIQUE) |
| `money_books` | 머니북 책 템플릿 |
| `money_book_chapters` | 챕터 템플릿 (prompt_template) |
| `user_purchases` | 유저 구매 + AI 개인화 결과 (source: store/scrap) |
| `user_book_highlights` | 문장별 컬러 하이라이트 (5색) |
| `user_quiz_scraps` | 퀴즈 스크랩 |

### 삭제됨 (v2)
daily_checks, weekly_summaries, monthly_finalizations, monthly_snapshots, monthly_reports, learn_contents, user_content_reads, user_content_scraps

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
5. **퀴즈 하루 1문제** — 정답/오답 무관 출석 인정
6. **AI가 수치 만들지 않게** — 데이터 직접 삽입, AI는 분석/서술만
7. **금지 표현 필터링** — 확정 투자 권유 등 자동 차단
8. **커밋/배포는 유저 지시 시에만**

---

*머니런 백엔드 CLAUDE.md v4.0 — 2026.04.11*
