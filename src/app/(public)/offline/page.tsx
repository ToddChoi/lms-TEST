import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Briefcase } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { OfflineProgramCard, type OfflineProgramCardData } from '@/components/offline/OfflineProgramCard'
import {
  OFFLINE_PROGRAM_TYPE_LABEL,
  type OfflineProgramType,
} from '@/types/database'
import type { Metadata } from 'next'
import type { Category } from '@/types/database'

export const metadata: Metadata = {
  title: '오프라인 교육',
  description: '워크샵 · 정규 과정 · 기업 맞춤 교육 — 현장에서 직접 만나는 학습 경험.',
}

export const revalidate = 60

const TYPES: OfflineProgramType[] = ['workshop', 'regular_course', 'corporate']

export default async function OfflineProgramsListPage({
  searchParams,
}: {
  searchParams: { category?: string; type?: string }
}) {
  const supabase = createClient()

  // 카테고리 목록 (active 만)
  const { data: rawCategories } = await supabase
    .from('categories').select('*').eq('is_active', true).order('sort_order')
  const categories = (rawCategories as unknown as Category[] | null) ?? []

  // 프로그램 쿼리
  let query = supabase
    .from('offline_programs')
    .select('id, title, slug, thumbnail_url, program_type, instructor_name, is_featured, categories(name)')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (searchParams.category) {
    const cat = categories.find((c) => c.slug === searchParams.category)
    if (cat) query = query.eq('category_id', cat.id)
  }
  if (searchParams.type && (TYPES as string[]).includes(searchParams.type)) {
    query = query.eq('program_type', searchParams.type)
  }

  const { data: rawPrograms } = await query
  const programs = (rawPrograms as unknown as OfflineProgramCardData[] | null) ?? []

  const currentCategory = searchParams.category ?? ''
  const currentType = searchParams.type ?? ''

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy">오프라인 교육</h1>
        <p className="mt-1 text-sm text-gray-500">
          워크샵 · 정규 과정 · 기업 맞춤 — 현장에서 직접 만나는 학습 경험
        </p>
      </header>

      {/* 카테고리 필터 */}
      {categories.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <FilterPill href="/offline" active={!currentCategory}>
            전체
          </FilterPill>
          {categories.map((c) => (
            <FilterPill
              key={c.id}
              href={`/offline?category=${c.slug}${currentType ? `&type=${currentType}` : ''}`}
              active={currentCategory === c.slug}
            >
              {c.name}
            </FilterPill>
          ))}
        </div>
      )}

      {/* 유형 필터 */}
      <div className="mb-6 flex gap-2">
        <FilterPill
          href={`/offline${currentCategory ? `?category=${currentCategory}` : ''}`}
          active={!currentType}
          variant="ghost"
        >
          모든 유형
        </FilterPill>
        {TYPES.map((t) => (
          <FilterPill
            key={t}
            href={`/offline?type=${t}${currentCategory ? `&category=${currentCategory}` : ''}`}
            active={currentType === t}
            variant="ghost"
          >
            {OFFLINE_PROGRAM_TYPE_LABEL[t]}
          </FilterPill>
        ))}
      </div>

      {/* 결과 수 */}
      <p className="mb-6 text-sm text-gray-500">
        총 <strong className="text-navy">{programs.length}</strong>개 프로그램
      </p>

      {programs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="조건에 맞는 프로그램이 없습니다"
          description="다른 카테고리나 유형을 선택해보세요."
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((p) => (
            <OfflineProgramCard key={p.id} program={p} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterPill({
  href, active, children, variant = 'solid',
}: {
  href: string
  active: boolean
  children: React.ReactNode
  variant?: 'solid' | 'ghost'
}) {
  if (variant === 'ghost') {
    return (
      <Link
        href={href}
        className={`rounded-lg px-3 py-1.5 text-sm transition ${
          active
            ? 'bg-navy text-white'
            : 'border border-gray-200 bg-white text-gray-600 hover:border-accent hover:text-accent'
        }`}
      >
        {children}
      </Link>
    )
  }
  return (
    <Link
      href={href}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
        active
          ? 'bg-navy text-white'
          : 'bg-white text-gray-600 hover:bg-silver'
      }`}
    >
      {children}
    </Link>
  )
}
