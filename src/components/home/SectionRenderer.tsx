import Link from 'next/link'
import { ArrowRight, Users, BookOpen, Award } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { CourseCardV2, type CourseCardV2Data } from '@/components/courses/CourseCardV2'
import BannerSlider from './BannerSlider'

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
  slug: string | null
  thumbnail_url: string | null
  total_duration: number
  status: string
  price?: number
  price_original?: number | null
  rating_avg?: number | null
  rating_count?: number | null
  enrolled_count?: number | null
  level?: string | null
  badge?: string | null
  preview_url?: string | null
  categories: { name: string; slug: string } | null
  instructor?: { name: string | null; avatar_url?: string | null } | null
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
function BannerSection({ config, banners }: { config: Record<string, unknown>; banners: BannerData[] }) {
  if (banners.length === 0) return null
  const autoplay   = config.autoplay     !== false
  const interval   = Number(config.interval ?? 5000)
  const showArrows = config.show_arrows  !== false
  const showDots   = config.show_dots    !== false

  return (
    <BannerSlider
      banners={banners}
      autoplay={autoplay}
      interval={interval}
      showArrows={showArrows}
      showDots={showDots}
    />
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
            const data: CourseCardV2Data = {
              id: course.id,
              title: course.title,
              thumbnail_url: course.thumbnail_url,
              category: course.categories ? { name: course.categories.name, slug: course.categories.slug } : null,
              instructor: course.instructor ?? null,
              level: (course.level as CourseCardV2Data['level']) ?? null,
              rating_avg: course.rating_avg ?? null,
              rating_count: course.rating_count ?? null,
              enrolled_count: course.enrolled_count ?? null,
              total_duration: course.total_duration,
              price: course.price,
              price_original: course.price_original ?? null,
              badge: (course.badge as CourseCardV2Data['badge']) ?? 'none',
              preview_url: course.preview_url ?? null,
              status: course.status,
            }
            return <CourseCardV2 key={course.id} course={data} />
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
