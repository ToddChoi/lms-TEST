import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { Database } from '@/types/database'
import { autoMatchCompanyByEmail } from '@/lib/tenant-auto-match'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/my'

  if (code) {
    const cookieStore = cookies()
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // 서버 컴포넌트에서는 무시
            }
          },
        },
      }
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // ★ Phase 4 — 신규 가입자(또는 이메일 확인 사용자)에게 도메인 자동 매칭 시도.
      //   이미 멤버인 경우 skip 됨 (수동 매핑 보존). 실패해도 가입 흐름엔 영향 없음.
      try {
        const { data } = await supabase.auth.getUser()
        const user = data?.user
        if (user?.email) {
          const result = await autoMatchCompanyByEmail(user.id, user.email)
          if (result.matched) {
            console.log(
              `[auth/callback] auto-matched ${user.email} → ${result.companyName} (${result.companyId})`
            )
          }
        }
      } catch (e) {
        console.warn('[auth/callback] auto-match skipped:', e)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
