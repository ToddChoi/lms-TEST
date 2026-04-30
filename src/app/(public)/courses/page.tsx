import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CourseCardV2, type CourseCardV2Data } from '@/components/courses/CourseCardV2'
import { CourseFilter } from '@/components/courses/CourseFilter'
import { CourseFilterSidebar } from '@/components/courses/CourseFilterSidebar'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { BookOpen } from 'lucide-react'
import type { Metadata } from 'next'
import type { Category } from '@/types/database'
import dayjs from '@/lib/dayjs'

export const metadata: Metadata = {
  title: '강좌 목록',
  description: 'AI·실무 역량 강화를 위한 다양한 강좌를 만나보세요.',
}

export const revalidate = 60

const PAGE_SIZE = 12

interface Props {
  searchParams: {
    category?: string
    status?: string
    sort?: string
    view?: string
    page?: string
    q?: string
    level?: string
    price?: string         // '' | 'free' | 'paid'
    rating_gte?: string
    duration?: string      // '' | 'under1h' | '1to3h' | '3to10h' | 'over10h'
  }
}

interface RawCourse {
  id: string
  title: string
  slug: string | null
  description: string | null
  thumbnail_url: string | null
  price: number
  total_duration: number
  status: string
  enroll_start: string | null
  enroll_end: string | null
  is_featured: boolean
  rating_avg: number | null
  rating_count: number | null
  enrolled_count: number | null
  level: string | null
  preview_url: string | null
  price_original: number | null
  badge: string | null
  categories: { id: string; name: string; slug: string } | null
  instructor: { name: string | null; avatar_url: string | null } | null
}

export default async function CoursesPage({ searchParams }: Props) {
  const supabase = createClient()
  const page = Math.max(1, Number(searchParams.page || 1))

  // 카테고리 목록
  const { data: rawCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  const categories = rawCategories as unknown as Category[] | null

  // 강좌 쿼리 빌드
  let query = supabase
    .from('courses')
    .select(`
      id, title, slug, description, thumbnail_url, price,
      total_duration, status, enroll_start, enroll_end, is_featured,
      rating_avg, rating_count, enrolled_count, level, preview_url, price_original, badge,
      categories (id, name, slug),
      instructor:profiles!instructor_id (name, avatar_url)
    `, { count: 'exact' })
    .eq('status', 'active')

  // 검색어
  const q = (searchParams.q ?? '').trim()
  if (q) {
    query = query.ilike('title', `%${q}%`)
  }

  // 카테고리 필터
  if (searchParams.category) {
    const cat = categories?.find((c) => c.slug === searchParams.category)
    if (cat) query = query.eq('category_id', cat.id)
  }

  // 신청 가능 / 마감
  const now = dayjs().format('YYYY-MM-DD')
  if (searchParams.status === 'open') {
    query = query.or(`enroll_end.is.null,enroll_end.gte.${now}`)
    query = query.or(`enroll_start.is.null,enroll_start.lte.${now}`)
  } else if (searchParams.status === 'closed') {
    query = query.lt('enroll_end', now)
  }

  // 난이도 (다중)
  const levels = (searchParams.level ?? '').split(',').filter(Boolean)
  if (levels.length > 0) {
    query = query.in('level', levels)
  }

  // 가격
  if (searchParams.price === 'free') {
    query = query.eq('price', 0)
  } else if (searchParams.price === 'paid') {
    query = query.gt('price', 0)
  }

  // 평점 ≥
  const ratingGte = Number(searchParams.rating_gte)
  if (!isNaN(ratingGte) && ratingGte > 0) {
    query = query.gte('rating_avg', ratingGte)
  }

  // 학습 시간
  switch (searchParams.duration) {
    case 'under1h':
      query = query.lt('total_duration', 3600); break
    case '1to3h':
      query = query.gte('total_duration', 3600).lt('total_duration', 10800); break
    case '3to10h':
      query = query.gte('total_duration', 10800).lt('total_duration', 36000); break
    case 'over10h':
      query = query.gte('total_duration', 36000); break
  }

  // 정렬
  switch (searchParams.sort) {
    case 'popular':
      query = query.order('enrolled_count', { ascending: false })
      break
    case 'rating':
      query = query.order('rating_avg', { ascending: false })
      break
    case 'price_asc':
      query = query.order('price', { ascending: true })
      break
    case 'price_desc':
      query = query.order('price', { ascending: false })
      break
    case 'title':
      query = query.order('title', { ascending: true })
      break
    case 'duration':
      query = query.order('total_duration', { ascending: false })
      break
    case 'newest':
    default:
      query = query.order('created_at', { ascending: false })
  }

  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const { data: rawCourses, count } = await query
  const rows = (rawCourses as unknown as RawCourse[] | null) ?? []

  // CourseCardV2 형태로 매핑
  const courses: CourseCardV2Data[] = rows.map((c) => ({
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
    price_original: c.price_original,
    badge: (c.badge as CourseCardV2Data['badge']) ?? 'none',
    preview_url: c.preview_url,
    status: c.status,
  }))

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">강좌 목록</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI·실무 역량 강화를 위한 다양한 강좌를 만나보세요
        </p>
      </div>

      <Suspense>
        <CourseFilter categories={categories ?? []} totalCount={count ?? 0} />
      </Suspense>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
        {/* 좌측 상세 필터 (데스크탑 전용) */}
        <div className="hidden lg:block">
          <Suspense>
            <CourseFilterSidebar />
          </Suspense>
        </div>

        {/* 결과 영역 */}
        <div>
          {courses.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
                {courses.map((c) => <CourseCardV2 key={c.id} course={c} />)}
              </div>

              <div className="mt-10">
                <Suspense>
                  <Pagination totalCount={count ?? 0} pageSize={PAGE_SIZE} />
                </Suspense>
              </div>
            </>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="조건에 맞는 강좌가 없습니다"
              description="다른 카테고리나 필터를 선택해보세요."
            />
          )}
        </div>
      </div>
    </div>
  )
}
