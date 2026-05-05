import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import type { BlockProps } from './registry'

export interface HeroConfig {
  heading?: string
  subheading?: string
  cta_label?: string
  cta_url?: string
  bg_image?: string                                 // 이미지 URL
  variant?: 'centered' | 'split' | 'video'
}

/**
 * Hero — content_blocks 용 신버전.
 * 기존 SectionRenderer 의 hero 와 분리 — 점진 교체용.
 *
 * variant:
 *   centered : 중앙정렬 헤드라인 + CTA + (옵션) 배경 이미지
 *   split    : 좌측 카피 / 우측 이미지 (B2B 친화)
 *   video    : 풀블리드 비디오 배경 (P3 시점에 본격 구현)
 */
export function HeroBlock({ config }: BlockProps<HeroConfig>) {
  const variant = config.variant ?? 'centered'
  const heading = config.heading?.trim() || ''
  const subheading = config.subheading?.trim() || ''
  const cta = config.cta_label?.trim() && config.cta_url?.trim()
    ? { label: config.cta_label, url: config.cta_url }
    : null

  if (!heading && !subheading && !config.bg_image) return null

  if (variant === 'split') {
    return (
      <section className="relative overflow-hidden bg-gradient-to-br from-navy via-navy-mid to-navy-light text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            {heading && <h1 className="text-h1 sm:text-display">{heading}</h1>}
            {subheading && (
              <p className="mt-5 text-body-lg text-white/80">{subheading}</p>
            )}
            {cta && (
              <div className="mt-8">
                <Link href={cta.url}>
                  <Button size="lg">{cta.label}</Button>
                </Link>
              </div>
            )}
          </div>
          <div className="relative aspect-video overflow-hidden rounded-xl bg-white/5">
            {config.bg_image && (
              <Image
                src={config.bg_image}
                alt=""
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 50vw, 100vw"
              />
            )}
          </div>
        </div>
      </section>
    )
  }

  // centered (default)
  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-navy via-navy-mid to-navy-light text-white">
      {config.bg_image && (
        <div className="absolute inset-0 opacity-25">
          <Image src={config.bg_image} alt="" fill className="object-cover" sizes="100vw" priority />
        </div>
      )}
      <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:py-32">
        {heading && <h1 className="text-h1 sm:text-display">{heading}</h1>}
        {subheading && (
          <p className="mx-auto mt-5 max-w-2xl text-body-lg text-white/80">{subheading}</p>
        )}
        {cta && (
          <div className="mt-9">
            <Link href={cta.url}>
              <Button size="lg">{cta.label}</Button>
            </Link>
          </div>
        )}
      </div>
    </section>
  )
}
