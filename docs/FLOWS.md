# API 플로우 — 코드 레벨 동작 정리

> 각 API가 내부적으로 어떤 코드를 거쳐 동작하는지 정리한 문서.
> 파일 경로는 `src/` 기준.

---

## 1. 인증

### POST /auth/kakao

```
auth.controller.ts → auth.service.ts: kakaoLogin()

1. fetch('https://kapi.kakao.com/v2/user/me') → 카카오 유저 정보 조회
2. users 테이블에서 kakao_id로 검색
   → 있으면 기존 유저 반환 (isNewUser: false)
   → 없으면 INSERT → 신규 유저 생성 (isNewUser: true)
3. JwtService.sign({ sub: user.id, kakaoId }) → JWT 발급
4. { accessToken, user } 반환
```

### POST /auth/onboarding 🔒

```
auth.controller.ts → auth.service.ts: completeOnboarding()

1. users 테이블에서 has_completed_onboarding 확인 → 이미 완료면 400
2. grade.calculator.ts: calculateGrade(income, expense)
   → expense/income 비율로 RED(>70%) / YELLOW(>40%) / GREEN 판정
3. variable-cost.calculator.ts: calculateVariableCost(income, fixedCost)
   → monthly = income - fixedCost, weekly = /4.3, daily = /30
4. finance_profiles INSERT (age, income, fixedCost, variableCost, grade, ...)
5. users UPDATE (nickname, has_completed_onboarding: true)
6. book.service.ts: generateDetailedReport(userId, true)
   → 무료 AI 상세 리포트 자동 생성 (실패해도 온보딩은 완료)
7. { grade, surplus, variableCost, firstReportId } 반환
```

---

## 2. 유저

### GET /users/me 🔒

```
users.controller.ts → users.service.ts: findById()

1. users 테이블 SELECT (id, nickname, email, marketing_consent, has_completed_onboarding, role, created_at)
2. snake_case → camelCase 변환 후 반환
```

---

## 3. 재무 프로필

### GET /finance/profile 🔒

```
finance.controller.ts → finance.service.ts: getFullProfile()

1. finance_profiles 테이블 SELECT
2. users 테이블에서 nickname 조회
3. 6개월 경과 체크: updated_at < 6개월 전 → isStale: true
4. 계산: monthlyExpense, surplus, investmentPeriod, vestingPeriod
5. variableCost { monthly, weekly, daily } 포함하여 반환
```

### PATCH /finance/profile 🔒

```
finance.controller.ts → finance.service.ts: updateProfile()

1. finance_profiles 현재값 조회
2. DTO에 있는 필드만 병합 (나머지는 기존값 유지)
3. calculateGrade() → 등급 재계산
4. calculateVariableCost() → 잉여자금 재계산
5. finance_profiles UPDATE
6. nickname 변경 시 users UPDATE 별도 수행
7. { grade, surplus, variableCost } 반환
```

---

## 4. 시뮬레이션

### POST /simulation/calculate

```
simulation.controller.ts → simulation.service.ts: calculate()

1. calculateGrade(), calculateVariableCost() → 등급 + 잉여자금 계산
2. 3가지 시나리오 시뮬레이션 (예적금 3%, KOSPI 7%, S&P500 10%):
   → 복리 공식: monthlySaving × ((1+r)^months - 1) / r
   → 거치기간 복리 추가 적용
   → 연금 월수령액 = 총자산 / (거치+20년 × 12)
3. { grade, surplus, simulation: { cases } } 반환
```

---

## 5. 페이스메이커

### GET /pacemaker/today 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: getTodayMessage()

1. KST 기준 오늘 날짜 계산
2. pacemaker_messages에서 오늘 메시지 조회 → 있으면 캐시 반환
3. 없으면 AI 생성:
   a. finance.service.ts: getFullProfile() → 재무 데이터
   b. constants.service.ts: getConfigMap() → 운영 상수
   c. external_scraps에서 최근 5개 조회
   d. getSpendingData() → 어제 지출 + 이번 주 지출 + 연속 절약일
   e. message.generator.ts: generate(contextData)
      → 요일별 테마 (월: 예산점검, 화: 절약팁, 수: 습관점검, ...)
      → 등급별 톤 가이드 (RED: 직접적, YELLOW: 은근, GREEN: 격려)
      → Claude API 호출 → JSON { message, quote } 파싱
      → 금지 표현 필터링 (확정 투자 권유 등)
   f. quiz.service.ts: getTodayQuizzes(userId, 10)
      → 오답노트에서 30% 재출제 + 나머지 새 퀴즈
   g. pacemaker_messages INSERT
