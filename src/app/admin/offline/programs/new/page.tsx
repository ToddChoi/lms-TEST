import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { ProgramForm } from '@/components/admin/offline/ProgramForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '오프라인 프로그램 추가' }

export default async function NewOfflineProgramPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawCategories } = await supabase
    .from('categories').select('id, name').eq('is_active', true).order('sort_order')
  const categories = (rawCategories as unknown as { id: string; name: string }[] | null) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/offline/programs"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> 프로그램 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">프로그램 추가</h1>
      </div>
      <ProgramForm categories={categories} />
    </div>
  )
}
