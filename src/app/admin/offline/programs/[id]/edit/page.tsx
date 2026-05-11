import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Calendar } from 'lucide-react'
import { ProgramForm } from '@/components/admin/offline/ProgramForm'
import type { OfflineProgram } from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '오프라인 프로그램 편집' }

export default async function EditOfflineProgramPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawProgram } = await supabase
    .from('offline_programs')
    .select('*')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()
  const program = rawProgram as unknown as OfflineProgram | null
  if (!program) notFound()

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
        <div className="mt-2 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">{program.title}</h1>
            <p className="text-xs text-gray-400 font-mono">/{program.slug}</p>
          </div>
          <Link
            href={`/admin/offline/programs/${program.id}/sessions`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-accent/40 bg-accent-pale px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white transition"
          >
            <Calendar className="h-4 w-4" /> 회차 관리
          </Link>
        </div>
      </div>
      <ProgramForm initial={program} categories={categories} />
    </div>
  )
}
