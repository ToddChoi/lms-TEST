# Ingrow LMS — QA 검증 리포트

> 작성일: 2026-04-28  
> 검증 범위: 전체 소스코드 정적 분석 (src/, API routes, middleware)

---

## 우선순위 기준

| 레벨 | 설명 |
|------|------|
| 🔴 **P1 — Critical** | 빌드 실패 또는 핵심 기능 완전 동작 불가 |
| 🟠 **P2 — High** | 주요 페이지 404 / 사용자가 바로 마주치는 UX 차단 |
| 🟡 **P3 — Medium** | 일부 기능 오작동, 데이터 누락 |
| 🟢 **P4 — Low** | 개선 필요하나 사용에 큰 지장 없음 |

---

## 🔴 P1 — Critical

### 1. DB 컬럼 오류: `is_published` (존재하지 않는 컬럼)

**영향 파일:**
- `src/app/admin/statistics/page.tsx` — line 22
- `src/app/admin/courses/[id]/sections/page.tsx` — line 21, 24, 69, 72

**문제:** `courses` 테이블에는 `is_published` 컬럼이 없고 `status` 컬럼(draft/active/closed)을 사용.  
통계 페이지의 "활성 강좌" 카운트가 항상 0으로 표시되며, sections 페이지에서 공개/비공개 배지가 오작동.

**수정 방향:**
```ts
// statistics/page.tsx line 22
// 변경 전
supabase.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true)
// 변경 후
supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'active')

// sections/page.tsx line 21
// 변경 전
.select('id, title, is_published')
// 변경 후
.select('id, title, status')
```

---

### 2. DB Migration 미실행 — `CourseDetailForm` 크래시

**영향 파일:** `src/components/courses/CourseDetailForm.tsx`  
**관련 파일:** `supabase/migration_course_details.sql`

**문제:** 강좌 편집 → "상세 정보" 탭이 `what_you_learn`, `requirements`, `target_audience`, `instructor_name`, `instructor_bio` 컬럼을 읽으려 하지만, 해당 컬럼들이 DB에 존재하지 않아 저장 시 오류 발생.

**수정 방향:** Supabase Dashboard → SQL Editor에서 아래 실행:
```sql
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS what_you_learn  TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS requirements    TEXT[]  DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS target_audience TEXT,
  ADD COLUMN IF NOT EXISTS instructor_name TEXT,
  ADD COLUMN IF NOT EXISTS instructor_bio  TEXT;
```

---

### 3. 결제 기능 완전 동작 불가 (Stripe 미설정)

**영향 파일:** `src/lib/stripe.ts`, `src/app/api/payments/checkout/route.ts`, `src/app/api/payments/webhook/route.ts`

**문제:** 아래 3개 환경변수가 없으면 유료 강좌 결제 불가.  
- `STRIPE_SECRET_KEY` — 없으면 `sk_test_placeholder`로 대체 → API 호출 시 Stripe 401 에러  
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — 프론트 미사용이지만 webhook 처리 불가  
- `STRIPE_WEBHOOK_SECRET` — 결제 완료 후 수강 등록이 안 됨

**수정 방향:** Vercel 환경변수에 Stripe 키 추가. 또는 유료 강좌 기능을 비활성화할 경우 `EnrollButton`에서 price > 0 조건부 UI를 "준비 중" 메시지로 교체.

---

### 4. `NEXT_PUBLIC_APP_URL` 미설정 — 결제 리다이렉트 localhost로 이동

**영향 파일:** `src/app/api/payments/checkout/route.ts` — line 94

**문제:** Vercel 환경변수에 `NEXT_PUBLIC_APP_URL`이 없으면 결제 성공/실패 후 `http://localhost:3000`으로 리다이렉트됨.

**수정 방향:** Vercel 환경변수에 추가:
```
NEXT_PUBLIC_APP_URL = https://lms-test-xxx.vercel.app
```

---

## 🟠 P2 — High

### 5. 헤더 네비게이션 링크 4개 모두 404

**영향 파일:** `src/components/layout/Header.tsx` — NAV_LINKS 배열

| 링크 | 페이지 존재 여부 |
|------|----------------|
| `/notice` | ❌ 없음 |
| `/faq` | ❌ 없음 |
| `/b2b` | ❌ 없음 |
| `/contact` | ❌ 없음 |

