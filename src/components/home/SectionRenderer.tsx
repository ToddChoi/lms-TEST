import Link from 'next/link'
import { ArrowRight, Users, BookOpen, Award, Building2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CourseThumb } from '@/components/courses/CourseThumb'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { formatDuration } from '@/lib/utils'

// ──────────────────────────────────────────
// 타입 정의
// ──────────────────────────────────────────
export interface HomeSectionData {
  id: string
  type: string
  label: string
  title: string | null
  subtitle: string | null
  is_visible: boolean
  config: Record<string, unknown>
}

export interface BannerData {
  id: string
  section_id: string
  title: string
  image_url: string | null
  link_url: string | null
  link_target: string
  sort_order: number
  is_visible: boolean
}

export interface FeaturedCourseData {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  total_duration: number
  status: string
  categories: { name: string; slug: string } | null
}

export interface CategoryData {
  id: string
  name: string
  slug: string
  icon: string | null
  is_visible: boolean
}

export interface StatsData {
  userCount: number
  courseCount: number
  certCount: number
}

interface Props {
  section: HomeSectionData
  banners?: BannerData[]
  featuredCourses?: FeaturedCourseData[]
  categories?: CategoryData[]
  stats?: StatsData
}

// ──────────────────────────────────────────
// SectionRenderer — 타입별 분기
// ──────────────────────────────────────────
export default function SectionRenderer({ section, banners = [], featuredCourses = [], categories = [], stats }: Props) {
  if (!section.is_visible) return null

  switch (section.type) {
    case 'hero':             return <HeroSection config={section.config} />
    case 'banner':           return <BannerSection config={section.config} banners={banners} />
    case 'featured_courses': return <FeaturedCoursesSection config={section.config} courses={featuredCourses} />
    case 'categories':       return <CategoriesSection config={section.config} categories={categories} />
    case 'stats':            return <StatsSection config={section.config} stats={stats} />
    case 'custom_html':      return <CustomHtmlSection config={section.config} />
    default:                 return null
  }
}

