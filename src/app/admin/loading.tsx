import { Loader2 } from 'lucide-react'

/**
 * admin segment 의 loading UI.
 * sidebar 가 layout.tsx 에 있어 본문만 fallback.
 */
export default function AdminLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-400">
      <Loader2 className="h-7 w-7 animate-spin text-accent" />
      <p className="text-sm">불러오는 중...</p>
    </div>
  )
}
