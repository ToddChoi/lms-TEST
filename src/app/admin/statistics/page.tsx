import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import { DailyEnrollChart, CategoryBarChart, CompletionPieChart } from '@/components/admin/StatCharts'
import dayjs from '@/lib/dayjs'

export default async function AdminStatisticsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  // KPIs
  const [
    { count: totalUsers },
    { count: activeCourses },
    { count: totalCerts },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('certificates').select('*', { count: 'exact', head: true }),
  ])

  const monthStart = dayjs().tz('Asia/Seoul').startOf('month').toISOString()
  const { count: monthEnrollments } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .gte('enrolled_at', monthStart)

  // Daily enrollments last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: rawDailyEnrollments } = await supabase
    .from('enrollments')
    .select('enrolled_at')
    .gte('enrolled_at', thirtyDaysAgo)
    .order('enrolled_at', { ascending: true })
  const dailyRaw = rawDailyEnrollments as unknown as { enrolled_at: string }[] | null

  // Group by date
  const dailyMap: Record<string, number> = {}
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = 0
  }
  ;(dailyRaw ?? []).forEach((e) => {
    const key = e.enrolled_at.slice(0, 10)
    if (key in dailyMap) dailyMap[key]++
  })
  const dailyData = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

  // Category course counts
  const { data: rawCourses } = await supabase
    .from('courses')
    .select('categories(name)')
  const coursesWithCat = rawCourses as unknown as {
    categories: { name: string } | null
  }[] | null

  const catMap: Record<string, number> = {}
  ;(coursesWithCat ?? []).forEach((c) => {
    const name = c.categories?.name ?? '미분류'
    catMap[name] = (catMap[name] ?? 0) + 1
  })
  const categoryData = Object.entries(catMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  // Recent 10 enrollments
  const { data: rawRecent } = await supabase
    .from('enrollments')
    .select('id, status, enrolled_at, profiles(name, email), courses(title)')
    .order('enrolled_at', { ascending: false })
    .limit(10)
  const recentEnrollments = rawRecent as unknown as {
    id: string
    status: string
    enrolled_at: string
    profiles: { name: string | null; email: string | null } | null
    courses: { title: string } | null
  }[] | null

  const kpis = [
    { label: '전체 회원', value: totalUsers ?? 0, color: 'text-[#0B1F3A]', bg: 'bg-[#E8F2FC]' },
    { label: '활성 강좌', value: activeCourses ?? 0, color: 'text-[#2D7DD2]', bg: 'bg-blue-50' },
    { label: '이번달 수강신청', value: monthEnrollments ?? 0, color: 'text-green-700', bg: 'bg-green-50' },
    { label: '발급된 수료증', value: totalCerts ?? 0, color: 'text-orange-700', bg: 'bg-orange-50' },
  ]

  const STATUS_LABELS: Record<string, string> = {
    active: '수강중', completed: '수료', expired: '만료', cancelled: '취소',
  }

  // ─── Phase 5: 기업별 수강 현황 (N+1 → 3 queries로 최적화) ───
  const [
    { data: rawCompaniesList },
    { data: rawAllMembers },
    { data: rawAllEnrollments },
  ] = await Promise.all([
    supabase.from('companies').select('id, name').order('name', { ascending: true }),
    supabase.from('company_members').select('company_id, user_id'),
    supabase.from('enrollments').select('user_id, status'),
  ])

  type CompanyRow = { id: string; name: string }
  type MemberRow = { company_id: string; user_id: string }
  type EnrollRow = { user_id: string; status: string }

  const companiesList = rawCompaniesList as unknown as CompanyRow[] | null
  const allMembers = rawAllMembers as unknown as MemberRow[] | null
  const allEnrollments = rawAllEnrollments as unknown as EnrollRow[] | null

  // company_id → user_id[] 맵
  const companyMemberMap = new Map<string, string[]>()
  for (const m of allMembers ?? []) {
    if (!companyMemberMap.has(m.company_id)) companyMemberMap.set(m.company_id, [])
    companyMemberMap.get(m.company_id)!.push(m.user_id)
  }

  // user_id → enrollments 맵
  const userEnrollMap = new Map<string, EnrollRow[]>()
  for (const e of allEnrollments ?? []) {
    if (!userEnrollMap.has(e.user_id)) userEnrollMap.set(e.user_id, [])
    userEnrollMap.get(e.user_id)!.push(e)
  }

  const companyStats = (companiesList ?? []).map((c) => {
    const memberIds = companyMemberMap.get(c.id) ?? []
    const enrollments = memberIds.flatMap((uid) => userEnrollMap.get(uid) ?? [])
    const enrollmentCount = enrollments.length
    const completedCount = enrollments.filter((e) => e.status === 'completed').length
    return {
      name: c.name,
      memberCount: memberIds.length,
      enrollmentCount,
      completionRate: enrollmentCount > 0 ? Math.round((completedCount / enrollmentCount) * 100) : 0,
    }
  })

  // Overall completion pie
  const { data: rawAllStatuses } = await supabase
    .from('enrollments')
    .select('status')
  const allStatuses = rawAllStatuses as unknown as { status: string }[] | null
  const statusCounts: Record<string, number> = {}
  ;(allStatuses ?? []).forEach((s) => {
    statusCounts[s.status] = (statusCounts[s.status] ?? 0) + 1
  })
  const completionPieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }))

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-6">통계 대시보드</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={`${kpi.bg} rounded-xl p-5`}>
            <p className="text-sm text-gray-500 mb-1">{kpi.label}</p>
            <p className={`text-3xl font-bold ${kpi.color}`}>{kpi.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-[#0B1F3A] mb-4">
            최근 30일 수강신청 추이
          </h2>
          <DailyEnrollChart data={dailyData} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-[#0B1F3A] mb-4">
            카테고리별 강좌 수
          </h2>
          <CategoryBarChart data={categoryData} />
        </div>
      </div>

      {/* Recent Enrollments */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#0B1F3A]">최근 수강신청 10건</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">수강자</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">이메일</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">강좌명</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">신청일</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {(recentEnrollments ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  수강 내역이 없습니다.
                </td>
              </tr>
            ) : (
              (recentEnrollments ?? []).map((e) => (
                <tr key={e.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {e.profiles?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{e.profiles?.email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{e.courses?.title ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(e.enrolled_at)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-gray-600">
                      {STATUS_LABELS[e.status] ?? e.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 기업별 수강 현황 */}
      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100 mt-8">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#0B1F3A]">기업별 수강 현황</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">기업명</th>
              <th className="px-4 py-3 text-center font-semibold text-[#0B1F3A]">회원 수</th>
              <th className="px-4 py-3 text-center font-semibold text-[#0B1F3A]">수강 건수</th>
              <th className="px-4 py-3 text-center font-semibold text-[#0B1F3A]">수료율</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {companyStats.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-gray-400">
                  등록된 기업이 없습니다.
                </td>
              </tr>
            ) : (
              companyStats.map((c) => (
                <tr key={c.name} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{c.name}</td>
                  <td className="px-4 py-3 text-center text-gray-700">{c.memberCount}명</td>
                  <td className="px-4 py-3 text-center text-gray-700">{c.enrollmentCount}건</td>
                  <td className="px-4 py-3 text-center text-gray-700">{c.completionRate}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 수료 완료율 차트 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mt-8 max-w-2xl">
        <h2 className="text-base font-semibold text-[#0B1F3A] mb-4">수료 완료율</h2>
        <CompletionPieChart data={completionPieData} />
      </div>
    </div>
  )
}
