import Link from 'next/link'
import Image from 'next/image'
import type { BlockProps } from './registry'

export interface BannerItem {
  title: string
  image_url?: string | null
  link_url?: string | null
  link_target?: string             // '_self' | '_blank'
}

export interface BannerConfig {
  layout?: 'single' | 'slider' | 'grid'
  items?: BannerItem[]              // 인라인 배너 — content_blocks.config 에 저장
}

/**
 * 배너 슬롯 — config.items 에서 직접 읽음.
 *
 * layout:
 *   single : 첫 배너만 풀폭 (5:1 비율)
 *   grid   : 3열 그리드 (3:1 비율)
 *   slider : (P 후속) — 일단 grid 와 동일 렌더
 */
export function BannerBlock({ config }: BlockProps<BannerConfig>) {
  const items = config.items ?? []
  if (items.length === 0) return null
  const layout = config.layout ?? 'single'

  if (layout === 'grid' || layout === 'slider') {
    return (
      <section className="bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b, i) => (
              <BannerItemView key={i} b={b} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // single (default) — 첫 배너만
  return (
    <section className="bg-surface py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <BannerItemView b={items[0]} large />
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
          {b.title || '(이미지 없음)'}
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
