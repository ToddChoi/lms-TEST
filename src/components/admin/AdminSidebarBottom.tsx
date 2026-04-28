'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Home } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  name: string
  role: string
}

export function AdminSidebarBottom({ name, role }: Props) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="border-t border-gray-100 p-4 space-y-2">
      {/* 메인페이지 이동 */}
      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:text-navy transition-colors"
      >
        <Home className="h-4 w-4 shrink-0" />
        메인페이지로 이동
      </Link>

      {/* 사용자 정보 + 로그아웃 */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-pale text-xs font-bold text-accent shrink-0">
          {name?.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-navy">{name}</p>
          <p className="text-xs text-gray-400">{role}</p>
        </div>
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
          title="로그아웃"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
