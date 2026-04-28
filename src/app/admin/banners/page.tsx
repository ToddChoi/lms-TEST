import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImageIcon } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '배너 관리' }

export default async function AdminBannersPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-6">배너 관리</h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center py-20 gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
          <ImageIcon className="h-8 w-8 text-gray-400" />
        </div>
        <div className="text-center">
          <p className="text-gray-700 font-medium">배너 관리 기능 준비 중</p>
          <p className="text-sm text-gray-400 mt-1">
            메인 홈의 배너 이미지 및 링크를 관리하는 기능이 곧 추가됩니다.
          </p>
        </div>
        <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700 max-w-sm text-center">
          현재 홈 화면의 배너는 사이트 설정에서 수정하거나,<br />
          개발자에게 직접 요청해 주세요.
        </div>
      </div>
    </div>
  )
}
