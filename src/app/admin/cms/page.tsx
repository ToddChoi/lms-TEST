import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import HomeSectionManager, { type HomeSection } from '@/components/admin/HomeSectionManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '홈 섹션 관리' }

export default async function AdminCmsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawSections } = await supabase
    .from('home_sections')
    .select('*')
    .order('sort_order')
  const sections = rawSections as unknown as HomeSection[] | null

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">홈 섹션 관리</h1>
        <p className="text-sm text-gray-500 mt-1">메인 홈 페이지에 노출되는 섹션의 내용과 표시 여부를 관리합니다.</p>
      </div>

      {(!sections || sections.length === 0) ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-gray-500 font-medium">섹션 데이터가 없습니다</p>
          <p className="text-sm text-gray-400 max-w-sm">
            먼저 <code className="bg-gray-100 px-1 rounded">supabase/migration_cms.sql</code>을 Supabase SQL Editor에서 실행해주세요.
          </p>
        </div>
      ) : (
        <HomeSectionManager initialSections={sections} />
      )}
    </div>
  )
}
