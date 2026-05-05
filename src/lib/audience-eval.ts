/**
 * audience 평가 — 순수 함수 부분만 (React/Next 의존성 없음).
 * 단위 테스트 + audience.ts 가 함께 사용.
 */

export interface Audience {
  logged_in?: boolean
  company_id?: string
  is_company_member?: boolean
  is_company_manager?: boolean
  roles?: string[]
  interests_any?: string[]
  job_levels?: string[]
}

export interface AudienceContext {
  userId: string | null
  role: string | null
  interests: string[]
  jobLevel: string | null
  memberships: { company_id: string; is_manager: boolean }[]
  tenantId: string | null
}

export function matchesAudience(
  a: Audience | null | undefined,
  ctx: AudienceContext,
): boolean {
  if (!a || Object.keys(a).length === 0) return true

  const isLoggedIn = !!ctx.userId

  if (a.logged_in === true && !isLoggedIn) return false
  if (a.logged_in === false && isLoggedIn) return false

  if (typeof a.company_id === 'string' && a.company_id) {
    const matched = ctx.memberships.some((m) => m.company_id === a.company_id)
    if (!matched) return false
  }

  if (a.is_company_member === true && ctx.memberships.length === 0) return false
  if (a.is_company_member === false && ctx.memberships.length > 0) return false

  if (a.is_company_manager === true) {
    const isAnyMgr = ctx.memberships.some((m) => m.is_manager)
    if (!isAnyMgr) return false
  }

  if (Array.isArray(a.roles) && a.roles.length > 0) {
    if (!ctx.role || !a.roles.includes(ctx.role)) return false
  }

  if (Array.isArray(a.interests_any) && a.interests_any.length > 0) {
    const hit = a.interests_any.some((tag) => ctx.interests.includes(tag))
    if (!hit) return false
  }

  if (Array.isArray(a.job_levels) && a.job_levels.length > 0) {
    if (!ctx.jobLevel || !a.job_levels.includes(ctx.jobLevel)) return false
  }

  return true
}
