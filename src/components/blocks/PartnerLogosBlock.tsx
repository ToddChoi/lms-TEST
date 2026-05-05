import Image from 'next/image'
import type { BlockProps } from './registry'

export interface PartnerLogo {
  name: string
  logo_url: string
  url?: string
}

export interface PartnerLogosConfig {
  heading?: string
  subheading?: string
  logos?: PartnerLogo[]
}

/**
 * 도입 기업 로고 wall — B2B 신뢰 시그널의 핵심 컴포넌트.
 *
 * 디자인:
 *   - grayscale + opacity-60 → hover 시 컬러 (Stripe / Linear 패턴)
 *   - 모바일 2열, 태블릿 4열, 데스크탑 6열
 */
export function PartnerLogosBlock({ config }: BlockProps<PartnerLogosConfig>) {
  const logos = config.logos ?? []
  if (logos.length === 0) return null

  return (
    <section className="bg-surface-subtle py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {(config.heading || config.subheading) && (
          <div className="mb-12 text-center">
            {config.heading && (
              <h2 className="text-h3 text-navy">{config.heading}</h2>
            )}
            {config.subheading && (
              <p className="mt-2 text-body-sm text-gray-500">{config.subheading}</p>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 items-center gap-x-8 gap-y-10 sm:grid-cols-4 lg:grid-cols-6">
          {logos.map((logo) => {
            const inner = (
              <div className="flex h-12 items-center justify-center grayscale opacity-60 transition-all duration-180 ease-out-snap hover:grayscale-0 hover:opacity-100">
                <Image
                  src={logo.logo_url}
                  alt={logo.name}
                  width={120}
                  height={48}
                  className="max-h-12 w-auto object-contain"
                />
              </div>
            )
            return logo.url ? (
              <a key={logo.name} href={logo.url} target="_blank" rel="noopener noreferrer">
                {inner}
              </a>
            ) : (
              <div key={logo.name}>{inner}</div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
