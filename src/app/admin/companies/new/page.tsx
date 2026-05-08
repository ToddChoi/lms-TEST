import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompanyForm } from '@/components/admin/CompanyForm'

export default async function NewCompanyPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-6">새 기업 등록</h1>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
        <CompanyForm mode="create" />
      </div>
    </div>
  )
}
