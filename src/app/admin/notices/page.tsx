import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import NoticeManager, { type Notice } from '@/components/admin/NoticeManager'

export default async function AdminNoticesPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawNotices } = await supabase
    .from('notices')
    .select('id, title, content, is_pinned, is_active, created_at')
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
  const notices = rawNotices as unknown as Notice[] | null

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">공지사항 관리</h1>
        <span className="text-sm text-gray-500">{(notices ?? []).length}건</span>
      </div>
      <NoticeManager initialNotices={notices ?? []} />
    </div>
  )
}
