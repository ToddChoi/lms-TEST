import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CategoryManager, { type Category } from '@/components/admin/CategoryManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '카테고리 관리' }

export default async function AdminCategoriesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawCategories } = await supabase
    .from('categories')
    .select('id, name, slug, description, icon, sort_order, is_visible')
    .order('sort_order', { ascending: true })
  const categories = (rawCategories as unknown as Category[] | null) ?? []

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A]">카테고리 관리</h1>
          <p className="text-sm text-gray-500 mt-1">강좌 분류 카테고리를 관리합니다.</p>
        </div>
        <span className="text-sm text-gray-500">{categories.length}개</span>
      </div>
      <CategoryManager initialCategories={categories} />
    </div>
  )
}