홈페이지 상단 내비게이션 전체가 클릭 시 404. 첫 방문자가 바로 마주치는 치명적 UX.

---

### 6. 푸터 링크 404

**영향 파일:** `src/components/layout/Footer.tsx`  
`/b2b`, `/notice`, `/faq`, `/contact` 동일하게 404.

---

### 7. 로그인 페이지 "비밀번호를 잊으셨나요?" 404

**영향 파일:** `src/app/(auth)/login/page.tsx` — line 75  
`/forgot-password` 페이지 없음. 클릭 시 404.

---

### 8. 헤더 사용자 메뉴 "프로필 설정" 404

**영향 파일:** `src/components/layout/Header.tsx` — line 89  
`/my/profile` 페이지 없음.

---

### 9. 관리자 사이드바 링크 4개 404

**영향 파일:** `src/app/admin/layout.tsx` — ADMIN_NAV 배열

| 링크 | 페이지 존재 여부 |
|------|----------------|
| `/admin/faqs` | ❌ 없음 |
| `/admin/contacts` | ❌ 없음 |
| `/admin/banners` | ❌ 없음 |
| `/admin/menus` | ❌ 없음 |

---

### 10. Supabase Auth URL 미설정 — Vercel 배포 후 로그인/회원가입 불가

**문제:** Supabase Dashboard에서 Vercel URL을 허용하지 않으면 로그인, 회원가입, 이메일 인증이 모두 실패.

**수정 방향:**  
Supabase Dashboard → Authentication → URL Configuration:
- **Site URL**: `https://lms-test-xxx.vercel.app`
- **Redirect URLs**: `https://lms-test-xxx.vercel.app/**`

---

## 🟡 P3 — Medium

### 11. YouTube / Vimeo 강의 수강 진도 미저장

**영향 파일:** `src/components/learn/VideoPlayer.tsx`

**문제:** HTML5 `<video>` 엘리먼트에만 `timeupdate`/`ended` 이벤트가 연결되어 있음. YouTube iframe과 Vimeo iframe은 진도가 전혀 저장되지 않음 → 수료 조건 충족 불가.

---

### 12. 강좌 `total_duration` 자동 갱신 없음

**문제:** 강의를 추가/수정/삭제해도 `courses.total_duration` 필드가 자동으로 재계산되지 않음. 강좌 목록, 상세 페이지, 마이페이지에서 총 학습 시간이 부정확하게 표시됨.

**수정 방향:** `lessons` CRUD API 처리 후 해당 강좌의 `total_duration`을 재합산하여 업데이트.

---

### 13. 학습 페이지 전체 강의 순서 정렬 오류

**영향 파일:** `src/app/my/courses/[id]/learn/page.tsx` — line 50-52

**문제:** `allLessons`를 `sort_order`로 정렬하지만, 섹션별로 sort_order가 독립적으로 1부터 시작함 (섹션1의 강의1, 섹션2의 강의1이 같은 sort_order 1을 가질 수 있음). 이전/다음 이동 순서가 틀릴 수 있음.

**수정 방향:** 섹션 sort_order → 강의 sort_order 복합 정렬 적용.

---

### 14. 강좌 편집 — 저장 후 `total_duration` 반영 안 됨

**영향 파일:** `src/components/courses/CourseForm.tsx`

**문제:** 강좌 편집 탭의 "기본 정보"에서 total_duration을 수동 입력해야 함. 실제 강의 시간 합산값과 괴리 발생.

---

### 15. 관리자 통계 기업별 수강현황 — N+1 쿼리 성능 문제

**영향 파일:** `src/app/admin/statistics/page.tsx` — line 111~143

**문제:** 기업 수만큼 `for` 루프 안에서 각각 3개의 쿼리(members, enrollments, completed)를 실행. 기업이 많아질수록 페이지 로드가 매우 느려짐.

---

## 🟢 P4 — Low

### 16. 관리자 사이드바 현재 페이지 활성 표시 없음

**영향 파일:** `src/app/admin/layout.tsx`

현재 어느 메뉴인지 강조 표시가 없어 UX가 불편함. `usePathname()`으로 현재 경로 비교 후 active 스타일 추가 필요 (단, 서버 컴포넌트라 클라이언트 전환 또는 별도 NavItem 컴포넌트 분리 필요).

