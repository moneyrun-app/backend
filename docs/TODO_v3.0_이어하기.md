# v3.0 코스 시스템 — 이어하기 가이드

> **마지막 작업일:** 2026-04-15
> **커밋:** `01e7d98` feat: v3.0 코스 기반 초개인화 학습 시스템
> **빌드:** 성공 (에러 0)

---

## 완료된 것

### 문서
- [x] `CLAUDE.md` v5.0 — 코스 시스템 기준 문서
- [x] `docs/기획서_v3.0_2026-04-15.md` — 전체 기획서 (11개 섹션)
- [x] `docs/프론트엔드_전달사항_2026-04-15.md` — API 명세 + 페이지 가이드
- [x] v2.0 문서 삭제

### DB
- [x] `migrations/v3.0_2026-04-15_courses.sql` — SQL 파일 작성 완료
- [x] `supabase/migrations/009_v3_courses.sql` — 동일 파일 복사

### 코드 — 신규 `src/course/` 모듈
- [x] `course.module.ts` — 모듈 정의
- [x] `course.controller.ts` — 코스 조회/시작/완료 + 미션 API
- [x] `course.service.ts` — 코스 CRUD, user_courses 관리
- [x] `onboarding.controller.ts` — v3 온보딩 5단계 엔드포인트 (8개 API)
- [x] `onboarding.service.ts` — 단계별 로직 + 이어하기
- [x] `course-book.generator.ts` — AI 마이북 + 미션 비동기 생성
- [x] `mission.service.ts` — 미션 CRUD + 완료 추적
- [x] `diagnostic.service.ts` — 진단퀴즈 + 레벨 배정
- [x] `dto/` 4개 파일

### 코드 — 기존 모듈 수정
- [x] `quiz/quiz.service.ts` — getTodayQuiz에 courseCategory 파라미터 추가
- [x] `pacemaker/pacemaker.module.ts` — CourseModule import
- [x] `pacemaker/pacemaker.service.ts` — 코스 컨텍스트 + 코스 기반 퀴즈
- [x] `pacemaker/message.generator.ts` — 코스 진도/미션 프롬프트
- [x] `my-book/my-book.service.ts` — courseBook 필드 + source:'course'
- [x] `auth/auth.service.ts` — kakaoLogin 응답에 onboardingVersion 추가
- [x] `app.module.ts` — CourseModule 등록

---

## 남은 작업 (순서대로)

### 1. DB 마이그레이션 실행 (최우선)
```
방법 A: Supabase 대시보드
  1. https://supabase.com/dashboard → moneyrun 프로젝트
  2. SQL Editor 열기
  3. migrations/v3.0_2026-04-15_courses.sql 내용 복사 & 실행

방법 B: CLI
  supabase db push
  → DB 비밀번호 입력 필요 (대시보드 Settings > Database에서 확인)
```

### 2. 진단퀴즈 50문제 seed 생성
- `diagnostic_quizzes` 테이블에 카테고리별 10문제씩 INSERT
- 카테고리: 연금, 주식, 부동산, 세금_연말정산, 소비_저축
- 각 문제에 `difficulty_weight` 1~3 (레벨 배정용 가중치)
- AI로 생성하면 됨

### 3. users/me 응답 수정
- `src/users/` 컨트롤러 또는 서비스에서 응답에 추가:
  - `onboardingVersion: number` (2 또는 3)
  - `activeCourseId: string | null`

### 4. API 통합 테스트
- 온보딩 5단계 흐름 실제 호출 테스트
- 페이스메이커에 코스 컨텍스트 반영 확인
- 퀴즈가 코스 카테고리로 필터링되는지 확인

---

## 프론트 전달 완료 사항

| # | 질문 | 답변 |
|---|---|---|
| 1 | `/auth/kakao`에 `onboardingVersion`? | 추가 완료. `user.onboardingVersion` (2=v2, 3=v3) |
| 2 | step4 generate 멱등성? | 보장됨. generating이면 기존 purchaseId 반환 |
| 3 | v2 미완료 유저? | v3 온보딩으로 보내면 됨. step3에서 version=3 업데이트 |
| 4 | 시뮬레이션 유지? | 유지. POST /simulation/calculate 변경 없음 |

---

## 핵심 설계 결정 요약

- **1인 1활성 코스** — user_courses에 partial unique index
- **코스와 서점 공존** — source: 'course'/'store'/'scrap' 구분
- **온보딩 이어하기** — onboarding_progress 테이블에 단계별 저장
- **퀴즈 코스 스코핑** — quizzes.course_category 컬럼으로 매핑
- **페이스메이커 코스 인식** — 5카드 중 1장은 코스 관련

---

*이 파일은 v3.0 작업 완료 후 삭제해도 됨*
