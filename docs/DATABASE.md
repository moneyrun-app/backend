# 머니런 데이터베이스 구조 & 데이터 흐름

> Supabase (PostgreSQL) | ORM 없이 @supabase/supabase-js 직접 사용

---

## 테이블 전체 목록 (18개)

| # | 테이블 | 설명 | 주요 키 |
|---|---|---|---|
| 1 | `users` | 유저 계정 | kakao_id (unique) |
| 2 | `finance_profiles` | 재무 프로필 | user_id (unique) |
| 3 | `pacemaker_messages` | 일일 AI 메시지 | user_id + date (unique) |
| 4 | `pacemaker_feedback` | 메시지 피드백 | message_id + user_id |
| 5 | `pacemaker_actions` | 추천 행동 | user_id |
| 6 | `daily_checks` | 일일 지출 체크 | user_id + date (unique) |
| 7 | `weekly_summaries` | 주간 요약 캐시 | user_id + week_start (unique) |
| 8 | `monthly_finalizations` | 월간 소비 확정 | user_id + month (unique) |
| 9 | `monthly_reports` | 월간 리포트 | user_id + month (unique) |
| 10 | `monthly_snapshots` | 월간 스냅샷 (전월 비교용) | user_id + month (unique) |
| 11 | `detailed_reports` | AI 상세 리포트 | user_id |
| 12 | `user_glossaries` | 금융 용어사전 (리포트 부산물) | user_id + report_id |
| 13 | `external_scraps` | 외부 URL 스크랩 | user_id + url |
| 14 | `learn_contents` | 학습 콘텐츠 (운영) | grade |
| 15 | `user_content_reads` | 콘텐츠 읽음 기록 | user_id + content_id (unique) |
| 16 | `user_content_scraps` | 콘텐츠 스크랩 | user_id + content_id |
| 17 | `quizzes` | 퀴즈 문제 (운영) | - |
| 18 | `quiz_answers` | 퀴즈 답변 | user_id + quiz_id |
| 19 | `wrong_notes` | 오답노트 | user_id + quiz_id |
| 20 | `badges` | 배지 정의 (운영) | code (unique) |
| 21 | `user_badges` | 유저 배지 획득 | user_id + badge_id + month (unique) |
| 22 | `report_payments` | 결제 이력 | user_id + report_id |
| 23 | `system_config` | 운영 상수 | key (unique) |

---

## 테이블별 컬럼 & 사용처

### `users`

```
id              UUID PK
kakao_id        BIGINT UNIQUE     ← 카카오 OAuth ID
nickname        TEXT
email           TEXT
marketing_consent  BOOLEAN
has_completed_onboarding  BOOLEAN
role            TEXT              ← 'user' | 'admin'
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| INSERT | POST /auth/kakao (신규) | auth.service.ts |
| SELECT | POST /auth/kakao (기존) | auth.service.ts |
| SELECT | GET /users/me | users.service.ts |
| SELECT | JWT 검증 시 | jwt.strategy.ts |
| UPDATE | POST /auth/onboarding (nickname, 온보딩 완료) | auth.service.ts |
| UPDATE | PATCH /finance/profile (nickname) | finance.service.ts |
| SELECT | GET /finance/profile (nickname 조회) | finance.service.ts |
| SELECT | GET /admin/users | admin.service.ts |
| SELECT | POST /pacemaker/monthly-finalize (가입일 조회) | pacemaker.service.ts |

---

### `finance_profiles`

```
id                      UUID PK
user_id                 UUID FK → users.id (UNIQUE)
age                     INT
retirement_age          INT
pension_start_age       INT
monthly_income          INT       ← 원 정수
monthly_fixed_cost      INT
monthly_variable_cost   INT
variable_cost_monthly   INT       ← 계산값
variable_cost_weekly    INT       ← 계산값
variable_cost_daily     INT       ← 계산값
grade                   TEXT      ← 'RED' | 'YELLOW' | 'GREEN'
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| INSERT | POST /auth/onboarding | auth.service.ts |
| SELECT | GET /finance/profile | finance.service.ts |
| UPDATE | PATCH /finance/profile | finance.service.ts |
| SELECT | (내부) 페이스메이커/리포트 생성 시 | finance.service.ts → getFullProfile() |

---

### `pacemaker_messages`

