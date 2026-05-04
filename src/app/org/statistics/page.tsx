import { requireManagerCompany, getCompanyMemberIds } from '@/lib/org'
import {
  DailyEnrollChart,
  CoursePopularityChart,
  CompletionPieChart,
} from '@/components/org/OrgCharts'

export default async function OrgStatisticsPage() {
  const { supabase, companyId, companyName } = await requireManagerCompany()
  const memberIds = await getCompanyMemberIds(supabase, companyId)

  let dailyData: { date: string; count: number }[] = []
  let courseData: { name: string; count: number }[] = []
  let completionData: { name: string; value: number }[] = []

  if (memberIds.length > 0) {
    // Daily enrollments last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: rawDaily } = await supabase
      .from('enrollments')
      .select('enrolled_at')
      .in('user_id', memberIds)
      .gte('enrolled_at', thirtyDaysAgo)
    const daily = rawDaily as unknown as { enrolled_at: string }[] | null

    const dailyMap: Record<string, number> = {}
    for (let i = 0; i < 30; i++) {
      const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
      dailyMap[d.toISOString().slice(0, 10)] = 0
    }
    ;(daily ?? []).forEach((e) => {
      const k = e.enrolled_at.slice(0, 10)
      if (k in dailyMap) dailyMap[k]++
    })
    dailyData = Object.entries(dailyMap).map(([date, count]) => ({ date, count }))

    // Course popularity
    const { data: rawCourseEnrolls } = await supabase
      .from('enrollments')
      .select('course_id, courses(title)')
      .in('user_id', memberIds)
    const courseEnrolls = rawCourseEnrolls as unknown as {
      course_id: string
      courses: { title: string } | null
    }[] | null

    const courseMap: Record<string, number> = {}
    ;(courseEnrolls ?? []).forEach((e) => {
      const name = e.courses?.title ?? '미분류'
      courseMap[name] = (courseMap[name] ?? 0) + 1
    })
    courseData = Object.entries(courseMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    // Completion pie
    const { data: rawStatuses } = await supabase
      .from('enrollments')
      .select('status')
      .in('user_id', memberIds)
    const statuses = rawStatuses as unknown as { status: string }[] | null
    const statusMap: Record<string, number> = {}
    ;(statuses ?? []).forEach((s) => {
      statusMap[s.status] = (statusMap[s.status] ?? 0) + 1
    })
    completionData = Object.entries(statusMap).map(([name, value]) => ({ name, value }))
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="text-sm text-gray-500">{companyName}</p>
          <h1 className="text-2xl font-bold text-[#0B1F3A] mt-1">통계</h1>
        </div>
        <a
          href="/api/org/csv"
          download
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#0B1F3A] px-4 py-2 text-sm font-medium text-white hover:bg-[#162d4f] transition"
        >
          CSV 내보내기
        </a>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-[#0B1F3A] mb-4">최근 30일 수강신청 추이</h2>
          <DailyEnrollChart data={dailyData} />
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-[#0B1F3A] mb-4">인기 강좌 TOP 8</h2>
          <CoursePopularityChart data={courseData} />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 max-w-2xl">
        <h2 className="text-base font-semibold text-[#0B1F3A] mb-4">수강 상태 분포</h2>
        <CompletionPieChart data={completionData} />
      </div>
    </div>
  )
}
