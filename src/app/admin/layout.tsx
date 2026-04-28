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
  Image,
  Navigation,
  LayoutTemplate,
} from 'lucide-react'
import { AdminSidebarBottom } from '@/components/admin/AdminSidebarBottom'
import { AdminNavLink } from '@/components/admin/AdminNavLink'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: '관리자',
    template: '%s | 관리자 | Ingrow LMS',
  },
}

const ADMIN_NAV = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/admin/courses', label: '강좌 관리', icon: BookOpen },
  { href: '/admin/users', label: '회원 관리', icon: Users },
  { href: '/admin/enrollments', label: '수강 신청', icon: ClipboardList },
  { href: '/admin/certificates', label: '수료증', icon: Award },
  { href: '/admin/payments', label: '결제 내역', icon: CreditCard },
  { href: '/admin/companies', label: '협약기업', icon: Building2 },
  { href: '/admin/bulk', label: '일괄 업로드', icon: Upload },
  { href: '/admin/statistics', label: '통계', icon: BarChart3 },
  { href: '/admin/notices', label: '공지사항', icon: Bell },
  { href: '/admin/faqs', label: 'FAQ', icon: HelpCircle },
  { href: '/admin/contacts', label: '이용문의', icon: MessageSquare },
  { href: '/admin/banners', label: '배너 관리', icon: Image },
  { href: '/admin/menus', label: '메뉴 관리', icon: Navigation },
  { href: '/admin/cms', label: '홈 섹션', icon: LayoutTemplate },
  { href: '/admin/categories', label: '카테고리', icon: Tag },
  { href: '/admin/settings', label: '사이트 설정', icon: Settings },
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
    <div className="flex min-h-screen">
      {/* 사이드바 */}
      <aside className="hidden w-60 shrink-0 border-r border-gray-100 bg-white md:flex md:flex-col">
        {/* 로고 */}
        <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-navy">Ingrow 관리자</span>
        </div>

        {/* 메뉴 */}
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-0.5">
            {ADMIN_NAV.map((item) => (
              <AdminNavLink
                key={item.href}
                href={item.href}
                label={item.label}
                icon={<item.icon className="h-4 w-4" />}
                exact={item.exact}
              />
            ))}
          </div>
        </nav>

        {/* 하단 사용자 + 메인 이동 + 로그아웃 */}
        <AdminSidebarBottom name={profile.name} role={profile.role} />
      </aside>

      {/* 메인 콘텐츠 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-silver p-6">{children}</main>
      </div>
    </div>
  )
}
