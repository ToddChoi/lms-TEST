/**
 * tenant 의 순수 유틸 — React/Next 의존성 없음 (단위 테스트 가능).
 */

const RESERVED_SUBDOMAINS = new Set([
  'www', 'app', 'api', 'admin', 'docs', 'staging', 'dev', 'preview',
])

/**
 * host 문자열에서 subdomain 추출.
 *
 * 규칙:
 *  - "acme.ingrow.com"   → "acme"
 *  - "ingrow.com"        → null (apex)
 *  - "www.ingrow.com"    → null (RESERVED)
 *  - "localhost(:port)"  → null
 *  - "192.168.x.x"       → null (IP)
 *  - "*.vercel.app"      → null (preview)
 */
export function parseSubdomain(host: string | null | undefined): string | null {
  if (!host) return null
  const cleanHost = host.split(':')[0].toLowerCase().trim()
  if (!cleanHost) return null
  if (cleanHost === 'localhost') return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cleanHost)) return null
  if (cleanHost.endsWith('.vercel.app')) return null

  const parts = cleanHost.split('.')
  if (parts.length < 3) return null

  const sub = parts[0]
  if (RESERVED_SUBDOMAINS.has(sub)) return null
  return sub
}
