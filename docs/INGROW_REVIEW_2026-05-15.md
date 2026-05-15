# INGROW 전면 검토 리포트

- 작성일: 2026-05-15
- 검토 범위: Next.js 앱 코드, Supabase 마이그레이션, 결제/수강/오프라인 교육 워크플로, 주요 UI/UX 구조
- 검증 기준: 정적 코드 리뷰, `typecheck`, `lint`, `test`, `build`
- 비고: 실제 브라우저 화면 캡처 기반 시각 QA는 별도 수행하지 않았고, 페이지/컴포넌트 코드 기준으로 UX를 검토했습니다.

## 종합 판단

현재 INGROW는 이전보다 완성도가 크게 올라간 상태입니다. CMS HTML sanitizing, 로그인 redirect 보호, 강좌 리스트 뷰, 모바일 필터, 오프라인 교육 도메인 확장, 결제/웹훅 멱등성 등 핵심 리스크 상당수가 보완되어 있습니다.

다만 실제 서비스 운영 기준에서는 결제 이후 좌석 확정, 온라인 수강 신청 기간 검증, 학습 영상 URL 노출, 기업 신청 커뮤니케이션 쪽에 아직 수정해야 할 부분이 남아 있습니다. 특히 결제/좌석/권한 계층은 UI보다 서버와 DB 트랜잭션 중심으로 먼저 정리하는 것이 좋습니다.

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run typecheck` | 통과 |
| `npm run lint` | 통과 |
| `npm test` | 통과, 9개 파일 / 84개 테스트 |
| `npm run build` | 통과 |

빌드 중 `Using edge runtime on a page currently disables static generation for that page` 경고가 표시됩니다. 현재 장애 요인은 아니지만, SEO/캐싱이 중요한 공개 페이지에 Edge Runtime이 걸려 있는지 후속 확인이 필요합니다.

## 주요 발견 사항

### P1. 오프라인 좌석 확정이 원자적이지 않아 초과 판매가 가능합니다

- 근거:
  - `supabase/migration_offline_v2.sql:570`의 `offline_session_available_seats`는 `STABLE` SQL 함수이며 `confirmed` 상태만 차감합니다.
  - `src/app/api/offline/webhook/route.ts:111`에서 잔여석을 조회한 뒤 `src/app/api/offline/webhook/route.ts:184`에서 `confirmed`로 업데이트합니다.
  - `src/app/api/admin/offline/enrollments/[id]/confirm-payment/route.ts:77`에서도 같은 방식으로 조회 후 `src/app/api/admin/offline/enrollments/[id]/confirm-payment/route.ts:113`에서 확정합니다.
- 문제:
  - 잔여석 조회와 상태 업데이트가 하나의 잠금 트랜잭션이 아닙니다.
  - 예를 들어 잔여석 1석 상황에서 Stripe 웹훅 2건 또는 관리자 입금 확인 2건이 동시에 들어오면, 둘 다 `available = 1`을 본 뒤 둘 다 확정될 수 있습니다.
  - 코드 주석의 `race-safe`는 같은 enrollment의 중복 처리는 막지만, 같은 session의 capacity 경쟁은 막지 못합니다.
- 권장 수정:
  - DB RPC로 `confirm_offline_enrollment(enrollment_id, payment_context)`를 만들고, 내부에서 `offline_sessions` row를 `FOR UPDATE`로 잠근 뒤 잔여석 재계산과 `pending_payment -> confirmed` 업데이트를 한 트랜잭션에서 처리합니다.
  - Stripe webhook과 세금계산서 관리자 확인 모두 동일 RPC를 사용하게 통합합니다.
  - 정책상 pending seat를 임시 점유로 볼지, confirmed만 점유로 볼지 제품 정책을 명확히 정해야 합니다.

### P1. 온라인 강좌 수강 신청 기간이 서버에서 강제되지 않습니다

- 근거:
  - 무료 수강 신청 API는 `src/app/api/enrollments/route.ts:44`에서 `enroll_start`, `enroll_end`, `learn_end`를 조회하지만 실제 신청 가능 기간을 검증하지 않습니다.
  - 유료 결제 checkout API는 `src/app/api/payments/checkout/route.ts:29`에서 기간 필드를 조회하지 않고, `status`와 `price`만 확인합니다.
  - 유료 결제 webhook은 `src/app/api/payments/webhook/route.ts:91`에서 enrollment를 활성화하지만 `expires_at`을 설정하지 않습니다.
- 문제:
  - UI에서 버튼을 숨겨도 직접 API POST를 보내면 모집 전/후에도 수강 등록 또는 결제 세션 생성이 가능합니다.
  - 무료 수강은 `learn_end`를 `expires_at`에 반영하지만, 유료 수강은 학습 종료일이 반영되지 않아 만료 정책이 서로 다릅니다.
- 권장 수정:
  - 무료 신청 API와 유료 checkout API 모두에서 `isEnrollable(enroll_start, enroll_end)`를 서버 검증합니다.
  - 유료 webhook에서 course를 재조회하거나 checkout metadata에 필요한 기간 정보를 넣어 `expires_at = learn_end`를 동일하게 저장합니다.
  - 이미 결제가 완료됐는데 기간 조건이 맞지 않는 경우를 대비해 환불/수동 처리 정책도 정의합니다.

### P1. 학습 페이지가 사이드바 데이터에 원본 `video_url`을 포함합니다

- 근거:
  - `src/app/my/courses/[id]/learn/page.tsx:50`에서 lesson의 `video_url`을 섹션 목록 조회에 포함합니다.
  - `src/app/my/courses/[id]/learn/page.tsx:104`에서 lesson 객체를 spread하여 `sectionsWithProgress`를 만듭니다.
  - `src/app/my/courses/[id]/learn/page.tsx:133`에서 현재 lesson만 signed URL로 바꾼 뒤, `src/app/my/courses/[id]/learn/page.tsx:175`에서 현재 lesson과 전체 섹션 목록을 클라이언트 컴포넌트로 넘깁니다.
  - `src/components/learn/LearnContent.tsx:15`의 `LessonItem` 타입에도 `video_url`이 포함되어 있습니다.
- 문제:
  - 현재 재생할 lesson은 signed URL로 보호하지만, 사이드바 목록에는 원본 `video_url`이 hydration data로 전달될 수 있습니다.
  - private storage path라면 즉시 재생은 어렵더라도 내부 경로가 노출되고, 외부 영상 URL이면 접근 가능한 URL 자체가 노출될 수 있습니다.
- 권장 수정:
  - 사이드바용 DTO를 별도로 만들어 `id`, `title`, `duration`, `is_preview`, `progress` 등 필요한 필드만 전달합니다.
  - `LearnContent`와 `CurriculumSidebar` 타입에서 `video_url`을 제거합니다.
  - RLS에서도 `expires_at`까지 고려하도록 강화할 수 있는지 검토합니다.

### P2. 기업 카드 결제 확정 메일 수신자가 신청 담당자와 다를 수 있습니다

- 근거:
  - 신청 접수 메일은 `src/app/api/offline/apply/route.ts:315`에서 corporate일 때 `company_contact_email`을 우선 사용합니다.
  - 세금계산서 관리자 입금 확인은 `src/app/api/admin/offline/enrollments/[id]/confirm-payment/route.ts:141`에서 기업 담당자 이메일을 조회하고 `src/app/api/admin/offline/enrollments/[id]/confirm-payment/route.ts:151`에서 우선 사용합니다.
  - 반면 Stripe 오프라인 webhook의 결제 확정 메일은 `src/app/api/offline/webhook/route.ts:293`에서 applicant profile만 조회하고 `src/app/api/offline/webhook/route.ts:309`에서 profile email로 보냅니다.
- 문제:
  - 기업 카드 결제에서는 실제 회계/교육 담당자가 아닌 로그인 사용자에게만 자리 확정 메일이 갈 수 있습니다.
- 권장 수정:
  - webhook의 `dispatchPaymentConfirmedEmail`에서도 `company_contact_email`, `company_contact_name`을 조회해 세금계산서 경로와 동일한 우선순위를 사용합니다.

### P2. 오프라인 교육 상세/신청 문구가 실제 기능과 충돌합니다

- 근거:
  - `src/components/offline/OfflineApplyForm.tsx:235`에는 기업 단체 신청 UI가 있고, `src/components/offline/OfflineApplyForm.tsx:403`에는 세금계산서 신청 UI가 있습니다.
  - 하지만 `src/app/(public)/offline/[slug]/page.tsx:313`은 "세금계산서·기업 단체 신청은 곧 오픈됩니다."라고 안내합니다.
  - `src/app/(public)/offline/[slug]/apply/[sessionId]/page.tsx:84`도 무료 회차 및 Phase 2 카드 결제만 지원한다는 오래된 문구가 남아 있습니다.
- 문제:
  - 사용자가 실제 가능 기능을 불가능하다고 오해할 수 있고, B2B 전환율에 직접 영향을 줍니다.
- 권장 수정:
  - 현재 운영 가능한 범위를 기준으로 문구를 정리합니다.
  - 예: "기업 회원은 신청서에서 단체 참석자와 세금계산서 결제를 선택할 수 있습니다."
  - 무료 회차가 아직 미구현이라면 무료 세션 노출 자체를 숨기거나 "관리자 문의" 흐름으로 분리합니다.

### P2. 기업 오프라인 신청 권한이 너무 넓을 수 있습니다

- 근거:
  - 신청 페이지는 `src/app/(public)/offline/[slug]/apply/[sessionId]/page.tsx:112`에서 `is_manager`를 조회하지만 실제 분기에는 사용하지 않습니다.
  - API는 `src/app/api/offline/apply/route.ts:91` 이후 corporate 검증에서 회사 멤버 여부만 확인합니다.
- 문제:
  - 일반 회사 구성원도 기업 단체/세금계산서 신청을 만들 수 있습니다.
  - 최대 500명 참석자와 후불 결제가 가능한 흐름이라면 권한이 과하게 열려 있을 수 있습니다.
- 권장 수정:
  - 제품 정책을 먼저 결정해야 합니다.
  - 관리 책임이 필요한 신청이라면 `is_manager = true`, `org_admin`, 또는 서비스 admin만 corporate/invoice 신청을 할 수 있게 제한합니다.
  - 일반 멤버에게는 "관리자에게 신청 권한 요청" UX를 제공합니다.

### P2. 오프라인 세션 목록에서 잔여석을 알 수 없습니다

- 근거:
  - 공개 상세 페이지는 `src/app/(public)/offline/[slug]/page.tsx:262`에서 `정원 {s.capacity}명`만 표시합니다.
  - 신청 페이지도 `src/app/(public)/offline/[slug]/apply/[sessionId]/page.tsx:178`에서 정원만 보여줍니다.
- 문제:
  - 사용자는 결제 전 잔여석, 대기 가능 여부, 마감 임박 여부를 알 수 없습니다.
  - 오프라인 교육은 좌석이 구매 판단에 직접 영향을 주므로 "정원"보다 "잔여석"이 더 중요합니다.
- 권장 수정:
  - 공개 페이지에서 세션별 `available seats`를 조회해 "잔여 3석", "마감 임박", "대기 가능" 같은 상태를 표시합니다.
  - 정확한 잔여석 노출이 부담스럽다면 "잔여석 확인 후 결제"처럼 불확실성을 명시합니다.

### P3. 오프라인 알림 중복 방지 인덱스가 일부 반복 알림과 맞지 않습니다

- 근거:
  - `supabase/migration_offline_v2.sql:492`의 unique index는 `(enrollment_id, type)` 조합을 한 번만 허용합니다.
  - 출석 체크 알림은 `src/app/api/offline/attendance/check-in/route.ts:169`에서 매번 `attendance_checked_in` 타입으로 insert합니다.
  - 수료증 알림은 `src/app/admin/offline/certificates/actions.ts:311`에서 `certificate_issued` 타입으로 insert합니다.
- 문제:
  - 여러 교육일에 같은 enrollment의 출석 알림을 남기거나, 기업 enrollment 안의 여러 참석자에게 수료증 알림을 남길 때 충돌할 수 있습니다.
- 권장 수정:
  - 단발성 알림과 반복/개별 알림을 분리합니다.
  - `session_day_id`, `attendee_id`, `certificate_id` 같은 scope 컬럼을 추가하거나, type별 부분 unique index를 재설계합니다.

### P3. 결제/웹훅/권한 플로우 테스트가 부족합니다

- 현황:
  - 현재 테스트는 순수 유틸/도메인 함수 중심입니다.
  - 결제 checkout, payment webhook, offline webhook, invoice confirmation, attendance, corporate permission 경로의 route-level 테스트는 부족합니다.
- 권장 테스트:
  - 모집 기간이 닫힌 온라인 강좌는 무료 신청과 유료 checkout 모두 거부되는지.
  - 유료 webhook이 `learn_end`를 `expires_at`으로 반영하는지.
  - 오프라인 좌석 1석 상황에서 동시 확정이 하나만 성공하는지.
  - 기업 카드 결제 확정 메일이 company contact로 가는지.
  - 학습 페이지 props에 원본 `video_url`이 포함되지 않는지.

## UI/UX 및 디자인 진단

### 좋은 점

- 강좌 목록, 필터, 리스트/그리드 전환, 모바일 필터가 갖춰져 탐색 UX의 기본기가 좋습니다.
- CMS HTML 블록 sanitizing이 들어가 운영자가 콘텐츠를 다뤄도 위험도가 낮아졌습니다.
- 오프라인 교육은 프로그램, 세션, 기업 신청, 세금계산서, 참석자, 출석, 수료증까지 도메인 구조가 꽤 깊게 잡혀 있습니다.
- 관리자 내비게이션은 기능 그룹이 나뉘어 있어 정보 구조 자체는 확장 가능한 편입니다.

### 어색하거나 개선하면 좋은 점

- 오프라인 교육이 주요 제품 축으로 커졌는데 기본 상단 메뉴와 모바일 하단 탭에는 명확한 진입점이 없습니다.
  - `src/components/layout/Header.tsx:22`의 기본 메뉴에 `/offline`이 없습니다.
  - `src/components/layout/MobileBottomNav.tsx:15`의 탭은 홈/강좌/내 학습/마이 중심입니다.
- 데스크톱 검색은 `src/components/layout/Header.tsx:82`에서만 노출되고, 모바일 메뉴에는 검색 진입이 없습니다.
- 관리자 화면과 오프라인 신청 폼에 `rounded-2xl`, 큰 카드, 그림자 기반 패널이 많습니다. 공개 마케팅 페이지에는 괜찮지만, 반복 작업이 많은 관리자 화면에서는 밀도와 스캔 속도를 떨어뜨릴 수 있습니다.
- 오프라인 상세/신청 문구가 오래된 Phase 문구와 현재 기능이 섞여 있어 제품 신뢰도를 낮출 수 있습니다.
- 좌석, 결제 방식, 신청 자격, 환불/대기 정책 같은 "결정에 필요한 정보"가 결제 직전까지 충분히 드러나지 않습니다.

## 권장 작업 순서

1. 오프라인 좌석 확정 RPC 원자화
   - Stripe webhook과 invoice admin confirmation을 같은 DB 트랜잭션 경로로 통합합니다.

2. 온라인 수강 신청 기간 서버 검증
   - 무료 신청, 유료 checkout, 유료 webhook의 `learn_end` 처리까지 같이 맞춥니다.

3. 학습 페이지 `video_url` DTO 분리
   - 현재 lesson만 signed URL을 받고, 사이드바 목록에는 영상 URL을 절대 내려주지 않게 수정합니다.

4. 오프라인 기업 커뮤니케이션 정리
   - 기업 카드 결제 확정 메일 수신자, 세금계산서/기업 신청 문구, 신청 권한 정책을 함께 정리합니다.

5. 공개/모바일 내비게이션 개선
   - `/offline` 진입점과 모바일 검색 진입을 추가합니다.

6. 운영 테스트 보강
   - 결제/웹훅/권한/좌석 경쟁 조건 중심의 route-level 테스트를 추가합니다.

## 결론

현재 코드는 기본 품질 게이트를 모두 통과하고, 이전에 위험했던 보안/수강/콘텐츠 이슈 일부가 이미 잘 보완되어 있습니다. 다음 단계는 "화면을 더 예쁘게"보다 "돈과 좌석과 접근 권한이 항상 맞게 처리되는가"에 집중하는 것이 맞습니다. P1 항목 3개만 먼저 정리해도 실제 운영 리스크는 크게 낮아질 것입니다.
