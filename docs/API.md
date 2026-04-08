# 머니런 API 명세서

> **v3.0** | 2026.04.08 | 프론트엔드 실사용 기준 33개 엔드포인트

---

## 기본 규칙

| 항목 | 값 |
|---|---|
| Base URL (개발) | `http://localhost:3001` |
| Base URL (프로덕션) | `https://api.moneyrun.io` |
| 인증 | `Authorization: Bearer {JWT}` |
| 금액 | 항상 원(₩) 정수 |

### 공통 에러

| HTTP | code | 설명 |
|---|---|---|
| 400 | `BAD_REQUEST` | 잘못된 요청 |
| 401 | `UNAUTHORIZED` | JWT 없음/만료 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 422 | `VALIDATION_ERROR` | 입력값 오류 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## 1. 인증

### `POST /auth/kakao`

카카오 OAuth 로그인/회원가입.

```
Request:  { "accessToken": "kakao_access_token" }
Response: { "accessToken": "jwt", "user": { id, nickname, email, isNewUser, hasCompletedOnboarding } }
```

### `POST /auth/onboarding` 🔒

온보딩 데이터 저장. 최초 1회. 재무 프로필 저장 + 무료 AI 상세 리포트 자동 생성.

```
Request:  { nickname, age, retirementAge, pensionStartAge?, monthlyIncome, monthlyFixedCost, monthlyVariableCost }
Response: { grade, monthlyExpense, surplus, investmentPeriod, vestingPeriod, variableCost, firstReportId }
```

---

## 2. 유저

### `GET /users/me` 🔒

내 정보 조회.

```
Response: { id, nickname, email, marketingConsent, hasCompletedOnboarding, role, createdAt }
```

---

## 3. 재무 프로필

### `GET /finance/profile` 🔒

재무 프로필 + 잉여자금 + 6개월 업데이트 유도.

```
Response: { nickname, age, retirementAge, pensionStartAge, monthlyIncome, monthlyFixedCost,
            monthlyVariableCost, monthlyExpense, surplus, investmentPeriod, vestingPeriod,
            grade, variableCost: { monthly, weekly, daily }, lastUpdated, isStale }
```

### `PATCH /finance/profile` 🔒

재무 프로필 수정. 변경할 항목만 전송. 수정 즉시 잉여자금 재계산.

```
Request:  { nickname?, age?, retirementAge?, pensionStartAge?, monthlyIncome?, monthlyFixedCost?, monthlyVariableCost? }
Response: { grade, monthlyExpense, surplus, investmentPeriod, vestingPeriod, variableCost }
```

---

## 4. 시뮬레이션

### `POST /simulation/calculate`

비로그인 시뮬레이션. 3가지 수익률 시나리오 계산.

```
Request:  { age, retirementAge, pensionStartAge?, monthlyIncome, monthlyFixedCost, monthlyVariableCost }
Response: { grade, monthlyExpense, surplus, investmentPeriod, vestingPeriod, variableCost,
            simulation: { cases: [{ label, futureAsset, monthlyPension }] } }
```

---

## 5. 페이스메이커

### `GET /pacemaker/today` 🔒

오늘의 메시지. 없으면 AI 생성 후 반환.

```
Response: { id, date, message, grade, theme, quote, dailyVariableCost, spendingStatus,
            quizzes: [{ id, question, choices, source, category }], quizCount, disclaimer, createdAt }
```

### `POST /pacemaker/quiz/:id/answer` 🔒

퀴즈 답변 제출.

```
Request:  { "userAnswer": 2 }
Response: { correct, correctAnswer, userAnswer, briefExplanation, detailedExplanation, wrongNoteId? }
```

### `POST /pacemaker/feedback` 🔒

메시지 피드백.

```
Request:  { "messageId": "uuid", "type": "like|dislike|report", "content": "선택" }
Response: { "message": "피드백이 접수되었습니다." }
```

### `POST /pacemaker/daily-check` 🔒

