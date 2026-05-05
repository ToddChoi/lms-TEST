import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CourseCardV2 } from '@/components/courses/CourseCardV2'
import type { BlockProps } from './registry'

export interface FeaturedCoursesConfig {
  heading?: string
  subheading?: string
  course_ids?: string[]      // 명시 선택. 비어 있으면 is_featured=true 자동
  limit?: number              // 기본 8
  cta_url?: string            // '전체 보기' 링크
}

/**
 * 추천 강좌 — content_blocks 신버전.
 * 데이터 fetch 는 server component (caller) 가 담당해서 props 로 주입하는 게 정석이지만,
 * 당분간은 ids 만 받고 caller (SurfaceBlocks) 가 일괄 fetch 후 주입하도록 분리.
 *
 * P2 스코프: heading/CTA 등 카피만 운영자가 편집. course_ids 는 admin UI 에서 picker.
 */
interface InjectedProps {
  /** SurfaceBlocks 가 주입 — 실제 강좌 row 들 */
  courses?: Array<{
    id: string
    title: string
    slug: string
    thumbnail_url: string | null
    price: number
    price_original?: number | null
    rating_avg?: number
    rating_count?: number
    enrolled_count?: number
    badge?: string
    level?: string
    instructor_name?: string | null
    category?: { name: string } | null
  }>
}

export function FeaturedCoursesBlock(
  { config, courses = [] }: BlockProps<FeaturedCoursesConfig> & InjectedProps,
) {
  if (courses.length === 0) {
    // 운영자가 course_ids 만 정해 두고 fetch 결과 0 — 빈 섹션은 그리지 않음
    return null
  }

  return (
    <section className="bg-surface py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(config.heading || config.subheading) && (
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              {config.heading && (
                <h2 className="text-h3 text-navy">{config.heading}</h2>
              )}
              {config.subheading && (
                <p className="mt-1 text-body-sm text-gray-500">{config.subheading}</p>
              )}
            </div>
            {config.cta_url && (
              <Link
                href={config.cta_url}
                className="flex items-center gap-1 text-body-sm font-semibold text-accent hover:underline"
              >
                전체 보기 <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {courses.map((c) => (
            <CourseCardV2
              key={c.id}
              course={{
                id: c.id,
                title: c.title,
                thumbnail_url: c.thumbnail_url,
                category: c.category,
                instructor: c.instructor_name ? { name: c.instructor_name } : null,
                level: (c.level as never) ?? null,
                rating_avg: c.rating_avg,
                rating_count: c.rating_count,
                enrolled_count: c.enrolled_count,
                price: c.price,
                price_original: c.price_original,
                badge: (c.badge as never) ?? null,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
