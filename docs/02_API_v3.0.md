# 머니런 API 명세서 v3.0

> **Base URL:** `http://localhost:3001`  
> **인증:** `Authorization: Bearer {JWT}`  
> **금액:** 원(₩) 정수 | **날짜:** ISO 8601

---

## 공통 응답 형식

```json
// 성공
{ "success": true, "data": { ... } }

// 실패
{ "success": false, "message": "에러 설명", "code": "ERROR_CODE" }
```

| HTTP | code | 설명 |
|---|---|---|
| 400 | `BAD_REQUEST` | 잘못된 요청 |
| 401 | `UNAUTHORIZED` | JWT 없음/만료 |
| 402 | `PAYMENT_REQUIRED` | 유료 결제 필요 |
| 404 | `NOT_FOUND` | 리소스 없음 |
| 422 | `VALIDATION_ERROR` | 입력값 오류 |
| 429 | `TOO_MANY_REQUESTS` | 요청 횟수 초과 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## 전체 엔드포인트 목록 (27개)

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/kakao` | ❌ | 카카오 로그인/회원가입 |
| POST | `/auth/onboarding` | ✅ | 시뮬레이션 입력값 이관 + 투자 체급 세팅 |
| GET | `/users/me` | ✅ | 내 정보 조회 |
| PATCH | `/users/me` | ✅ | 내 정보 수정 |
| DELETE | `/users/me` | ✅ | 회원 탈퇴 |
| GET | `/finance/profile` | ✅ | 투자 체급 + 변동비 조회 |
| PATCH | `/finance/profile` | ✅ | 투자 체급 수정 |
| POST | `/simulation/calculate` | ❌ | 비로그인 시뮬레이션 |
| GET | `/pacemaker/today` | ✅ | 오늘의 메시지 |
| POST | `/pacemaker/refresh` | ✅ | 메시지 새로고침 |
| POST | `/pacemaker/actions/:id/complete` | ✅ | 추천 행동 완료 |
| POST | `/pacemaker/feedback` | ✅ | 피드백/신고 |
| GET | `/pacemaker/history` | ✅ | 메시지 히스토리 |
| GET | `/book/detailed-reports` | ✅ | AI 리포트 목록 |
| GET | `/book/detailed-reports/:id` | ✅ | AI 리포트 상세 |
| POST | `/book/detailed-reports/generate` | ✅ | 리포트 재생성 (유료) |
| GET | `/book/detailed-reports/:id/download` | ✅ | 리포트 다운로드 |
| GET | `/book/weekly-reports` | ✅ | 주간 리포트 목록 |
| POST | `/book/weekly-reports` | ✅ | 주간 리포트 생성 |
| GET | `/book/weekly-reports/:id` | ✅ | 주간 리포트 상세 |
| POST | `/book/scraps` | ✅ | 외부 URL 스크랩 |
| GET | `/book/scraps` | ✅ | 스크랩 목록 |
| DELETE | `/book/scraps/:id` | ✅ | 스크랩 삭제 |
| GET | `/book/learn` | ✅ | 학습 콘텐츠 목록 |
| GET | `/book/learn/:id` | ✅ | 학습 콘텐츠 상세 |
| POST | `/book/learn/:id/scrap` | ✅ | 학습 스크랩 토글 |
| GET | `/constants` | ❌ | 운영 상수 |

---

## 1. 인증 (Auth)

### POST `/auth/kakao` — 카카오 로그인/회원가입

```
인증: 불필요
```

```json
// Request
{ "accessToken": "카카오_access_token" }

// Response 200
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": "uuid",
      "nickname": "김민수",
      "email": "user@email.com",
      "isNewUser": true,
      "hasCompletedOnboarding": false
    }
  }
}
```

---

### POST `/auth/onboarding` — 시뮬레이션 입력값 이관

```
인증: Bearer JWT
```

sessionStorage 입력값을 DB에 저장. 최초 1회. 무료 AI 리포트 자동 생성.

```json
// Request
{
  "age": 27,
  "monthlyIncome": 2300000,
  "monthlyFixedCost": 1200000,
  "monthlyInvestment": 300000,    // 선택, 기본값 0
  "expectedReturn": 5.0,          // 선택, 기본값 5.0
  "investmentYears": 38           // 선택, 기본값 65-나이
}

