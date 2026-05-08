import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CmsMenuManager, { type CmsNavMenu } from '@/components/admin/CmsMenuManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '네비게이션 관리' }

export default async function AdminCmsMenusPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawMenus } = await supabase
    .from('nav_menus')
    .select('*')
    .order('location')
    .order('sort_order')
  const menus = (rawMenus as unknown as CmsNavMenu[] | null) ?? []

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">네비게이션 관리</h1>
        <p className="text-sm text-gray-500 mt-1">헤더와 푸터에 노출할 메뉴를 관리합니다. 변경 사항은 즉시 공개 페이지에 반영됩니다.</p>
      </div>
      <CmsMenuManager initialMenus={menus} />
    </div>
  )
}
