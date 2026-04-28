import { createClient } from '@/lib/supabase/server'
import { Bell, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '공지사항' }
export const revalidate = 60

export default async function NoticePage() {
  const supabase = createClient()
  const { data: rawNotices } = await supabase
    .from('notices')
    .select('id, title, content, is_pinned, created_at')
    .eq('is_published', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50)

  type Notice = { id: string; title: string; content: string; is_pinned: boolean; created_at: string }
  const notices = rawNotices as unknown as Notice[] | null

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-pale">
          <Bell className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">공지사항</h1>
          <p className="text-sm text-gray-500">Ingrow LMS의 새소식을 확인하세요.</p>
        </div>
      </div>

      {notices && notices.length > 0 ? (
        <div className="flex flex-col divide-y divide-gray-100 rounded-2xl bg-white shadow-sm overflow-hidden">
          {notices.map((notice) => (
            <div key={notice.id} className="flex items-center gap-4 px-5 py-4 hover:bg-silver/50 transition">
              {notice.is_pinned && (
                <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-white">
                  공지
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-navy truncate">{notice.title}</p>
                <p className="mt-0.5 text-xs text-gray-400">{formatDate(notice.created_at)}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm">
          <Bell className="h-12 w-12 text-gray-200" />
          <p className="mt-4 text-gray-400">등록된 공지사항이 없습니다.</p>
        </div>
      )}
    </div>
  )
}
