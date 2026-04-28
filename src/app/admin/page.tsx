import { createClient } from '@/lib/supabase/server'
import { Users, BookOpen, Award, TrendingUp } from 'lucide-react'
import type { Metadata } from 'next'
import dayjs from 'dayjs'

export const metadata: Metadata = { title: '대시보드' }

export default async function AdminDashboard() {
  const supabase = createClient()
  const thisMonthStart = dayjs().startOf('month').toISOString()

  const [
    { count: newUsersCount },
    { count: newEnrollmentsCount },
    { count: newCompletedCount },
    { count: activeCoursesCount },
    { data: rawRecentEnrollments },
    { data: rawRecentUsers },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thisMonthStart),
    supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .gte('enrolled_at', thisMonthStart),
    supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('enrolled_at', thisMonthStart),
    supabase
      .from('courses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase
      .from('enrollments')
      .select(`
        id, enrolled_at, status,
        profiles (name, email),
        courses (title)
      `)
      .order('enrolled_at', { ascending: false })
      .limit(10),
    supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  type RecentEnrollment = { id: string; enrolled_at: string; status: string; profiles: { name: string; email: string } | null; courses: { title: string } | null }
  type RecentUser = { id: string; name: string; email: string; role: string; created_at: string }
  const recentEnrollments = rawRecentEnrollments as unknown as RecentEnrollment[] | null
  const recentUsers = rawRecentUsers as unknown as RecentUser[] | null

  const kpis = [
    {
      label: '이번 달 신규 가입자',
      value: newUsersCount ?? 0,
      icon: Users,
      color: 'text-accent',
      bg: 'bg-accent-pale',
    },
    {
      label: '이번 달 수강 신청',
      value: newEnrollmentsCount ?? 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      label: '이번 달 수료자',
      value: newCompletedCount ?? 0,
      icon: Award,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
    },
    {
      label: '현재 활성 강좌',
      value: activeCoursesCount ?? 0,
      icon: BookOpen,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold text-navy">대시보드</h1>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm"
          >
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${kpi.bg}`}>
              <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 최근 수강 신청 */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-navy">최근 수강 신청</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="pb-2 font-medium">회원</th>
                  <th className="pb-2 font-medium">강좌</th>
                  <th className="pb-2 font-medium">신청일</th>
                </tr>
              </thead>
              <tbody>
                {recentEnrollments?.map((e) => {
                  const profile = e.profiles as { name: string } | null
                  const course = e.courses as { title: string } | null
                  return (
                    <tr key={e.id} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-navy">
                        {profile?.name ?? '-'}
                      </td>
                      <td className="py-2 text-gray-600">
                        {course?.title ?? '-'}
                      </td>
                      <td className="py-2 text-gray-400">
                        {dayjs(e.enrolled_at).format('MM/DD')}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 최근 가입 회원 */}
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 font-semibold text-navy">최근 가입 회원</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                  <th className="pb-2 font-medium">이름</th>
                  <th className="pb-2 font-medium">이메일</th>
                  <th className="pb-2 font-medium">가입일</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers?.map((u) => (
                  <tr key={u.id} className="border-b border-gray-50">
                    <td className="py-2 font-medium text-navy">{u.name}</td>
                    <td className="py-2 text-gray-500 text-xs">{u.email}</td>
                    <td className="py-2 text-gray-400">
                      {dayjs(u.created_at).format('MM/DD')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
