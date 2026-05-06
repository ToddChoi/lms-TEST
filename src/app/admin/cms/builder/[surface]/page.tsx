/**
 * /admin/cms/builder/[surface]
 *  - "home"  → home 페이지 빌더
 *  - "b2b"   → B2B 랜딩 빌더
 *
 * scope:
 *  - 기본 'global' — 모든 사용자가 보는 페이지 (대다수의 운영 케이스)
 *  - ?scope=company&company={id} — 그 회사 subdomain 진입 시 노출되는 회사 전용 블록 편집.
 *    현재 진입점 없음 (도메인 셋업 후 협약기업 화면에서 진입 가능 예정).
 *
 * scope 분리 이유: 운영자가 '페이지 빌더 (홈)' 메뉴 클릭 시 default 홈만 보여
 * 회사 전용 블록과 혼동되지 않게 함. 회사 전용은 회사 컨텍스트에서 명시 진입.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageBuilder } from '@/components/admin/PageBuilder'

interface Props {
  params: { surface: string }
  searchParams: { scope?: string; company?: string }
}

const SURFACE_LABEL: Record<string, string> = {
  home: '홈 페이지',
  b2b:  'B2B 랜딩 페이지',
}

export default async function CmsBuilderPage({ params, searchParams }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/admin/cms/builder/' + params.surface)

  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    redirect('/')
  }

  const surface = params.surface
  const label = SURFACE_LABEL[surface] ?? surface

  // scope 결정 — query 로 명시한 경우만 'company'. 기본 global.
  const scope: 'global' | 'company' =
    searchParams.scope === 'company' && searchParams.company ? 'company' : 'global'
  const companyId = scope === 'company' ? searchParams.company : undefined

  // scope=company 인 경우 회사 정보 fetch — 헤더에 회사명 표시 (혼동 방지)
  let companyLabel: string | undefined
  if (scope === 'company' && companyId) {
    const { data } = await supabase
      .from('companies').select('name').eq('id', companyId).maybeSingle()
    const co = data as unknown as { name: string } | null
    companyLabel = co?.name
  }

  const finalLabel =
    scope === 'company' && companyLabel
      ? `${label} (${companyLabel} 전용)`
      : label

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageBuilder
        surface={surface}
        surfaceLabel={finalLabel}
        scope={scope}
        companyId={companyId}
      />
    </div>
  )
}
