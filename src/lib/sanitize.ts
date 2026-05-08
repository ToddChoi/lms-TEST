/**
 * RichEditor 가 만든 HTML 을 렌더 직전에 sanitize.
 * dangerouslySetInnerHTML 직전에 항상 호출.
 *
 * isomorphic-dompurify — server (jsdom) + client 양쪽 동작.
 */
import DOMPurify from 'isomorphic-dompurify'

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'title', 'class', 'id',
      'colspan', 'rowspan',
    ],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  })
}
