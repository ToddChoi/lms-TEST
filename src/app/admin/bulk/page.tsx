import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BulkUploader } from '@/components/admin/BulkUploader'

export default async function AdminBulkPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawCourses } = await supabase
    .from('courses')
    .select('id, title')
    .order('title', { ascending: true })
  const courses = rawCourses as unknown as { id: string; title: string }[] | null

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-[#0B1F3A] mb-2">일괄 업로드</h1>
      <p className="text-sm text-gray-500 mb-6">CSV 파일로 회원과 수강 신청을 일괄 등록합니다.</p>
      <BulkUploader courses={courses ?? []} />
    </div>
  )
}
