import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// 타입 미부여 — Database 타입이 일부 라우트(categories 등)에서 strict 충돌을 일으켜
// 인라인 패턴과 동일하게 untyped 클라이언트 유지. 안전성은 RLS/role guard 가 담당.
export function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function requireAdmin() {
  return requireAnyRole(['admin', 'superadmin'])
}

/**
 * 일반화된 role guard — 호출자가 명시한 role 들 중 하나여야 통과.
 * 예: requireAnyRole(['admin', 'superadmin', 'org_admin'])
 *
 * 반환:
 *  - 실패: { guard: NextResponse(401|403), supabase: null, user: null, role: null }
 *  - 성공: { guard: null, supabase, user, role }
 *
 * 사용 측에서 user/role 활용 가능 (예: 회사 매니저가 자기 회사만 조회).
 */
export async function requireAnyRole(allowedRoles: string[]) {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return {
      guard: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      supabase: null,
      user: null,
      role: null,
    } as const
  }
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !allowedRoles.includes(profile.role)) {
    return {
      guard: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      supabase: null,
      user: null,
      role: null,
    } as const
  }
  return { guard: null, supabase, user, role: profile.role } as const
}
