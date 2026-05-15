import { Loader2 } from 'lucide-react'

export default function OrgLoading() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-gray-400">
      <Loader2 className="h-7 w-7 animate-spin text-accent" />
      <p className="text-sm">불러오는 중...</p>
    </div>
  )
}
