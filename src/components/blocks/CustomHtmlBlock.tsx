import { sanitizeHtml } from '@/lib/sanitize'
import type { BlockProps } from './registry'

export interface CustomHtmlConfig {
  html?: string
}

/**
 * 커스텀 HTML — 다른 블록으로 표현 안 되는 비상용.
 *
 * 보안: admin role 만 작성 가능 (RLS), 그래도 DB 오염 / 운영자 실수 / 계정 탈취 시
 *       공개 페이지 XSS 방지를 위해 항상 sanitize 후 렌더.
 *       <script>, on*, javascript: 같은 위험 요소는 dompurify 가 제거.
 */
export function CustomHtmlBlock({ config }: BlockProps<CustomHtmlConfig>) {
  if (!config.html?.trim()) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(config.html) }} />
    </section>
  )
}