4. formatResponse() → { id, date, message, grade, theme, quote, quizzes, ... }
```

### POST /pacemaker/quiz/:id/answer 🔒

```
quiz.controller.ts → quiz.service.ts: submitAnswer()

1. quizzes 테이블에서 퀴즈 조회 (정답 포함)
2. 보기 범위 검증 (1 ~ choices.length)
3. 정답이면 → wrong_notes에서 해당 퀴즈 DELETE (오답 복습 성공)
4. quiz_answers에 이미 답변 없으면 INSERT
5. 오답이면 → wrong_notes에 없으면 INSERT (자동 오답노트 저장)
6. { correct, correctAnswer, briefExplanation, detailedExplanation } 반환
```

### POST /pacemaker/feedback 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: submitFeedback()

1. pacemaker_feedback INSERT (message_id, user_id, type, content)
```

### POST /pacemaker/daily-check 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: createDailyCheck()

1. 미래 날짜 차단 (date > today → 400)
2. monthly_finalizations에서 해당 월 확정 여부 확인 → 확정이면 400
3. daily_checks에서 같은 날짜 조회
   → 있으면 UPDATE (status, amount)
   → 없으면 INSERT
4. { id, date, status, amount } 반환
```

### GET /pacemaker/daily-checks 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: getDailyChecks()

1. month 파라미터로 시작일/종료일 계산
2. daily_checks SELECT (해당 월 전체)
3. finance.service.ts: getFullProfile() → dailyBudget 조회
4. 통계 계산: totalSpent, adjustedBudget, spentRate, daysUnder, daysOver
5. calculateStreak() → 현재 연속 절약일
6. calculateBestStreak() → 최대 연속 절약일
7. { days, summary } 반환
```

### GET /pacemaker/weekly-summary 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: getWeeklySummary()

1. getWeekRange(date) → 해당 주 월~일 범위 계산
2. weekly_summaries에서 저장된 요약 조회 → 있으면 반환
3. 없으면 calculateWeeklySummary():
   a. daily_checks SELECT (해당 주)
   b. finance.service.ts: getFullProfile() → dailyBudget
   c. 통계 계산: totalSpent, spentRate, daysUnder, daysOver
   d. weekEnd < 오늘이면 weekly_summaries UPSERT (캐시 저장)
4. { weekStart, weekEnd, totalSpent, spentRate, ... } 반환
```

### GET /pacemaker/monthly-finalize-status 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: getMonthlyFinalizeStatus()

1. 현재 월 확정 여부: monthly_finalizations 조회
2. 현재 월 리포트 여부: monthly_reports 조회 (month는 DATE → "-01" 붙여서 조회)
3. pendingReport: 확정O + 리포트X + 소멸X인 과거 월 (최신 1개)
4. getUnfinalizedMonths(): 유저 가입월 ~ 대상 월 직전 중 미확정 월 목록
5. { currentMonth, pendingReport, unfinalizedMonths } 반환
```

### POST /pacemaker/monthly-finalize 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: finalizeMonth()

1. monthly_finalizations에서 이미 확정됐는지 확인 → 확정이면 400
2. getUnfinalizedMonths() → 이전 미확정 월 목록
3. 이전 미확정 월 자동 확정 (UPSERT)
4. 이전 pendingReport 소멸 처리 (리포트 미생성 + 확정O → expired: true)
5. 해당 월 확정 INSERT/UPDATE
6. { finalized, autoFinalized, expiredReport } 반환
```

### POST /pacemaker/monthly-finalize/cancel 🔒

```
pacemaker.controller.ts → pacemaker.service.ts: cancelFinalize()

1. monthly_reports에서 해당 월 리포트 존재 확인 → 있으면 400
2. monthly_finalizations DELETE
```

---

## 6. 마이북 — 상세 리포트

### GET /book/detailed-reports 🔒

```
book.controller.ts → book.service.ts: getDetailedReports()

1. detailed_reports SELECT (id, summary, report_version, created_at) WHERE user_id
2. { items } 반환
```

### GET /book/detailed-reports/:id 🔒

```
book.controller.ts → book.service.ts: getDetailedReportById()

1. detailed_reports SELECT * WHERE id + user_id
2. { id, reportVersion: "v6", sections, userSnapshot, disclaimer, ... } 반환
```

**상세 리포트 생성 플로우 (온보딩 시 자동 호출):**

```
book.service.ts: generateDetailedReport()

