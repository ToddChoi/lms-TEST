/**
 * 가벼운 markdown → HTML 변환기.
 *
 * 외부 라이브러리 (marked, markdown-it 등) 추가 없이 약관/개인정보 같은 정적 페이지에
 * 충분한 수준만 처리. WYSIWYG 도입 시 별도 라운드.
 *
 * 지원:
 *   # / ## / ### 헤딩
 *   **bold** / *italic*
 *   [text](url) 링크
 *   - 또는 * 불릿 리스트
 *   1. 숫자 리스트
 *   > 인용
 *   `code` 인라인
 *   --- 구분선
 *   빈 줄로 단락 구분
 *
 * 보안:
 *   - <  >  &  를 escape 한 뒤 markdown 토큰만 HTML 로 치환.
 *   - admin role 만 작성 가능하지만 방어적으로 처리.
 *   - 링크의 javascript: 스킴 차단.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function safeUrl(url: string): string {
  const trimmed = url.trim()
  if (/^javascript:/i.test(trimmed)) return '#'
  return trimmed
}

function inline(text: string): string {
  // ★ 순서 중요: 코드 인라인 먼저 (그 안의 *,_ 등 무력화)
  let s = escapeHtml(text)

  // `code`
  s = s.replace(/`([^`]+)`/g, '<code class="rounded bg-surface-muted px-1 text-caption">$1</code>')

  // [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, t, u) => {
    const url = safeUrl(u)
    return `<a href="${url}" class="text-accent hover:underline" target="_blank" rel="noopener noreferrer">${t}</a>`
  })

  // **bold**
  s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')

  // *italic* — bold 다음에. _italic_ 도 지원.
  s = s.replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
  s = s.replace(/_([^_\n]+)_/g, '<em>$1</em>')

  return s
}

export function renderMarkdown(md: string): string {
  if (!md) return ''
  const lines = md.split(/\r?\n/)
  const out: string[] = []
  let inUl = false
  let inOl = false

  const closeLists = () => {
    if (inUl) { out.push('</ul>'); inUl = false }
    if (inOl) { out.push('</ol>'); inOl = false }
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '')

    // 빈 줄 — 단락 구분
    if (line.trim() === '') {
      closeLists()
      continue
    }

    // 구분선
    if (/^---+\s*$/.test(line)) {
      closeLists()
      out.push('<hr class="my-6 border-border-subtle" />')
      continue
    }

    // 헤딩
    const h = line.match(/^(#{1,6})\s+(.+)$/)
    if (h) {
      closeLists()
      const level = h[1].length
      const cls =
        level === 1 ? 'text-h2 mt-8 mb-4 text-navy' :
        level === 2 ? 'text-h3 mt-7 mb-3 text-navy' :
        level === 3 ? 'text-h4 mt-6 mb-2 text-navy' :
                       'text-h5 mt-5 mb-2 text-navy'
      out.push(`<h${level} class="${cls}">${inline(h[2])}</h${level}>`)
      continue
    }

    // 인용
    if (line.startsWith('> ')) {
      closeLists()
      out.push(`<blockquote class="my-3 border-l-4 border-accent/30 pl-4 italic text-gray-600">${inline(line.slice(2))}</blockquote>`)
      continue
    }

    // 불릿 리스트
    if (/^[-*]\s+/.test(line)) {
      if (!inUl) { closeLists(); out.push('<ul class="my-3 list-disc space-y-1 pl-6">'); inUl = true }
      out.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }

    // 숫자 리스트
    if (/^\d+\.\s+/.test(line)) {
      if (!inOl) { closeLists(); out.push('<ol class="my-3 list-decimal space-y-1 pl-6">'); inOl = true }
      out.push(`<li>${inline(line.replace(/^\d+\.\s+/, ''))}</li>`)
      continue
    }

    // 일반 단락
    closeLists()
    out.push(`<p class="my-3 leading-relaxed">${inline(line)}</p>`)
  }
  closeLists()
  return out.join('\n')
}
