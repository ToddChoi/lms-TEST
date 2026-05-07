'use client'

/**
 * 모바일 admin 메뉴 — 햄버거 버튼 + 슬라이드 드로어.
 * md 이상에서는 자동 숨김 (데스크탑은 사이드바 사용).
 *
 * 라우트 변경 시 드로어 자동 닫힘 (pathname 변화 감지).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { AdminNavLink } from './AdminNavLink'
import { NAV_GROUPS } from './admin-nav'

export function AdminMobileNav() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  // 라우트 바뀌면 드로어 자동 닫힘 (사용자가 메뉴 클릭한 경우)
  useEffect(() => { setOpen(false) }, [pathname])

  // 드로어 열린 동안 body 스크롤 잠금
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [open])

  return (
    <>
      {/* 모바일 top bar — md 이상에선 숨김 */}
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-subtle bg-surface px-4 md:hidden">
        <Link href="/admin" className="flex items-center gap-2 text-navy">
          <Logo size="sm" />
          <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
            Admin
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="메뉴 열기"
          className="rounded-md p-2 text-gray-600 hover:bg-surface-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* 드로어 */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          {/* dim */}
          <button
            aria-label="메뉴 닫기"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          {/* drawer panel */}
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-elev-3">
            <div className="flex h-14 items-center justify-between border-b border-border-subtle px-4 text-navy">
              <div className="flex items-center gap-2">
                <Logo size="sm" />
                <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                  Admin
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="메뉴 닫기"
                className="rounded-md p-2 text-gray-600 hover:bg-surface-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4">
              {NAV_GROUPS.map((group, idx) => (
                <div key={group.label} className={idx > 0 ? 'mt-5' : ''}>
                  <div className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {group.items.map((item) => (
                      <AdminNavLink
                        key={item.href}
                        href={item.href}
                        label={item.label}
                        icon={<item.icon className="h-4 w-4" />}
                        exact={item.exact}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  )
}
