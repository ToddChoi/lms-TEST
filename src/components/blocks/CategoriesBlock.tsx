import Link from 'next/link'
import type { BlockProps } from './registry'

export interface CategoriesConfig {
  heading?: string
}

interface InjectedProps {
  /** SurfaceBlocks 가 주입 */
  categories?: Array<{
    id: string
    slug: string
    name: string
    description?: string | null
    icon?: string | null
    color?: string | null
  }>
}

/**
 * 카테고리 그리드 — Phase 1 categories 테이블의 color/image_url 활용 가능.
 * icon 은 아직 이모지 string 그대로지만 P3 에서 Lucide 매핑 도입 예정.
 */
export function CategoriesBlock(
  { config, categories = [] }: BlockProps<CategoriesConfig> & InjectedProps,
) {
  if (categories.length === 0) return null

  return (
    <section className="bg-surface-subtle py-12 sm:py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {config.heading && (
          <h2 className="mb-8 text-h3 text-navy">{config.heading}</h2>
        )}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/courses?category=${c.slug}`}
              className="group flex flex-col items-center gap-3 rounded-lg border border-border-subtle bg-surface p-5 transition-all duration-180 ease-out-snap hover:-translate-y-0.5 hover:shadow-elev-2"
              style={c.color ? { borderTopColor: c.color, borderTopWidth: 3 } : undefined}
            >
              {c.icon && (
                <span className="text-h3" aria-hidden="true">
                  {c.icon}
                </span>
              )}
              <span className="text-body-sm font-semibold text-navy">{c.name}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
