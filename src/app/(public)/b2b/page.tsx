import B2BContactForm from '@/components/public/B2BContactForm'
import { SurfaceBlocks } from '@/components/blocks/SurfaceBlocks'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '기업 도입',
  description: '기업 맞춤형 이러닝 솔루션 — Ingrow LMS B2B',
}

/**
 * /b2b — 페이지 빌더 100% driven.
 *
 * 콘텐츠 (hero / 혜택 / CTA / 후기 / 로고 wall 등) 은 모두 content_blocks 에서.
 * 운영자는 /admin/cms/builder/b2b 에서 편집.
 *
 * B2BContactForm 만 코드로 유지 — 결제·이메일 발송 같은 복잡한 클라이언트 로직.
 * `#b2b-form` anchor 로 CTA 블록의 cta_url 이 가리킴.
 */
export default function B2BPage() {
  return (
    <div className="flex flex-col">
      <SurfaceBlocks surface="b2b" />

      {/* 폼은 코드로 유지 — 어떤 블록이 있든 항상 페이지 하단에 노출. */}
      <section id="b2b-form" className="bg-surface-subtle py-16">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <B2BContactForm />
        </div>
      </section>
    </div>
  )
}
