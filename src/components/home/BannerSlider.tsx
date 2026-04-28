'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { BannerData } from './SectionRenderer'

interface Props {
  banners: BannerData[]
  autoplay?: boolean
  interval?: number
  showArrows?: boolean
  showDots?: boolean
}

export default function BannerSlider({
  banners,
  autoplay = true,
  interval = 5000,
  showArrows = true,
  showDots = true,
}: Props) {
  const [index, setIndex] = useState(0)
  const total = banners.length
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const hoverRef = useRef(false)

  useEffect(() => {
    if (!autoplay || total <= 1) return
    function tick() {
      if (!hoverRef.current) setIndex((i) => (i + 1) % total)
    }
    timerRef.current = setInterval(tick, Math.max(1500, interval))
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [autoplay, interval, total])

  if (total === 0) return null

  const go = (i: number) => setIndex(((i % total) + total) % total)
  const prev = () => go(index - 1)
  const next = () => go(index + 1)

  return (
    <section
      className="relative w-full overflow-hidden"
      onMouseEnter={() => { hoverRef.current = true }}
      onMouseLeave={() => { hoverRef.current = false }}
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
      >
        {banners.map((banner) => (
          <div key={banner.id} className="w-full flex-shrink-0">
            {banner.link_url ? (
              <a
                href={banner.link_url}
                target={banner.link_target}
                rel="noopener noreferrer"
                className="block"
              >
                <BannerImage banner={banner} />
              </a>
            ) : (
              <BannerImage banner={banner} />
            )}
          </div>
        ))}
      </div>

      {showArrows && total > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            aria-label="이전 배너"
            className="absolute left-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={next}
            aria-label="다음 배너"
            className="absolute right-3 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm hover:bg-black/50 transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </>
      )}

      {showDots && total > 1 && (
        <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-label={`${i + 1}번 배너로 이동`}
              className={`h-2 rounded-full transition-all ${
                i === index ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/70'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function BannerImage({ banner }: { banner: BannerData }) {
  if (banner.image_url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img
        src={banner.image_url}
        alt={banner.title}
        className="w-full max-h-[480px] object-cover"
      />
    )
  }
  return (
    <div className="w-full h-48 bg-gradient-to-r from-accent-pale to-accent/20 flex items-center justify-center">
      <p className="text-navy font-semibold">{banner.title}</p>
    </div>
  )
}