```
id                  UUID PK
user_id             UUID FK → users.id
date                DATE          ← KST 기준 (user_id + date UNIQUE)
message             TEXT          ← AI 생성 메시지
grade               TEXT
daily_variable_cost INT
spending_status     JSONB         ← { todayRemaining, weeklyRemaining, level }
quiz_ids            UUID[]        ← 오늘 배정 퀴즈 ID 목록
theme               TEXT          ← 요일별 테마
quote               TEXT          ← AI 생성 명언
disclaimer          TEXT
created_at          TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /pacemaker/today (캐시 조회) | pacemaker.service.ts |
| INSERT | GET /pacemaker/today (AI 생성 후) | pacemaker.service.ts |

---

### `pacemaker_feedback`

```
id          UUID PK
message_id  UUID FK → pacemaker_messages.id
user_id     UUID FK → users.id
type        TEXT      ← 'like' | 'dislike' | 'report'
content     TEXT
created_at  TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| INSERT | POST /pacemaker/feedback | pacemaker.service.ts |

---

### `daily_checks`

```
id          UUID PK
user_id     UUID FK → users.id
date        DATE          ← (user_id + date UNIQUE)
status      TEXT          ← 'under' | 'over'
amount      INT           ← 실제 지출 원 정수
created_at  TIMESTAMPTZ
updated_at  TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT + INSERT/UPDATE | POST /pacemaker/daily-check | pacemaker.service.ts |
| SELECT | GET /pacemaker/daily-checks | pacemaker.service.ts |
| SELECT | GET /pacemaker/weekly-summary | pacemaker.service.ts |
| SELECT | GET /pacemaker/today (어제/이번주 지출) | pacemaker.service.ts |
| SELECT | POST /book/monthly-reports (월간 통계) | monthly-report.collector.ts |

---

### `weekly_summaries`

```
id              UUID PK
user_id         UUID FK → users.id
week_start      DATE          ← (user_id + week_start UNIQUE)
week_end        DATE
days_tracked    INT
days_skipped    INT
days_under      INT
days_over       INT
total_spent     INT
adjusted_budget INT
spent_rate      NUMERIC
created_at      TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /pacemaker/weekly-summary (캐시 조회) | pacemaker.service.ts |
| UPSERT | GET /pacemaker/weekly-summary (지난 주면 저장) | pacemaker.service.ts |

---

### `monthly_finalizations`

```
id           UUID PK
user_id      UUID FK → users.id
month        TEXT          ← "YYYY-MM" (user_id + month UNIQUE)
expired      BOOLEAN       ← 소멸 여부
finalized_at TIMESTAMPTZ
created_at   TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /pacemaker/monthly-finalize-status | pacemaker.service.ts |
| SELECT | POST /pacemaker/daily-check (확정 차단) | pacemaker.service.ts |
| INSERT/UPSERT | POST /pacemaker/monthly-finalize | pacemaker.service.ts |
| UPDATE | POST /pacemaker/monthly-finalize (소멸 처리) | pacemaker.service.ts |
| DELETE | POST /pacemaker/monthly-finalize/cancel | pacemaker.service.ts |
| SELECT | GET /book/monthly-reports (pending 목록) | book.service.ts |
| SELECT | POST /book/monthly-reports (확정 확인) | book.service.ts |

---

### `monthly_reports`

```
id              UUID PK
user_id         UUID FK → users.id
month           DATE          ← "YYYY-MM-01" (DATE 타입, user_id + month UNIQUE)
summary         TEXT
guide           TEXT          ← 하위 호환용
user_input      JSONB         ← { overallFeeling, memo }
sections        JSONB         ← { spending, proposals, goals, learning, rewards }
badges_earned   JSONB         ← [{ code, name, icon }]
proposal_checks JSONB         ← [{ proposalId, checked }]
created_at      TIMESTAMPTZ
```

**주의:** month 컬럼이 DATE 타입이므로 "2026-04" → "2026-04-01"로 변환하여 조회/저장.

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /book/monthly-reports | book.service.ts |
| SELECT | GET /book/monthly-reports/:id | book.service.ts |
| INSERT | POST /book/monthly-reports | book.service.ts |
| SELECT | GET /pacemaker/monthly-finalize-status (리포트 존재 확인) | pacemaker.service.ts |
| SELECT | POST /pacemaker/monthly-finalize (소멸 판단) | pacemaker.service.ts |
| SELECT | POST /pacemaker/monthly-finalize/cancel (취소 가능 여부) | pacemaker.service.ts |

---

### `monthly_snapshots`

```
id                   UUID PK
user_id              UUID FK → users.id
month                TEXT          ← "YYYY-MM" (user_id + month UNIQUE)
monthly_income       INT
monthly_fixed_cost   INT
monthly_variable_cost INT
grade                TEXT
total_spent          INT
savings              INT
surplus              INT
fq_score             INT
days_tracked         INT
days_under           INT
days_over            INT
no_spend_days        INT
quiz_total           INT
quiz_correct         INT
best_streak          INT
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | POST /book/monthly-reports (전월 비교) | monthly-report.collector.ts |
| UPSERT | POST /book/monthly-reports (리포트 생성 후 저장) | monthly-report.collector.ts |

