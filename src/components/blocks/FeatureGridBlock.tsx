import {
  Users, BookOpen, BarChart3, Award, Building2, GraduationCap,
  CheckCircle, Star, Sparkles, Shield, Zap, Target,
} from 'lucide-react'
import type { ComponentType } from 'react'
import type { BlockProps } from './registry'

export interface FeatureItem {
  icon?: string             // 아이콘 키 (아래 ICON_MAP)
  title: string
  desc: string
}

export interface FeatureGridConfig {
  heading?: string
  subheading?: string
  items?: FeatureItem[]
  columns?: 2 | 3 | 4        // 그리드 열 수 (기본 4)
  surface?: 'silver' | 'white'  // 배경
}

const ICON_MAP: Record<string, ComponentType<{ className?: string }>> = {
  users:       Users,
  book:        BookOpen,
  chart:       BarChart3,
  award:       Award,
  building:    Building2,
  graduation:  GraduationCap,
  check:       CheckCircle,
  star:        Star,
  sparkles:    Sparkles,
  shield:      Shield,
  zap:         Zap,
  target:      Target,
}

/**
 * 혜택/기능 카드 grid — 4 카드(아이콘+제목+설명) 구조.
 * B2B 도입 혜택, 강의 기능 소개, About 페이지의 핵심 가치 등에 사용.
 */
export function FeatureGridBlock({ config }: BlockProps<FeatureGridConfig>) {
  const items = config.items ?? []
  if (items.length === 0) return null

  const cols = config.columns ?? 4
  const colClass = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
  }[cols]
  const bg = config.surface === 'white' ? 'bg-surface' : 'bg-silver'

  return (
    <section className={`${bg} py-16`}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(config.heading || config.subheading) && (
          <div className="mb-10 text-center">
            {config.heading && (
              <h2 className="text-h3 text-navy">{config.heading}</h2>
            )}
            {config.subheading && (
              <p className="mt-2 text-body-sm text-gray-500">{config.subheading}</p>
            )}
          </div>
        )}
        <div className={`grid grid-cols-1 gap-6 ${colClass}`}>
          {items.map((item, i) => {
            const Icon = item.icon ? ICON_MAP[item.icon] : null
            return (
              <div
                key={i}
                className="rounded-lg bg-surface p-6 shadow-elev-1 transition-shadow duration-180 ease-out-snap hover:shadow-elev-2"
              >
                {Icon && (
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-md bg-accent-pale">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                )}
                <h3 className="text-body font-semibold text-navy">{item.title}</h3>
                <p className="mt-2 text-body-sm text-gray-500">{item.desc}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
