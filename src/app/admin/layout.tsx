import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  LayoutDashboard,
  BookOpen,
  Users,
  ClipboardList,
  Award,
  Building2,
  BarChart3,
  Bell,
  Settings,
  Tag,
  Upload,
  CreditCard,
  HelpCircle,
  MessageSquare,
  Navigation,
  LayoutTemplate,
  Blocks,
  FileText,
  Image as ImageIcon,
} from 'lucide-react'
import { AdminSidebarBottom } from '@/components/admin/AdminSidebarBottom'
import { AdminNavLink } from '@/components/admin/AdminNavLink'
import { ConfirmDialogHost } from '@/components/ui/ConfirmDialog'
import { Logo } from '@/components/brand/Logo'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: '관리자',
    template: '%s | 관리자 | Ingrow LMS',
  },
}

/**
 * 사이드바 IA — Linear/Notion 패턴.
 * 16개 평면 → 4 섹션 그룹. 섹션 라벨은 uppercase 작게.
 */
type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const NAV_GROUPS: NavGroup[] = [
  {
    label: '개요',
    items: [
      { href: '/admin',            label: '대시보드',     icon: LayoutDashboard, exact: true },
      { href: '/admin/statistics', label: '통계',         icon: BarChart3 },
    ],
  },
  {
    label: '학습 콘텐츠',
    items: [
      { href: '/admin/courses',    label: '강좌 관리',    icon: BookOpen },
      { href: '/admin/categories', label: '카테고리',     icon: Tag },
    ],
  },
  {
    label: '회원·결제',
    items: [
      { href: '/admin/users',        label: '회원 관리',  icon: Users },
      { href: '/admin/enrollments',  label: '수강 신청',  icon: ClipboardList },
      { href: '/admin/certificates', label: '수료증',     icon: Award },
      { href: '/admin/payments',     label: '결제 내역',  icon: CreditCard },
      { href: '/admin/companies',    label: '협약기업',   icon: Building2 },
      { href: '/admin/bulk',         label: '일괄 업로드', icon: Upload },
    ],
  },
  {
    label: '사이트 콘텐츠',
    items: [
      { href: '/admin/cms',                label: '홈페이지 관리', icon: LayoutTemplate },
      { href: '/admin/cms/builder/home',   label: '페이지 빌더',   icon: Blocks },
      { href: '/admin/pages',              label: '약관·정책 페이지', icon: FileText },
      { href: '/admin/media',              label: '미디어 라이브러리', icon: ImageIcon },
      { href: '/admin/cms/menus',          label: '네비게이션',    icon: Navigation },
      { href: '/admin/notices',            label: '공지사항',     icon: Bell },
      { href: '/admin/faqs',               label: 'FAQ',          icon: HelpCircle },
      { href: '/admin/contacts',           label: '이용문의',     icon: MessageSquare },
    ],
  },
  {
    label: '시스템',
    items: [
      { href: '/admin/settings', label: '사이트 설정', icon: Settings },
    ],
  },
]

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
    <div className="flex min-h-screen bg-surface-subtle">
      {/* 사이드바 */}
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
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>

      {/* 전역 confirm 대체 다이얼로그 */}
      <ConfirmDialogHost />
    </div>
  )
}
