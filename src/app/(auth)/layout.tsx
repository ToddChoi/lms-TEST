// 인증 페이지 레이아웃 — 헤더/푸터 없음, 전체 배경
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
