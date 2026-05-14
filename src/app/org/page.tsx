import { requireManagerCompany, getCompanyMemberIds } from '@/lib/org'
import { formatDate } from '@/lib/utils'

export default async function OrgDashboardPage() {
  const { supabase, companyId, companyName } = await requireManagerCompany()
  const memberIds = await getCompanyMemberIds(supabase, companyId)

  const memberCount = memberIds.length

  // Enrollments
  let enrollmentsCount = 0
  let completionsCount = 0
  let avgProgress = 0
  let recent: {
    id: string
    status: string
    enrolled_at: string
    user_name: string | null
    user_email: string | null
    course_title: string | null
  }[] = []

  if (memberIds.length > 0) {
    const { count: ec } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('user_id', memberIds)
    enrollmentsCount = ec ?? 0

    const { count: cc } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .in('user_id', memberIds)
      .eq('status', 'completed')
    completionsCount = cc ?? 0

    // Pull all enrollments to compute average progress
    const { data: rawEnrolls } = await supabase
      .from('enrollments')
      .select('id, user_id, course_id, status, enrolled_at')
      .in('user_id', memberIds)
    const enrolls = rawEnrolls as unknown as {
      id: string
      user_id: string
      course_id: string
      status: string
      enrolled_at: string
    }[] | null

    if (enrolls && enrolls.length > 0) {
      // Compute lesson totals per course
      const courseIds = Array.from(new Set(enrolls.map((e) => e.course_id)))
      const { data: rawLessons } = await supabase
        .from('lessons')
        .select('id, course_id')
        .in('course_id', courseIds)
        .is('deleted_at', null)
      const lessons = rawLessons as unknown as { id: string; course_id: string }[] | null
      const lessonsPerCourse: Record<string, number> = {}
      ;(lessons ?? []).forEach((l) => {
        lessonsPerCourse[l.course_id] = (lessonsPerCourse[l.course_id] ?? 0) + 1
      })

      // Completed lesson counts per user/course
      const { data: rawProgress } = await supabase
        .from('lesson_progress')
        .select('user_id, course_id, is_completed')
        .in('user_id', memberIds)
        .eq('is_completed', true)
      const progressRows = rawProgress as unknown as {
        user_id: string
        course_id: string
        is_completed: boolean
      }[] | null
      const completedMap: Record<string, number> = {}
      ;(progressRows ?? []).forEach((p) => {
        const key = `${p.user_id}|${p.course_id}`
        completedMap[key] = (completedMap[key] ?? 0) + 1
      })

      let progressSum = 0
      for (const e of enrolls) {
        const total = lessonsPerCourse[e.course_id] ?? 0
        const done = completedMap[`${e.user_id}|${e.course_id}`] ?? 0
        if (total > 0) progressSum += (done / total) * 100
      }
      avgProgress = enrolls.length > 0 ? Math.round(progressSum / enrolls.length) : 0
    }

    // Recent 10
    const { data: rawRecent } = await supabase
      .from('enrollments')
      .select('id, status, enrolled_at, profiles(name, email), courses(title)')
      .in('user_id', memberIds)
      .order('enrolled_at', { ascending: false })
      .limit(10)
    const recentRaw = rawRecent as unknown as {
      id: string
      status: string
      enrolled_at: string
      profiles: { name: string | null; email: string | null } | null
      courses: { title: string } | null
    }[] | null
    recent = (recentRaw ?? []).map((r) => ({
      id: r.id,
      status: r.status,
      enrolled_at: r.enrolled_at,
      user_name: r.profiles?.name ?? null,
      user_email: r.profiles?.email ?? null,
      course_title: r.courses?.title ?? null,
    }))
  }

  const STATUS_LABELS: Record<string, string> = {
    active: '수강중', completed: '수료', expired: '만료', cancelled: '취소',
  }

  const kpis = [
    { label: '총 회원', value: memberCount, bg: 'bg-[#E8F2FC]', color: 'text-[#0B1F3A]' },
    { label: '총 수강', value: enrollmentsCount, bg: 'bg-blue-50', color: 'text-[#2D7DD2]' },
    { label: '수료 완료', value: completionsCount, bg: 'bg-green-50', color: 'text-green-700' },
    { label: '평균 진도율', value: `${avgProgress}%`, bg: 'bg-orange-50', color: 'text-orange-700' },
  ]

  return (
    <div className="p-8">
      <div className="mb-6">
        <p className="text-sm text-gray-500">{companyName}</p>
        <h1 className="text-2xl font-bold text-[#0B1F3A] mt-1">대시보드</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {kpis.map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-5`}>
            <p className="text-sm text-gray-500 mb-1">{k.label}</p>
            <p className={`text-3xl font-bold ${k.color}`}>
              {typeof k.value === 'number' ? k.value.toLocaleString() : k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-[#0B1F3A]">최근 수강신청 10건</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">수강자</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">이메일</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">강좌</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">신청일</th>
              <th className="px-4 py-3 text-left font-semibold text-[#0B1F3A]">상태</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {recent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-gray-400">
                  수강 내역이 없습니다.
                </td>
              </tr>
            ) : (
              recent.map((r) => (
                <tr key={r.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{r.user_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{r.user_email ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{r.course_title ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(r.enrolled_at)}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {STATUS_LABELS[r.status] ?? r.status}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
