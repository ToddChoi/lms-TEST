import { Loader2 } from 'lucide-react'

/**
 * (auth) route group 의 segment-level loading UI.
 * App Router 가 page.tsx 의 server component await 동안 자동 표시.
 */
export default function AuthLoading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-accent" />
    </div>
  )
}
