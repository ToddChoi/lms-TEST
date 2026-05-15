# Ingrow LMS

Next.js 14 (App Router) + Supabase 기반 자체 LMS.
온라인 영상 강좌 + 오프라인 워크샵·정규 과정·기업 맞춤 교육을 한 플랫폼에서 운영.

- 운영 URL: https://lms-test-six.vercel.app
- Repo: `ToddChoi/lms-TEST` (Vercel project `lms-test`, team `toddchois-projects`)
- Supabase: `unrhoadjtyyuqvtdeyks`

---

## 빠른 시작 (로컬 개발)

```bash
# 1. 의존성 설치
npm install

# 2. 환경변수 — .env.local 작성
cp .env.local.example .env.local
# → 최소 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY / SERVICE_ROLE_KEY 채움

# 3. 마이그레이션 — Supabase Dashboard > SQL Editor 에서 실행 (아래 §3)

# 4. 개발 서버
npm run dev
# → http://localhost:3000
```

## 스크립트

```bash
npm run dev         # Next dev 서버
npm run build       # production build
npm run start       # production server (build 후)
npm run typecheck   # tsc --noEmit
npm run lint        # ESLint
npm run test        # Vitest 단위 테스트
npm run test:watch  # Vitest watch 모드
```

---

## 1. 기술 스택

| 영역 | 채택 |
|---|---|
| Framework | Next.js 14.2.15 (App Router) |
| Auth / DB | Supabase (`@supabase/ssr`) — RLS 기반 |
| TypeScript | strict, `target: es2017` |
| Styling | Tailwind CSS + clsx + tailwind-merge |
| Forms | react-hook-form + zod |
| Charts | recharts |
| Email | Resend + `@react-email/components` |
| Payment | Stripe (test mode by default) |
| PDF | `@react-pdf/renderer` (한국어 NanumGothic) |
| HTML Sanitize | sanitize-html (서버 호환) |
| Cron | Vercel Cron (vercel.json) |
| Hosting | Vercel (region `icn1` — Seoul) |

---

## 2. 환경변수

`.env.local.example` 참조. 운영(Vercel)도 동일 키를 Settings → Environment Variables 에 등록.

| 키 | 필수 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 프로젝트 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | client/server anon 키 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | server-only (RLS 우회) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Stripe redirect / 이메일 link |
| `NEXT_PUBLIC_SITE_URL` | ✅ | SEO / canonical |
| `STRIPE_SECRET_KEY` | Phase 2+ | sk_test_... / sk_live_... |
| `STRIPE_WEBHOOK_SECRET` | Phase 2+ | 온라인 강좌 webhook |
| `STRIPE_OFFLINE_WEBHOOK_SECRET` | Phase 2+ | 오프라인 webhook (미설정 시 fallback) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Phase 2+ | pk_test_... / pk_live_... |
| `RESEND_API_KEY` | 선택 | 미설정 시 메일 skip |
| `EMAIL_FROM_ADDRESS` | 선택 | Resend 검증 도메인 |
| `CRON_SECRET` | Cron 사용 시 | Vercel Cron 인증 |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry 사용 시 | 클라이언트 + 서버 에러 전송 |
| `SENTRY_AUTH_TOKEN` | Source map 업로드 시 | sentry-cli release upload |
| `SENTRY_ORG` / `SENTRY_PROJECT` | Source map 업로드 시 | release 식별 |
| `SENTRY_ENVIRONMENT` | Sentry 사용 시 | production / preview / development 구분 |
| `KAKAO_ALIMTALK_API_KEY` | Phase 6 | 카카오 알림톡 (예정) |

---

## 3. Supabase 마이그레이션 적용 순서

Supabase Dashboard → SQL Editor 에서 **아래 그룹 순서대로** 실행. 그룹 안은 어떤 순서로도 OK (모두 `IF NOT EXISTS` 멱등).

### Group 0 — 베이스 (신규 환경에서 한 번)
```
schema.sql                                          ← 초기 16 테이블 + RLS 정책
schema_phase6.sql                                   ← Phase 6: payments / certificates 등
```

### Group 1 — 핵심 도메인 패치 (순차)
```
migration_phase1_foundation.sql
migration_phase2_b2b_seed.sql
migration_org_admin_role.sql                        ← profiles.role 'org_admin' 추가
migration_instructor_role.sql                       ← profiles.role 'instructor' 추가
migration_courses_metadata.sql                      ← courses 메타 필드
migration_course_details.sql
migration_total_duration_trigger.sql
migration_lesson_notes.sql
migration_recommendations.sql
migration_reviews_qa.sql / migration_review_fixes.sql
```

