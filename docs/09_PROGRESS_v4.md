# 머니런 백엔드 v4.0 진행 현황

> 2026.04.05~06 작업 내역. 다음 세션에서 이어서 작업할 때 참고.

---

## 완료된 작업

### 1. 인프라
- [x] Render 배포 완료 (`https://moneyrun-backend.onrender.com`)
- [x] CORS 설정: `https://moneyrun-beta.vercel.app` 허용 (Render 환경변수)
- [x] Anthropic API 모델명 수정: `claude-sonnet-4-20250514` (이전 모델명 404 에러 해결)

### 2. 온보딩/프로필 필드 전면 변경
- [x] **삭제**: `monthlyInvestment`, `expectedReturn`, `investmentYears`
- [x] **추가**: `nickname`, `retirementAge`, `pensionStartAge`(기본65), `monthlyVariableCost`
- [x] **등급 기준 변경**: 총지출/소득 비율 (70%↑ RED, 50%↑ YELLOW, 50%↓ GREEN)
- [x] **계산값 추가**: `monthlyExpense`, `surplus`, `investmentPeriod`, `vestingPeriod`
- [x] DB 마이그레이션 완료 (`finance_profiles` 컬럼 변경)
- [x] 영향 API: `POST /auth/onboarding`, `GET/PATCH /finance/profile`, `POST /simulation/calculate`

### 3. 변동비 계산 변경
- [x] `daily = floor1000(잉여자금 / 해당월 실제 일수)`
- [x] `weekly = floor1000(daily × 7)`
- [x] `daysInMonth` 응답에 포함
- [x] 모든 금액 천원 단위 내림 (`Math.floor(n / 1000) * 1000`)

### 4. 시뮬레이션 변경
- [x] 3가지 시나리오: 예적금 3%, KOSPI 7%, S&P500 10%
- [x] 거치기간 복리 적용
- [x] 응답: `simulation.cases[]` 배열

### 5. 페이스메이커 — 오늘의 한마디 (1개)
- [x] 100개 배치 → 1개 단일 메시지로 변경
- [x] `message` (문자열), `messages[]` 배열 아님
- [x] `POST /pacemaker/refresh` 삭제
- [x] DB 유니크 제약: `user_id + date` (동시 요청 중복 방지)
- [x] AI 실패 시 폴백 메시지

### 6. 페이스메이커 — OX 퀴즈
- [x] `quizzes` 테이블: 전체 유저 공통 퀴즈 풀 (30개 시드)
- [x] `quiz_answers` 테이블: 유저별 답변 기록
- [x] `wrong_notes` 테이블: 오답노트 (user_answer, detailed_explanation 포함)
- [x] `GET /pacemaker/today` 응답에 `quizzes[]` 10개 포함
- [x] 오답 재출제: 10개 중 30%(3개)를 오답노트에서 재출제, `source: "오답노트 복습"`
- [x] 재출제에서 맞추면 `wrong_notes`에서 자동 삭제
- [x] `POST /pacemaker/quiz/:id/answer` — 답변 제출
- [x] 틀리면 AI 상세 설명 생성 → `detailed_explanation` 저장
- [x] `GET /book/wrong-notes` — 오답노트 목록 (`userAnswer`, `detailedExplanation` 포함)
- [x] ~~`POST /book/wrong-notes/:id/retry`~~ 삭제

### 7. 일별 지출 체크 (주간 리뷰 대체)
- [x] `weekly_reviews` 테이블 삭제
- [x] `daily_checks` 테이블 생성 (`user_id, date, status, amount`)
- [x] `POST /pacemaker/daily-check` — 일별 체크 저장/수정 (미래 날짜 차단)
- [x] `GET /pacemaker/daily-checks?month=2026-04` — 월별 체크 목록
- [x] ~~`POST /pacemaker/weekly-review`~~ 삭제
- [x] ~~`GET /pacemaker/weekly-reviews`~~ 삭제

### 8. 월간 리포트 (주간 대체)
- [x] `weekly_reports` → `monthly_reports` 테이블 리네임
- [x] `GET /book/monthly-reports` — 월간 리포트 목록
- [x] `POST /book/monthly-reports` — 월간 리포트 생성
- [x] `GET /book/monthly-reports/:id` — 월간 리포트 상세
- [x] ~~`GET/POST /book/weekly-reports`~~ 삭제

### 9. 시뮬레이터 분석 리포트 (상세 리포트 변경)
- [x] `title` → "시뮬레이터 분석 리포트" 고정
- [x] `analyzedAt` 필드 추가
- [x] `pdfUrl` 필드 제거
- [x] ~~`GET /book/detailed-reports/:id/download`~~ 삭제
- [x] `content` 필드: 마크다운 → **JSON sections 구조**로 변경
- [x] 프론트에서 section.type별 컴포넌트 렌더링 (차트, 카드, 그래프 등)
- [x] 9개 파트 35+ 섹션의 풍부한 분석 리포트 (PDF 40~50쪽 분량)

