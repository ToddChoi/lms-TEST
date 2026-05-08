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

  // 'new' = 신규 템플릿 모드
  const isNew = params.id === 'new'
  let initial: CertificateTemplate | null = null

  if (!isNew) {
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
