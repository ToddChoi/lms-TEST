import Link from 'next/link'
import { CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { BlockProps } from './registry'

export interface CtaConfig {
  heading?: string
  subheading?: string
  bullets?: string[]                          // 체크 아이콘 + 텍스트 리스트
  cta_label?: string
  cta_url?: string                            // '#b2b-form' 같은 anchor 도 가능
  variant?: 'soft' | 'inverted'               // soft = 흰배경, inverted = navy 배경
}

/**
 * 행동 유도 섹션 — heading/bullets/CTA 버튼.
 * B2B 의 "지금 바로 도입 상담", 강좌 페이지의 "수강 신청 마감 임박" 등.
 */
export function CtaBlock({ config }: BlockProps<CtaConfig>) {
  const { heading, subheading, bullets = [], cta_label, cta_url, variant = 'soft' } = config
  if (!heading && !subheading && bullets.length === 0 && !cta_label) return null

  const isInverted = variant === 'inverted'
  const sectionCls = isInverted
    ? 'bg-navy text-white'
    : 'bg-surface'
  const headingCls = isInverted ? 'text-h2 text-white' : 'text-h2 text-navy'
  const subCls = isInverted ? 'text-body text-white/80' : 'text-body text-gray-500'
  const bulletCls = isInverted ? 'text-white/90' : 'text-gray-600'
  const checkCls = isInverted ? 'text-success' : 'text-success'

  return (
    <section className={`${sectionCls} py-16`}>
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        {heading && <h2 className={headingCls}>{heading}</h2>}
        {subheading && <p className={`mt-3 ${subCls}`}>{subheading}</p>}
        {bullets.length > 0 && (
          <ul className="mt-6 mb-8 flex flex-col items-center gap-2">
            {bullets.map((b, i) => (
              <li key={i} className={`flex items-center gap-2 text-body-sm ${bulletCls}`}>
                <CheckCircle className={`h-4 w-4 shrink-0 ${checkCls}`} />
                {b}
              </li>
            ))}
          </ul>
        )}
        {cta_label && cta_url && (
          <Link href={cta_url}>
            <Button size="lg" variant={isInverted ? 'secondary' : 'primary'}>
              {cta_label}
            </Button>
          </Link>
        )}
      </div>
    </section>
  )
}