일일 지출 체크.

```
Request:  { "date": "2026-04-07", "status": "under|over", "amount": 30000 }
Response: { id, date, status, amount }
```

### `GET /pacemaker/daily-checks?month=2026-04` 🔒

월별 일일 체크 조회.

```
Response: { days: [{ id, date, status, amount }],
            summary: { totalSpent, adjustedBudget, dailyBudget, monthlyBudget, spentRate,
                       daysInMonth, daysTracked, daysUnder, daysOver, currentStreak, bestStreak } }
```

### `GET /pacemaker/weekly-summary?date=2026-04-07` 🔒

주간 요약. 지난 주면 DB 저장.

```
Response: { weekStart, weekEnd, daysTracked, daysSkipped, daysUnder, daysOver,
            totalSpent, adjustedBudget, spentRate, remainingBudget }
```

### `GET /pacemaker/monthly-finalize-status` 🔒

월간 확정 상태 조회.

```
Response: { currentMonth: { month, finalized, isLastDay, reportId },
            pendingReport: { month, reportId } | null,
            unfinalizedMonths: ["2026-03", ...] }
```

### `POST /pacemaker/monthly-finalize` 🔒

월간 소비 확정. 이전 미확정 월 자동 확정 + 이전 미생성 리포트 소멸 처리.

```
Request:  { "month": "2026-03" }
Response: { finalized, autoFinalized: [], expiredReport }
```

### `POST /pacemaker/monthly-finalize/cancel` 🔒

확정 취소. 리포트 생성된 월은 취소 불가.

```
Request:  { "month": "2026-03" }
Response: { "success": true }
```

---

## 6. 마이북

### 상세 리포트

#### `GET /book/detailed-reports` 🔒

```
Response: { items: [{ id, summary, reportVersion, analyzedAt, createdAt }] }
```

#### `GET /book/detailed-reports/:id` 🔒

```
Response: { id, reportVersion, analyzedAt, grade, summary, sections: [...], userSnapshot, disclaimer, createdAt }
```

### 월간 리포트

#### `GET /book/monthly-reports` 🔒

생성 완료 + 확정 대기(pending) 합산 목록.

```
Response: [{ id, month, summary, status: "created"|"pending", badgesEarned, createdAt }]
```

#### `GET /book/monthly-reports/proposals` 🔒

리포트 생성 전 유저 OX 체크 항목.

```
Response: [{ id, title, source: "detailed_report"|"pacemaker", checked: null }]
```

#### `POST /book/monthly-reports` 🔒

월간 리포트 생성. 확정된 월만 가능.

```
Request:  { month?, overallFeeling: "good|okay|tight|bad", memo?, proposalChecks?: [{ proposalId, checked }] }
Response: { id, month, summary, badgesEarned, createdAt }
```

#### `GET /book/monthly-reports/:id` 🔒

```
Response: { id, month, summary, sections, badgesEarned, proposalChecks, userInput, createdAt }
```

### 학습 콘텐츠

#### `GET /book/learn?grade=RED` 🔒

등급별 학습 콘텐츠 목록. grade 미지정 시 유저 등급 자동 적용.

```
Response: [{ id, title, grade, isRead, isScrapped, readMinutes }]
```

#### `GET /book/learn/:id` 🔒

콘텐츠 상세. 조회 시 자동 읽음 처리.

```
Response: { id, title, content, grade, isRead: true, isScrapped }
```

#### `POST /book/learn/:id/scrap` 🔒

학습 콘텐츠 스크랩 토글.

```
Response: { "isScrapped": true|false }
```

### 오답노트

#### `GET /book/wrong-notes` 🔒

```
Response: [{ id, quizId, question, choices, correctAnswer, userAnswer,
             briefExplanation, detailedExplanation, source, category, createdAt }]
```

### 외부 스크랩

#### `GET /book/scraps` 🔒

```
Response: [{ id, url, channel, creator, contentDate, title, aiSummary, scrapCount, createdAt }]
```

