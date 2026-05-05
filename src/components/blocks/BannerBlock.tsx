import Link from 'next/link'
import Image from 'next/image'
import type { BlockProps } from './registry'

export interface BannerItem {
  title: string
  image_url?: string | null
  link_url?: string | null
  link_target?: string
}

export interface BannerConfig {
  layout?: 'single' | 'slider' | 'grid'
}

interface InjectedProps {
  banners?: BannerItem[]
}

/**
 * 배너 슬롯 — single/slider/grid 3종.
 * P2 시점에는 single + grid 만 렌더, slider 는 P3 에서 client component 로.
 */
export function BannerBlock(
  { config, banners = [] }: BlockProps<BannerConfig> & InjectedProps,
) {
  if (banners.length === 0) return null
  const layout = config.layout ?? 'single'

  if (layout === 'grid') {
    return (
      <section className="bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {banners.map((b, i) => (
              <BannerItemView key={i} b={b} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // single (default) — 첫 배너만
  const b = banners[0]
  return (
    <section className="bg-surface py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <BannerItemView b={b} large />
      </div>
    </section>
  )
}

function BannerItemView({ b, large = false }: { b: BannerItem; large?: boolean }) {
  const aspect = large ? 'aspect-[5/1]' : 'aspect-[3/1]'
  const inner = (
    <div className={`relative overflow-hidden rounded-lg ${aspect} bg-surface-muted`}>
      {b.image_url ? (
        <Image
          src={b.image_url}
          alt={b.title}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 1280px, 100vw"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-body text-gray-400">
          {b.title}
        </div>
      )}
    </div>
  )
  return b.link_url ? (
    <Link
      href={b.link_url}
      target={b.link_target === '_blank' ? '_blank' : undefined}
      rel={b.link_target === '_blank' ? 'noopener noreferrer' : undefined}
    >
      {inner}
    </Link>
  ) : (
    inner
  )
}
