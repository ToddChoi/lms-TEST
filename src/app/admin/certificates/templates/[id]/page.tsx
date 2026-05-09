import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CertTemplateEditor } from '@/components/admin/CertTemplateEditor'
import type { Metadata } from 'next'
import type { CertificateTemplate } from '@/types/database'

export const metadata: Metadata = { title: '수료증 템플릿 편집' }

interface Props { params: { id: string } }

export default async function CertTemplateEditPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  // 'new' = 신규 템플릿 모드 — 빈 캔버스가 아닌 '기본 템플릿 복제' 로 시작.
  // 운영자가 처음부터 모든 element 만들 필요 없이 기본 17 element 위에서 수정해 자기 버전 제작.
  const isNew = params.id === 'new'
  let initial: CertificateTemplate | null = null

  if (isNew) {
    const { data } = await supabase
      .from('certificate_templates').select('*')
      .eq('is_default', true).eq('scope_type', 'global')
      .maybeSingle()
    const defaultRow = data as unknown as CertificateTemplate | null
    if (defaultRow) {
      // 복제 — 이름 비우고 is_default 끔. id 는 mode='create' 라 안 쓰임 (POST).
      initial = {
        ...defaultRow,
        name: '',
        description: defaultRow.description ? `${defaultRow.description} (복제)` : null,
        is_default: false,
      }
    }
    // 기본 템플릿 자체가 없는 환경 → null fallback (빈 캔버스, 처음 시드 전 안전망)
  } else {
    const { data } = await supabase
      .from('certificate_templates').select('*').eq('id', params.id).maybeSingle()
    initial = (data as unknown as CertificateTemplate | null) ?? null
    if (!initial) notFound()
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <CertTemplateEditor mode={isNew ? 'create' : 'edit'} initial={initial} />
    </div>
  )
}
