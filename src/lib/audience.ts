/**
 * audience 컨텍스트 빌더 (서버 전용).
 *
 * 순수 함수 (타입 + matchesAudience) 는 audience-eval.ts 에 분리 — 단위 테스트 가능.
 * 이 파일은 React/Next/Supabase 의존성 가지는 부분만.
 */

import { createClient } from '@/lib/supabase/server'
import { getTenant } from '@/lib/tenant'
import {
  type Audience,
  type AudienceContext,
  matchesAudience,
} from './audience-eval'

// re-export — 다른 모듈은 lib/audience 만 import 하면 됨.
export { type Audience, type AudienceContext, matchesAudience }

/**
 * 한 요청의 audience 컨텍스트를 1회 fetch 후 반환.
 * SurfaceBlocks 등 호출자가 한 번만 만들고 매 블록마다 matchesAudience 로 평가.
 */
export async function buildAudienceContext(): Promise<AudienceContext> {
  const supabase = createClient()

  const [{ data: userRes }, tenant] = await Promise.all([
    supabase.auth.getUser(),
    getTenant().catch(() => null),
  ])
  const userId = userRes?.user?.id ?? null
  const tenantId = tenant?.id ?? null

  if (!userId) {
    return { userId: null, role: null, interests: [], jobLevel: null, memberships: [], tenantId }
  }

  const [{ data: rawProfile }, { data: rawMembers }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, interests, job_level')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('company_members')
      .select('company_id, is_manager')
      .eq('user_id', userId),
  ])

  const profile = rawProfile as unknown as {
    role: string | null
    interests: string[] | null
    job_level: string | null
  } | null

  const memberships =
    ((rawMembers as unknown as { company_id: string; is_manager: boolean }[] | null) ?? [])
      .filter((m) => !!m.company_id)

  return {
    userId,
    role: profile?.role ?? null,
    interests: profile?.interests ?? [],
    jobLevel: profile?.job_level ?? null,
    memberships,
    tenantId,
  }
}