1. finance.service.ts: getFullProfile() → 재무 데이터
2. constants.service.ts: getConfigMap() + getPeerData() → 또래 비교 데이터
3. report.generator.ts: generateDetailedReportV6()
   a. report-calculator.ts로 9개 섹션 (A~I) 수치 계산:
      A: 재무 건강 점수 (또래 비교)
      B: 소득 흐름 분석 (고정비/변동비 비중)
      C: 은퇴 자산 시뮬레이션 (복리 + 생애 이벤트)
      D: 한국 재무 환경 (연금, 부채 등)
      E: 등급 업그레이드 로드맵
      F: 절약 팁 (고정비/변동비)
      G: 금융 학습 커리큘럼
      H: 월간 체크리스트
      I: 금융 용어사전
   b. Claude API → 9개 섹션 ai_narrative 생성
   c. 금지 표현 필터링
4. detailed_reports INSERT
5. Section I 용어사전 → user_glossaries INSERT (마이북 선물)
```

---

## 6. 마이북 — 월간 리포트

### GET /book/monthly-reports 🔒

```
book.controller.ts → book.service.ts: getMonthlyReports()

1. monthly_reports SELECT (생성 완료 리포트)
2. monthly_finalizations SELECT (확정 + 소멸X)
3. 확정됐지만 리포트 미생성 → status: "pending"
4. 합산 후 월 역순 정렬
```

### GET /book/monthly-reports/proposals 🔒

```
book.controller.ts → book.service.ts: getProposalItems()
  → monthly-report.collector.ts: getProposalItems()

1. detailed_reports에서 최신 v6 리포트 조회
2. Section E (로드맵 steps) → 제안 항목 추출
3. Section F (절약팁) → 제안 항목 추출
4. [{ id, title, source, checked: null }] 반환
```

### POST /book/monthly-reports 🔒

```
book.controller.ts → book.service.ts: createMonthlyReport()

1. monthly_finalizations에서 확정 여부 확인 → 미확정이면 400
2. monthly_reports에서 중복 확인 → 이미 있으면 400
3. monthly-report.collector.ts: collect()
   a. collectSpending(): daily_checks 통계 + 전월 비교 + 또래 비교
   b. collectProposals(): 상세리포트 제안 + 유저 OX 체크 병합 + 페이스메이커 액션 이행률
   c. collectLearning(): 퀴즈 답변 통계 + FQ 금융지수 + 오답노트
   d. evaluateBadges(): badges 테이블 조건 판정 → user_badges UPSERT
4. monthly-report.generator.ts: generateNarratives()
   → Claude API → 5개 섹션 (spending, proposals, goals, learning, rewards)
   → 금지 표현 필터링
5. 섹션 조립 + summary 생성
6. monthly_reports INSERT
7. monthly-report.collector.ts: saveSnapshot() → monthly_snapshots UPSERT (다음달 비교용)
```

### GET /book/monthly-reports/:id 🔒

```
book.controller.ts → book.service.ts: getMonthlyReportById()

1. monthly_reports SELECT * WHERE id + user_id
2. month DATE → "YYYY-MM" 변환
3. { id, month, summary, sections, badgesEarned, proposalChecks, userInput, createdAt }
```

---

## 6. 마이북 — 학습 콘텐츠

### GET /book/learn 🔒

```
book.controller.ts → book.service.ts: getLearnContents()

1. grade 미지정 시 → finance.service.ts: getFullProfile() → 유저 등급 자동 적용
2. learn_contents SELECT WHERE grade
3. user_content_reads, user_content_scraps SELECT → 읽음/스크랩 상태 병합
4. [{ id, title, grade, isRead, isScrapped, readMinutes }]
```

### GET /book/learn/:id 🔒

```
book.controller.ts → book.service.ts: getLearnContentById()

1. learn_contents SELECT WHERE id
2. user_content_reads UPSERT → 자동 읽음 처리
3. user_content_scraps에서 스크랩 여부 조회
4. { id, title, content, grade, isRead: true, isScrapped }
```

### POST /book/learn/:id/scrap 🔒

```
book.controller.ts → book.service.ts: toggleLearnScrap()

1. user_content_scraps에서 기존 스크랩 조회
   → 있으면 DELETE → { isScrapped: false }
   → 없으면 INSERT → { isScrapped: true }
