import { createClient } from '@/lib/supabase/server'
import { CourseCardV2, type CourseCardV2Data } from './CourseCardV2'

interface Props {
  /** 기준이 되는 강좌 ID — 본인은 결과에서 제외 */
  courseId: string
  /** 선택: 같은 카테고리 우선 매칭에 사용 */
  categoryId?: string | null
  /** 선택: 같은 난이도 우선 매칭에 사용 */
  level?: string | null
  /** 결과 갯수 */
  limit?: number
}

interface RawRow {
  id: string
  title: string
  thumbnail_url: string | null
  total_duration: number
  status: string
  price: number
  rating_avg: number | null
  rating_count: number | null
  enrolled_count: number | null
  level: string | null
  preview_url: string | null
  price_original: number | null
  badge: string | null
  categories: { name: string; slug: string } | null
  instructor: { name: string | null; avatar_url: string | null } | null
}

/**
 * AI 임베딩 없이 동작하는 "비슷한 강좌" 섹션.
 *
 * 매칭 우선순위:
 *  1) 같은 카테고리 + 같은 난이도
 *  2) 같은 카테고리 (난이도 무관)
 *  3) 인기순 (enrolled_count) 으로 채우기
 *
 * 강좌 데이터가 충분히 쌓이고 진짜 개인화가 필요해지면
 * pgvector + Voyage 임베딩 (AI 추천 Phase 1+) 으로 업그레이드 가능.
 */
export async function SimilarCoursesSection({
  courseId, categoryId, level, limit = 4,
}: Props) {
  const supabase = createClient()

  const select = `
    id, title, thumbnail_url, total_duration, status, price,
    rating_avg, rating_count, enrolled_count, level, preview_url, price_original, badge,
    categories (name, slug),
    instructor:profiles!instructor_id (name, avatar_url)
  `

  // 1) 같은 카테고리 + 같은 난이도
  let primary: RawRow[] = []
  if (categoryId && level) {
    const { data } = await supabase
      .from('courses')
      .select(select)
      .eq('status', 'active')
      .eq('category_id', categoryId)
      .eq('level', level)
      .neq('id', courseId)
      .order('enrolled_count', { ascending: false })
      .limit(limit)
    primary = (data as unknown as RawRow[] | null) ?? []
  }

  // 2) 같은 카테고리만 (난이도 무관) — 부족분 보충
  const collected = new Map<string, RawRow>()
  primary.forEach((r) => collected.set(r.id, r))

  if (collected.size < limit && categoryId) {
    const remaining = limit - collected.size
    const exclude = [courseId, ...Array.from(collected.keys())]
    const { data } = await supabase
      .from('courses')
      .select(select)
      .eq('status', 'active')
      .eq('category_id', categoryId)
      .not('id', 'in', `(${exclude.map((id) => `"${id}"`).join(',')})`)
      .order('enrolled_count', { ascending: false })
      .limit(remaining)
    ;((data as unknown as RawRow[] | null) ?? []).forEach((r) => collected.set(r.id, r))
  }

  // 3) 카테고리 무관, 인기순으로 마지막 보충
  if (collected.size < limit) {
    const remaining = limit - collected.size
    const exclude = [courseId, ...Array.from(collected.keys())]
    const { data } = await supabase
      .from('courses')
      .select(select)
      .eq('status', 'active')
      .not('id', 'in', `(${exclude.map((id) => `"${id}"`).join(',')})`)
      .order('enrolled_count', { ascending: false })
      .order('rating_avg', { ascending: false })
      .limit(remaining)
    ;((data as unknown as RawRow[] | null) ?? []).forEach((r) => collected.set(r.id, r))
  }

  const items = Array.from(collected.values())
  if (items.length === 0) return null

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-navy">이 강좌와 비슷한 강좌</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((c) => {
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
            price_original: c.price_original,
            badge: (c.badge as CourseCardV2Data['badge']) ?? 'none',
            preview_url: c.preview_url,
            status: c.status,
          }
          return <CourseCardV2 key={c.id} course={data} />
        })}
      </div>
    </section>
  )
}
