'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, User, LogOut, Settings, BookOpen } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import type { Profile, NavLink } from '@/types/database'
import { HeaderSearch } from './HeaderSearch'

interface HeaderProps {
  profile: Profile | null
  navLinks?: NavLink[]
}

const DEFAULT_NAV: NavLink[] = [
  { id: 'default-0', label: '강좌', href: '/courses', target: '_self' },
  { id: 'default-1', label: '공지사항', href: '/notice', target: '_self' },
  { id: 'default-2', label: 'FAQ', href: '/faq', target: '_self' },
  { id: 'default-3', label: '기업 도입', href: '/b2b', target: '_self' },
  { id: 'default-4', label: '문의하기', href: '/contact', target: '_self' },
]

export function Header({ profile, navLinks }: HeaderProps) {
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const links = navLinks && navLinks.length > 0 ? navLinks : DEFAULT_NAV

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* 로고 */}
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy">
            <BookOpen className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-navy">Ingrow LMS</span>
        </Link>

        {/* 데스크탑 내비게이션 */}
        <nav className="hidden items-center gap-6 md:flex">
          {links.map((link) => (
            <Link
              key={link.id}
              href={link.href}
              target={link.target !== '_self' ? link.target : undefined}
              rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
              className="text-sm font-medium text-gray-600 transition-colors hover:text-navy"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* 데스크탑 검색바 */}
        <div className="hidden lg:block w-72">
          <HeaderSearch />
        </div>

        {/* 우측 버튼 영역 */}
        <div className="flex items-center gap-3">
          {profile ? (
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-navy hover:bg-silver"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent-pale">
                  <User className="h-4 w-4 text-accent" />
                </div>
                <span className="hidden sm:block">{profile.name}</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-10 z-50 w-48 rounded-xl border border-gray-100 bg-white shadow-lg">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-sm font-medium text-navy">{profile.name}</p>
                    <p className="text-xs text-gray-500">{profile.email}</p>
                  </div>
                  <div className="py-1">
                    <Link
                      href="/my"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-silver"
                    >
                      <BookOpen className="h-4 w-4" /> 내 강의실
                    </Link>
                    <Link
                      href="/my/profile"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-silver"
                    >
                      <Settings className="h-4 w-4" /> 프로필 설정
                    </Link>
                    {['admin', 'superadmin'].includes(profile.role) && (
                      <Link
                        href="/admin"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-silver"
                      >
                        <Settings className="h-4 w-4" /> 관리자
                      </Link>
                    )}
                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> 로그아웃
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login">
                <Button variant="ghost" size="sm">로그인</Button>
              </Link>
              <Link href="/register">
                <Button size="sm">회원가입</Button>
              </Link>
            </div>
          )}

          {/* 모바일 메뉴 버튼 */}
          <button
            className="rounded-lg p-2 hover:bg-silver md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-4 pb-4 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {links.map((link) => (
              <Link
                key={link.id}
                href={link.href}
                target={link.target !== '_self' ? link.target : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-silver'
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  )
}
