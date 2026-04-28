import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDate, formatDuration } from '@/lib/utils'
import { Plus, Pencil, BookOpen } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '강좌 관리' }

export default async function AdminCoursesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as { role: string } | null

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    redirect('/')
  }

  const { data: rawCourses } = await supabase
    .from('courses')
    .select(`
      id, title, status, price, total_duration,
      enroll_start, enroll_end, created_at,
      categories (name),
      instructor:profiles!instructor_id (name)
    `)
    .order('created_at', { ascending: false })
  const courses = rawCourses as unknown as any[] | null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">강좌 관리</h1>
          <p className="mt-1 text-sm text-gray-500">총 {courses?.length ?? 0}개</p>
        </div>
        <Link
          href="/admin/courses/new"
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
        >
          <Plus className="h-4 w-4" /> 강좌 추가
        </Link>
      </div>

      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-silver">
              <th className="px-4 py-3 text-left font-semibold text-gray-600">강좌명</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">카테고리</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">상태</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">가격</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">수강 신청 기간</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">강의 시간</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">관리</th>
            </tr>
          </thead>
          <tbody>
            {courses && courses.length > 0 ? (
              courses.map((course) => {
                const cat = course.categories as { name: string } | null
                const ins = course.instructor as { name: string } | null
                return (
                  <tr key={course.id} className="border-b border-gray-50 hover:bg-silver/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 shrink-0 text-gray-300" />
                        <div>
                          <p className="font-medium text-navy line-clamp-1">{course.title}</p>
                          {ins && <p className="text-xs text-gray-400">{ins.name}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{cat?.name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={course.status as 'draft' | 'active' | 'closed'} />
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">
                      {course.price === 0 ? '무료' : `${course.price.toLocaleString()}원`}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {course.enroll_start || course.enroll_end
                        ? `${course.enroll_start ? formatDate(course.enroll_start) : '상시'} ~ ${course.enroll_end ? formatDate(course.enroll_end) : '상시'}`
                        : '상시'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {course.total_duration > 0 ? formatDuration(course.total_duration) : '-'}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/courses/${course.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        <Pencil className="h-3 w-3" /> 편집
                      </Link>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={7} className="py-16 text-center text-gray-400">
                  등록된 강좌가 없습니다.{' '}
                  <Link href="/admin/courses/new" className="text-accent hover:underline">
                    첫 강좌를 추가하세요
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
