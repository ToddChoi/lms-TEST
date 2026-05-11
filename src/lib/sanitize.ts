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

/**
 * <script>...</script> 안에 JSON 을 박을 때 사용 (e.g., schema.org LD+JSON).
 * JSON.stringify 자체는 `<` 를 escape 하지 않으므로 데이터에 `</script>` 가 있으면
 * 브라우저가 script 를 조기 종료하고 다음 텍스트를 HTML 로 파싱 → XSS.
 *
 * `<`, `>`, `&` 와 JS 파서가 거부하는 line/paragraph separator (U+2028/2029) 까지
 * 모두 unicode escape — JSON spec 안에 머물면서 안전.
 */
export function safeScriptJson(value: unknown): string {
  const LINE_SEP = String.fromCharCode(0x2028)
  const PARA_SEP = String.fromCharCode(0x2029)
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .split(LINE_SEP).join('\\u2028')
    .split(PARA_SEP).join('\\u2029')
}