// Response 200
{
  "success": true,
  "data": {
    "grade": "GREEN",
    "variableCost": {
      "monthly": 800000,
      "weekly": 186046,
      "daily": 26666
    },
    "firstReportId": "uuid"
  }
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `age` | int | O | 만 나이 |
| `monthlyIncome` | int | O | 월 실수령액 (원) |
| `monthlyFixedCost` | int | O | 월 고정비 (원) |
| `monthlyInvestment` | int | | 월 투자비 (원), 기본 0 |
| `expectedReturn` | number | | 연평균 수익률 (%), 기본 5.0 |
| `investmentYears` | int | | 투자 기간 (년), 기본 65-나이 |

---

## 2. 유저 (Users)

### GET `/users/me` — 내 정보 조회

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "nickname": "김민수",
    "email": "user@email.com",
    "marketingConsent": false,
    "hasCompletedOnboarding": true,
    "createdAt": "2026-04-02T00:00:00.000Z"
  }
}
```

### PATCH `/users/me` — 내 정보 수정

```
인증: Bearer JWT
```

```json
// Request (변경할 항목만)
{
  "nickname": "새닉네임",
  "email": "new@email.com",
  "marketingConsent": true
}

// Response 200 — GET /users/me 와 동일한 형태
```

### DELETE `/users/me` — 회원 탈퇴

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": { "message": "회원 탈퇴가 완료되었습니다." }
}
```

---

## 3. 재무 프로필 (Finance)

### GET `/finance/profile` — 투자 체급 + 변동비 조회

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": {
    "age": 27,
    "monthlyIncome": 2300000,
    "monthlyFixedCost": 1200000,
    "monthlyInvestment": 300000,
    "expectedReturn": 5.0,
    "investmentYears": 38,
    "grade": "GREEN",
    "variableCost": {
      "monthly": 800000,
      "weekly": 186046,
      "daily": 26666
    },
    "lastUpdated": "2026-04-02T00:00:00.000Z",
    "isStale": false,
    "canGenerateFreeReport": false
  }
}
```

| 필드 | 설명 |
|---|---|
| `isStale` | 마지막 업데이트가 6개월 이전이면 `true` |
| `canGenerateFreeReport` | 최초 무료 리포트 미사용이면 `true` |

### PATCH `/finance/profile` — 투자 체급 수정

```
인증: Bearer JWT
```

```json
// Request (변경할 항목만)
{
  "monthlyIncome": 2500000,
  "monthlyFixedCost": 1100000,
  "monthlyInvestment": 400000
}

// Response 200
{
  "success": true,
  "data": {
    "grade": "GREEN",
    "variableCost": {
      "monthly": 1000000,
      "weekly": 232558,
      "daily": 33333
    },
    "canGenerateFreeReport": false,
    "reportPrice": 3900
  }
}
```

---

## 4. 시뮬레이션 (Simulation)

### POST `/simulation/calculate` — 비로그인 시뮬레이션

```
인증: 불필요
```

```json
// Request
{
  "age": 27,
  "monthlyIncome": 2300000,
  "monthlyFixedCost": 1200000,
  "monthlyInvestment": 300000,    // 선택, 기본값 0
  "expectedReturn": 5.0,          // 선택, 기본값 5.0
  "investmentYears": 38           // 선택, 기본값 65-나이
}

// Response 200
{
  "success": true,
  "data": {
    "variableCost": {
      "monthly": 800000,
      "weekly": 186046,
      "daily": 26666
    },
    "simulation": {
      "futureAsset": 407487941,
      "monthlyPensionEstimate": 1697866,
      "minLivingCost": 1300000,
      "shortfall": 0,
      "meetsGoal": true
    },
    "grade": "GREEN"
  }
}
```

| 필드 | 설명 |
|---|---|
| `variableCost` | 변동비 = 실수령액 - 고정비 - 투자비 |
| `futureAsset` | 투자비 × 복리 (투자비 없으면 변동비 기준) |
| `monthlyPensionEstimate` | 미래자산 ÷ 240개월 (20년 은퇴) |
| `minLivingCost` | 월 최소 생활비 (system_config) |
| `shortfall` | max(0, 최소생활비 - 월연금) |
| `meetsGoal` | 월연금 >= 최소생활비 |
| `grade` | RED / YELLOW / GREEN |

**등급 기준:**
```
변동비 비율 = 변동비 ÷ 실수령액
RED:    > 70%
YELLOW: 40~70%
GREEN:  ≤ 40%
```

---

## 5. 페이스메이커 (Pacemaker)

### GET `/pacemaker/today` — 오늘의 메시지

```
인증: Bearer JWT
```

없으면 AI 생성 후 반환. 있으면 캐시.

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2026-04-03",
    "message": "야 하루에 26,666원인데 오늘도 알뜰하게 가보자!",
    "grade": "GREEN",
    "dailyVariableCost": 26666,
    "spendingStatus": {
      "todayRemaining": 26666,
      "weeklyRemaining": 186046,
      "weeklyUsed": 0,
      "level": "green"
    },
    "actions": [
      {
        "id": "uuid",
        "type": "learn_content",
        "contentId": "uuid",
        "title": "연금저축 지금 안 하면 65세에 후회",
        "label": "이거 읽어봐 →",
        "status": "pending"
      }
    ],
    "disclaimer": "참고용 조언이며, 개인 상황에 따라 다를 수 있어요",
    "canRefresh": true,
    "createdAt": "2026-04-03T00:00:00.000Z"
  }
}
```