// ──────────────────────────────────────────
// Hero
// ──────────────────────────────────────────
function HeroSection({ config }: { config: Record<string, unknown> }) {
  const heading           = str(config.heading) || '성장하는 사람들의 이러닝 플랫폼'
  const subheading        = str(config.subheading)
  const ctaLabel          = str(config.cta_label) || '강좌 둘러보기'
  const ctaUrl            = str(config.cta_url) || '/courses'
  const ctaSecLabel       = str(config.cta_secondary_label)
  const ctaSecUrl         = str(config.cta_secondary_url) || '/b2b'
  const bgImage           = str(config.background_image_url)

  return (
    <section
      className="bg-gradient-to-br from-navy to-navy-light py-20 text-white"
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl whitespace-pre-line">
            {heading}
          </h1>
          {subheading && (
            <p className="mt-6 text-lg text-gray-300 whitespace-pre-line">{subheading}</p>
          )}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link href={ctaUrl}>
              <Button size="lg" variant="primary" className="w-full sm:w-auto bg-accent hover:bg-accent-light">
                {ctaLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            {ctaSecLabel && (
              <Link href={ctaSecUrl}>
                <Button size="lg" variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 sm:w-auto">
                  {ctaSecLabel}
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

// ──────────────────────────────────────────
// Banner Slider (클라이언트 슬라이더는 별도 컴포넌트로 분리 가능)
// 현재는 첫 배너를 전체 폭 이미지로 표시하고 나머지는 하단에 도트 표시
// ──────────────────────────────────────────
function BannerSection({ banners }: { config: Record<string, unknown>; banners: BannerData[] }) {
  if (banners.length === 0) return null

  const banner = banners[0]
  return (
    <section className="w-full">
      {banner.link_url ? (
        <a href={banner.link_url} target={banner.link_target} rel="noopener noreferrer" className="block">
          {banner.image_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={banner.image_url} alt={banner.title} className="w-full max-h-[480px] object-cover" />
          ) : (
            <div className="w-full h-48 bg-gradient-to-r from-accent-pale to-accent/20 flex items-center justify-center">
              <p className="text-navy font-semibold">{banner.title}</p>
            </div>
          )}
        </a>
      ) : banner.image_url ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={banner.image_url} alt={banner.title} className="w-full max-h-[480px] object-cover" />
      ) : null}
    </section>
  )
}

// ──────────────────────────────────────────
// Featured Courses
// ──────────────────────────────────────────
function FeaturedCoursesSection({ config, courses }: { config: Record<string, unknown>; courses: FeaturedCourseData[] }) {
  if (courses.length === 0) return null
  const title    = str(config.title)    || '추천 강좌'
  const subtitle = str(config.subtitle)

  return (
    <section className="bg-silver py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-navy">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
          </div>
          <Link href="/courses" className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
            전체보기 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const category = course.categories as { name: string; slug: string } | null
            return (
              <Link key={course.id} href={`/courses/${course.id}`}
                className="group flex flex-col rounded-2xl bg-white shadow-sm transition-shadow hover:shadow-md">
                <div className="relative h-40 overflow-hidden rounded-t-2xl bg-gradient-to-br from-accent-pale to-accent/10">
                  <CourseThumb src={course.thumbnail_url} alt={course.title} />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  {category && <span className="text-xs font-medium text-accent">{category.name}</span>}
                  <h3 className="mt-1 font-semibold text-navy line-clamp-2 group-hover:text-accent">{course.title}</h3>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <StatusBadge status={course.status as 'active' | 'closed' | 'draft'} />
                    {course.total_duration > 0 && (
                      <span className="text-xs text-gray-400">{formatDuration(course.total_duration)}</span>
                    )}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

// ──────────────────────────────────────────
// Categories
// ──────────────────────────────────────────
function CategoriesSection({ config, categories }: { config: Record<string, unknown>; categories: CategoryData[] }) {
  if (categories.length === 0) return null
  const title = str(config.title) || '카테고리'

  return (
    <section className="bg-white py-14">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-navy mb-8">{title}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {categories.map((cat) => (
            <Link key={cat.id} href={`/courses?category=${cat.slug}`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-silver p-5 text-center hover:border-accent hover:bg-accent-pale transition">
              {cat.icon && <span className="text-3xl">{cat.icon}</span>}
              <span className="text-sm font-medium text-navy">{cat.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

// ──────────────────────────────────────────
// Stats
// ──────────────────────────────────────────
function StatsSection({ config, stats }: { config: Record<string, unknown>; stats?: StatsData }) {
  const showStudents  = config.show_students  !== false
  const showCourses   = config.show_courses   !== false
  const showCompanies = config.show_companies !== false

  const studentVal  = config.manual_students  != null ? Number(config.manual_students)  : (stats?.userCount   ?? 0)
  const courseVal   = config.manual_courses   != null ? Number(config.manual_courses)   : (stats?.courseCount ?? 0)
  const companyVal  = config.manual_companies != null ? Number(config.manual_companies) : 0

  const items = [
    showStudents  && { label: '수강생',    value: `${(studentVal / 1000).toFixed(1)}K+`, icon: Users },
    showCourses   && { label: '강좌',      value: `${courseVal}+`,                        icon: BookOpen },
    showCompanies && { label: '파트너 기업', value: `${companyVal}+`,                      icon: Award },
  ].filter(Boolean) as { label: string; value: string; icon: React.ComponentType<{ className?: string }> }[]

  if (items.length === 0) return null

  return (
    <section className="border-b border-gray-100 bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`grid gap-8 text-center grid-cols-${items.length}`}>
          {items.map((stat) => (
            <div key={stat.label}>
              <p className="text-3xl font-bold text-navy">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-500">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ──────────────────────────────────────────
// Custom HTML
// ──────────────────────────────────────────
function CustomHtmlSection({ config }: { config: Record<string, unknown> }) {
  const html = str(config.html)
  if (!html) return null
  // 간단 XSS 방지: script 태그 제거
  const safeHtml = html.replace(/<script[\s\S]*?<\/script>/gi, '')
  return (
    <section className="py-8">
      <div
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
    </section>
  )
}

// ──────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────
function str(v: unknown): string { return v != null ? String(v) : '' }