---

### `detailed_reports`

```
id              UUID PK
user_id         UUID FK → users.id
summary         TEXT
grade           TEXT
sections        JSONB         ← [{ section: "A"~"I", ... , ai_narrative }]
report_version  TEXT          ← "v6"
user_snapshot   JSONB         ← { nickname, age, income, ... }
is_free         BOOLEAN
created_at      TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| INSERT | POST /auth/onboarding (자동 생성) | book.service.ts |
| SELECT | GET /book/detailed-reports | book.service.ts |
| SELECT | GET /book/detailed-reports/:id | book.service.ts |
| SELECT | POST /book/monthly-reports (제안 항목 추출) | monthly-report.collector.ts |
| SELECT | GET /book/monthly-reports/proposals | monthly-report.collector.ts |

---

### `user_glossaries`

```
id          UUID PK
user_id     UUID FK → users.id
report_id   UUID FK → detailed_reports.id
terms       JSONB         ← [{ term, definition }]
grade       TEXT
created_at  TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| INSERT | POST /auth/onboarding (리포트 Section I 저장) | book.service.ts |

---

### `external_scraps`

```
id            UUID PK
user_id       UUID FK → users.id
url           TEXT
channel       TEXT          ← 'youtube' | 'threads' | 'instagram' | 'other'
creator       TEXT
content_date  TEXT
title         TEXT
ai_summary    TEXT
scrap_count   INT           ← 같은 URL 전체 스크랩 횟수
created_at    TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| INSERT | POST /book/scraps | book.service.ts |
| SELECT | GET /book/scraps | book.service.ts |
| DELETE | DELETE /book/scraps/:id | book.service.ts |
| UPDATE | POST /book/scraps (scrap_count 증가) | book.service.ts |
| SELECT | GET /pacemaker/today (최근 스크랩 참조) | pacemaker.service.ts |

---

### `learn_contents` (운영 데이터)

```
id            UUID PK
title         TEXT
content       TEXT          ← 마크다운 본문
grade         TEXT          ← 'RED' | 'YELLOW' | 'GREEN'
read_minutes  INT
created_at    TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /book/learn | book.service.ts |
| SELECT | GET /book/learn/:id | book.service.ts |

---

### `user_content_reads`

```
id          UUID PK
user_id     UUID FK → users.id
content_id  UUID FK → learn_contents.id    ← (user_id + content_id UNIQUE)
created_at  TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| UPSERT | GET /book/learn/:id (자동 읽음) | book.service.ts |
| SELECT | GET /book/learn (읽음 상태) | book.service.ts |

---

### `user_content_scraps`

```
id          UUID PK
user_id     UUID FK → users.id
content_id  UUID FK → learn_contents.id
created_at  TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT + INSERT/DELETE | POST /book/learn/:id/scrap (토글) | book.service.ts |
| SELECT | GET /book/learn (스크랩 상태) | book.service.ts |
| SELECT | GET /book/learn/:id (스크랩 여부) | book.service.ts |

---

### `quizzes` (운영 데이터)

```
id                      UUID PK
question                TEXT
choices                 JSONB       ← ["보기1", "보기2", "보기3", "보기4"]
correct_answer          INT         ← 1~4
brief_explanation       TEXT
detailed_explanation    TEXT
source                  TEXT
category                TEXT
created_at              TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /pacemaker/today (퀴즈 배정) | quiz.service.ts |
| SELECT | POST /pacemaker/quiz/:id/answer (정답 확인) | quiz.service.ts |
| SELECT | GET /admin/quizzes | admin.service.ts |

---

### `quiz_answers`

```
id          UUID PK
user_id     UUID FK → users.id
quiz_id     UUID FK → quizzes.id
user_answer INT
correct     BOOLEAN
created_at  TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /pacemaker/today (풀었던 퀴즈 제외) | quiz.service.ts |
| INSERT | POST /pacemaker/quiz/:id/answer | quiz.service.ts |
| SELECT | POST /book/monthly-reports (월간 학습 통계) | monthly-report.collector.ts |

