import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { CourseCardV2, type CourseCardV2Data } from '@/components/courses/CourseCardV2'
import { Award, BookOpen, GraduationCap, User } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', params.id)
    .maybeSingle()
  const name = (data as unknown as { name: string } | null)?.name
  return {
    title: name ? `${name} 학습 프로필` : '학습 프로필',
    description: '수료한 강좌와 학습 이력을 공개 프로필에서 확인하세요.',
  }
}

/**
 * 학습자 공개 프로필 — 비로그인 접근 가능.
 * 표시:
 *  - 이름·가입일·아바타
 *  - 수료 강좌 (CourseCardV2)
 *  - 학습 중 강좌 수 (간략)
 *  - 발급 수료증 수
 */
export default async function PublicProfilePage({ params }: Props) {
  const supabase = createClient()

  // 프로필 (사용자 자체는 인증 없이 노출 가능 — public)
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role, created_at')
    .eq('id', params.id)
    .maybeSingle()
  const profile = rawProfile as unknown as {
    id: string; name: string | null; email: string | null
    avatar_url: string | null; role: string; created_at: string
  } | null
  if (!profile) notFound()

  // 수료 강좌
  const { data: rawCompleted } = await supabase
    .from('enrollments')
    .select(`
      course_id,
      courses (
        id, title, thumbnail_url, total_duration, status, price,
        rating_avg, rating_count, enrolled_count, level, badge,
        categories (name, slug),
        instructor:profiles!instructor_id (name, avatar_url)
      )
    `)
    .eq('user_id', params.id)
    .eq('status', 'completed')
  const completed = (rawCompleted as unknown as {
    course_id: string
    courses: {
      id: string; title: string; thumbnail_url: string | null
      total_duration: number; status: string; price: number
      rating_avg: number | null; rating_count: number | null
      enrolled_count: number | null; level: string | null; badge: string | null
      categories: { name: string; slug: string } | null
      instructor: { name: string | null; avatar_url: string | null } | null
    } | null
  }[] | null) ?? []

  const completedCourses: CourseCardV2Data[] = completed
    .filter((e) => e.courses)
    .map((e) => {
      const c = e.courses!
      return {
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
    })

  // 카운트 (간략 KPI)
  const [{ count: activeCount }, { count: certCount }] = await Promise.all([
    supabase.from('enrollments').select('*', { count: 'exact', head: true })
      .eq('user_id', params.id).eq('status', 'active'),
    supabase.from('certificates').select('*', { count: 'exact', head: true })
      .eq('user_id', params.id),
  ])

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Hero */}
      <section className="rounded-3xl bg-gradient-to-br from-navy to-navy-light p-8 text-white shadow-xl">
        <div className="flex items-start gap-5">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm">
            {profile.avatar_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={profile.avatar_url} alt={profile.name ?? ''} className="h-full w-full rounded-2xl object-cover" />
            ) : (
              <User className="h-10 w-10 text-white/80" />
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold">{profile.name ?? '익명 학습자'}</h1>
            <p className="mt-1 text-sm text-white/70">
              {formatDate(profile.created_at)} 부터 Ingrow LMS 와 함께
            </p>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <KpiPill icon={GraduationCap} label="수료" value={completedCourses.length} />
              <KpiPill icon={BookOpen} label="학습 중" value={activeCount ?? 0} />
              <KpiPill icon={Award} label="수료증" value={certCount ?? 0} />
            </div>
          </div>
        </div>
      </section>

      {/* 수료 강좌 */}
      <section className="mt-10">
        <h2 className="mb-5 flex items-center gap-2 text-xl font-bold text-navy">
          <Award className="h-5 w-5 text-amber-500" /> 수료한 강좌
          <span className="text-sm font-normal text-gray-400">{completedCourses.length}개</span>
        </h2>
        {completedCourses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center">
            <Award className="mx-auto h-10 w-10 text-gray-200" />
            <p className="mt-3 text-sm text-gray-400">아직 수료한 강좌가 없습니다.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {completedCourses.map((c) => (
              <CourseCardV2 key={c.id} course={c} />
            ))}
          </div>
        )}
      </section>

      {/* 푸터 */}
      <div className="mt-12 text-center text-xs text-gray-400">
        <Link href="/" className="hover:text-navy hover:underline">
          Ingrow LMS 둘러보기 →
        </Link>
      </div>
    </div>
  )
}

function KpiPill({
  icon: Icon, label, value,
}: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 backdrop-blur-sm">
      <Icon className="h-3.5 w-3.5" />
      <span className="font-semibold">{value.toLocaleString()}</span>
      <span className="text-white/70">{label}</span>
    </div>
  )
}
