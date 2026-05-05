/**
 * SurfaceBlocks — 한 표면(surface)의 content_blocks 을 한 번에 fetch + 렌더.
 *
 * 사용:
 *   <SurfaceBlocks surface="b2b" />
 *   <SurfaceBlocks surface="home" />
 *   <SurfaceBlocks surface={`company/${companyId}/home`} />  // P3
 *
 * 데이터 흐름:
 *   1. content_blocks 에서 surface 일치 + 시간 윈도 안에 있는 published row 조회
 *   2. 각 블록의 block_type 별 dependency (강좌/카테고리/배너 등) 일괄 prefetch
 *   3. REGISTRY 에서 컴포넌트 매핑해 렌더
 *
 * 서버 컴포넌트 — 클라이언트 번들 영향 없음.
 */
import { createClient } from '@/lib/supabase/server'
import { REGISTRY, isKnownBlockType } from './registry'

interface Props {
  surface: string
  /** P3 — multi-tenant 시점에 host 미들웨어가 주입 */
  companyId?: string
}

interface BlockRow {
  id: string
  block_type: string
  config: Record<string, unknown>
  audience: Record<string, unknown>
  sort_order: number
  scope_type: 'global' | 'company'
  company_id: string | null
}

export async function SurfaceBlocks({ surface, companyId }: Props) {
  const supabase = createClient()

  // P2 스코프: scope_type='global' 만 선택. P3 에서 company override 추가.
  const { data: rawBlocks } = await supabase
    .from('content_blocks')
    .select('id, block_type, config, audience, sort_order, scope_type, company_id')
    .eq('surface', surface)
    .eq('status', 'published')
    .eq('scope_type', 'global')
    .order('sort_order')
  const blocks = (rawBlocks as unknown as BlockRow[] | null) ?? []
  if (blocks.length === 0) return null

  // ── 의존 데이터 prefetch ─────────────────────────
  // 같은 컴포넌트 타입이 여러 블록에 걸쳐 있어도 N+1 방지 위해 한 번에.
  const courseIdsToFetch = new Set<string>()
  const needCategories   = blocks.some((b) => b.block_type === 'categories')
  const bannerSurfaces   = blocks.filter((b) => b.block_type === 'banner').map((b) => b.id)

  for (const b of blocks) {
    if (b.block_type === 'featured_courses' || b.block_type === 'company_collection') {
      const cfg = b.config as { course_ids?: string[] }
      ;(cfg.course_ids ?? []).forEach((id) => courseIdsToFetch.add(id))
    }
  }

  const [coursesData, categoriesData] = await Promise.all([
    courseIdsToFetch.size > 0
      ? supabase
          .from('courses')
          .select('id, title, slug, thumbnail_url, price, price_original, rating_avg, rating_count, enrolled_count, badge, level, instructor_name, categories(name)')
          .in('id', [...courseIdsToFetch])
      : Promise.resolve({ data: null }),
    needCategories
      ? supabase
          .from('categories')
          .select('id, slug, name, description, icon, color')
          .eq('is_visible', true)
          .order('sort_order')
      : Promise.resolve({ data: null }),
  ])

  type CourseRow = {
    id: string; title: string; slug: string; thumbnail_url: string | null
    price: number; price_original: number | null
    rating_avg: number; rating_count: number; enrolled_count: number
    badge: string; level: string; instructor_name: string | null
    categories: { name: string } | null
  }
  const courseMap = new Map(
    ((coursesData.data as unknown as CourseRow[] | null) ?? []).map((c) => [c.id, c])
  )
  const allCategories = (categoriesData.data as unknown as Array<{
    id: string; slug: string; name: string; description: string | null
    icon: string | null; color: string | null
  }> | null) ?? []

  // banners 는 P2 에선 home_sections legacy 와 분리 — content_blocks.config.layout 만 적용.
  // 실제 banner 콘텐츠는 P3 에서 banners 테이블의 scope/company_id 활용해 조회.
  void bannerSurfaces

  // ── 렌더 ────────────────────────────────────────
  return (
    <>
      {blocks.map((b) => {
        if (!isKnownBlockType(b.block_type)) {
          // 등록 안 된 block_type — DB 에는 있지만 프론트에 컴포넌트 없음. 무시.
          return null
        }
        // 컴포넌트마다 추가 prop (courses/categories) 가 다르므로 union 타입을 좁히지 않고
        // any 캐스트 — 각 블록 컴포넌트 자체는 타입 안전 (BlockProps + InjectedProps).
        const Component = REGISTRY[b.block_type] as unknown as React.ComponentType<Record<string, unknown>>
        const context = { companyId }

        if (b.block_type === 'featured_courses' || b.block_type === 'company_collection') {
          const cfg = b.config as { course_ids?: string[] }
          const courses = (cfg.course_ids ?? [])
            .map((id) => courseMap.get(id))
            .filter((c): c is CourseRow => !!c)
            .map((c) => ({
              id: c.id, title: c.title, slug: c.slug,
              thumbnail_url: c.thumbnail_url, price: c.price,
              price_original: c.price_original,
              rating_avg: c.rating_avg, rating_count: c.rating_count,
              enrolled_count: c.enrolled_count,
              badge: c.badge, level: c.level,
              instructor_name: c.instructor_name,
              category: c.categories,
            }))
          return <Component key={b.id} config={b.config} context={context} courses={courses} />
        }

        if (b.block_type === 'categories') {
          return <Component key={b.id} config={b.config} context={context} categories={allCategories} />
        }

        return <Component key={b.id} config={b.config} context={context} />
      })}
    </>
  )
}