### Group 2 — CMS / B2B Phase 4-5
```
migration_cms.sql / migration_cms_v2.sql / migration_cms_storage.sql
migration_boards_v2.sql
migration_phase4_demo_tenant.sql
migration_phase4_audience_demo.sql
migration_phase4_collections_paths.sql
migration_phase5_banner_items_field.sql
migration_phase5_banner_sizing.sql
migration_phase5_home_seed.sql
migration_phase6_certificate_templates.sql
migration_notifications.sql                         ← notification_logs (이메일/SMS 로그)
```

### Group 3 — P0 / P1 핫픽스 (멱등, 운영 중에도 안전)
```
migration_security_hotfix_p0.sql                    ← P0 보안 패치
migration_p1_correctness.sql                        ← certificates UNIQUE(user_id, course_id) 등
migration_p1_phase8_role_check.sql                  ← profiles.role CHECK constraint
migration_lessons_course_id_backfill.sql            ← 기존 lessons 의 NULL course_id 채움
migration_lessons_soft_delete.sql                   ← lessons.deleted_at + 부분 인덱스 (P1)
fix_rls_recursion.sql / fix_signup_trigger.sql      ← RLS / 트리거 핫픽스
```

### Group 4 — 오프라인 교육 (11 테이블)
```
migration_offline_v2.sql                            ← 11 테이블 + RLS 19+ + 트리거 + 함수
```

### 적용 후 검증 쿼리
```sql
-- 모든 도메인 테이블 (대략 35+)
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';

-- 오프라인 11
SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'offline_%';
-- 오프라인 RLS 정책 19+
SELECT count(*) FROM pg_policies WHERE tablename LIKE 'offline_%';

-- 핵심 P1 컬럼 / 제약 존재 검증
SELECT column_name FROM information_schema.columns
  WHERE table_name='lessons' AND column_name='deleted_at';
SELECT * FROM information_schema.table_constraints WHERE constraint_name='profiles_role_check';
SELECT * FROM information_schema.table_constraints WHERE constraint_name='certificates_user_id_course_id_key';
```

### Supabase Storage Buckets

Dashboard → Storage 에서 **수동 생성** (RLS 정책은 각 버킷 설정에서 적용):

| Bucket | Public | 용도 | 누락 시 영향 |
|---|---|---|---|
| `course-videos` | private | 강좌 영상 (signed URL 통해서만 재생) | 영상 업로드/재생 실패 |
| `media` | public | CMS 미디어 라이브러리 (이미지/배너) | CMS 미디어 업로드 실패 |
| `thumbnails` | public | 강좌 / 프로그램 썸네일 | 썸네일 업로드 실패 |
| `certificates` | private | 발급된 수료증 PDF (온라인 + 오프라인 공용) | **수료증 일괄 발급 시 upload 실패** |

---

## 4. Vercel 배포 + Stripe / Cron 등록

### Vercel 배포
1. GitHub repo 연동 (자동 — main push 시 production deploy)
2. Environment Variables → 위 §2 키들 등록
3. Region: `icn1` (vercel.json 에 설정)

### Stripe Webhook 등록 (Phase 2 결제 활성화 후)
Stripe Dashboard → Developers → Webhooks → **Add endpoint**:

| Endpoint | URL | 이벤트 | Secret 환경변수 |
|---|---|---|---|
| 온라인 강좌 결제 | `/api/payments/webhook` | `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed` | `STRIPE_WEBHOOK_SECRET` |
| 오프라인 신청 결제 | `/api/offline/webhook` | (동일) | `STRIPE_OFFLINE_WEBHOOK_SECRET` |

각 endpoint signing secret 을 Vercel 환경변수에 추가.

### Vercel Cron 동작 확인
`vercel.json` 의 `crons` 배열에 정의된 작업이 Vercel 대시보드의 **Cron Jobs** 탭에 자동 등록됨. 각 cron 엔드포인트는 `Authorization: Bearer <CRON_SECRET>` 헤더 검증.

수동 트리거 (디버깅용):
```bash
curl -X POST https://lms-test-six.vercel.app/api/cron/expire-enrollments \
  -H "Authorization: Bearer $CRON_SECRET"
```

---

## 5. 프로젝트 구조

