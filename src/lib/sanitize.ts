/**
 * RichEditor / CMS HTML 을 렌더 직전에 sanitize.
 * dangerouslySetInnerHTML 직전에 항상 호출.
 *
 * sanitize-html — 순수 CommonJS, jsdom 의존 없음. Vercel serverless 호환.
 */
import sanitize from 'sanitize-html'

const OPTIONS: sanitize.IOptions = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
    'ul', 'ol', 'li', 'blockquote',
    'a', 'img',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'code', 'pre', 'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'target', 'rel', 'title', 'class', 'id'],
    img: ['src', 'alt', 'title', 'class', 'id'],
    th: ['colspan', 'rowspan', 'class', 'id'],
    td: ['colspan', 'rowspan', 'class', 'id'],
    '*': ['class', 'id'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedSchemesAppliedToAttributes: ['href', 'src'],
  allowProtocolRelative: false,
}

export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return ''
  return sanitize(html, OPTIONS)
}