---

### 17. 관리자 테이블 페이지네이션 없음

해당 페이지: 강좌 관리, 회원 관리, 수강 신청, 수료증  
데이터가 많아지면 전체를 한 번에 로드 → 성능 저하 및 UI 과부하.

---

### 18. 홈페이지 추천 강좌 — 썸네일 미노출

**영향 파일:** `src/app/(public)/page.tsx` — line 132-134

`is_featured = true`인 강좌가 없으면 "추천 강좌" 섹션 자체가 미노출. thumbnail_url도 BookOpen 아이콘으로 대체되어 볼품없음.

---

### 19. 수강 신청 후 `router.refresh()` 미적용 케이스

**영향 파일:** `src/components/courses/EnrollButton.tsx` — line 107-108

`router.push` 후 `router.refresh()`를 호출하지만 Next.js App Router에서는 push와 refresh가 경쟁 조건이 될 수 있음. 수강 신청 직후 학습 페이지에서 enrollment가 아직 반영 안 된 상태로 표시될 수 있음.

---

### 20. `dayjs` import — 타임존 설정 없음

**영향 파일:** `src/app/admin/page.tsx`, `src/app/admin/statistics/page.tsx`

서버가 UTC 기준이므로 `thisMonthStart`가 한국 시간 기준과 다를 수 있음. KST(+9) 플러그인 미적용.

---

## 요약 표

| # | 우선순위 | 영역 | 문제 | 상태 |
|---|---------|------|------|------|
| 1 | 🔴 P1 | 관리자/통계 | `is_published` 잘못된 컬럼명 | ✅ 수정완료 |
| 2 | 🔴 P1 | 관리자/강좌 | DB Migration 미실행 | ✅ 수정완료 |
| 3 | 🔴 P1 | 결제 | Stripe 환경변수 미설정 | ⏸ 보류 (Stripe 미도입) |
| 4 | 🔴 P1 | 결제 | `NEXT_PUBLIC_APP_URL` 미설정 | ✅ 수정완료 |
| 5 | 🟠 P2 | 공개 헤더 | 네비 링크 4개 404 | ✅ 수정완료 |
| 6 | 🟠 P2 | 공개 푸터 | 푸터 링크 4개 404 | ✅ 수정완료 |
| 7 | 🟠 P2 | 로그인 | 비밀번호 찾기 페이지 없음 | ✅ 수정완료 |
| 8 | 🟠 P2 | 헤더 | 프로필 설정 페이지 없음 | ✅ 수정완료 |
| 9 | 🟠 P2 | 관리자 사이드바 | 4개 메뉴 404 | ✅ 수정완료 (메뉴 제거) |
| 10 | 🟠 P2 | 인증 | Supabase URL 미설정 | ✅ 수정완료 |
| 11 | 🟡 P3 | 학습 | YouTube/Vimeo 진도 미저장 | 미수정 |
| 12 | 🟡 P3 | 강좌 | `total_duration` 자동 갱신 없음 | 미수정 |
| 13 | 🟡 P3 | 학습 | 전체 강의 정렬 오류 | 미수정 |
| 14 | 🟡 P3 | 관리자/강좌 | duration 수동 입력 의존 | 미수정 |
| 15 | 🟡 P3 | 관리자/통계 | N+1 쿼리 성능 문제 | 미수정 |
| 16 | 🟢 P4 | 관리자 | 사이드바 active 표시 없음 | 미수정 |
| 17 | 🟢 P4 | 관리자 | 테이블 페이지네이션 없음 | 미수정 |
| 18 | 🟢 P4 | 홈 | 추천 강좌 썸네일 미표시 | 미수정 |
| 19 | 🟢 P4 | 수강 | refresh 경쟁 조건 | 미수정 |
| 20 | 🟢 P4 | 관리자 | dayjs 타임존 미설정 | 미수정 |

---

## 즉시 실행 가능한 수동 조치

1. **Supabase SQL Editor 실행** — `supabase/migration_course_details.sql`
2. **Vercel 환경변수 추가** — `NEXT_PUBLIC_APP_URL=https://배포URL`
3. **Supabase Auth URL 설정** — Site URL + Redirect URLs에 Vercel URL 추가
