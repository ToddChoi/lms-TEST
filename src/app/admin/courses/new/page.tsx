import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CourseForm } from '@/components/courses/CourseForm'
import type { Metadata } from 'next'
import type { Category } from '@/types/database'

export const metadata: Metadata = { title: '강좌 추가' }

export default async function NewCoursePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as { role: string } | null

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    redirect('/')
  }

  const { data: rawCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
  const categories = rawCategories as unknown as Category[] | null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">강좌 추가</h1>
        <p className="mt-1 text-sm text-gray-500">새 강좌를 등록합니다</p>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <CourseForm categories={categories ?? []} mode="create" />
      </div>
    </div>
  )
}
