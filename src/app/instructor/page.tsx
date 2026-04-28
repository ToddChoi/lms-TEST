import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, Users, Award, ArrowRight } from 'lucide-react'

export default async function InstructorDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 본인이 담당하는 강좌 목록 (admin 도 자기 명의로 만든 강좌 보임)
  const { data: rawCourses } = await supabase
    .from('courses')
    .select('id, title, status')
    .eq('instructor_id', user.id)
  const courses = (rawCourses as unknown as { id: string; title: string; status: string }[] | null) ?? []

  const courseIds = courses.map((c) => c.id)

  // 수강생 수
  let studentCount = 0
  if (courseIds.length > 0) {
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .in('course_id', courseIds)
    studentCount = count ?? 0
  }

  // 수료증 수
  let certCount = 0
  if (courseIds.length > 0) {
    const { count } = await supabase
      .from('certificates')
      .select('id', { count: 'exact', head: true })
      .in('course_id', courseIds)
    certCount = count ?? 0
  }

  const kpis = [
    { label: '담당 강좌',  value: courses.length, icon: BookOpen, color: 'text-[#2D7DD2]', bg: 'bg-blue-50' },
    { label: '누적 수강생', value: studentCount,   icon: Users,    color: 'text-green-700',   bg: 'bg-green-50' },
    { label: '수료증 발급', value: certCount,      icon: Award,    color: 'text-orange-700',  bg: 'bg-orange-50' },
  ]

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-[#0B1F3A]">강사 대시보드</h1>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {kpis.map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-5`}>
            <div className="flex items-center gap-2">
              <k.icon className={`h-4 w-4 ${k.color}`} />
              <p className="text-sm text-gray-600">{k.label}</p>
            </div>
            <p className={`mt-1 text-3xl font-bold ${k.color}`}>{k.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#0B1F3A]">내 강좌</h2>
          <Link
            href="/instructor/courses"
            className="inline-flex items-center gap-1 text-sm text-[#2D7DD2] hover:underline"
          >
            전체보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {courses.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            아직 담당하는 강좌가 없습니다. 관리자에게 강좌 배정을 요청하세요.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {courses.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-[#0B1F3A]">{c.title}</span>
                <span className="text-xs text-gray-400">{c.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
