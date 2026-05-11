import { describe, it, expect } from 'vitest'
import { safeScriptJson, sanitizeHtml } from './sanitize'

describe('safeScriptJson', () => {
  it('escapes </script> break-out attempt', () => {
    const out = safeScriptJson({ description: '</script><script>alert(1)</script>' })
    expect(out).not.toContain('</script>')
    expect(out).toContain('\\u003c')
  })

  it('escapes < > & to unicode', () => {
    const out = safeScriptJson({ raw: '<a&b>' })
    expect(out).not.toMatch(/[<>&]/)
    expect(out).toContain('\\u003c')
    expect(out).toContain('\\u003e')
    expect(out).toContain('\\u0026')
  })

  it('escapes U+2028 / U+2029 line and paragraph separators', () => {
    const sep = String.fromCharCode(0x2028) + String.fromCharCode(0x2029)
    const out = safeScriptJson({ raw: sep })
    expect(out).toContain('\\u2028')
    expect(out).toContain('\\u2029')
    expect(out).not.toContain(String.fromCharCode(0x2028))
    expect(out).not.toContain(String.fromCharCode(0x2029))
  })

  it('round-trips back to original via JSON.parse', () => {
    const input = { name: 'A', description: '</script>' }
    const escaped = safeScriptJson(input)
    expect(JSON.parse(escaped)).toEqual(input)
  })
})

describe('sanitizeHtml', () => {
  it('strips <script> tags', () => {
    expect(sanitizeHtml('<p>hi</p><script>alert(1)</script>')).toBe('<p>hi</p>')
  })

  it('strips javascript: hrefs', () => {
    const out = sanitizeHtml('<a href="javascript:alert(1)">x</a>')
    expect(out).not.toContain('javascript:')
  })

  it('keeps allowed tags and attrs', () => {
    const out = sanitizeHtml('<p class="x">hi <strong>bold</strong></p>')
    expect(out).toContain('<p class="x">')
    expect(out).toContain('<strong>')
  })

  it('handles null / empty', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
    expect(sanitizeHtml('')).toBe('')
  })
})
