import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  LayoutDashboard, BookOpen, GraduationCap,
} from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: { default: '강사', template: '%s | 강사 | Ingrow LMS' },
}

const NAV = [
  { href: '/instructor',         label: '대시보드', icon: LayoutDashboard, exact: true },
  { href: '/instructor/courses', label: '내 강좌',   icon: BookOpen },
]

export default async function InstructorLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/instructor')

  const { data: rawProfile } = await supabase
    .from('profiles').select('id, name, email, role').eq('id', user.id).single()
  const profile = rawProfile as unknown as {
    id: string; name: string | null; email: string | null; role: string
  } | null

  if (!profile || !['instructor', 'admin', 'superadmin'].includes(profile.role)) {
    redirect('/')
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 border-r border-gray-100 bg-white md:flex md:flex-col">
        <div className="flex h-16 items-center gap-2 border-b border-gray-100 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-navy">
            <GraduationCap className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-bold text-navy">Ingrow 강사</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-0.5">
            {NAV.map((item) => (
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
          <p className="text-xs text-gray-400">강사</p>
          <p className="truncate text-sm font-semibold text-navy">
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
