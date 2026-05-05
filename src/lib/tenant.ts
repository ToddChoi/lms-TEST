/**
 * Multi-tenant 해석 헬퍼 — Phase 4.
 *
 * 현재 요청의 host 에서 회사(tenant)를 해석.
 *
 * 동작:
 *   - "acme.ingrow.com"     → companies.subdomain='acme' 매칭 시도
 *   - "ingrow.com" / "www.ingrow.com" → 기본 사이트 (tenant=null)
 *   - "localhost:3000"      → tenant=null (개발)
 *   - "?tenant=acme" 쿼리   → 로컬에서 데모용으로 강제 지정 (개발 편의)
 *
 * cache():
 *   같은 요청 안에서 여러 번 호출해도 DB 1회만. SurfaceBlocks, layout, Header
 *   등이 각자 호출해도 무관.
 *
 * RESERVED:
 *   www, app, api, admin, docs, staging, dev 같은 시스템 prefix 는 회사명 으로
 *   인식하지 않음 (예약).
 */

import { headers } from 'next/headers'
import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'
import { parseSubdomain } from './tenant-utils'

export interface Tenant {
  id: string
  name: string
  subdomain: string
  logo_url: string | null
  primary_color: string | null
  hero_image_url: string | null
  is_white_label: boolean
}

// re-export — 다른 파일들이 lib/tenant 만 import 하면 되도록.
export { parseSubdomain }

/**
 * 현재 요청의 회사 해석.
 *  - 매칭 실패 또는 기본 사이트 → null
 *  - 매칭 성공 → Tenant
 */
export const getTenant = cache(async (): Promise<Tenant | null> => {
  const h = headers()
  const host = h.get('host')

  // 1순위: host subdomain
  let sub = parseSubdomain(host)

  // 2순위: 개발 편의 — ?tenant=... 쿼리. middleware 가 x-tenant-override 헤더로 패스해줌.
  // (production 에서는 사용 안 됨)
  if (!sub) {
    const override = h.get('x-tenant-override')
    if (override) sub = override
  }

  if (!sub) return null

  const supabase = createClient()
  const { data } = await supabase
    .from('companies')
    .select('id, name, subdomain, logo_url, primary_color, hero_image_url, is_white_label')
    .eq('subdomain', sub)
    .eq('is_active', true)
    .maybeSingle()
  return (data as unknown as Tenant | null) ?? null
})