```
src/
├── app/
│   ├── (auth)/              ← 로그인 / 회원가입 / 비밀번호 찾기
│   ├── (public)/            ← 비로그인 접근 가능
│   │   ├── courses/         ← 온라인 강좌
│   │   └── offline/         ← 오프라인 교육 (Phase 1-2)
│   ├── admin/               ← 관리자 (admin / superadmin 만)
│   │   └── offline/         ← 오프라인 관리
│   ├── my/                  ← 로그인 사용자 마이페이지
│   │   ├── courses/         ← 학습 진행
│   │   └── offline/         ← 오프라인 신청 내역
│   ├── org/                 ← B2B 매니저 (org_admin)
│   ├── instructor/          ← 강사
│   └── api/
│       ├── admin/           ← admin 보호 API
│       ├── offline/         ← 오프라인 신청 + Stripe webhook
│       └── cron/            ← Vercel Cron 엔드포인트
├── components/
│   ├── admin/               ← 관리자 전용 (offline 하위 별도)
│   ├── courses/             ← 온라인 강좌 UI
│   ├── offline/             ← 오프라인 공개 UI
│   └── ui/                  ← 공용 (Button, EmptyState, Pagination 등)
├── lib/
│   ├── supabase/            ← server/client/admin
│   ├── email/               ← Resend + react-email 템플릿
│   ├── offline/             ← QR 토큰 등 오프라인 유틸
│   └── stripe.ts            ← Stripe lazy singleton
├── types/
│   └── database.ts          ← 수동 갱신 (Supabase CLI 도입 전까지)
└── docs/                    ← 기능 명세서 (FEATURE_*, DATA_MODEL_*)
```

---

## 6. 분리 원칙 (중요)

- **온라인 강좌 (`courses` / `enrollments` / `certificates`) 와 오프라인 (`offline_*`) 은 완전 분리**.
- 신규 오프라인 기능은 `src/app/(public)/offline/`, `src/app/admin/offline/`, `src/app/api/offline/`, `src/components/offline/`, `src/lib/offline/` 하위에만 작성.
- 공용 인프라 (auth, RLS pattern, EmptyState, Pagination, 이메일 헬퍼) 는 재사용.

---

## 7. 기능 명세서

`docs/` 하위에 PRD / 데이터 모델 명세 보관:

| 파일 | 내용 |
|---|---|
| `FEATURE_OFFLINE_EDUCATION.md` | 오프라인 교육 PRD (Phase 1-6 로드맵) |
| `DATA_MODEL_OFFLINE_V2.md` | 오프라인 데이터 모델 v2 (실제 적용된 schema/트리거/RLS) |

신규 기능 추가 시 `docs/` 에 명세서 우선 작성 → 마이그레이션 → 코드.

---

## 8. 디버깅 / 운영

- **로그**: Vercel Dashboard → Logs (실시간) / Build Logs
- **Supabase**: Dashboard → Logs (Postgres, API, Auth)
- **에러 추적**: 미도입 — Sentry 등 도입은 향후 백로그
- **이메일 발송 로그**: `notification_logs` 테이블 (status, error)
- **오프라인 알림 큐**: `offline_notifications` 테이블 (Phase 6 cron 도입 시 활용)
- **감사 로그**: `offline_audit_log` (admin/superadmin 만 조회)

---

## 9. 신규 환경 셋업 체크리스트

신규 Supabase / Vercel 환경에서 처음 띄울 때 **순서대로** 처리. 누락 시 어떤 기능이 깨지는지 표기.

### 9-1. Supabase
- [ ] **마이그레이션 그룹 0~4 적용** (§3) — 전체 적용 후 검증 쿼리 통과 확인.
- [ ] **Storage 버킷 4종 생성** (§3 표) — 특히 `certificates` 누락 시 수료증 발급 실패.
- [ ] **Auth Email Confirmation 정책 설정** — Dashboard → Auth → Settings.
- [ ] **(선택) RLS 동작 확인** — admin 계정으로 `/admin/users` 접근 / 일반 사용자로 `/admin/*` 접근 차단 확인.

### 9-2. Vercel
- [ ] **GitHub repo 연동** + main push 자동 배포.
- [ ] **Environment Variables 등록** — §2 의 모든 키 (Production / Preview 양쪽).
- [ ] **`vercel.json`** 의 region `icn1` 적용 확인.

