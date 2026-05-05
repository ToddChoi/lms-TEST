import { Users, Building2, GraduationCap, Star, Award, BookOpen } from 'lucide-react'
import type { ComponentType } from 'react'
import type { BlockProps } from './registry'

export interface StatItem {
  label: string
  value: string             // '1,200+' 처럼 운영자가 직접 포맷
  icon?: 'users' | 'building' | 'graduation' | 'star' | 'award' | 'book'
}

export interface StatsConfig {
  heading?: string
  items?: StatItem[]
}

const ICON_MAP: Record<NonNullable<StatItem['icon']>, ComponentType<{ className?: string }>> = {
  users:      Users,
  building:   Building2,
  graduation: GraduationCap,
  star:       Star,
  award:      Award,
  book:       BookOpen,
}

/**
 * 신뢰 숫자 — 수강생 N명, 기업 M사, 평점 X 등.
 * 듀오톤 카드 + 아이콘 기반.
 */
export function StatsBlock({ config }: BlockProps<StatsConfig>) {
  const items = config.items ?? []
  if (items.length === 0) return null

  return (
    <section className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {config.heading && (
          <h2 className="mb-10 text-center text-h3 text-navy">{config.heading}</h2>
        )}
        <div
          className={`grid gap-6 ${
            items.length === 2
              ? 'grid-cols-2'
              : items.length === 3
                ? 'grid-cols-1 sm:grid-cols-3'
                : 'grid-cols-2 sm:grid-cols-4'
          }`}
        >
          {items.map((item, i) => {
            const Icon = item.icon ? ICON_MAP[item.icon] : null
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-2 rounded-lg border border-border-subtle bg-surface-subtle p-6 text-center"
              >
                {Icon && (
                  <div className="flex h-11 w-11 items-center justify-center rounded-md bg-accent-pale text-accent">
                    <Icon className="h-5 w-5" />
                  </div>
                )}
                <div className="font-en text-h2 font-bold text-navy">{item.value}</div>
                <div className="text-body-sm text-gray-500">{item.label}</div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
