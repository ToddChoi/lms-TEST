import { createClient } from '@/lib/supabase/server'
import SectionRenderer, {
  type HomeSectionData,
  type BannerData,
  type FeaturedCourseData,
  type CategoryData,
  type StatsData,
} from '@/components/home/SectionRenderer'
import { SurfaceBlocks } from '@/components/blocks/SurfaceBlocks'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ingrow LMS — AI·실무 역량 강화 이러닝 플랫폼',
  description: '기업과 개인을 위한 맞춤형 AI·실무 교육 플랫폼. 최신 강좌로 성장하세요.',
}

export const revalidate = 60

export default async function HomePage() {
  const supabase = createClient()

  // ── 1. 홈 섹션 목록 ──────────────────────────────────────
  const { data: rawSections } = await supabase
    .from('home_sections')
    .select('id, type, label, title, subtitle, is_visible, config')
    .eq('is_visible', true)
    .order('sort_order')
  const sections = (rawSections as unknown as HomeSectionData[] | null) ?? []

  // ── 2. banner 섹션 → 배너 일괄 조회 ──────────────────────
  const bannerSectionIds = sections.filter((s) => s.type === 'banner').map((s) => s.id)
  let allBanners: BannerData[] = []

  if (bannerSectionIds.length > 0) {
    const now = new Date().toISOString()
    const { data: rawBanners } = await supabase
      .from('banners')
      .select('id, section_id, title, image_url, link_url, link_target, sort_order, is_visible')
      .in('section_id', bannerSectionIds)
      .eq('is_visible', true)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order('sort_order')
    allBanners = (rawBanners as unknown as BannerData[] | null) ?? []
  }

  const bannersBySectionId = allBanners.reduce<Record<string, BannerData[]>>((acc, b) => {
    acc[b.section_id] = [...(acc[b.section_id] ?? []), b]
    return acc
  }, {})

  // ── 3. 추천 강좌 ─────────────────────────────────────────
  const featuredSection = sections.find((s) => s.type === 'featured_courses')
  const featuredLimit   = Number((featuredSection?.config as any)?.limit ?? 6)
  const featuredFilter  = String((featuredSection?.config as any)?.filter ?? 'is_featured')

  let featuredCourses: FeaturedCourseData[] = []
  if (featuredSection) {
    let query = supabase
      .from('courses')
      .select(`
        id, title, slug, thumbnail_url, total_duration, status, price,
        rating_avg, rating_count, enrolled_count, level, preview_url, price_original, badge,
        categories (name, slug),
        instructor:profiles!instructor_id (name, avatar_url)
      `)
      .eq('status', 'active')
      .order('sort_order')
      .limit(featuredLimit)

    if (featuredFilter === 'is_featured') {
      query = query.eq('is_featured', true) as typeof query
    }

    const { data: rawFeatured } = await query
    featuredCourses = (rawFeatured as unknown as FeaturedCourseData[] | null) ?? []
  }

  // ── 4. 카테고리 ──────────────────────────────────────────
  const categoriesSection = sections.find((s) => s.type === 'categories')
  const catLimit = Number((categoriesSection?.config as any)?.limit ?? 8)

  let categories: CategoryData[] = []
  if (categoriesSection) {
    const { data: rawCats } = await supabase
      .from('categories')
      .select('id, name, slug, icon, is_visible')
      .eq('is_visible', true)
      .order('sort_order')
      .limit(catLimit)
    categories = (rawCats as unknown as CategoryData[] | null) ?? []
  }

  // ── 5. 통계 ──────────────────────────────────────────────
  const statsSection = sections.find((s) => s.type === 'stats')
  let stats: StatsData | undefined

  if (statsSection) {
    const [{ count: userCount }, { count: courseCount }, { count: certCount }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('courses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('certificates').select('*', { count: 'exact', head: true }),
    ])
    stats = { userCount: userCount ?? 0, courseCount: courseCount ?? 0, certCount: certCount ?? 0 }
  }

  // ── 6. 렌더링 ────────────────────────────────────────────
  // 빌더 결과(content_blocks)를 위에, 기존 home_sections 결과를 아래에.
  // "홈 빌더" 에서 추가한 블록은 즉시 홈 상단에 노출됨 — 비어 있으면 무영향.
  // 점진 마이그레이션: 운영팀이 home_sections 의 섹션을 빌더 블록으로 옮기면
  // 자연스럽게 home_sections 가 비어 가고, 결국 SectionRenderer 제거 가능.
  return (
    <div className="flex flex-col">
      <SurfaceBlocks surface="home" />

      {sections.map((section) => (
        <SectionRenderer
          key={section.id}
          section={section}
          banners={bannersBySectionId[section.id] ?? []}
          featuredCourses={section.type === 'featured_courses' ? featuredCourses : []}
          categories={section.type === 'categories' ? categories : []}
          stats={section.type === 'stats' ? stats : undefined}
        />
      ))}
    </div>
  )
}
