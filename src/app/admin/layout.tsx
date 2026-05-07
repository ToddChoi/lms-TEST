import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AdminSidebarBottom } from '@/components/admin/AdminSidebarBottom'
import { AdminNavLink } from '@/components/admin/AdminNavLink'
import { AdminMobileNav } from '@/components/admin/AdminMobileNav'
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog'
import { Logo } from '@/components/brand/Logo'
import { NAV_GROUPS } from '@/components/admin/admin-nav'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: '관리자',
    template: '%s | 관리자 | Ingrow LMS',
  },
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('role, name')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as { role: string; name: string } | null

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen flex-col bg-surface-subtle md:flex-row">
      {/* 모바일 top bar + 드로어 — md 이상에선 자동 숨김 */}
      <AdminMobileNav />

      {/* 데스크탑 사이드바 — md 미만에선 숨김 */}
      <aside className="hidden w-64 shrink-0 border-r border-border-subtle bg-surface md:flex md:flex-col">
        {/* 로고 */}
        <div className="flex h-16 items-center border-b border-border-subtle px-5 text-navy">
          <Logo size="sm" />
          <span className="ml-2 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Admin
          </span>
        </div>

        {/* 메뉴 — 그룹별 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group, idx) => (
            <div key={group.label} className={idx > 0 ? 'mt-5' : ''}>
              <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => (
                  <AdminNavLink
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={<item.icon className="h-4 w-4" />}
                    exact={item.exact}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* 하단 사용자 + 메인 이동 + 로그아웃 */}
        <AdminSidebarBottom name={profile.name} role={profile.role} />
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>

      {/* 전역 confirm 대체 다이얼로그 */}
      <ConfirmDialogHost />
    </div>
  )
}