---

### `wrong_notes`

```
id                      UUID PK
user_id                 UUID FK → users.id
quiz_id                 UUID FK → quizzes.id
user_answer             INT
detailed_explanation    TEXT
created_at              TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /pacemaker/today (오답 재출제 30%) | quiz.service.ts |
| DELETE | POST /pacemaker/quiz/:id/answer (정답 시 제거) | quiz.service.ts |
| INSERT | POST /pacemaker/quiz/:id/answer (오답 시 저장) | quiz.service.ts |
| SELECT | GET /book/wrong-notes | quiz.service.ts |
| SELECT | POST /book/monthly-reports (오답 현황) | monthly-report.collector.ts |

---

### `badges` (운영 데이터)

```
id              UUID PK
code            TEXT UNIQUE       ← 'no_spend_3', 'streak_7', ...
name            TEXT
description     TEXT
icon            TEXT              ← 이모지
condition_type  TEXT              ← 'no_spend_days' | 'streak_days' | 'quiz_total' | ...
condition_value INT
created_at      TIMESTAMPTZ
```

### `user_badges`

```
id        UUID PK
user_id   UUID FK → users.id
badge_id  UUID FK → badges.id
month     TEXT          ← "YYYY-MM" (user_id + badge_id + month UNIQUE)
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT (badges) | POST /book/monthly-reports (배지 판정) | monthly-report.collector.ts |
| UPSERT (user_badges) | POST /book/monthly-reports (달성 배지 저장) | monthly-report.collector.ts |

---

### `report_payments`

```
id              UUID PK
user_id         UUID FK → users.id
report_id       UUID FK → detailed_reports.id
amount          INT
status          TEXT          ← 'completed'
payment_token   TEXT
created_at      TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| INSERT | (미사용 — 결제 모듈 스텁) | payment.service.ts |
| SELECT | (미사용) | payment.service.ts |

---

### `system_config` (운영 데이터)

```
key             TEXT PK
value           TEXT          ← 숫자/JSON 문자열
category        TEXT
unit            TEXT
description     TEXT
source          TEXT
review_cycle    TEXT
updated_at      TIMESTAMPTZ
```

| 조작 | API | 파일 |
|---|---|---|
| SELECT | GET /constants | constants.service.ts |
| SELECT | (내부) 모든 AI 생성 시 참조 | constants.service.ts → getConfigMap() |
| UPDATE | PATCH /admin/constants/:key | admin.service.ts |

---

## 데이터 흐름도

### 1. 유저 진입 (회원가입 → 온보딩)

```
카카오 로그인
  │
  ▼
[users] INSERT ─────────────────────────────────┐
  │                                              │
  ▼                                              │
온보딩 (POST /auth/onboarding)                   │
  │                                              │
  ├──▶ [finance_profiles] INSERT                 │
  │     (age, income, grade 등 계산)              │
  │                                              │
  ├──▶ [users] UPDATE                            │
  │     (nickname, has_completed_onboarding)      │
  │                                              │
  └──▶ [detailed_reports] INSERT                 │
        (AI 상세 리포트 v6 자동 생성)             │
        │                                        │
        └──▶ [user_glossaries] INSERT            │
              (Section I 용어사전)                │
```

### 2. 일일 루틴 (페이스메이커)

```
GET /pacemaker/today
  │
  ├──▶ [pacemaker_messages] SELECT (캐시 확인)
  │     └── 있으면 바로 반환
  │
  └── 없으면 AI 생성:
        ├──▶ [finance_profiles] SELECT (재무 데이터)
        ├──▶ [system_config] SELECT (운영 상수)
        ├──▶ [external_scraps] SELECT (최근 스크랩 5개)
        ├──▶ [daily_checks] SELECT (어제/이번주 지출)
        ├──▶ [quizzes] SELECT + [quiz_answers] SELECT + [wrong_notes] SELECT
        │     (오답 30% 재출제 + 새 퀴즈 배정)
        │
        ├──▶ Claude API → 메시지 생성
        │
        └──▶ [pacemaker_messages] INSERT
