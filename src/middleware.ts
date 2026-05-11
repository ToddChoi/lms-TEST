import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/database'

export async function middleware(request: NextRequest) {
  // 서버 컴포넌트가 headers() 로 읽을 수 있도록 request 헤더 복사 후 mutation.
  // tenant override (개발 ?tenant=acme) 같은 값을 여기에 주입.
  const requestHeaders = new Headers(request.headers)

  // tenant override — production host 기반 subdomain 외 개발/프리뷰 검증용.
  // host 매칭이 1순위이고, 이 헤더는 fallback (lib/tenant.ts 참고).
  const tenantQuery = request.nextUrl.searchParams.get('tenant')
  if (tenantQuery && /^[a-z0-9-]{2,32}$/i.test(tenantQuery)) {
    requestHeaders.set('x-tenant-override', tenantQuery.toLowerCase())
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: requestHeaders },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 세션 갱신 (필수 — 삭제하지 말 것)
  const authRes = await supabase.auth.getUser()
  const user = authRes.data?.user ?? null

  const { pathname } = request.nextUrl

  // 역할 기반 접근 제어
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/instructor') ||
    pathname.startsWith('/org/admin')
  ) {
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    // 역할 확인
    const { data: rawProfile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    const profile = rawProfile as unknown as { role: string } | null

    if (pathname.startsWith('/admin')) {
      if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    if (pathname.startsWith('/instructor')) {
      if (
        !profile ||
        !['instructor', 'admin', 'superadmin'].includes(profile.role)
      ) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }

    if (pathname.startsWith('/org/admin')) {
      if (
        !profile ||
        !['org_admin', 'admin', 'superadmin'].includes(profile.role)
      ) {
        return NextResponse.redirect(new URL('/', request.url))
      }
    }
  }

  // 마이페이지 — 로그인 필요
  // 단, /my/courses/[id]/learn 은 미리보기 레슨용으로 비로그인 허용 (페이지 내부에서 처리).
  // 정규식은 정확히 그 path 만 매치 — 끝에 '$' 마커로 prefix bypass 차단.
  // (예: /my/courses/foo/learn-bypass, /my/courses/foo/learn/extra 같은 변종)
  if (pathname.startsWith('/my')) {
    const isLearnPage = /^\/my\/courses\/[^/]+\/learn$/.test(pathname)
    if (!user && !isLearnPage) {
      return NextResponse.redirect(
        new URL(`/login?redirectTo=${pathname}`, request.url)
      )
    }
  }

  // 이미 로그인한 사용자가 로그인/회원가입 페이지 접근 시 리다이렉트
  if ((pathname === '/login' || pathname === '/register') && user) {
    return NextResponse.redirect(new URL('/my', request.url))
  }

  // layout에서 현재 경로를 읽을 수 있도록 헤더에 추가
  supabaseResponse.headers.set('x-pathname', pathname)

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * 아래 경로를 제외한 모든 요청에 미들웨어 적용:
     * - _next/static (정적 파일)
     * - _next/image (이미지 최적화)
     * - favicon.ico
     * - 공개 이미지 파일
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
