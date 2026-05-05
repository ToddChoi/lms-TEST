# Ingrow LMS — 종합 테스트 가이드

오늘 세션의 모든 변경 (Phase 1 → 2 → 3 → 4 R1 → 5) 이 Vercel 에 배포된 상태에서 검증할 절차.

---

## A. 사용자 수동 작업 — 한 번만 (10분)

### A-1. Supabase Dashboard → SQL Editor 에 순서대로 실행

**아직 실행 안 한 것이 있다면** 아래 순서로 (이미 실행한 건 자동 skip — 안전):

| # | 파일 | 효과 | 이미 실행 여부 |
|---|---|---|---|
| 1 | `migration_security_hotfix_p0.sql` | C1+C2 보안 핫픽스 | (확인 필요) |
| 2 | `migration_p1_correctness.sql` | cert UNIQUE / RLS / RPC 시그니처 | ✅ 적용함 |
| 3 | `migration_phase1_foundation.sql` | multi-tenant + page builder + i18n DB 토대 | ✅ 적용함 |
| 4 | `migration_phase2_b2b_seed.sql` | feature_grid/cta + /b2b 시드 | (확인 필요) |
| 5 | `migration_phase4_demo_tenant.sql` | ACME 회사 + ACME home 블록 | (확인 필요) |
| 6 | `migration_phase4_audience_demo.sql` | ACME audience 분기 (guest/멤버/매니저) | (확인 필요) |
| 7 | **NEW** `migration_phase5_home_seed.sql` | / 홈의 기본 5 블록 시드 | ❌ 신규 |

**한 번에 검증**:
```sql
-- 새 테이블들 확인
SELECT 'pages' AS t, COUNT(*) FROM pages
UNION ALL SELECT 'content_blocks', COUNT(*) FROM content_blocks
UNION ALL SELECT 'block_types',    COUNT(*) FROM block_types
UNION ALL SELECT 'media_assets',   COUNT(*) FROM media_assets
UNION ALL SELECT 'translations',   COUNT(*) FROM translations
UNION ALL SELECT 'companies-w-subdomain',
                 COUNT(*) FROM companies WHERE subdomain IS NOT NULL;
-- block_types 11+ / content_blocks home 5+ + b2b 3+ + ACME 5+
-- companies-w-subdomain 1+ (ACME)
```

### A-2. Storage 버킷 생성 (한 번만)

Supabase Dashboard → Storage → **New bucket** → 이름 `media` / public **체크 ON** → Save.

(없으면 미디어 라이브러리 업로드 시 500 에러)

### A-3. Vercel 도메인 (선택 — production 회사별 분기 데모용)

ACME subdomain 시연하려면 wildcard 추가. 안 하면 `?tenant=acme` 쿼리로 동등 시연.

---

## B. 테스트 시나리오 — 12개

### 1. 기본 사이트 (비로그인)
- `https://your-vercel-domain/`
- 기대: 홈에 hero / featured_courses (course_ids 비었으면 빈 영역) / categories / feature_grid / stats 5 블록
- ✓ Logo (Ingrow 자체 마크), Footer (약관 페이지 게시 후 링크 자동)

### 2. 강좌 카드 (비로그인)
- `/courses` 진입
- 기대: 카드에 강사 아바타 (avatar_url 있으면 이미지, 없으면 이니셜) / 별점 / 수강생 수
- 듀오톤 배지 (NEW/BEST/HOT 형광 솔리드 X)

### 3. 약관 페이지 만들기 (admin)
- `/admin/pages` → "+ 페이지 추가"
- slug: `terms` / 제목: `이용약관` / body 에 markdown 입력 → 게시
- `/p/terms` 진입 → 정상 렌더 + Footer 하단에 "이용약관" 링크 자동 노출

### 4. 미디어 라이브러리 (admin)
- `/admin/media` → 드래그앤드롭 또는 클릭으로 이미지 업로드 (5MB 이하)
- grid 에 노출, hover 시 URL 복사 / 삭제 버튼

### 5. 홈 빌더 — 강좌 picker (admin)
- `/admin/cms/builder/home` → "추천 강좌" 블록 ⚙
- "강좌 선택" 버튼 → 모달 → 검색 → 다중 선택 → 확인
- 저장 → / 진입 → 선택한 강좌가 그리드로 노출

### 6. 홈 빌더 — 이미지 picker (admin)
- 같은 빌더에서 hero 블록 ⚙ → bg_image 필드 → "라이브러리" → 모달 → 업로드한 이미지 클릭 → 선택
- 저장 → / 의 hero 배경이 해당 이미지로

