import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { BookOpen, Clock, PlayCircle } from 'lucide-react'
import { formatDuration, formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '내 강의실' }

export default async function MyCoursesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawEnrollments } = await supabase
    .from('enrollments')
    .select(`
      id, status, enrolled_at, expires_at,
      courses (
        id, title, slug, thumbnail_url, total_duration,
        categories (name)
      )
    `)
    .eq('user_id', user.id)
    .order('enrolled_at', { ascending: false })
  const enrollments = rawEnrollments as unknown as any[] | null

  // 수강 중 vs 수료 완료 분리
  const active = enrollments?.filter((e) => e.status === 'active') ?? []
  const completed = enrollments?.filter((e) => e.status === 'completed') ?? []

  // 강좌별 진도 조회
  const courseIds = active.map((e) => {
    const c = e.courses as { id: string } | null
    return c?.id
  }).filter(Boolean) as string[]

  let progressMap: Record<string, number> = {}
  if (courseIds.length > 0) {
    // 각 강좌의 전체 레슨 수
    const { data: rawLessonCounts } = await supabase
      .from('lessons')
      .select('course_id')
      .in('course_id', courseIds)
    const lessonCounts = rawLessonCounts as unknown as { course_id: string }[] | null

    const { data: rawCompletedProgress } = await supabase
      .from('lesson_progress')
      .select('course_id')
      .eq('user_id', user.id)
      .eq('is_completed', true)
      .in('course_id', courseIds)
    const completedProgress = rawCompletedProgress as unknown as { course_id: string }[] | null

    courseIds.forEach((id) => {
      const total = lessonCounts?.filter((l) => l.course_id === id).length ?? 0
      const done = completedProgress?.filter((p) => p.course_id === id).length ?? 0
      progressMap[id] = total > 0 ? Math.round((done / total) * 100) : 0
    })
  }

  const CourseRow = ({
    enrollment,
    showProgress = false,
  }: {
    enrollment: typeof active[0]
    showProgress?: boolean
  }) => {
    const course = enrollment.courses as {
      id: string; title: string; thumbnail_url: string | null
      total_duration: number; categories: { name: string } | null
    } | null
    if (!course) return null

    const progress = progressMap[course.id] ?? 0

    return (
      <div className="flex gap-4 rounded-2xl bg-white p-4 shadow-sm">
        {/* 썸네일 */}
        <div className="relative h-24 w-36 shrink-0 overflow-hidden rounded-xl bg-accent-pale">
          {course.thumbnail_url ? (
            <Image src={course.thumbnail_url} alt={course.title} fill className="object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <BookOpen className="h-8 w-8 text-accent/40" />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between min-w-0">
          <div>
            {course.categories && (
              <p className="text-xs font-medium text-accent">{course.categories.name}</p>
            )}
            <h3 className="mt-0.5 font-semibold text-navy line-clamp-2">{course.title}</h3>
            <div className="mt-1 flex items-center gap-3 text-xs text-gray-400">
              {course.total_duration > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {formatDuration(course.total_duration)}
                </span>
              )}
              {enrollment.expires_at && (
                <span>~{formatDate(enrollment.expires_at)} 까지</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between mt-2">
            <div className="flex-1 mr-4">
              {showProgress && (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-accent transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{progress}%</span>
                </div>
              )}
              {!showProgress && (
                <StatusBadge status="completed" />
              )}
            </div>
            <Link
              href={`/my/courses/${course.id}/learn`}
              className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-light shrink-0"
            >
              <PlayCircle className="h-4 w-4" />
              {progress > 0 ? '이어보기' : '시작하기'}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-bold text-navy">내 강의실</h1>

      {/* 수강 중 */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-bold text-navy">
          <PlayCircle className="h-5 w-5 text-accent" />
          수강 중
          <span className="ml-1 rounded-full bg-accent-pale px-2 py-0.5 text-xs text-accent">
            {active.length}
          </span>
        </h2>
        {active.length > 0 ? (
          <div className="flex flex-col gap-3">
            {active.map((e) => (
              <CourseRow key={e.id} enrollment={e} showProgress />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl bg-white py-12 text-center shadow-sm">
            <BookOpen className="h-10 w-10 text-gray-200" />
            <p className="mt-3 font-medium text-gray-400">수강 중인 강좌가 없습니다</p>
            <Link
              href="/courses"
              className="mt-3 text-sm font-medium text-accent hover:underline"
            >
              강좌 둘러보기 →
            </Link>
          </div>
        )}
      </section>

      {/* 수료 완료 */}
      {completed.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-bold text-navy">
            수료 완료
            <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">
              {completed.length}
            </span>
          </h2>
          <div className="flex flex-col gap-3">
            {completed.map((e) => (
              <CourseRow key={e.id} enrollment={e} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
