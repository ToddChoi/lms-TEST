import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Award, TrendingUp, Clock, ArrowRight } from 'lucide-react'
import { ContinueLearningCard } from '@/components/my/ContinueLearningCard'
import { LearningStreakWidget } from '@/components/my/LearningStreakWidget'
import { LearningTimeChart } from '@/components/my/LearningTimeChart'
import { LearningCalendarHeatmap } from '@/components/my/LearningCalendarHeatmap'
import { CourseCardV2, type CourseCardV2Data } from '@/components/courses/CourseCardV2'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '마이페이지' }

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export default async function MyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const profile = rawProfile as unknown as { name: string } | null

  // ── KPI 카운트 (parallel) ──
  const [
    { count: enrollmentCount },
    { count: completedCount },
    { count: certCount },
  ] = await Promise.all([
    supabase.from('enrollments').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'active'),
    supabase.from('enrollments').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'completed'),
    supabase.from('certificates').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  // ── 가장 최근 학습한 강좌 (이어보기) ──
  // soft-deleted lesson 가리키는 row 는 skip — limit 5 fetch 후 client-side 필터.
  const { data: rawRecent } = await supabase
    .from('lesson_progress')
    .select('lesson_id, course_id, last_watched_at, lessons(title, deleted_at), courses(id, title, thumbnail_url, total_duration, categories(name))')
    .eq('user_id', user.id)
    .order('last_watched_at', { ascending: false })
    .limit(5)
  const recentRows = (rawRecent as unknown as {
    lesson_id: string
    course_id: string
    last_watched_at: string
    lessons: { title: string; deleted_at: string | null } | null
    courses: {
      id: string; title: string; thumbnail_url: string | null
      total_duration: number; categories: { name: string } | null
    } | null
  }[] | null) ?? []
  const recent = recentRows.find((r) => r.lessons && r.lessons.deleted_at === null) ?? null

  // ── 수강 중인 강좌 목록 (active enrollments) ──
  const { data: rawActiveEnrollments } = await supabase
    .from('enrollments')
    .select(`
      course_id,
      enrolled_at,
      courses (
        id, title, thumbnail_url, total_duration, status, price,
        rating_avg, rating_count, enrolled_count, level, badge,
        categories (name, slug),
        instructor:profiles!instructor_id (name, avatar_url)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .order('enrolled_at', { ascending: false })
    .limit(8)
  const activeEnrollments = (rawActiveEnrollments as unknown as {
    course_id: string
    enrolled_at: string
    courses: {
      id: string; title: string; thumbnail_url: string | null
      total_duration: number; status: string; price: number
      rating_avg: number | null; rating_count: number | null
      enrolled_count: number | null; level: string | null; badge: string | null
      categories: { name: string; slug: string } | null
      instructor: { name: string | null; avatar_url: string | null } | null
    } | null
  }[] | null) ?? []

  // 이어보기 카드와 중복되는 강좌는 제외 (다른 강좌만 표시)
  const otherActiveCourses = activeEnrollments
    .filter((e) => e.courses && e.course_id !== recent?.course_id)
    .slice(0, 6)

  // 수강 중 강좌별 진도 계산
  const otherCourseIds = otherActiveCourses
    .map((e) => e.courses?.id)
    .filter((id): id is string => !!id)

  const progressMap: Record<string, number> = {}
  if (otherCourseIds.length > 0) {
    const [{ data: rawLessonCounts }, { data: rawCompletedCounts }] = await Promise.all([
      supabase.from('lessons').select('course_id').in('course_id', otherCourseIds).is('deleted_at', null),
      supabase.from('lesson_progress').select('course_id')
        .eq('user_id', user.id).eq('is_completed', true).in('course_id', otherCourseIds),
    ])
    const lessonRows = (rawLessonCounts as unknown as { course_id: string }[] | null) ?? []
    const completedRows = (rawCompletedCounts as unknown as { course_id: string }[] | null) ?? []
    for (const id of otherCourseIds) {
      const total = lessonRows.filter((l) => l.course_id === id).length
      const done = completedRows.filter((p) => p.course_id === id).length
      progressMap[id] = total > 0 ? Math.round((done / total) * 100) : 0
    }
  }

  // ── 이어보기 카드용 진도 계산 ──
  let recentProgressPercent = 0
  if (recent?.course_id) {
    const [{ count: totalLessons }, { count: doneLessons }] = await Promise.all([
      supabase.from('lessons').select('*', { count: 'exact', head: true })
        .eq('course_id', recent.course_id).is('deleted_at', null),
      supabase.from('lesson_progress').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('course_id', recent.course_id).eq('is_completed', true),
    ])
    if ((totalLessons ?? 0) > 0)
      recentProgressPercent = Math.round(((doneLessons ?? 0) / (totalLessons ?? 1)) * 100)
  }

  // ── 최근 84일(12주) 학습 활동 + streak + 누적 시간 계산 ──
  // lesson_progress.watched_seconds 는 lesson 누적값이라 "그날 시청 시간" 추출 불가.
  // - daily30 / daily84: "그날 last_watched_at 이 갱신된 강의 수" 단순 활동 지표
  // - totalWatchedSeconds: 전체 누적 시청 시간 (전 기간, 정확한 합산)
  const eightyFourDaysAgo = new Date(Date.now() - 84 * 24 * 60 * 60 * 1000)
  const [{ data: rawProgressList }, { data: rawAllProgress }] = await Promise.all([
    supabase
      .from('lesson_progress')
      .select('last_watched_at')
      .eq('user_id', user.id)
      .gte('last_watched_at', eightyFourDaysAgo.toISOString()),
    supabase
      .from('lesson_progress')
      .select('watched_seconds')
      .eq('user_id', user.id),
  ])
  const progressList = (rawProgressList as unknown as
    { last_watched_at: string }[] | null) ?? []
  const allProgress = (rawAllProgress as unknown as
    { watched_seconds: number | null }[] | null) ?? []

  // 누적 학습 시간 (전 기간)
  const totalWatchedSeconds = allProgress.reduce(
    (sum, p) => sum + (p.watched_seconds ?? 0), 0
  )

  // 84일 일별 활동 카운트
  const dailyMap84: Record<string, number> = {}
  const dateSet = new Set<string>()
  for (let i = 0; i < 84; i++) {
    const d = new Date(Date.now() - (83 - i) * 24 * 60 * 60 * 1000)
    dailyMap84[isoDate(d)] = 0
  }
  for (const p of progressList) {
    const key = p.last_watched_at.slice(0, 10)
    if (key in dailyMap84) dailyMap84[key] += 1
    dateSet.add(key)
  }
  const daily84 = Object.values(dailyMap84)
  const daily = daily84.slice(-30) // 기존 LearningTimeChart 용 30일

  // 학습 streak 계산 — 오늘부터 거꾸로 dateSet에 연속된 날짜 카운트
  let streak = 0
  for (let i = 0; i < 100; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    if (dateSet.has(isoDate(d))) streak += 1
    else if (i > 0) break // 오늘 학습 안 했어도 어제부터 연속이면 OK
  }

  // 최근 7일 점 (학습 여부)
  const weekDots: boolean[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    weekDots.push(dateSet.has(isoDate(d)))
  }

  // 누적 시간 표시 — 60초 미만은 0분, 그 외는 시간 단위 우선
  const totalMinutes = Math.floor(totalWatchedSeconds / 60)
  const totalHours = Math.floor(totalMinutes / 60)
  const totalTimeLabel =
    totalHours > 0
      ? `${totalHours}시간 ${totalMinutes % 60}분`
      : `${totalMinutes}분`

  const stats = [
    { label: '수강 중',     value: String(enrollmentCount ?? 0), icon: BookOpen,   color: 'text-accent',     bg: 'bg-accent-pale', href: '/my/courses' },
    { label: '수료 완료',   value: String(completedCount  ?? 0), icon: TrendingUp, color: 'text-green-600',  bg: 'bg-green-50',    href: '/my/courses' },
    { label: '수료증',      value: String(certCount       ?? 0), icon: Award,      color: 'text-yellow-600', bg: 'bg-yellow-50',   href: '/my/certificates' },
    { label: '누적 학습',   value: totalTimeLabel,                icon: Clock,      color: 'text-blue-600',   bg: 'bg-blue-50',     href: '/my/courses' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* 인사말 */}
      <div>
        <h1 className="text-2xl font-bold text-navy">
          안녕하세요, {profile?.name}님 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">오늘도 학습을 계속해보세요.</p>
      </div>

      {/* 이어보기 — 큰 CTA */}
      {recent?.courses && (
        <ContinueLearningCard
          course={{
            id: recent.courses.id,
            title: recent.courses.title,
            thumbnail_url: recent.courses.thumbnail_url,
            total_duration: recent.courses.total_duration,
            category: recent.courses.categories?.name ?? null,
          }}
          lesson={recent.lessons ? { id: recent.lesson_id, title: recent.lessons.title } : null}
          progressPercent={recentProgressPercent}
        />
      )}

      {/* KPI 카드 (4개) */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${s.bg} shrink-0`}>
              <s.icon className={`h-5 w-5 ${s.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-xl font-bold text-navy leading-tight truncate">{s.value}</p>
              <p className="text-xs text-gray-500 truncate">{s.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* streak + 학습 시간 차트 */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LearningStreakWidget streak={streak} weekDots={weekDots} />
        <LearningTimeChart daily={daily} />
      </div>

      {/* 수강 중인 다른 강좌들 (이어보기 카드와 중복 제외) */}
      {otherActiveCourses.length > 0 && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <h2 className="text-base font-bold text-navy">수강 중인 강좌</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                총 {(enrollmentCount ?? 0).toLocaleString()}개 중 최근 신청 순으로 {otherActiveCourses.length}개 표시
              </p>
            </div>
            <Link
              href="/my/courses"
              className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
            >
              전체보기 <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherActiveCourses.map((e) => {
              const c = e.courses!
              const data: CourseCardV2Data = {
                id: c.id,
                title: c.title,
                thumbnail_url: c.thumbnail_url,
                category: c.categories ? { name: c.categories.name, slug: c.categories.slug } : null,
                instructor: c.instructor ?? null,
                level: (c.level as CourseCardV2Data['level']) ?? null,
                rating_avg: c.rating_avg,
                rating_count: c.rating_count,
                enrolled_count: c.enrolled_count,
                total_duration: c.total_duration,
                price: c.price,
                badge: (c.badge as CourseCardV2Data['badge']) ?? 'none',
                status: c.status,
              }
              return (
                <CourseCardV2
                  key={c.id}
                  course={data}
                  variant="progress"
                  progress={progressMap[c.id] ?? 0}
                />
              )
            })}
          </div>
        </section>
      )}

      {/* 학습 캘린더 히트맵 (12주) */}
      <LearningCalendarHeatmap daily={daily84} />

      {/* 비어있을 때 안내 */}
      {(!enrollmentCount || enrollmentCount === 0) && !recent && (
        <div className="rounded-2xl bg-white p-10 text-center shadow-sm">
          <BookOpen className="mx-auto h-12 w-12 text-gray-300" />
          <h3 className="mt-4 font-semibold text-navy">아직 수강 중인 강좌가 없어요</h3>
          <p className="mt-1 text-sm text-gray-500">지금 바로 강좌를 찾아보세요!</p>
          <Link
            href="/courses"
            className="mt-4 inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
          >
            강좌 둘러보기
          </Link>
        </div>
      )}
    </div>
  )
}