| 필드 | 설명 |
|---|---|
| `spendingStatus.level` | `green` / `yellow` / `red` |
| `actions[].status` | `pending` / `completed` / `cancelled` |
| `canRefresh` | 오늘 새로고침 가능 여부 (하루 2회 제한) |

### POST `/pacemaker/refresh` — 메시지 새로고침

```
인증: Bearer JWT
```

하루 총 2회 제한. 초과 시 429.

```json
// Response 200 — GET /pacemaker/today 와 동일한 형태

// Response 429 (초과 시)
{
  "success": false,
  "message": "오늘 메시지 새로고침 횟수를 초과했습니다. (최대 2회)",
  "code": "TOO_MANY_REQUESTS"
}
```

### POST `/pacemaker/actions/:id/complete` — 추천 행동 완료

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": {
    "status": "completed",
    "completedAt": "2026-04-03T12:00:00.000Z"
  }
}
```

### POST `/pacemaker/feedback` — 피드백/신고

```
인증: Bearer JWT
```

```json
// Request
{
  "messageId": "uuid",
  "type": "inaccurate",
  "content": "금액이 틀렸어요"
}

// Response 200
{
  "success": true,
  "data": { "message": "피드백이 접수되었습니다." }
}
```

| type | 설명 |
|---|---|
| `inaccurate` | 부정확 |
| `offensive` | 불쾌 |
| `other` | 기타 |

### GET `/pacemaker/history` — 메시지 히스토리

```
인증: Bearer JWT
쿼리: ?page=1&limit=20
```

```json
// Response 200
{
  "success": true,
  "data": {
    "items": [
      { "id": "uuid", "date": "2026-04-03", "message": "...", "grade": "GREEN" },
      { "id": "uuid", "date": "2026-04-02", "message": "...", "grade": "GREEN" }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15
    }
  }
}
```

---

## 6. 마이북 (Book)

### GET `/book/detailed-reports` — AI 상세 리포트 목록

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": {
    "canGenerateFree": false,
    "items": [
      {
        "id": "uuid",
        "title": "4월 재무 분석 리포트",
        "summary": "변동비 80만 원, 하루 26,666원...",
        "pdfUrl": null,
        "createdAt": "2026-04-02T00:00:00.000Z"
      }
    ]
  }
}
```

### GET `/book/detailed-reports/:id` — 리포트 상세

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "4월 재무 분석 리포트",
    "content": "## 4월 재무 현황\n\n...(마크다운)",
    "grade": "GREEN",
    "analysis": {
      "wellDone": "고정비를 잘 관리하고 있습니다.",
      "improvement": "변동비 비율을 점검해보세요.",
      "actionPlan": "불필요한 지출 항목 하나를 줄여보세요."
    },
    "pdfUrl": null,
    "isFree": true,
    "createdAt": "2026-04-02T00:00:00.000Z"
  }
}
```

### POST `/book/detailed-reports/generate` — 리포트 재생성 (유료)

```
인증: Bearer JWT
```

최초 1회 무료일 때는 `paymentToken` 불필요.

```json
// Request
{ "paymentToken": "payment_token_from_pg" }

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "generating"
  }
}

// Response 402 (무료 소진 + 토큰 없음)
{
  "success": false,
  "message": "유료 리포트 생성은 결제가 필요합니다.",
  "code": "PAYMENT_REQUIRED"
}
```

### GET `/book/detailed-reports/:id/download` — 리포트 다운로드

```
인증: Bearer JWT
응답: text/markdown 파일 (Content-Disposition: attachment)
```

---

### GET `/book/weekly-reports` — 주간 리포트 목록

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "weekStart": "2026-03-31",
      "weekEnd": "2026-04-06",
      "summary": "회식이 잦았던 주...",
      "createdAt": "2026-04-07T00:00:00.000Z"
    }
  ]
}
```

### POST `/book/weekly-reports` — 주간 리포트 생성

```
인증: Bearer JWT
```

