import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MenuManager, { type Menu } from '@/components/admin/MenuManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '메뉴 관리' }

export default async function AdminMenusPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawMenus } = await supabase
    .from('menus')
    .select('*')
    .order('menu_type')
    .order('sort_order')
  const menus = rawMenus as unknown as Menu[] | null

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">메뉴 관리</h1>
        <p className="text-sm text-gray-500 mt-1">헤더와 푸터에 노출할 내비게이션 메뉴를 관리합니다.</p>
      </div>
      <MenuManager initialMenus={menus ?? []} />
    </div>
  )
}
