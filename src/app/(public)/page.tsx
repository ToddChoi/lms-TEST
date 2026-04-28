import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BookOpen, Users, Award, ArrowRight, Building2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDuration } from '@/lib/utils'
import type { Metadata } from 'next'

type FeaturedCourse = {
  id: string; title: string; slug: string; thumbnail_url: string | null
  total_duration: number; status: string; enroll_end: string | null
  categories: { name: string; slug: string } | null
}

export const metadata: Metadata = {
  title: 'Ingrow LMS — AI·실무 역량 강화 이러닝 플랫폼',
  description: '기업과 개인을 위한 맞춤형 AI·실무 교육 플랫폼. 최신 강좌로 성장하세요.',
}

export const revalidate = 60

export default async function HomePage() {
  const supabase = createClient()

  // 추천 강좌 가져오기
  const { data: rawFeatured } = await supabase
    .from('courses')
    .select(`id, title, slug, thumbnail_url, total_duration, status, enroll_end, categories (name, slug)`)
    .eq('status', 'active')
    .eq('is_featured', true)
    .order('sort_order')
    .limit(6)
  const featuredCourses = rawFeatured as unknown as FeaturedCourse[] | null

  // 통계
  const [{ count: userCount }, { count: courseCount }, { count: certCount }] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('certificates').select('*', { count: 'exact', head: true }),
    ])

  const stats = [
    { label: '수강생', value: `${((userCount ?? 0) / 1000).toFixed(1)}K+`, icon: Users },
    { label: '강좌', value: `${courseCount ?? 0}+`, icon: BookOpen },
    { label: '수료증 발급', value: `${certCount ?? 0}+`, icon: Award },
  ]

  const b2bBenefits = [
    '기업 맞춤형 강좌 커리큘럼 제공',
    '임직원 학습 현황 실시간 대시보드',
    '수료증 및 이수 현황 일괄 관리',
    '기업 전용 포털 및 브랜딩 지원',
  ]

  return (
    <div className="flex flex-col">
      {/* 히어로 섹션 */}
      <section className="bg-gradient-to-br from-navy to-navy-light py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm">
              <span className="h-2 w-2 rounded-full bg-accent-light"></span>
              AI·실무 역량 강화 플랫폼
            </div>
            <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl">
              성장하는 사람들의
              <br />
              <span className="text-accent-light">이러닝 플랫폼</span>
            </h1>
            <p className="mt-6 text-lg text-gray-300">
              AI 활용부터 실무 역량까지. 체계적인 커리큘럼으로
              <br className="hidden sm:block" />
              당신의 커리어를 한 단계 높이세요.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/courses">
                <Button size="lg" variant="primary" className="w-full sm:w-auto bg-accent hover:bg-accent-light">
                  강좌 둘러보기 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/b2b">
                <Button size="lg" variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto">
                  기업 도입 문의
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 통계 */}
      <section className="border-b border-gray-100 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-3 gap-8 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold text-navy">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 추천 강좌 */}
      {featuredCourses && featuredCourses.length > 0 && (
        <section className="bg-silver py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-navy">추천 강좌</h2>
                <p className="mt-1 text-sm text-gray-500">지금 인기 있는 강좌를 만나보세요</p>
              </div>
              <Link
                href="/courses"
                className="flex items-center gap-1 text-sm font-medium text-accent hover:underline"
              >
                전체보기 <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {featuredCourses.map((course) => {
                const category = course.categories as { name: string; slug: string } | null
                return (
                  <Link
                    key={course.id}
                    href={`/courses/${course.id}`}
                    className="group flex flex-col rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md"
                  >
                    {/* 썸네일 */}
                    <div className="flex h-40 items-center justify-center rounded-t-2xl bg-gradient-to-br from-accent-pale to-accent/10">
                      <BookOpen className="h-12 w-12 text-accent/40" />
                    </div>

                    <div className="flex flex-1 flex-col p-4">
                      {category && (
                        <span className="text-xs font-medium text-accent">
                          {category.name}
                        </span>
                      )}
                      <h3 className="mt-1 font-semibold text-navy line-clamp-2 group-hover:text-accent">
                        {course.title}
              </h3>
                      <div className="mt-auto flex items-center justify-between pt-3">
                        <StatusBadge
                          status={course.status as 'active' | 'closed' | 'draft'}
                        />
                        {course.total_duration > 0 && (
                          <span className="text-xs text-gray-400">
                            {formatDuration(course.total_duration)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* B2B CTA */}
      <section className="bg-navy py-16 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-start lg:gap-16">
            <div className="flex-1">
              <div className="mb-3 flex items-center gap-2 text-accent-light">
                <Building2 className="h-5 w-5" />
                <span className="text-sm font-medium">B2B 기업 도입</span>
              </div>
              <h2 className="text-3xl font-bold leading-snug">
                임직원 교육,
                <br />
                이제 Ingrow LMS로 한 번에
              </h2>
              <p className="mt-4 text-gray-300">
                기업 맞춤형 커리큘럼부터 학습 현황 관리까지.
                <br />
                AI 시대에 필요한 실무 역량을 체계적으로 키워드립니다.
              </p>
              <Link href="/b2b" className="mt-6 inline-block">
                <Button variant="primary" className="bg-accent hover:bg-accent-light">
                  기업 도입 상담 신청 <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="flex-1">
              <ul className="flex flex-col gap-3">
                {b2bBenefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-accent-light" />
                    <span className="text-gray-200">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