### 7. ACME 데모 — 비로그인
- `https://your-domain/?tenant=acme` (또는 acme.your-domain)
- 기대: Header 가 ACME 로고 + 컬러가 오렌지(#FF6A4D) + hero가 "ACME 임직원이신가요? 로그인하세요"

### 8. ACME 데모 — 회원가입 + 자동 매칭
- 시크릿 창 → `/register` → email 에 `test@acme.com` 입력 → 회원가입
- 메일 확인 클릭 (또는 Dashboard 에서 user 수동 confirm)
- → 자동으로 ACME `company_members` 에 INSERT
- ACME tenant 진입 (`?tenant=acme`) → 로그인 → "ACME 임직원 학습 포털" hero / feature_grid / cta 노출

### 9. ACME 데모 — 매니저 권한
- `/admin/companies` → ACME 클릭 → 위 가입 사용자 → is_manager 토글 ON
- 그 사용자로 다시 로그인 → ACME tenant → 위 + "매니저용 학습 현황 대시보드" CTA 추가 노출

### 10. audience 편집 (admin)
- `/admin/cms/builder/home` → 아무 블록 ⚙ → 폼 하단 "노출 조건"
- 로그인 여부 / 회사 멤버십 / role / 직급 select 로 편집
- 저장 → 해당 블록이 조건 맞는 사용자에게만 노출 확인

### 11. /b2b 빌더 동작
- `/b2b` 진입 → 시드된 hero / feature_grid / cta 3 블록 + 하단 폼
- `/admin/cms/builder/b2b` → 블록 편집 → 저장 → /b2b 새로고침 → 즉시 반영

### 12. Admin 사이드바 IA
- `/admin` 진입 → 사이드바 5 그룹: 개요 / 학습 콘텐츠 / 회원·결제 / 사이트 콘텐츠 / 시스템
- 활성 메뉴: 좌측 4px 인디케이터 + 옅은 accent 배경

---

## C. 알려진 한계 (이번 stretch 에서 의도적 미포함)

별도 라운드에서 진행 예정:

| 영역 | 현재 | 예정 |
|---|---|---|
| 강좌 description 편집 | plain textarea | WYSIWYG (TipTap) |
| pages.body 편집 | plain textarea + markdown | WYSIWYG |
| 회사별 큐레이션 컬렉션 | featured_courses 블록 + scope=company 로 가능 | 전용 admin UI + 컬렉션 테이블 |
| 직무별 학습맵 | DB 스키마 미생성 | learning_paths + 진도 추적 |
| 회사 picker UI | 텍스트 입력 fallback | 모달 picker |
| SEO meta per-page | pages.seo 컬럼만 (UI 없음) | seo 편집 폼 + auto OG image |
| home_sections 폐기 | 테이블·라우트 살아있음 (충돌 X) | 점진 마이그레이션 후 제거 |

---

## D. 진단 명령어

문제 생기면:

```powershell
# 로컬 검증 4종
cd C:\Users\Owner\Desktop\최철우\CLAUDE\ingrow-lms
npm run typecheck
npm run lint
npm test
npm run build

# 캐시 깨지면
Remove-Item -Recurse -Force .next
npm run dev

# Storage 버킷 상태
node scripts/check_storage_buckets.mjs

# DB 권한·연결
node scripts/diagnose_new_key.mjs
```

---

## E. 푸시된 commit 누적 (오늘 세션 전체)

```
3bc0978  feat(Phase 5): pages module + media library + course/image picker + home builder
9b3617d  feat(Phase 4 Round 1): audience filter + email domain auto-match
fa951fa  feat(Phase 4 토대): multi-tenant subdomain routing + company branding
44e737e  feat(Phase 3 round 2): UI core components tokenized + focus polish
8c0d162  feat(Phase 3): admin sidebar modernization + CourseCard avatar/tokens
22a7a46  feat(P2+): /b2b fully builder-driven + home page wired + 2 new blocks
21b0e9a  feat(Phase 2): generic page builder + 8 block components + B2B surface demo
ff4081c  feat(Phase 1 토대): design tokens + multi-tenant DB + page builder + i18n + brand logo
ca19e04  feat(P3): test infra + CI + pre-commit + CSP
f09a4b7  chore(QA): close gaps from session QA sweep
4b2c7de  refactor(P2): migrate 7 inline admin checks to requireAdmin helper
3cdc139  fix(P1): concurrency safety + permission accuracy
1499616  chore(cleanup): remove dead admin tree (-1348 LOC)
2eabf80  types: regenerate database.ts to match current migrations
08dd5bd  fix(security P0 #5): private course-videos with on-demand signed URLs
f61ecf8  fix(security P0): close 4 of 5 critical findings
```

테스트하시면서 막히는 부분 / 의외의 동작 발견 시 시나리오 번호 + 본 화면 알려 주세요.