```

### 3. 퀴즈 답변

```
POST /pacemaker/quiz/:id/answer
  │
  ├──▶ [quizzes] SELECT (정답 조회)
  │
  ├── 정답이면:
  │   └──▶ [wrong_notes] DELETE (오답노트에서 제거)
  │
  ├── 오답이면:
  │   └──▶ [wrong_notes] INSERT (오답노트에 추가)
  │
  └──▶ [quiz_answers] INSERT (답변 기록)
```

### 4. 일일 지출 체크

```
POST /pacemaker/daily-check
  │
  ├──▶ [monthly_finalizations] SELECT (확정 차단 확인)
  │
  └──▶ [daily_checks] INSERT or UPDATE
```

### 5. 월간 확정 → 월간 리포트

```
POST /pacemaker/monthly-finalize
  │
  ├──▶ [monthly_finalizations] UPSERT (이전 미확정 월 자동 확정)
  ├──▶ [monthly_finalizations] UPDATE (이전 pending 소멸)
  └──▶ [monthly_finalizations] INSERT (해당 월 확정)

        ▼ (유저가 리포트 생성 요청)

POST /book/monthly-reports
  │
  ├──▶ [monthly_finalizations] SELECT (확정 확인)
  ├──▶ [monthly_reports] SELECT (중복 확인)
  │
  ├── 데이터 수집:
  │   ├──▶ [daily_checks] SELECT (소비 통계)
  │   ├──▶ [monthly_snapshots] SELECT (전월 비교)
  │   ├──▶ [detailed_reports] SELECT (제안 항목)
  │   ├──▶ [pacemaker_actions] SELECT (액션 이행)
  │   ├──▶ [quiz_answers] SELECT (퀴즈 통계)
  │   ├──▶ [wrong_notes] SELECT (오답 현황)
  │   └──▶ [badges] SELECT (배지 판정)
  │
  ├──▶ Claude API → 5개 섹션 narrative 생성
  │
  ├──▶ [monthly_reports] INSERT
  ├──▶ [user_badges] UPSERT (달성 배지 저장)
  └──▶ [monthly_snapshots] UPSERT (다음달 비교용 스냅샷)
```

### 6. 학습 콘텐츠

```
GET /book/learn
  ├──▶ [learn_contents] SELECT (등급별)
  ├──▶ [user_content_reads] SELECT (읽음 상태)
  └──▶ [user_content_scraps] SELECT (스크랩 상태)

GET /book/learn/:id
  ├──▶ [learn_contents] SELECT
  ├──▶ [user_content_reads] UPSERT (자동 읽음)
  └──▶ [user_content_scraps] SELECT

POST /book/learn/:id/scrap
  └──▶ [user_content_scraps] INSERT or DELETE (토글)
```

### 7. 외부 스크랩

```
POST /book/scraps
  │
  ├── URL 메타데이터 추출 (fetch + HTML 파싱)
  ├── Claude API → AI 요약
  │
  ├──▶ [external_scraps] SELECT (같은 URL count 조회)
  ├──▶ [external_scraps] INSERT
  └──▶ [external_scraps] UPDATE (기존 URL scrap_count 갱신)
```

---

## 운영 데이터 vs 유저 데이터

**운영 데이터** (어드민이 관리, 유저 요청으로 변경 안 됨):
- `system_config` — 운영 상수 (환율, 물가, 또래 통계 등)
- `quizzes` — 퀴즈 문제 (공공데이터 기반 493개)
- `badges` — 배지 정의
- `learn_contents` — 학습 콘텐츠

**유저 데이터** (유저 행동으로 생성/변경):
- 나머지 전부

---

## 주의사항

1. **monthly_reports.month는 DATE 타입** — "2026-04" → "2026-04-01"로 변환하여 저장/조회
2. **monthly_finalizations.month는 TEXT 타입** — "2026-04" 그대로 저장
3. **금액은 항상 원 정수** — NUMERIC/FLOAT 사용 안 함
4. **daily_checks는 확정된 월 수정 불가** — monthly_finalizations 확인 후 차단
5. **pacemaker_messages는 하루 1개** — user_id + date UNIQUE 제약
6. **report_payments는 현재 미사용** — 결제 모듈 스텁 상태
