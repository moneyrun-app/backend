# CLAUDE.md — 머니런 백엔드

> Claude Code가 이 프로젝트를 이해하기 위한 메인 문서. **코드 작성 전 반드시 읽을 것.**

---

## 프로젝트 개요

**머니런(MoneyRun)** — 초개인화 온보딩(관심 분야 선택 → 진단퀴즈 → 데이터 입력 → AI 마이북 생성)으로 코스 배정 후, 강의·미션·퀴즈·복습 루프 + 페이스메이커 코칭으로 재방문 유도하는 금융 학습 웹 MVP.

### 핵심 루프

```
온보딩 5단계 → 코스 배정(예: 연금 기초) → AI 개인화 마이북 생성
  ↓
홈(페이스메이커): 코스 진도 기반 코칭 + 데일리 퀴즈(코스 범위)
메뉴(마이북): 강의 읽기 + 커스텀 미션 수행
머니북(서점): 추가 책 구매 (코스와 별도 공존)
```

---

## 관련 문서

| 문서 | 설명 |
|---|---|
| `docs/기획서_v3.0_2026-04-15.md` | v3.0 전체 기획서 (코스 시스템) |
| `docs/프론트엔드_전달사항_2026-04-15.md` | 프론트엔드 API 명세 + 페이지 가이드 |
| `migrations/v3.2_2026-04-16_quiz_schema.sql` | v3.2 퀴즈 스키마 개선 (구분코드, 3단계 난이도, 힌트, 통계) |
| `migrations/v3.0_2026-04-15_courses.sql` | v3.0 DB 마이그레이션 SQL |
| `migrations/v2.0_2026-04-11.sql` | v2.0 DB 마이그레이션 SQL (이전) |

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
  ├── auth/                     ← POST /auth/kakao, POST /auth/onboarding (v2 레거시)
  │   ├── auth.module.ts
  │   ├── auth.controller.ts
  │   ├── auth.service.ts
  │   ├── jwt.strategy.ts
  │   └── dto/
  │       ├── kakao-login.dto.ts
  │       └── onboarding.dto.ts  (v2 레거시 8개 필드)
  │
  ├── course/                   ← v3 코스 시스템 (신규)
  │   ├── course.module.ts
  │   ├── course.controller.ts         (코스 조회/시작/완료)
  │   ├── course.service.ts            (코스 CRUD + user_courses 관리)
  │   ├── onboarding.controller.ts     (v3 5단계 온보딩 엔드포인트)
  │   ├── onboarding.service.ts        (단계별 로직 + 이어하기)
  │   ├── course-book.generator.ts     (AI 코스 마이북 생성)
  │   ├── mission.service.ts           (미션 CRUD + 완료 추적)
  │   ├── diagnostic.service.ts        (진단퀴즈 + 레벨 배정)
  │   └── dto/
  │       ├── select-category.dto.ts
  │       ├── submit-diagnostic.dto.ts
  │       ├── submit-finance-data.dto.ts
  │       └── complete-mission.dto.ts
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
  │   ├── pacemaker.controller.ts  (v3: 코스 진도 기반)
  │   ├── pacemaker.service.ts     (코스 컨텍스트 + 출석 정보)
  │   └── message.generator.ts     (코스 미션/진도 반영 AI 메시지)
  │
  ├── quiz/                     ← 퀴즈 + 출석 + 난이도 + 스크랩
  │   ├── quiz.module.ts
  │   ├── quiz.controller.ts    (출석/난이도/스크랩 엔드포인트)
  │   ├── quiz.service.ts       (v3: 코스 카테고리 기반 필터링)
  │   └── dto/
  │       └── answer-quiz.dto.ts
  │
  ├── money-book/               ← 머니북 (서점) — 코스와 공존
  │   ├── money-book.module.ts
  │   ├── money-book.controller.ts     (GET 목록, GET 상세, POST 구매)
  │   ├── money-book.service.ts        (AI 개인화 책 생성)
  │   ├── admin-money-book.controller.ts (어드민 CRUD)
  │   └── dto/
  │
  ├── my-book/                  ← 마이북 (내 서재)
  │   ├── my-book.module.ts
  │   ├── my-book.controller.ts (overview, 책 열람, 하이라이트, 스크랩)
  │   ├── my-book.service.ts    (v3: 코스 책 + 서점 책 + 스크랩 책 통합)
  │   └── dto/
  │
  ├── book/                     ← 상세리포트 + 외부 URL 스크랩 (유지)
  │   ├── book.service.ts
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

