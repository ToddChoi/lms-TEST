import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  BarChart3,
  Building2,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: '기업 관리자',
    template: '%s | 기업 관리자 | Ingrow LMS',
  },
}

const ORG_NAV = [
  { href: '/org', label: '대시보드', icon: LayoutDashboard },
  { href: '/org/members', label: '회원', icon: Users },
  { href: '/org/enrollments', label: '수강 현황', icon: ClipboardList },
  { href: '/org/statistics', label: '통계', icon: BarChart3 },
]

export default async function OrgLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('id, name, email, role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as {
    id: string
    name: string | null
    email: string | null
    role: string
  } | null
  if (!profile) redirect('/')

  const { data: rawMembership } = await supabase
    .from('company_members')
    .select('company_id, is_manager, companies(id, name)')
    .eq('user_id', user.id)
    .eq('is_manager', true)
    .limit(1)
    .maybeSingle()
  const membership = rawMembership as unknown as {
    company_id: string
    is_manager: boolean
    companies: { id: string; name: string } | null
  } | null

  if (!membership || !membership.is_manager) redirect('/')

  const companyName = membership.companies?.name ?? '기업'

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-gray-100 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-navy">기업 관리자</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-0.5">
            {ORG_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-silver hover:text-navy"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </div>
        </nav>

        <div className="border-t border-gray-100 p-4">
          <p className="text-xs text-gray-400">기업</p>
          <p className="truncate text-sm font-semibold text-navy">{companyName}</p>
          <p className="mt-2 truncate text-xs text-gray-500">
            {profile.name ?? profile.email}
          </p>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-silver p-6">{children}</main>
      </div>
    </div>
  )
}