```json
// Request
{
  "weekStatus": {
    "overallFeeling": "tight",
    "memo": "회식이 2번 있어서 식비가 많이 나갔어요"
  }
}

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "weekStart": "2026-03-31",
    "weekEnd": "2026-04-06",
    "summary": "회식이 잦았던 주...",
    "createdAt": "2026-04-07T00:00:00.000Z"
  }
}
```

| overallFeeling | 의미 |
|---|---|
| `good` | 잘 보냈다 |
| `okay` | 무난했다 |
| `tight` | 빠듯했다 |
| `bad` | 힘들었다 |

### GET `/book/weekly-reports/:id` — 주간 리포트 상세

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "weekStart": "2026-03-31",
    "weekEnd": "2026-04-06",
    "summary": "회식이 잦았던 주...",
    "guide": "## 이번 주 돌아보기\n\n...(마크다운)",
    "weeklyStats": {},
    "userInput": { "overallFeeling": "tight", "memo": "..." },
    "createdAt": "2026-04-07T00:00:00.000Z"
  }
}
```

---

### POST `/book/scraps` — 외부 URL 스크랩

```
인증: Bearer JWT
```

```json
// Request
{ "url": "https://youtube.com/watch?v=abc123" }

// Response 201
{
  "success": true,
  "data": {
    "id": "uuid",
    "url": "https://youtube.com/watch?v=abc123",
    "channel": "youtube",
    "creator": "슈카월드",
    "contentDate": null,
    "title": "2026년 금리 전망",
    "aiSummary": "AI가 요약한 텍스트...",
    "scrapCount": 42,
    "createdAt": "2026-04-03T00:00:00.000Z"
  }
}
```

| channel | 설명 |
|---|---|
| `youtube` | 유튜브 (AI 요약 생성) |
| `threads` | 쓰레드 (전문 텍스트) |
| `instagram` | 인스타그램 (전문 텍스트) |
| `other` | 기타 (AI 요약 생성) |

### GET `/book/scraps` — 스크랩 목록

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "url": "https://youtube.com/watch?v=abc123",
      "channel": "youtube",
      "creator": "슈카월드",
      "contentDate": null,
      "title": "2026년 금리 전망",
      "aiSummary": "AI가 요약한 텍스트...",
      "scrapCount": 42,
      "createdAt": "2026-04-03T00:00:00.000Z"
    }
  ]
}
```

### DELETE `/book/scraps/:id` — 스크랩 삭제

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": { "message": "삭제되었습니다." }
}
```

---

### GET `/book/learn` — 금융 학습 목록

```
인증: Bearer JWT
쿼리: ?grade=RED (선택, 생략 시 내 등급)
```

```json
// Response 200
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "비상금 없으면 진짜 거지 됩니다",
      "grade": "RED",
      "isRead": false,
      "isScrapped": false,
      "readMinutes": 1
    }
  ]
}
```

### GET `/book/learn/:id` — 학습 콘텐츠 상세

```
인증: Bearer JWT
```

접속하면 자동 읽음 처리.

```json
// Response 200
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "비상금 없으면 진짜 거지 됩니다",
    "content": "마크다운 본문...",
    "grade": "RED",
    "isRead": true,
    "isScrapped": false
  }
}
```

### POST `/book/learn/:id/scrap` — 학습 스크랩 토글

```
인증: Bearer JWT
```

```json
// Response 200
{
  "success": true,
  "data": { "isScrapped": true }
}
```

---

## 7. 운영 상수 (Constants)

### GET `/constants` — 운영 상수 조회

```
인증: 불필요
```

```json
// Response 200
{
  "success": true,
  "data": {
    "exchangeRate": 1350,
    "oilPrice": 75.5,
    "inflationRate": 0.025,
    "minPensionGoal": 1300000,
    "seoulAverageRent": 730000,
    "categoryAverages": {
      "food": 420000,
      "transport": 80000,
      "subscription": 50000,
      "shopping": 150000,
      "leisure": 220000,
      "etc": 100000
    },
    "updatedAt": "2026-04-03T03:01:25.564Z"
  }
}
```

---

## 변동비 계산 공식

```
변동비 = 월 실수령액 - 월 고정비 - 월 투자비
주 변동비 = 변동비 ÷ 4.3 (내림)
일 변동비 = 변동비 ÷ 30 (내림)
```

## 시뮬레이션 미래 자산 공식

```
월 수익률 = 연 수익률 / 100 / 12
총 개월수 = 투자기간 × 12
월 저축액 = 투자비 > 0 ? 투자비 : 변동비

미래 자산 = 월 저축액 × ((1 + 월 수익률)^총개월수 - 1) / 월 수익률
월 연금 = 미래 자산 ÷ 240 (20년)
```

---

*머니런 API 명세서 v3.0 — 2026.04.03*
