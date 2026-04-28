import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDate } from '@/lib/utils'

export default async function InstructorCoursesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawCourses } = await supabase
    .from('courses')
    .select('id, title, status, total_duration, created_at')
    .eq('instructor_id', user.id)
    .order('created_at', { ascending: false })
  const courses = (rawCourses as unknown as {
    id: string; title: string; status: string
    total_duration: number; created_at: string
  }[] | null) ?? []

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">내 강좌</h1>
        <span className="text-sm text-gray-500">총 {courses.length}건</span>
      </div>

      {courses.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="담당 강좌가 없습니다"
          description="관리자가 강좌를 배정해주면 이곳에 표시됩니다."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">강좌명</th>
                <th className="px-4 py-3 text-left font-semibold w-24">상태</th>
                <th className="px-4 py-3 text-left font-semibold w-28">생성일</th>
                <th className="px-4 py-3 text-center font-semibold w-32">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {courses.map((c) => (
                <tr key={c.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">{c.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{c.status}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{formatDate(c.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    <Link
                      href={`/instructor/courses/${c.id}/students`}
                      className="inline-block rounded-lg bg-[#E8F2FC] px-3 py-1 text-xs font-medium text-[#2D7DD2] hover:bg-[#2D7DD2] hover:text-white transition"
                    >
                      수강생 보기
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
