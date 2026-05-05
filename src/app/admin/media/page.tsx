import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { MediaLibrary } from '@/components/admin/MediaLibrary'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '미디어 라이브러리' }

export default async function AdminMediaPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-h3 text-navy">미디어 라이브러리</h1>
        <p className="mt-1 text-body-sm text-gray-500">
          한 번 올린 이미지를 페이지 빌더의 모든 블록·강좌 썸네일에서 재사용할 수 있습니다.
        </p>
      </div>
      <MediaLibrary />
    </div>
  )
}
