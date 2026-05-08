import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ContactManager, { type Contact } from '@/components/admin/ContactManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '이용문의 관리' }

export default async function AdminContactsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawContacts } = await supabase
    .from('contacts')
    .select('id, user_id, title, content, status, answer, answered_at, created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  const contacts = rawContacts as unknown as Contact[] | null

  const pendingCount = (contacts ?? []).filter((c) => c.status === 'pending').length

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A]">이용문의 관리</h1>
          {pendingCount > 0 && (
            <p className="text-sm text-orange-600 mt-0.5">미답변 {pendingCount}건이 있습니다.</p>
          )}
        </div>
        <span className="text-sm text-gray-500">총 {(contacts ?? []).length}건</span>
      </div>
      <ContactManager initialContacts={contacts ?? []} />
    </div>
  )
}
