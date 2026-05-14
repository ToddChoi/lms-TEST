import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Users } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'

interface Props {
  params: { id: string }
}

const STATUS_LABELS: Record<string, string> = {
  active: '수강중', completed: '수료', expired: '만료', cancelled: '취소',
}

export default async function InstructorStudentsPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 강좌 소유 여부 확인 (admin 은 RLS 로 통과)
  const { data: rawCourse } = await supabase
    .from('courses')
    .select('id, title, instructor_id')
    .eq('id', params.id)
    .maybeSingle()
  const course = rawCourse as unknown as {
    id: string; title: string; instructor_id: string | null
  } | null
  if (!course) notFound()

  // 본인이 담당자가 아니면 막음 (admin/superadmin 은 추가 검사 통과)
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (rawProfile as unknown as { role: string } | null)?.role
  const isAdmin = role === 'admin' || role === 'superadmin'
  if (!isAdmin && course.instructor_id !== user.id) {
    redirect('/instructor')
  }

  // 수강생 + 진도 (단순화: enrollments 만, lesson_progress 집계는 별도)
  const { data: rawEnrollments } = await supabase
    .from('enrollments')
    .select('id, user_id, status, enrolled_at, profiles(name, email)')
    .eq('course_id', params.id)
    .order('enrolled_at', { ascending: false })
  const enrollments = (rawEnrollments as unknown as {
    id: string; user_id: string; status: string; enrolled_at: string
    profiles: { name: string | null; email: string | null } | null
  }[] | null) ?? []

  // 강좌 전체 강의 수 (soft-deleted 제외)
  const { count: totalLessons } = await supabase
    .from('lessons').select('id', { count: 'exact', head: true })
    .eq('course_id', params.id)
    .is('deleted_at', null)

  // 수강생별 완료 강의 수
  const userIds = enrollments.map((e) => e.user_id)
  let completedMap = new Map<string, number>()
  if (userIds.length > 0) {
    const { data: rawProgress } = await supabase
      .from('lesson_progress')
      .select('user_id')
      .eq('course_id', params.id)
      .eq('is_completed', true)
      .in('user_id', userIds)
    const progressList = rawProgress as unknown as { user_id: string }[] | null
    completedMap = (progressList ?? []).reduce<Map<string, number>>((acc, p) => {
      acc.set(p.user_id, (acc.get(p.user_id) ?? 0) + 1)
      return acc
    }, new Map())
  }

  const totalLessonCount = totalLessons ?? 0

  return (
    <div>
      <Link
        href="/instructor/courses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> 내 강좌
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">{course.title}</h1>
        <p className="mt-1 text-sm text-gray-500">수강생 {enrollments.length}명</p>
      </div>

      {enrollments.length === 0 ? (
        <EmptyState
          icon={Users}
          title="아직 수강생이 없습니다"
          description="강좌가 공개되고 수강 신청이 들어오면 이곳에 표시됩니다."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">이름</th>
                <th className="px-4 py-3 text-left font-semibold">이메일</th>
                <th className="px-4 py-3 text-left font-semibold w-28">신청일</th>
                <th className="px-4 py-3 text-left font-semibold w-24">상태</th>
                <th className="px-4 py-3 text-left font-semibold w-32">진도</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {enrollments.map((e) => {
                const completed = completedMap.get(e.user_id) ?? 0
                const rate = totalLessonCount > 0 ? Math.round((completed / totalLessonCount) * 100) : 0
                return (
                  <tr key={e.id} className="hover:bg-[#E8F2FC]/30 transition">
                    <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                      {e.profiles?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.profiles?.email ?? '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{formatDate(e.enrolled_at)}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">
                      {STATUS_LABELS[e.status] ?? e.status}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full bg-[#2D7DD2] transition-all"
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 w-10 text-right">{rate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
