import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CmsSectionManager from '@/components/admin/CmsSectionManager'
import type { CmsHomeSection } from '@/components/admin/SectionConfigDrawer'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '홈페이지 관리' }

export default async function AdminCmsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawSections } = await supabase
    .from('home_sections')
    .select('id, type, label, title, subtitle, sort_order, is_visible, config')
    .order('sort_order')
  const sections = (rawSections as unknown as CmsHomeSection[] | null) ?? []

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">홈페이지 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          메인 홈 페이지 섹션 구조·콘텐츠를 관리합니다. 배너는 banner 타입 섹션의 [설정] 버튼에서 관리할 수 있습니다.
        </p>
      </div>
      <CmsSectionManager initialSections={sections} />
    </div>
  )
}
