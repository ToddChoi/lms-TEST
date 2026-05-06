import Link from 'next/link'
import Image from 'next/image'
import type { BlockProps } from './registry'

export interface BannerItem {
  title: string
  image_url?: string | null
  link_url?: string | null
  link_target?: string             // '_self' | '_blank'
}

/**
 * aspect_ratio:
 *   '21/9'  cinematic 와이드 (default for single/slider)
 *   '16/9'  표준 (default for grid)
 *   '16/7'  hero
 *   '5/2'   와이드 슬림
 *   '3/1'   슬림
 *   '5/1'   가로 매우 긴
 *   '1/1'   정사각
 *   'custom' → aspect_custom 사용 ("16/9" 또는 "16:9")
 */
export type AspectPreset = '21/9' | '16/9' | '16/7' | '5/2' | '3/1' | '5/1' | '1/1' | 'custom'

export interface BannerConfig {
  layout?: 'single' | 'slider' | 'grid'
  items?: BannerItem[]
  aspect_ratio?: AspectPreset
  aspect_custom?: string           // "W/H" 또는 "W:H"
  max_height_px?: number           // 최대 높이 (px). 비워두면 무제한.
}

/**
 * 배너 슬롯 — config.items 인라인 + 운영자가 사이즈 조정 가능.
 *
 * 기본값:
 *   single / slider : 21/9 (와이드 시네마 — 임팩트 큼)
 *   grid            : 16/9 (표준 — 3열 그리드 적정)
 *
 * max_height_px 로 데스크탑에서 너무 커지는 것 방지 가능.
 */
export function BannerBlock({ config }: BlockProps<BannerConfig>) {
  const items = config.items ?? []
  if (items.length === 0) return null
  const layout = config.layout ?? 'single'

  if (layout === 'grid' || layout === 'slider') {
    const fallback = layout === 'grid' ? '16/9' : '21/9'
    const style = computeAspectStyle(config, fallback)
    return (
      <section className="bg-surface py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((b, i) => (
              <BannerItemView key={i} b={b} style={style} />
            ))}
          </div>
        </div>
      </section>
    )
  }

  // single — 첫 배너만 풀폭
  const style = computeAspectStyle(config, '21/9')
  return (
    <section className="bg-surface py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <BannerItemView b={items[0]} style={style} />
      </div>
    </section>
  )
}

function computeAspectStyle(cfg: BannerConfig, fallback: string): React.CSSProperties {
  let ratio = fallback
  if (cfg.aspect_ratio === 'custom' && cfg.aspect_custom) {
    const norm = cfg.aspect_custom.replace(':', '/').trim()
    if (/^\d+\/\d+$/.test(norm)) ratio = norm
  } else if (cfg.aspect_ratio && cfg.aspect_ratio !== 'custom') {
    ratio = cfg.aspect_ratio
  }
  const style: React.CSSProperties = { aspectRatio: ratio }
  if (cfg.max_height_px && Number.isFinite(cfg.max_height_px) && cfg.max_height_px > 0) {
    style.maxHeight = `${cfg.max_height_px}px`
  }
  return style
}

function BannerItemView({ b, style }: { b: BannerItem; style: React.CSSProperties }) {
  const inner = (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-surface-muted"
      style={style}
    >
      {b.image_url ? (
        <Image
          src={b.image_url}
          alt={b.title}
          fill
          className="object-cover"
          sizes="(min-width: 1024px) 1280px, 100vw"
          priority
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