```

---

## 6. 마이북 — 오답노트

### GET /book/wrong-notes 🔒

```
quiz.controller.ts → quiz.service.ts: getWrongNotes()

1. wrong_notes SELECT + quizzes JOIN (question, choices, correct_answer, explanations)
2. 최신순 정렬
```

---

## 6. 마이북 — 외부 스크랩

### POST /book/scraps 🔒

```
book.controller.ts → book.service.ts: createExternalScrap()

1. scraper.service.ts: scrapeUrl(url)
   → 채널 자동 감지 (youtube/threads/instagram/other)
   → 메타데이터 추출 (title, creator)
   → AI 요약: Claude API (youtube/other) 또는 전문 텍스트 (threads/instagram)
2. external_scraps에서 같은 URL의 scrap_count 조회
3. external_scraps INSERT (url, channel, creator, title, aiSummary, scrapCount)
4. 기존 URL이면 모든 레코드의 scrap_count UPDATE
```

### GET /book/scraps 🔒

```
book.controller.ts → book.service.ts: getExternalScraps()

1. external_scraps SELECT WHERE user_id, 최신순
```

### DELETE /book/scraps/:id 🔒

```
book.controller.ts → book.service.ts: deleteExternalScrap()

1. external_scraps DELETE WHERE id + user_id
```

---

## 7. 통계

### GET /statistics/peers

```
statistics.controller.ts → statistics.service.ts: getPeers()

1. constants.service.ts: getConfigMap() → peer_statistics JSON 파싱
2. 나이대 매칭 (ageMin ~ ageMax) → 매칭 실패 시 가장 가까운 그룹
3. 소득대 매칭 (incomeMin ~ incomeMax) → 매칭 실패 시 가장 가까운 구간
4. { ageGroup, incomeGroup, peers: { avgMonthlyIncome, avgMonthlyExpense, ... } }
```

---

## 8. 운영 상수

### GET /constants

```
constants.controller.ts → constants.service.ts: getAll()

1. system_config SELECT (key, value, updated_at)
2. key-value 맵 구성
3. 주요 상수 파싱: exchangeRate, inflationRate, categoryAverages 등
4. 가장 최근 updated_at 반환
```

---

## 9. 어드민

### GET /admin/users 🔒👑

```
admin.controller.ts → admin.service.ts: getUsers()

1. JwtAuthGuard + AdminGuard 인증
2. users SELECT + 페이지네이션 (offset, limit)
3. { users, total, page, limit }
```

### GET /admin/quizzes 🔒👑

```
admin.controller.ts → admin.service.ts: getQuizzes()

1. quizzes SELECT ALL, 최신순
2. { quizzes, total }
```

### PATCH /admin/constants/:key 🔒👑

```
admin.controller.ts → admin.service.ts: updateConstant()

1. system_config에서 key 존재 확인 → 없으면 404
2. system_config UPDATE (value, updated_at)
3. { key, value, updatedAt }
```

---

## 핵심 계산 로직 위치

| 로직 | 파일 |
|---|---|
| 등급 판정 (RED/YELLOW/GREEN) | `finance/grade.calculator.ts` |
| 잉여자금 계산 (월/주/일) | `finance/variable-cost.calculator.ts` |
| 상세 리포트 수치 계산 (9개 섹션) | `book/report-calculator.ts` |
| 상세 리포트 AI narrative | `book/report.generator.ts` |
| 상세 리포트 프롬프트 | `book/report-prompts.ts` |
| 월간 리포트 데이터 수집 | `book/monthly-report.collector.ts` |
| 월간 리포트 AI narrative | `book/monthly-report.generator.ts` |
| 페이스메이커 메시지 생성 | `pacemaker/message.generator.ts` |
| 외부 URL 스크랩 + AI 요약 | `book/scraper.service.ts` |
| 또래 통계 매칭 | `statistics/statistics.service.ts` |

## AI 호출 지점 (Claude API)

| 기능 | 모델 | 파일 |
|---|---|---|
| 상세 리포트 ai_narrative | claude-sonnet-4 | `book/report.generator.ts` |
| 월간 리포트 5개 섹션 narrative | claude-sonnet-4 | `book/monthly-report.generator.ts` |
| 페이스메이커 오늘의 메시지 | claude-sonnet-4 | `pacemaker/message.generator.ts` |
| 외부 URL AI 요약 | claude-sonnet-4 | `book/scraper.service.ts` |

모든 AI 호출에는 fallback이 있어서, API 실패 시 기본 텍스트로 대체됨.
