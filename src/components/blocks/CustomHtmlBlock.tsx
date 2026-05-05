import type { BlockProps } from './registry'

export interface CustomHtmlConfig {
  html?: string
}

/**
 * 커스텀 HTML — 다른 블록으로 표현 안 되는 비상용.
 * 보안상 admin role 만 작성 가능 (RLS), 그러나 XSS 위험 항상 인지.
 * 일반 마케터에게는 노출하지 않는 게 권장.
 */
export function CustomHtmlBlock({ config }: BlockProps<CustomHtmlConfig>) {
  if (!config.html?.trim()) return null
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* eslint-disable-next-line react/no-danger */}
      <div dangerouslySetInnerHTML={{ __html: config.html }} />
    </section>
  )
}