### 1. 온보딩 (v3 — 5단계, 이어하기 가능)

```
Step 1: POST /course/onboarding/step1
  → 관심 분야 선택 (연금/주식/부동산/세금_연말정산/소비_저축)

Step 2: GET  /course/onboarding/step2/questions → 진단퀴즈 10문제
        POST /course/onboarding/step2
  → 답변 제출 → 가중 점수로 코스 레벨 배정
    ≤30%: 기초 / ≤70%: 심화 / >70%: 마스터

Step 3: POST /course/onboarding/step3
  → 재무 데이터 8개 필드 + 코스별 추가 데이터 입력
  → finance_profiles 생성, 등급 계산

Step 4: POST /course/onboarding/step4/generate
        GET  /course/onboarding/step4/status (폴링)
  → AI 개인화 마이북(5챕터) + 챕터별 미션 자동 생성
  → user_purchases(source: 'course')에 저장

Step 5: POST /course/onboarding/step5/complete
  → 온보딩 완료 + 페이스메이커 웰컴 메시지

이어하기: onboarding_progress 테이블에 유저별 진행 상태 저장.
  GET /course/onboarding/status → 현재 단계 반환 → 프론트가 해당 단계부터 재개.
```

### 2. 코스 시스템

```
5카테고리 × 3레벨 = 15개 코스
  카테고리: 연금, 주식, 부동산, 세금_연말정산, 소비_저축
  레벨: 기초, 심화, 마스터

1인 1활성 코스 — user_courses에서 status='active'인 코스 1개만 허용
코스 완료 → 다음 레벨 또는 다른 카테고리 선택 가능

코스 = 마이북(강의) + 미션 + 코스 범위 퀴즈
  GET /course/active: 활성 코스 + 진행 상황
  POST /course/:id/start: 새 코스 시작
  POST /course/active/complete: 코스 완료
```

### 3. 미션 시스템

```
course_missions: 챕터별 미션 2~3개
  type: 'action' (행동) / 'read' (읽기) / 'calculate' (계산)
  예: "이번 달 연금 납부 내역 확인하기", "3장 핵심 내용 다시 읽기"

GET /course/active/missions: 전체 미션 + 완료 상태
POST /course/missions/:id/complete: 미션 완료 처리
→ 페이스메이커가 미션 진행 상황 참조하여 코칭
```

### 4. 변동비 계산 (variable-cost.calculator.ts)

```typescript
function calculateVariableCost(monthlyIncome, monthlyFixedCost, monthlyInvestment = 0) {
  const monthly = floor1000(monthlyIncome - monthlyFixedCost - monthlyInvestment);
  const daily = floor1000(monthly / daysInMonth);
  const weekly = floor1000(daily * 7);
}
```

### 5. 투자 체급 (신호등)

```typescript
// expenseRatio = (고정비 + 변동비) / 실수령액  (투자액은 포함 안 함)
RED:    ≥ 70%  → 소비케어 집중
YELLOW: ≥ 50%  → 투자준비
GREEN:  < 50%  → 투자실습
```

### 6. 페이스메이커 (v3 — 코스 진도 기반)

```
GET /pacemaker/today:
  1. DB 캐시 확인 → 있으면 반환
  2. 없으면:
     a. 유저 재무 프로필 + 등급 조회
     b. 활성 코스 조회 (현재 챕터, 미션 진행률)
     c. AI 메시지 생성 (5카드)
        - 기존: 요일 테마 + 등급별 톤
        - 추가: 코스 진도/미션 참조 (카드 1장은 코스 관련)
  3. todayQuiz: 코스 카테고리 기반 1문제
  4. attendance: { checkedToday, currentStreak, totalDays }
  하루 2회 제한
```

### 7. 퀴즈/출석 시스템 (v3.2 — 코스 스코핑 + 구분코드/통계)

