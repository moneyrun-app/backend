# 머니런 API 통합 명세서

> **버전:** v2.0
> **최종 수정:** 2026.04.02
> **범위:** 3페이지 MVP (페이스메이커 / 마이북 / 마이페이지)

---

## 기본 규칙

| 항목 | 규칙 |
|---|---|
| Base URL (개발) | `http://localhost:3001` |
| Base URL (프로덕션) | `https://api.moneyrun.io` |
| 인증 방식 | `Authorization: Bearer {JWT}` |
| 날짜 형식 | ISO 8601 UTC |
| **금액 단위** | **항상 원 정수** |

---

## 공통 응답

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
| 404 | `NOT_FOUND` | 리소스 없음 |
| 422 | `VALIDATION_ERROR` | 입력값 오류 |
| 500 | `INTERNAL_ERROR` | 서버 오류 |

---

## 1. 인증 (Auth)

### POST `/auth/kakao` — 로그인/회원가입

**Request**

```json
{ "accessToken": "kakao_access_token_string" }
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "accessToken": "nestjs_jwt_token",
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

## 2. 온보딩 (Onboarding)

### POST `/onboarding` — 온보딩 데이터 저장 (인증 필요)

최초 1회. 재무 프로필 + 좋은 소비 + 고정 소비를 한 번에 저장.

**Request**

```json
{
  "age": 27,
  "monthlyIncome": 2300000,
  "goodSpendings": [
    { "type": "savings", "label": "적금", "amount": 300000 },
    { "type": "pension_savings", "label": "연금저축", "amount": 100000 }
  ],
  "fixedExpenses": {
    "rent": 700000,
    "utilities": 100000,
    "phone": 55000
  }
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "grade": "YELLOW",
    "surplus": {
      "monthly": 1045000,
      "weekly": 243023,
      "daily": 34833
    }
  }
}
```

---

## 3. 유저 (Users)

### GET `/users/me` — 내 정보 조회 (인증 필요)

```json
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

### PATCH `/users/me` — 내 정보 수정 (인증 필요)

```json
{ "email": "new@email.com", "marketingConsent": true }
```

### DELETE `/users/me` — 회원 탈퇴 (인증 필요)

---

## 4. 재무 프로필 (Finance)

### GET `/finance/profile` — 재무 프로필 + 잉여자금 조회 (인증 필요)

```json
{
  "success": true,
  "data": {
    "age": 27,
    "monthlyIncome": 2300000,
    "grade": "YELLOW",
    "goodSpendings": [
      { "id": "uuid", "type": "savings", "label": "적금", "amount": 300000 },
      { "id": "uuid", "type": "pension_savings", "label": "연금저축", "amount": 100000 }
    ],
    "goodSpendingTotal": 400000,
    "fixedExpenses": {
      "rent": 700000,
      "utilities": 100000,
      "phone": 55000
    },
    "fixedExpenseTotal": 855000,
    "surplus": {
      "monthly": 1045000,
      "weekly": 243023,
      "daily": 34833
    }
  }
}
```

### PATCH `/finance/profile` — 재무 프로필 수정 (인증 필요)

수정 즉시 잉여자금 재계산 후 반환. 변경할 항목만 전송.

```json
{ "age": 28, "monthlyIncome": 2500000 }
```

Response — `GET /finance/profile`과 동일 구조

---

### POST `/finance/good-spendings` — 좋은 소비 추가 (인증 필요)

```json
{ "type": "irp", "label": "IRP", "amount": 200000 }
```

### PATCH `/finance/good-spendings/:id` — 좋은 소비 수정 (인증 필요)

```json
{ "amount": 250000 }
```

### DELETE `/finance/good-spendings/:id` — 좋은 소비 삭제 (인증 필요)

---

### PATCH `/finance/fixed-expenses` — 고정 소비 수정 (인증 필요)

```json
{ "rent": 650000, "utilities": 90000, "phone": 55000 }
```

---

## 5. 페이스메이커 (Pacemaker)

### GET `/pacemaker/today` — 오늘의 페이스메이커 메시지 (인증 필요)

오늘 메시지가 없으면 AI로 생성 후 반환. 이미 있으면 캐시된 메시지 반환.

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "date": "2026-04-02",
    "message": "야 하루에 34,833원인데 어제 배달만 2번이잖아 ㅋㅋ 오늘은 도시락 싸가자",
    "grade": "YELLOW",
    "dailySurplus": 34833,
    "actions": [
      {
        "type": "learn_content",
        "id": "uuid",
        "title": "배달비 월 30만 원 = 1년 360만 원",
        "label": "이거 읽어봐 →"
      }
    ],
    "createdAt": "2026-04-02T00:00:00.000Z"
  }
}
```

| 필드 | 설명 |
|---|---|
| `message` | AI가 생성한 오늘의 메시지 |
| `actions` | 추천 행동 1~2개 (마이북 콘텐츠 링크) |
| `actions[].type` | `learn_content`, `detailed_report`, `weekly_report` |

---

### GET `/pacemaker/history` — 페이스메이커 메시지 히스토리 (인증 필요)

**Query:** `?page=1&limit=20`

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "date": "2026-04-02",
        "message": "야 하루에 34,833원인데...",
        "grade": "YELLOW"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 15 }
  }
}
```

---

## 6. 마이북 (Book)

### GET `/book/detailed-reports` — 상세 리포트 목록 (인증 필요)

