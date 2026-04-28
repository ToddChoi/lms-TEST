import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import SectionManager, { type Section } from '@/components/admin/SectionManager'

export default async function CourseSectionsPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawCourse } = await supabase
    .from('courses')
    .select('id, title, is_published')
    .eq('id', params.id)
    .single()
  const course = rawCourse as unknown as { id: string; title: string; is_published: boolean } | null
  if (!course) notFound()

  const { data: rawSections } = await supabase
    .from('sections')
    .select('id, title, sort_order, lessons(id, title, video_url, duration, is_preview, sort_order)')
    .eq('course_id', params.id)
    .order('sort_order', { ascending: true })
  const sectionsRaw = rawSections as unknown as {
    id: string
    title: string
    sort_order: number
    lessons: {
      id: string
      title: string
      video_url: string | null
      duration: number
      is_preview: boolean
      sort_order: number
    }[]
  }[] | null

  const sections: Section[] = (sectionsRaw ?? []).map((s) => ({
    ...s,
    lessons: [...(s.lessons ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  }))

  return (
    <div className="p-8">
      <div className="flex items-center gap-4 mb-2">
        <Link href="/admin/courses" className="text-gray-400 hover:text-gray-600 transition text-sm">
          ← 강좌 목록
        </Link>
        <Link href={`/admin/courses/${params.id}/edit`} className="text-gray-400 hover:text-gray-600 transition text-sm">
          강좌 편집
        </Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#0B1F3A]">섹션 / 강의 관리</h1>
          <p className="text-gray-500 mt-1 text-sm">{course.title}</p>
        </div>
        <span
          className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
            course.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
          }`}
        >
          {course.is_published ? '공개' : '비공개'}
        </span>
      </div>

      <SectionManager courseId={params.id} initialSections={sections} />
    </div>
  )
}
