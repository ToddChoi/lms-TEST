import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { CourseEditTabs } from '@/components/admin/CourseEditTabs'
import Link from 'next/link'
import type { Metadata } from 'next'
import type { Section } from '@/components/admin/SectionManager'

interface Props { params: { id: string } }

export const metadata: Metadata = { title: '강좌 편집' }

export default async function EditCoursePage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const [
    { data: rawCourse },
    { data: categories },
    { data: rawSections },
  ] = await Promise.all([
    supabase.from('courses').select('*').eq('id', params.id).single(),
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    supabase
      .from('sections')
      .select('id, title, sort_order, lessons(id, title, video_url, duration, is_preview, sort_order)')
      .eq('course_id', params.id)
      .order('sort_order', { ascending: true }),
  ])

  const course = rawCourse as unknown as Record<string, any> | null
  if (!course) notFound()

  const sectionsRaw = rawSections as unknown as {
    id: string; title: string; sort_order: number
    lessons: { id: string; title: string; video_url: string | null; duration: number; is_preview: boolean; sort_order: number }[]
  }[] | null

  const sections: Section[] = (sectionsRaw ?? []).map((s) => ({
    ...s,
    lessons: [...(s.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))

  return (
    <div className="p-8">
      {/* 브레드크럼 */}
      <div className="flex items-center gap-2 mb-5 text-sm text-gray-400">
        <Link href="/admin/courses" className="hover:text-gray-600 transition">강좌 관리</Link>
        <span>/</span>
        <span className="text-[#0B1F3A] font-medium truncate max-w-xs">{course.title}</span>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">강좌 편집</h1>
        <p className="mt-1 text-sm text-gray-400">기본 정보, 커리큘럼, 상세 정보를 탭으로 관리하세요.</p>
      </div>

      <CourseEditTabs
        course={course}
        categories={categories ?? []}
        sections={sections}
      />
    </div>
  )
}