#### `POST /book/scraps` 🔒

URL 메타데이터 + AI 요약 자동 생성.

```
Request:  { "url": "https://..." }
Response: { id, url, channel, creator, contentDate, title, aiSummary, scrapCount, createdAt }
```

#### `DELETE /book/scraps/:id` 🔒

```
Response: { "message": "삭제되었습니다." }
```

---

## 7. 통계

### `GET /statistics/peers?age=27&monthlyIncome=2300000`

또래 통계 비교.

```
Response: { ageGroup: { label, range }, incomeGroup: { label, range },
            peers: { avgMonthlyIncome, avgMonthlyExpense, avgFixedCost, avgVariableCost, avgSavingsRate, avgSurplus } }
```

---

## 8. 운영 상수

### `GET /constants`

앱 시작 시 1회 호출.

```
Response: { exchangeRate, oilPrice, inflationRate, minPensionGoal, seoulAverageRent,
            categoryAverages: { food, transport, subscription, shopping, leisure, etc }, updatedAt }
```

---

## 9. 어드민

### `GET /admin/users?page=1&limit=20` 🔒👑

```
Response: { users: [{ id, nickname, email, role, hasCompletedOnboarding, createdAt }], total, page, limit }
```

### `GET /admin/quizzes` 🔒👑

```
Response: { quizzes: [...], total }
```

### `PATCH /admin/constants/:key` 🔒👑

```
Request:  { "value": "새로운 값" }
Response: { key, value, updatedAt }
```

---

## 전체 엔드포인트 (33개)

| # | 메서드 | 경로 | 인증 |
|---|---|---|---|
| 1 | POST | `/auth/kakao` | - |
| 2 | POST | `/auth/onboarding` | 🔒 |
| 3 | GET | `/users/me` | 🔒 |
| 4 | GET | `/finance/profile` | 🔒 |
| 5 | PATCH | `/finance/profile` | 🔒 |
| 6 | POST | `/simulation/calculate` | - |
| 7 | GET | `/pacemaker/today` | 🔒 |
| 8 | POST | `/pacemaker/quiz/:id/answer` | 🔒 |
| 9 | POST | `/pacemaker/feedback` | 🔒 |
| 10 | POST | `/pacemaker/daily-check` | 🔒 |
| 11 | GET | `/pacemaker/daily-checks` | 🔒 |
| 12 | GET | `/pacemaker/weekly-summary` | 🔒 |
| 13 | GET | `/pacemaker/monthly-finalize-status` | 🔒 |
| 14 | POST | `/pacemaker/monthly-finalize` | 🔒 |
| 15 | POST | `/pacemaker/monthly-finalize/cancel` | 🔒 |
| 16 | GET | `/book/detailed-reports` | 🔒 |
| 17 | GET | `/book/detailed-reports/:id` | 🔒 |
| 18 | GET | `/book/monthly-reports` | 🔒 |
| 19 | GET | `/book/monthly-reports/proposals` | 🔒 |
| 20 | POST | `/book/monthly-reports` | 🔒 |
| 21 | GET | `/book/monthly-reports/:id` | 🔒 |
| 22 | GET | `/book/learn` | 🔒 |
| 23 | GET | `/book/learn/:id` | 🔒 |
| 24 | POST | `/book/learn/:id/scrap` | 🔒 |
| 25 | GET | `/book/wrong-notes` | 🔒 |
| 26 | GET | `/book/scraps` | 🔒 |
| 27 | POST | `/book/scraps` | 🔒 |
| 28 | DELETE | `/book/scraps/:id` | 🔒 |
| 29 | GET | `/statistics/peers` | - |
| 30 | GET | `/constants` | - |
| 31 | GET | `/admin/users` | 🔒👑 |
| 32 | GET | `/admin/quizzes` | 🔒👑 |
| 33 | PATCH | `/admin/constants/:key` | 🔒👑 |

🔒 = JWT 필요 | 👑 = 어드민 전용
