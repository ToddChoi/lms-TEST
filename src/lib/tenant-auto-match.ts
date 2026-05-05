/**
 * 가입자 이메일 도메인 → 회사 자동 매칭.
 *
 * 호출 시점:
 *   - /api/auth/callback (이메일 확인 직후 — 신규 가입자에게 즉시 회사 멤버십 부여)
 *   - 필요 시 백오피스 일괄 매칭 (관리자가 누락된 사용자 일괄 매칭)
 *
 * 안전:
 *   - 이미 어떤 회사든 멤버인 사용자 → skip (수동 부여 우선)
 *   - companies.email_domains 빈 배열 → skip
 *   - service_role 사용 — company_members RLS 가 admin only 라 일반 user 흐름엔 service_role 필요
 *
 * 정책:
 *   - 한 도메인이 여러 회사에 등록된 경우 첫 회사만 매칭. 운영 정책상 도메인은 1회사에 매핑돼야 함.
 *   - is_manager=false 로 INSERT. 매니저 승격은 별도 admin UI.
 *   - department=null. 회사 admin 이 나중에 채울 수 있음.
 */
import { createAdminClient } from '@/lib/supabase/admin'

export interface AutoMatchResult {
  matched: boolean
  companyId?: string
  companyName?: string
  reason?: string
}

export async function autoMatchCompanyByEmail(
  userId: string,
  email: string | null | undefined,
): Promise<AutoMatchResult> {
  const at = email?.indexOf('@') ?? -1
  if (!email || at < 0) return { matched: false, reason: 'invalid email' }
  const domain = email.slice(at + 1).toLowerCase().trim()
  if (!domain) return { matched: false, reason: 'empty domain' }

  const admin = createAdminClient() as any

  // 이미 어떤 회사든 멤버 → skip (수동 매핑 보존)
  const { data: existing, error: existingErr } = await admin
    .from('company_members')
    .select('company_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (existingErr) {
    console.error('[autoMatch] existing check failed', existingErr)
    return { matched: false, reason: 'check failed' }
  }
  if (existing) return { matched: false, reason: 'already member' }

  // email_domains 배열에 매칭되는 회사 찾기 — Postgres array contains.
  const { data: companies, error: compErr } = await admin
    .from('companies')
    .select('id, name')
    .contains('email_domains', [domain])
    .eq('is_active', true)
    .limit(1)
  if (compErr) {
    console.error('[autoMatch] company lookup failed', compErr)
    return { matched: false, reason: 'lookup failed' }
  }
  const company = (companies as Array<{ id: string; name: string }> | null)?.[0]
  if (!company) return { matched: false, reason: 'no company for domain' }

  // INSERT — UNIQUE(company_id, user_id) 라 onConflict 무시.
  const { error: insErr } = await admin
    .from('company_members')
    .upsert(
      { company_id: company.id, user_id: userId, is_manager: false },
      { onConflict: 'company_id,user_id', ignoreDuplicates: true },
    )
  if (insErr) {
    console.error('[autoMatch] insert failed', insErr)
    return { matched: false, reason: 'insert failed' }
  }

  return { matched: true, companyId: company.id, companyName: company.name }
}
