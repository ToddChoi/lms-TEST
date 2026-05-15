import Link from 'next/link'
import { LayoutDashboard, FileQuestion } from 'lucide-react'

export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
        <FileQuestion className="h-7 w-7 text-gray-400" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-navy">관리자 페이지를 찾을 수 없습니다</h2>
        <p className="mt-1 max-w-md text-sm text-gray-500">
          삭제됐거나 잘못된 주소일 수 있습니다.
        </p>
      </div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light"
      >
        <LayoutDashboard className="h-4 w-4" /> 대시보드로
      </Link>
    </div>
  )
}
