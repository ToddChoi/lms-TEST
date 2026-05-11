import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { SessionForm } from '@/components/admin/offline/SessionForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '회차 추가' }

export default async function NewSessionPage({
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

  // 프로그램 존재 확인
  const { data: rawProgram } = await supabase
    .from('offline_programs')
    .select('id, title')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()
  const program = rawProgram as unknown as { id: string; title: string } | null
  if (!program) notFound()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/offline/programs/${program.id}/sessions`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> 회차 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">회차 추가</h1>
        <p className="mt-1 text-sm text-gray-500">{program.title}</p>
      </div>
      <SessionForm programId={program.id} />
    </div>
  )
}
