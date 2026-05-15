import { Loader2 } from 'lucide-react'

/**
 * my (마이페이지) segment loading UI.
 * 학습 통계 / 강의 목록 fetch 중 sidebar 유지하면서 본문만 fallback.
 */
export default function MyLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-400">
      <Loader2 className="h-7 w-7 animate-spin text-accent" />
      <p className="text-sm">불러오는 중...</p>
    </div>
  )
}