### 10. 학습 API 삭제
- [x] ~~`GET /book/learn`~~ 삭제
- [x] ~~`GET /book/learn/:id`~~ 삭제
- [x] ~~`POST /book/learn/:id/scrap`~~ 삭제

---

## 현재 API 전체 목록

### 인증
| API | 설명 |
|---|---|
| `POST /auth/kakao` | 카카오 로그인 |
| `POST /auth/onboarding` | 온보딩 저장 |

### 유저
| API | 설명 |
|---|---|
| `GET /users/me` | 내 정보 조회 |
| `PATCH /users/me` | 내 정보 수정 |
| `DELETE /users/me` | 회원 탈퇴 |

### 재무
| API | 설명 |
|---|---|
| `GET /finance/profile` | 재무 프로필 조회 |
| `PATCH /finance/profile` | 재무 프로필 수정 |

### 시뮬레이션
| API | 설명 |
|---|---|
| `POST /simulation/calculate` | 비로그인 시뮬레이션 |

### 페이스메이커
| API | 설명 |
|---|---|
| `GET /pacemaker/today` | 오늘의 한마디 + 퀴즈 10개 |
| `POST /pacemaker/quiz/:id/answer` | 퀴즈 OX 답변 |
| `POST /pacemaker/daily-check` | 일별 지출 체크 |
| `GET /pacemaker/daily-checks?month=` | 월별 체크 목록 |
| `POST /pacemaker/actions/:id/complete` | 추천 행동 완료 |
| `POST /pacemaker/feedback` | 피드백 제출 |
| `GET /pacemaker/history` | 메시지 히스토리 |

### 마이북
| API | 설명 |
|---|---|
| `GET /book/detailed-reports` | 시뮬레이터 리포트 목록 |
| `GET /book/detailed-reports/:id` | 시뮬레이터 리포트 상세 |
| `POST /book/detailed-reports/generate` | 리포트 재생성 (유료) |
| `GET /book/monthly-reports` | 월간 리포트 목록 |
| `POST /book/monthly-reports` | 월간 리포트 생성 |
| `GET /book/monthly-reports/:id` | 월간 리포트 상세 |
| `POST /book/scraps` | 외부 URL 스크랩 |
| `GET /book/scraps` | 스크랩 목록 |
| `DELETE /book/scraps/:id` | 스크랩 삭제 |
| `GET /book/wrong-notes` | 오답노트 목록 |

### 기타
| API | 설명 |
|---|---|
| `GET /constants` | 운영 상수 조회 |

---

## DB 테이블 현황 (Supabase)

| 테이블 | 설명 | 변경사항 |
|---|---|---|
| `users` | 유저 | 변경 없음 |
| `finance_profiles` | 재무 프로필 | 컬럼 변경 (retirement_age, pension_start_age, monthly_variable_cost 추가) |
| `pacemaker_messages` | 일일 메시지 | message(text 단일), quiz_ids(jsonb) |
| `pacemaker_actions` | 추천 행동 | 유지 |
| `pacemaker_feedback` | 피드백 | 유지 |
| `daily_checks` | 일별 지출 체크 | **신규** (date, status, amount) |
| `quizzes` | OX 퀴즈 풀 | **신규** (30개 시드) |
| `quiz_answers` | 퀴즈 답변 기록 | **신규** |
| `wrong_notes` | 오답노트 | **신규** (user_answer, detailed_explanation) |
| `detailed_reports` | 시뮬레이터 분석 리포트 | content → JSON sections |
| `monthly_reports` | 월간 리포트 | weekly_reports에서 리네임 |
| `external_scraps` | 외부 스크랩 | 유지 |
| `learn_contents` | 학습 콘텐츠 | 미사용 (API 삭제됨) |
| `report_payments` | 결제 이력 | 유지 |
| `system_config` | 운영 상수 | 유지 |

---

## 남은 작업 / TODO

- [ ] 퀴즈 시드 데이터 추가 (현재 30개 → 200개 이상 필요)
- [ ] 공공 API 연동 (재경부 시사퀴즈, 한국은행 용어사전, 예탁결제원 금융용어)
- [ ] 네이버 뉴스 API 연동 (데일리 뉴스 퀴즈)
- [ ] 시뮬레이터 분석 리포트 AI 자동 생성 시 JSON sections 구조로 출력
- [ ] 월간 리포트 AI 프롬프트 보강
- [ ] 결제 모듈 연동 (토스페이먼츠 등)
- [ ] Render 재배포 (현재 코드 반영)

---

*2026.04.06 작성*
