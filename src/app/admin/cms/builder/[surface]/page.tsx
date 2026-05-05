/**
 * /admin/cms/builder/[surface]
 *  - "home"  → home 페이지 빌더
 *  - "b2b"   → B2B 랜딩 빌더
 *  - "company-{id}-home" → 회사 전용 (P3)
 *
 * 각 surface 별로 독립된 블록 시퀀스 관리.
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PageBuilder } from '@/components/admin/PageBuilder'

interface Props {
  params: { surface: string }
}

const SURFACE_LABEL: Record<string, string> = {
  home: '홈 페이지',
  b2b:  'B2B 랜딩 페이지',
}

export default async function CmsBuilderPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/admin/cms/builder/' + params.surface)

  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    redirect('/')
  }

  // surface slug 정규화 — URL 의 'b2b' 가 그대로 content_blocks.surface 와 매핑.
  // 회사 전용은 'company-{uuid}-home' 형식 — params 는 dash-hyphen 일 수 있으니 그대로 사용.
  const surface = params.surface
  const label = SURFACE_LABEL[surface] ?? surface

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <PageBuilder surface={surface} surfaceLabel={label} />
    </div>
  )
}
