import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { CourseCard } from '@/components/courses/CourseCard'
import { CourseFilter } from '@/components/courses/CourseFilter'
import { Pagination } from '@/components/ui/Pagination'
import { BookOpen } from 'lucide-react'
import type { Metadata } from 'next'
import type { Category, CourseWithCategory } from '@/types/database'
import dayjs from 'dayjs'

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
  }
}

export default async function CoursesPage({ searchParams }: Props) {
  const supabase = createClient()
  const page = Math.max(1, Number(searchParams.page || 1))
  const view = searchParams.view === 'list' ? 'list' : 'grid'

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
      categories (id, name, slug),
      instructor:profiles!instructor_id (name)
    `, { count: 'exact' })
    .eq('status', 'active')

  // 카테고리 필터
  if (searchParams.category) {
    const cat = categories?.find((c) => c.slug === searchParams.category)
    if (cat) query = query.eq('category_id', cat.id)
  }

  // 상태 필터 (신청 가능 / 마감)
  const now = dayjs().format('YYYY-MM-DD')
  if (searchParams.status === 'open') {
    query = query.or(`enroll_end.is.null,enroll_end.gte.${now}`)
    query = query.or(`enroll_start.is.null,enroll_start.lte.${now}`)
  } else if (searchParams.status === 'closed') {
    query = query.lt('enroll_end', now)
  }

  // 정렬
  if (searchParams.sort === 'title') {
    query = query.order('title', { ascending: true })
  } else if (searchParams.sort === 'duration') {
    query = query.order('total_duration', { ascending: false })
  } else {
    query = query.order('created_at', { ascending: false })
  }

  // 페이지네이션
  const from = (page - 1) * PAGE_SIZE
  query = query.range(from, from + PAGE_SIZE - 1)

  const { data: rawCourses, count } = await query
  const courses = rawCourses as unknown as (CourseWithCategory & { instructor?: { name: string } | null })[] | null

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">강좌 목록</h1>
        <p className="mt-1 text-sm text-gray-500">
          AI·실무 역량 강화를 위한 다양한 강좌를 만나보세요
        </p>
      </div>

      <Suspense>
        <CourseFilter
          categories={categories ?? []}
          totalCount={count ?? 0}
        />
      </Suspense>

      <div className="mt-6">
        {courses && courses.length > 0 ? (
          <>
            <div className={
              view === 'list'
                ? 'flex flex-col gap-3'
                : 'grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
            }>
              {courses.map((course) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  view={view}
                />
              ))}
            </div>

            <div className="mt-10">
              <Suspense>
                <Pagination totalCount={count ?? 0} pageSize={PAGE_SIZE} />
              </Suspense>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 text-center shadow-sm">
            <BookOpen className="h-12 w-12 text-gray-200" />
            <p className="mt-4 font-medium text-gray-400">조건에 맞는 강좌가 없습니다</p>
            <p className="mt-1 text-sm text-gray-300">다른 카테고리나 필터를 선택해보세요</p>
          </div>
        )}
      </div>
    </div>
  )
}
