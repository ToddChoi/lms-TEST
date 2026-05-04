'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, BookOpen, GraduationCap, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Tab {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  match: (pathname: string) => boolean
}

const TABS: Tab[] = [
  { href: '/',          label: '홈',     icon: Home,          match: (p) => p === '/' },
  { href: '/courses',   label: '강좌',   icon: BookOpen,      match: (p) => p.startsWith('/courses') },
  { href: '/my',        label: '내 학습', icon: GraduationCap, match: (p) => p === '/my' || p.startsWith('/my/courses') },
  { href: '/my/profile', label: '마이',   icon: User,         match: (p) => p.startsWith('/my/profile') },
]

/** 학습 몰입을 위해 숨길 경로 */
const HIDE_ON: Array<(p: string) => boolean> = [
  (p) => /^\/my\/courses\/[^/]+\/learn/.test(p), // 학습 페이지
  (p) => p.startsWith('/admin'),
  (p) => p.startsWith('/instructor'),
  (p) => p.startsWith('/org'),
  (p) => p === '/login' || p === '/register' || p === '/forgot-password',
]

export function MobileBottomNav() {
  const pathname = usePathname() ?? '/'
  const hide = HIDE_ON.some((fn) => fn(pathname))
  if (hide) return null

  return (
    <>
      <nav
        aria-label="모바일 하단 네비게이션"
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.04)] md:hidden"
      >
        <ul className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map((tab) => {
            const active = tab.match(pathname)
            const Icon = tab.icon
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className={cn(
                    'flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition',
                    active ? 'text-accent' : 'text-gray-500 hover:text-navy'
                  )}
                >
                  <Icon className={cn('h-5 w-5', active && 'text-accent')} />
                  {tab.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      {/* 본문 끝부분이 탭에 가려지지 않게 여백 */}
      <div aria-hidden="true" className="h-14 md:hidden" />
    </>
  )
}
