'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Props {
  href: string
  label: string
  icon: React.ReactNode
  exact?: boolean
}

export function AdminNavLink({ href, label, icon, exact }: Props) {
  const pathname = usePathname()
  const isActive = exact ? pathname === href : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? 'bg-accent/10 text-accent'
          : 'text-gray-600 hover:bg-silver hover:text-navy'
      }`}
    >
      <span className={`h-4 w-4 shrink-0 ${isActive ? 'text-accent' : ''}`}>
        {icon}
      </span>
      {label}
    </Link>
  )
}
