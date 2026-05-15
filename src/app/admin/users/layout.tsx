/**
 * /admin/users segment layout — Parallel Routes (@modal slot) PoC.
 *
 * Phase D — Next.js 14 App Router 의 Parallel + Intercepting routes 활용.
 *
 * 동작:
 *   - children: /admin/users 또는 /admin/users/[id] 의 page.tsx
 *   - modal:    intercepting route @modal/(.)[id]/page.tsx 가 있을 때만 렌더
 *
 * /admin/users 목록 → 상세 버튼 클릭 → 같은 segment 내 navigation →
 *   intercepting route 가 잡아서 modal slot 에 렌더 (URL 은 /[id] 로 변경되지만
 *   본 children 은 list 유지).
 *
 * 직접 /admin/users/[id] URL 접근 → intercept 미발화 → 풀 페이지 [id]/page.tsx 표시.
 *
 * 참고: parallel slot 은 default.tsx 가 있어야 navigation 시 fallback 됨.
 */
export default function UsersLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal: React.ReactNode
}) {
  return (
    <>
      {children}
      {modal}
    </>
  )
}