```
퀴즈 필수 필드:
  quiz_code: Q00001 형식 (자동 채번, UNIQUE)
  difficulty_level: 1=초급, 2=심화, 3=마스터 (3단계)
  question, choices(JSONB), correct_answer(1-indexed)
  hint: 힌트 텍스트
  source: 퀴즈 출처
  total_attempts / correct_count / correct_rate: 일배치 집계
    → SELECT refresh_quiz_stats(); 으로 갱신

데일리 퀴즈 선택 로직:
  1. 유저 활성 코스 확인 → course_category 획득
  2. quizzes에서 course_category + difficulty_level 필터
  3. 30% 확률: 오답노트 복습 (course_category 필터 적용)
  4. 70% 확률: 새 퀴즈
  5. 코스 없으면: 기존 전체 카테고리 로직 (하위 호환)

POST /quiz/:id/answer:
  1. 정답/오답 판정 + 오답노트 저장
  2. 출석체크 자동 (attendance_records)
  3. 뱃지 체크 (7일/30일/180일 연속, 30일/100일 누적)
  4. 난이도 변경 제안 (suggestLevelChange: up/down/null)

quizzes 테이블에 course_category 컬럼:
  기존 category(자유 텍스트) → course_category(5개 코스 카테고리로 매핑)
```

### 8. 머니북 (서점) — 코스와 공존

```
서점은 기존 그대로 유지. 코스 마이북과는 별개.
GET /money-book: 카테고리별 책 목록 (isPurchased 포함)
GET /money-book/:id: 상세 + 챕터 미리보기 + requiredFields
POST /money-book/:id/purchase: 추가 온보딩 → AI 개인화 책 비동기 생성
```

### 9. 마이북 (내 서재)

```
GET /my-book/overview: 머니레터 — 코스 책(source:'course') + 서점 책(source:'store') + 스크랩 책(source:'scrap') 통합
GET /my-book/books/:id: 개인화된 책 열람 + 하이라이트
POST/DELETE 하이라이트: 문장별 컬러 스크랩 (5색)
GET /my-book/scraps: URL + 퀴즈 스크랩 통합
POST /my-book/generate-from-scraps: 100개 이상 → AI 맞춤 책 생성
```

### 10. 외부 URL 스크랩

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

### 기존 유지
| 테이블 | 설명 |
|---|---|
| `users` | 유저 (+quiz_level, +onboarding_version) |
| `finance_profiles` | 투자 체급 (+monthly_investment) |
| `pacemaker_messages` | 일일 메시지 (+course_id, +course_chapter, +mission_context) |
| `pacemaker_feedback` | 피드백 |
| `detailed_reports` | AI 상세 리포트 (머니레터) |
| `external_scraps` | 외부 URL 스크랩 |
| `quizzes` | 퀴즈 (+quiz_code, +difficulty_level 3단계, +hint, +course_category, +total_attempts/correct_count/correct_rate) |
| `quiz_answers` | 퀴즈 답변 |
| `wrong_notes` | 오답 노트 |
| `badges` | 뱃지 정의 |
| `user_badges` | 유저 뱃지 |
| `user_glossaries` | 용어사전 |
| `system_config` | 운영 상수 |
| `report_payments` | 결제 이력 (스텁) |
| `attendance_records` | 출석체크 (user_id + date UNIQUE) |
| `money_books` | 머니북 책 템플릿 |
| `money_book_chapters` | 챕터 템플릿 (prompt_template) |
| `user_purchases` | 유저 구매 + AI 개인화 결과 (source: store/scrap/course) |
| `user_book_highlights` | 문장별 컬러 하이라이트 (5색) |
| `user_quiz_scraps` | 퀴즈 스크랩 |

### 신규 (v3 — 코스 시스템)
| 테이블 | 설명 |
|---|---|
| `courses` | 코스 정의 (5카테고리 × 3레벨, UNIQUE(category, level)) |
| `user_courses` | 유저-코스 연결 (1인 1활성 코스, partial unique index) |
| `course_missions` | 챕터별 미션 (action/read/calculate) |
| `user_mission_completions` | 미션 수행 이력 |
| `onboarding_progress` | v3 온보딩 단계별 진행 상태 (이어하기 지원, user_id UNIQUE) |
| `diagnostic_quizzes` | 진단퀴즈 풀 (카테고리별 10문제, difficulty_weight 가중) |

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
5. **퀴즈 하루 1문제** — 코스 카테고리 범위, 정답/오답 무관 출석 인정
6. **AI가 수치 만들지 않게** — 데이터 직접 삽입, AI는 분석/서술만
7. **금지 표현 필터링** — 확정 투자 권유 등 자동 차단
8. **커밋/배포는 유저 지시 시에만**
9. **1인 1활성 코스** — 완료 후 다음 코스 전환
10. **온보딩 이어하기 보장** — onboarding_progress에 단계별 저장, 중간 이탈 시 재개 가능
11. **코스와 서점 공존** — 코스 마이북(source:'course')과 서점 구매(source:'store')는 독립

---

*머니런 백엔드 CLAUDE.md v5.0 — 2026.04.15*
