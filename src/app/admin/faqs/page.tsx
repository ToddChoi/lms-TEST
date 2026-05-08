import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FaqManager, { type Faq } from '@/components/admin/FaqManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FAQ 관리' }

export default async function AdminFaqsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawFaqs } = await supabase
    .from('faqs')
    .select('id, question, answer, category, sort_order, is_active, created_at')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: false })
  const faqs = rawFaqs as unknown as Faq[] | null

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">FAQ 관리</h1>
        <span className="text-sm text-gray-500">{(faqs ?? []).length}건</span>
      </div>
      <FaqManager initialFaqs={faqs ?? []} />
    </div>
  )
}
