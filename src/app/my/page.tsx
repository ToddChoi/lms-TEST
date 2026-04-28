import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Award, Clock, TrendingUp } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '마이페이지',
}

export default async function MyPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as { name: string } | null

  // 수강 중인 강좌 수
  const { count: enrollmentCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'active')

  // 수료 완료 강좌 수
  const { count: completedCount } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')

  // 수료증 수
  const { count: certCount } = await supabase
    .from('certificates')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // 최근 수강 강좌 (학습 진도 기준)
  const { data: rawRecentProgress } = await supabase
    .from('lesson_progress')
    .select(`
      last_watched_at,
      course_id,
      courses (id, title, thumbnail_url, slug)
    `)
    .eq('user_id', user.id)
    .order('last_watched_at', { ascending: false })
    .limit(3)
  const recentProgress = rawRecentProgress as unknown as any[] | null

  const stats = [
    {
      label: '수강 중',
      value: enrollmentCount ?? 0,
      icon: BookOpen,
      color: 'text-accent',
      bg: 'bg-accent-pale',
      href: '/my/courses',
    },
    {
      label: '수료 완료',
      value: completedCount ?? 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bg: 'bg-green-50',
      href: '/my/courses',
    },
    {
      label: '수료증',
      value: certCount ?? 0,
      icon: Award,
      color: 'text-yellow-600',
      bg: 'bg-yellow-50',
      href: '/my/certificates',
    },
  ]

  return (
    <div className="flex flex-col gap-8">
      {/* 인사말 */}
      <div>
        <h1 className="text-2xl font-bold text-navy">
          안녕하세요, {profile?.name}님 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          오늘도 학습을 계속해보세요.
        </p>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${stat.bg}`}>
              <stat.icon className={`h-6 w-6 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-navy">{stat.value}</p>
              <p className="text-sm text-gray-500">{stat.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* 최근 학습 */}
      {recentProgress && recentProgress.length > 0 && (
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-bold text-navy">
              <Clock className="h-4 w-4" /> 최근 학습
            </h2>
            <Link href="/my/courses" className="text-sm text-accent hover:underline">
              전체보기
            </Link>
          </div>
          <div className="flex flex-col gap-3">
            {recentProgress.map((item) => {
              const course = item.courses as { id: string; title: string; slug: string } | null
              if (!course) return null
              return (
                <Link
                  key={item.course_id}
                  href={`/my/courses/${course.id}/learn`}
                  className="flex items-center gap-3 rounded-xl p-3 hover:bg-silver"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-pale">
                    <BookOpen className="h-5 w-5 text-accent" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy">
                      {course.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDate(item.last_watched_at)}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 강좌가 없을 때 */}
      {(!enrollmentCount || enrollmentCount === 0) && (
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
