import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Award, TrendingUp } from 'lucide-react'
import { ContinueLearningCard } from '@/components/my/ContinueLearningCard'
import { LearningStreakWidget } from '@/components/my/LearningStreakWidget'
import { LearningTimeChart } from '@/components/my/LearningTimeChart'
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
  const { data: rawRecent } = await supabase
    .from('lesson_progress')
    .select('lesson_id, course_id, last_watched_at, lessons(title), courses(id, title, thumbnail_url, total_duration, categories(name))')
    .eq('user_id', user.id)
    .order('last_watched_at', { ascending: false })
    .limit(1)
  const recent = (rawRecent as unknown as {
    lesson_id: string
    course_id: string
    last_watched_at: string
    lessons: { title: string } | null
    courses: {
      id: string; title: string; thumbnail_url: string | null
      total_duration: number; categories: { name: string } | null
    } | null
  }[] | null)?.[0] ?? null

  // ── 이어보기 카드용 진도 계산 ──
  let recentProgressPercent = 0
  if (recent?.course_id) {
    const [{ count: totalLessons }, { count: doneLessons }] = await Promise.all([
      supabase.from('lessons').select('*', { count: 'exact', head: true })
        .eq('course_id', recent.course_id),
      supabase.from('lesson_progress').select('*', { count: 'exact', head: true })
        .eq('user_id', user.id).eq('course_id', recent.course_id).eq('is_completed', true),
    ])
    if ((totalLessons ?? 0) > 0)
      recentProgressPercent = Math.round(((doneLessons ?? 0) / (totalLessons ?? 1)) * 100)
  }

  // ── 최근 30일 학습 활동 + streak 계산 ──
  // lesson_progress.watched_seconds 는 lesson 누적값이라 "그날 시청 시간" 추출 불가.
  // 대신 "그날 last_watched_at 이 갱신된 강의 수" 를 활동 지표로 사용 (정직한 단순화)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const { data: rawProgressList } = await supabase
    .from('lesson_progress')
    .select('last_watched_at')
    .eq('user_id', user.id)
    .gte('last_watched_at', thirtyDaysAgo.toISOString())
  const progressList = (rawProgressList as unknown as
    { last_watched_at: string }[] | null) ?? []

  const dailyMap: Record<string, number> = {}
  const dateSet = new Set<string>()
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
    dailyMap[isoDate(d)] = 0
  }
  for (const p of progressList) {
    const key = p.last_watched_at.slice(0, 10)
    if (key in dailyMap) dailyMap[key] += 1
    dateSet.add(key)
  }
  const daily = Object.values(dailyMap)

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

  const stats = [
    { label: '수강 중',   value: enrollmentCount ?? 0, icon: BookOpen,   color: 'text-accent',     bg: 'bg-accent-pale', href: '/my/courses' },
    { label: '수료 완료', value: completedCount  ?? 0, icon: TrendingUp, color: 'text-green-600',  bg: 'bg-green-50',    href: '/my/courses' },
    { label: '수료증',    value: certCount       ?? 0, icon: Award,      color: 'text-yellow-600', bg: 'bg-yellow-50',   href: '/my/certificates' },
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

      {/* KPI 카드 */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
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
              <p className="text-xl font-bold text-navy leading-tight">{s.value}</p>
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
