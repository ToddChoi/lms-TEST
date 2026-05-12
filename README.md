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
| `KAKAO_ALIMTALK_API_KEY` | Phase 6 | 카카오 알림톡 (예정) |

---

## 3. Supabase 마이그레이션 적용 순서

Supabase Dashboard → SQL Editor 에서 **순서대로** 실행. 모든 마이그레이션은 `IF NOT EXISTS`로 멱등.

```
1. supabase/schema.sql                                  ← 초기 16 테이블 + RLS
2. supabase/schema_phase6.sql                           ← Phase 6 (payments)
3. supabase/migration_*.sql                             ← 추가 패치 (날짜순)
   - migration_p1_correctness.sql
   - migration_p1_phase8_role_check.sql
   - migration_lessons_course_id_backfill.sql
   - migration_offline_v2.sql                           ← 오프라인 교육 (11 테이블 + RLS + 트리거 + 함수)
   - ... 등
```

적용 후 검증 쿼리:
```sql
-- 11 + 7 + ... = 모든 도메인 테이블
SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';
-- 오프라인 11
SELECT count(*) FROM information_schema.tables WHERE table_name LIKE 'offline_%';
-- 오프라인 RLS 정책 19+
SELECT count(*) FROM pg_policies WHERE tablename LIKE 'offline_%';
```

### Supabase Storage Buckets

다음 버킷을 Dashboard → Storage 에서 수동 생성 (RLS 정책은 각 버킷 설정에서 적용):

| Bucket | Public | 용도 |
|---|---|---|
| `course-videos` | private | 강좌 영상 (signed URL 통해서만 재생) |
| `media` | public | CMS 미디어 라이브러리 (이미지/배너) |
| `thumbnails` | public | 강좌 / 프로그램 썸네일 |
| `certificates` | private | 발급된 수료증 PDF |

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

## 라이선스

내부 프로젝트 — 외부 배포 X.
