import { Loader2 } from 'lucide-react'

/**
 * (public) route group 의 segment-level loading UI.
 * 강좌 목록 / 상세 / B2B 등 공개 페이지가 server fetch 중일 때 표시.
 */
export default function PublicLoading() {
  return (
    <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-gray-400">
        <Loader2 className="h-7 w-7 animate-spin text-accent" />
        <p className="text-sm">불러오는 중...</p>
      </div>
    </div>
  )
}