```json
{
  "success": true,
  "data": {
    "canGenerate": true,
    "nextAvailableDate": null,
    "items": [
      {
        "id": "uuid",
        "title": "4월 재무 분석 리포트",
        "summary": "잉여자금 104만 원, 하루 3.5만 원...",
        "createdAt": "2026-04-01T00:00:00.000Z"
      }
    ]
  }
}
```

### GET `/book/detailed-reports/:id` — 상세 리포트 상세 (인증 필요)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "title": "4월 재무 분석 리포트",
    "content": "마크다운 본문...",
    "grade": "YELLOW",
    "surplus": { "monthly": 1045000, "daily": 34833 },
    "analysis": {
      "wellDone": "적금과 연금저축을 꾸준히 하고 있어요.",
      "improvement": "고정 소비 중 통신비를 줄일 수 있어요.",
      "actionPlan": "알뜰 요금제 전환 시 월 2만 원 절약 가능"
    },
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```

---

### GET `/book/weekly-reports` — 주간 리포트 목록 (인증 필요)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "weekStart": "2026-03-25",
      "weekEnd": "2026-03-31",
      "summary": "이번 주 잘 버텼어요. 식비를 잘 잡았어요.",
      "createdAt": "2026-04-01T00:00:00.000Z"
    }
  ]
}
```

### POST `/book/weekly-reports` — 주간 리포트 생성 (인증 필요)

**Request**

```json
{
  "weekStatus": {
    "overallFeeling": "tight",
    "memo": "이번 주 회식이 2번이나 있어서 식비가 많이 나갔어요"
  }
}
```

**Response 201**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "weekStart": "2026-03-25",
    "weekEnd": "2026-03-31",
    "summary": "회식이 잦았던 주, 하지만 다음 주는 잡을 수 있어요.",
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```

### GET `/book/weekly-reports/:id` — 주간 리포트 상세 (인증 필요)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "weekStart": "2026-03-25",
    "weekEnd": "2026-03-31",
    "summary": "회식이 잦았던 주, 하지만 다음 주는 잡을 수 있어요.",
    "guide": "마크다운 본문 — 한 쪽짜리 가이드...",
    "userInput": {
      "overallFeeling": "tight",
      "memo": "회식 2번..."
    },
    "createdAt": "2026-04-01T00:00:00.000Z"
  }
}
```

---

### GET `/book/learn` — 금융 학습 콘텐츠 목록 (인증 필요)

내 등급 기준. `?grade=RED`로 특정 등급 지정 가능.

```json
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

### GET `/book/learn/:id` — 콘텐츠 상세 (인증 필요, 조회 시 자동 읽음 처리)

```json
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

### POST `/book/learn/:id/scrap` — 스크랩 토글 (인증 필요)

```json
{ "success": true, "data": { "isScrapped": true } }
```

---

### GET `/book/scraps` — 내 스크랩 목록 (인증 필요)

```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "title": "비상금 없으면 진짜 거지 됩니다",
      "grade": "RED",
      "type": "learn",
      "scrappedAt": "2026-04-01T12:00:00.000Z"
    }
  ]
}
```

---

## 7. 운영 상수 (Constants)

### GET `/constants` — 운영 상수 조회 (인증 불필요)

앱 시작 시 1회 호출.

```json
{
  "success": true,
  "data": {
    "seoulAverageRent": 730000,
    "categoryAverages": {
      "food": 420000,
      "transport": 80000,
      "subscription": 50000,
      "shopping": 150000,
      "leisure": 220000,
      "etc": 100000
    },
    "inflationRate": 0.025,
    "updatedAt": "2026-01-01T00:00:00.000Z"
  }
}
```

---

## API 엔드포인트 전체 목록

| 메서드 | 경로 | 인증 | 설명 |
|---|---|---|---|
| POST | `/auth/kakao` | X | 로그인/회원가입 |
| POST | `/onboarding` | O | 온보딩 데이터 저장 |
| GET | `/users/me` | O | 내 정보 조회 |
| PATCH | `/users/me` | O | 내 정보 수정 |
| DELETE | `/users/me` | O | 회원 탈퇴 |
| GET | `/finance/profile` | O | 재무 프로필 + 잉여자금 |
| PATCH | `/finance/profile` | O | 재무 프로필 수정 |
| POST | `/finance/good-spendings` | O | 좋은 소비 추가 |
| PATCH | `/finance/good-spendings/:id` | O | 좋은 소비 수정 |
| DELETE | `/finance/good-spendings/:id` | O | 좋은 소비 삭제 |
| PATCH | `/finance/fixed-expenses` | O | 고정 소비 수정 |
| GET | `/pacemaker/today` | O | 오늘의 메시지 |
| GET | `/pacemaker/history` | O | 메시지 히스토리 |
| GET | `/book/detailed-reports` | O | 상세 리포트 목록 |
| GET | `/book/detailed-reports/:id` | O | 상세 리포트 상세 |
| GET | `/book/weekly-reports` | O | 주간 리포트 목록 |
| POST | `/book/weekly-reports` | O | 주간 리포트 생성 |
| GET | `/book/weekly-reports/:id` | O | 주간 리포트 상세 |
| GET | `/book/learn` | O | 학습 콘텐츠 목록 |
| GET | `/book/learn/:id` | O | 학습 콘텐츠 상세 |
| POST | `/book/learn/:id/scrap` | O | 스크랩 토글 |
| GET | `/book/scraps` | O | 내 스크랩 목록 |
| GET | `/constants` | X | 운영 상수 |

---

*머니런 API 통합 명세서 v2.0 — 2026.04.02*
