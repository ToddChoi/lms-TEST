import Link from 'next/link'
import { Home, BookOpen } from 'lucide-react'

export default function PublicNotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-6xl font-bold text-accent">404</p>
      <div>
        <h2 className="text-xl font-semibold text-navy">페이지를 찾을 수 없습니다</h2>
        <p className="mt-1 text-sm text-gray-500">
          주소가 잘못됐거나, 강좌가 비공개로 전환됐을 수 있습니다.
        </p>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light"
        >
          <Home className="h-4 w-4" /> 홈으로
        </Link>
        <Link
          href="/courses"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-5 py-2 text-sm text-gray-700 hover:border-accent hover:text-accent"
        >
          <BookOpen className="h-4 w-4" /> 강좌 둘러보기
        </Link>
      </div>
    </div>
  )
}
