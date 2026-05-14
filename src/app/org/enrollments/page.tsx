import { requireManagerCompany, getCompanyMemberIds } from '@/lib/org'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const STATUS_LABELS: Record<string, string> = {
  active: '수강중', completed: '수료', expired: '만료', cancelled: '취소',
}

export default async function OrgEnrollmentsPage({
  searchParams,
}: {
  searchParams: { status?: string }
}) {
  const { supabase, companyId } = await requireManagerCompany()
  const statusFilter = searchParams.status ?? ''
  const memberIds = await getCompanyMemberIds(supabase, companyId)

  let enrolls: {
    id: string
    user_id: string
    course_id: string
    status: string
    enrolled_at: string
    user_name: string | null
    course_title: string | null
  }[] = []

  if (memberIds.length > 0) {
    let q = supabase
      .from('enrollments')
      .select('id, user_id, course_id, status, enrolled_at, profiles(name), courses(title)')
      .in('user_id', memberIds)
      .order('enrolled_at', { ascending: false })
    if (statusFilter) q = q.eq('status', statusFilter)

    const { data: rawEnrolls } = await q
    const rows = rawEnrolls as unknown as {
      id: string
      user_id: string
      course_id: string
      status: string
      enrolled_at: string
      profiles: { name: string | null } | null
      courses: { title: string } | null
    }[] | null

    enrolls = (rows ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      course_id: r.course_id,
      status: r.status,
      enrolled_at: r.enrolled_at,
      user_name: r.profiles?.name ?? null,
      course_title: r.courses?.title ?? null,
    }))
  }

  // Compute progress percent per enrollment
  let progressMap: Record<string, number> = {}
  if (enrolls.length > 0) {
    const courseIds = Array.from(new Set(enrolls.map((e) => e.course_id)))
    const userIds = Array.from(new Set(enrolls.map((e) => e.user_id)))

    const { data: rawLessons } = await supabase
      .from('lessons')
      .select('id, course_id')
      .in('course_id', courseIds)
      .is('deleted_at', null)
    const lessons = rawLessons as unknown as { id: string; course_id: string }[] | null
    const totalMap: Record<string, number> = {}
    ;(lessons ?? []).forEach((l) => {
      totalMap[l.course_id] = (totalMap[l.course_id] ?? 0) + 1
    })

    const { data: rawProgress } = await supabase
      .from('lesson_progress')
      .select('user_id, course_id, is_completed')
      .in('user_id', userIds)
      .in('course_id', courseIds)
      .eq('is_completed', true)
    const progress = rawProgress as unknown as {
      user_id: string
      course_id: string
      is_completed: boolean
    }[] | null
    const doneMap: Record<string, number> = {}
    ;(progress ?? []).forEach((p) => {
      const key = `${p.user_id}|${p.course_id}`
      doneMap[key] = (doneMap[key] ?? 0) + 1
    })

    enrolls.forEach((e) => {
      const total = totalMap[e.course_id] ?? 0
      const done = doneMap[`${e.user_id}|${e.course_id}`] ?? 0
      progressMap[e.id] = total > 0 ? Math.round((done / total) * 100) : 0
    })
  }

  const statuses = ['', 'active', 'completed', 'expired', 'cancelled']

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-2">수강 현황</h1>
      <p className="text-sm text-gray-500 mb-6">총 {enrolls.length}건</p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {statuses.map((s) => {
          const label = s ? STATUS_LABELS[s] ?? s : '전체'
          const active = statusFilter === s
          const href = s ? `/org/enrollments?status=${s}` : '/org/enrollments'
          return (
            <Link
              key={s}
              href={href}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                active
                  ? 'bg-[#2D7DD2] text-white border-[#2D7DD2]'
                  : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {label}
            </Link>
          )
        })}
      </div>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">수강자</th>
              <th className="px-4 py-3 text-left font-semibold">강좌</th>
              <th className="px-4 py-3 text-left font-semibold">신청일</th>
              <th className="px-4 py-3 text-center font-semibold">상태</th>
              <th className="px-4 py-3 text-center font-semibold">진도율</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {enrolls.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  수강 내역이 없습니다.
                </td>
              </tr>
            ) : (
              enrolls.map((e) => (
                <tr key={e.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{e.user_name ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{e.course_title ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(e.enrolled_at)}</td>
                  <td className="px-4 py-3 text-center text-xs text-gray-600">
                    {STATUS_LABELS[e.status] ?? e.status}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#2D7DD2]"
                          style={{ width: `${progressMap[e.id] ?? 0}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-10 text-right">
                        {progressMap[e.id] ?? 0}%
                      </span>
                    </div>
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