### 9-3. Stripe (결제 활성화 시)
- [ ] **Webhook endpoint 2개 등록** — §4 표 (`/api/payments/webhook` + `/api/offline/webhook`).
- [ ] 각 endpoint signing secret → Vercel `STRIPE_WEBHOOK_SECRET` / `STRIPE_OFFLINE_WEBHOOK_SECRET`.
- [ ] **테스트 모드 → Live 전환 시** — sk_live_ / pk_live_ 키로 교체 + webhook 재등록.

### 9-4. Resend (이메일)
- [ ] **API Key 발급 + 도메인 검증** (https://resend.com).
- [ ] `RESEND_API_KEY` + `EMAIL_FROM_ADDRESS` 등록.
- [ ] (검증 도메인 미설정 시) Resend onboarding domain 으로 시작 → `noreply@onresend.com` 같은 값 사용.

### 9-5. Vercel Cron
- [ ] `vercel.json` 의 `crons` 배열에 정의된 작업이 Vercel **Cron Jobs** 탭에 자동 등록 확인.
- [ ] `CRON_SECRET` Vercel 환경변수 등록.
- [ ] **Hobby plan 한도**: 일일 cron 최대 2개. 현재 `expire-enrollments` + `offline/daily` (offline 통합) 2개 사용 중.

### 9-6. 운영 도메인 변경 시
- [ ] `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` 변경.
- [ ] Stripe webhook endpoint URL 변경.
- [ ] Supabase Auth → Site URL / Redirect URLs 갱신.

---

## 10. 코드 패턴 가이드

App Router 14 의 강점 활용 — 신규 mutation 작업 시 아래 패턴 따라.

### 10-1. Server Actions (form mutation)

Route Handler (`/api/...`) 대신 Server Action 우선. 5개 admin form 이미 마이그됨 (`src/app/admin/**/actions.ts`).

**Uncontrolled form** (formData 자동 수집, 단순 form):
```tsx
// actions.ts
'use server'
export async function saveSettingsAction(prev: State, formData: FormData): Promise<State> {
  const value = String(formData.get('field_name') ?? '')
  // ... validate + DB
  revalidatePath('/admin/settings')
  return { ok: true, ... }
}

// component.tsx
'use client'
import { useFormState, useFormStatus } from 'react-dom'
const [state, formAction] = useFormState(saveSettingsAction, initialState)
return <form action={formAction}>
  <input name="field_name" defaultValue={...} />
  <SubmitButton />
</form>
function SubmitButton() {
  const { pending } = useFormStatus()
  return <button disabled={pending}>{pending ? '...' : '저장'}</button>
}
```

**Controlled form** (react-hook-form + zod 통합 / state object 보존):
```tsx
// component.tsx
const [isPending, startTransition] = useTransition()
const onSubmit = (values) => {
  startTransition(async () => {
    const result = await createCompanyAction(values)
    if (!result.ok) { setError(result.error); return }
    router.push('/admin/companies')
  })
}
return <form onSubmit={handleSubmit(onSubmit)}>...</form>
```

**가드 / 갱신 규칙**:
- `requireAdmin()` 등 가드는 action 안에서 그대로 호출 (Route Handler 와 동일).
- 응답: `{ ok: true; data } | { ok: false; error }` (typed result) 또는 `useFormState` 의 state 객체.
- 페이지 갱신: `revalidatePath('/admin/foo')` (router.refresh 대체).

### 10-2. Parallel + Intercepting routes (modal)

`/admin/users` 가 PoC. 같은 URL 로 contextual modal 표시:
- `layout.tsx` — `{ children, modal }` slot
- `default.tsx` — children null fallback
- `@modal/default.tsx` — modal null fallback (닫힘)
- `@modal/(.)[id]/page.tsx` — intercepting route (목록에서 click 시)
- `[id]/page.tsx` — 풀 페이지 (직접 URL / 새로고침)

다른 admin 영역에 적용하려면 위 5개 파일 패턴을 그대로 복사 + path 만 변경.

### 10-3. Segment 표준 파일

신규 segment 추가 시 (예: `/admin/foo/`) 다음 3개 항상 추가:
- `loading.tsx` — server fetch 중 streaming UI
- `error.tsx` — 'use client' + reset() 버튼 + dev mode stack
- `not-found.tsx` — `notFound()` 호출 시 segment 디자인 유지

기존 7 segment × 3 = 21개 파일 참고 (Phase A commit `ac80a74`).

---

## 라이선스

내부 프로젝트 — 외부 배포 X.
