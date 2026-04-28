import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BannerManager, { type Banner } from '@/components/admin/BannerManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '배너 관리' }

export default async function AdminBannersPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawBanners } = await supabase
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: true })
  const banners = rawBanners as unknown as Banner[] | null

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A]">배너 관리</h1>
          <p className="text-sm text-gray-500 mt-1">홈 화면에 노출할 배너를 관리합니다.</p>
        </div>
      </div>
      <BannerManager initialBanners={banners ?? []} />
    </div>
  )
}
