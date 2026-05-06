import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { SurfaceBlocks } from '@/components/blocks/SurfaceBlocks'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Ingrow LMS — AI·실무 역량 강화 이러닝 플랫폼',
  description: '기업과 개인을 위한 맞춤형 AI·실무 교육 플랫폼. 최신 강좌로 성장하세요.',
}

export const revalidate = 60

/**
 * 홈 — Phase 5 풀 빌더.
 *
 * 콘텐츠는 모두 content_blocks 에서. 운영자는 /admin/cms/builder/home 에서 편집.
 * 회사 subdomain 진입 시 SurfaceBlocks 가 회사 전용 블록 우선 노출 (P4).
 *
 * 블록이 0개일 때 (시드 안 한 신규 환경, 운영자가 다 지운 경우) → fallback 화면.
 *   - 일반 사용자 : 강좌 목록 진입 안내
 *   - admin       : 빌더 진입 링크 + 시드 안내 (운영자가 즉시 채울 수 있게)
 */
export default async function HomePage() {
  const hasBlocks = await checkHomeBlocksExist()
  if (hasBlocks) {
    return (
      <div className="flex flex-col">
        <SurfaceBlocks surface="home" />
      </div>
    )
  }
  return <EmptyHomeFallback />
}

async function checkHomeBlocksExist(): Promise<boolean> {
  try {
    const supabase = createClient()
    const { count } = await supabase
      .from('content_blocks')
      .select('*', { count: 'exact', head: true })
      .eq('surface', 'home')
      .eq('status', 'published')
    return (count ?? 0) > 0
  } catch {
    return false
  }
}

async function EmptyHomeFallback() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: rawProfile } = await supabase
      .from('profiles').select('role').eq('id', user.id).maybeSingle()
    const profile = rawProfile as unknown as { role: string } | null
    isAdmin = !!profile && ['admin', 'superadmin'].includes(profile.role)
  }

  return (
    <section className="flex min-h-[60vh] items-center justify-center bg-gradient-to-br from-navy via-navy-mid to-navy-light px-4 text-center text-white">
      <div className="max-w-2xl">
        <h1 className="text-h1">Ingrow LMS</h1>
        <p className="mt-4 text-body-lg text-white/80">
          AI·실무 역량 강화를 위한 이러닝 플랫폼
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/courses"
            className="rounded-md bg-accent px-6 py-3 text-body-sm font-semibold text-white transition-colors hover:bg-accent-light"
          >
            강좌 둘러보기
          </Link>
          {isAdmin && (
            <Link
              href="/admin/cms/builder/home"
              className="rounded-md border border-white/30 bg-white/10 px-6 py-3 text-body-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              홈 페이지 빌더 →
            </Link>
          )}
        </div>

        {isAdmin && (
          <p className="mt-8 text-caption text-white/60">
            관리자 안내: content_blocks 의 surface=&apos;home&apos; 게시된 블록이 0개입니다.
            <br />
            빌더에서 추가하거나 supabase/migration_phase5_home_seed.sql 을 실행해 기본 5 블록을 시드하세요.
          </p>
        )}
      </div>
    </section>
  )
}
