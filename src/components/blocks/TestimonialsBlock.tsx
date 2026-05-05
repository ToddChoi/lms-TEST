import Image from 'next/image'
import { Quote } from 'lucide-react'
import type { BlockProps } from './registry'

export interface Testimonial {
  name: string
  company?: string
  quote: string
  avatar_url?: string
  role?: string
}

export interface TestimonialsConfig {
  heading?: string
  subheading?: string
  items?: Testimonial[]
  layout?: 'grid' | 'centered'   // grid = 3열, centered = 1개씩 중앙
}

/**
 * 수강생/고객사 후기 — 소셜 프루프.
 */
export function TestimonialsBlock({ config }: BlockProps<TestimonialsConfig>) {
  const items = config.items ?? []
  if (items.length === 0) return null

  const layout = config.layout ?? 'grid'

  return (
    <section className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(config.heading || config.subheading) && (
          <div className="mb-12 text-center">
            {config.heading && (
              <h2 className="text-h2 text-navy">{config.heading}</h2>
            )}
            {config.subheading && (
              <p className="mt-3 text-body text-gray-500">{config.subheading}</p>
            )}
          </div>
        )}

        {layout === 'centered' ? (
          <div className="mx-auto max-w-3xl">
            {items.slice(0, 1).map((t, i) => (
              <Card key={i} t={t} centered />
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {items.map((t, i) => (
              <Card key={i} t={t} />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function Card({ t, centered = false }: { t: Testimonial; centered?: boolean }) {
  return (
    <figure
      className={`rounded-lg border border-border-subtle bg-surface p-6 shadow-elev-1 ${
        centered ? 'text-center' : ''
      }`}
    >
      <Quote className="h-6 w-6 text-accent" />
      <blockquote className="mt-4 text-body text-navy/90">
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        {t.avatar_url ? (
          <Image
            src={t.avatar_url}
            alt={t.name}
            width={40}
            height={40}
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-h6 text-navy">
            {t.name.slice(0, 1)}
          </div>
        )}
        <div className={centered ? 'text-left' : ''}>
          <div className="text-body-sm font-semibold text-navy">{t.name}</div>
          {(t.role || t.company) && (
            <div className="text-caption text-gray-500">
              {t.role}
              {t.role && t.company && ' · '}
              {t.company}
            </div>
          )}
        </div>
      </figcaption>
    </figure>
  )
}
