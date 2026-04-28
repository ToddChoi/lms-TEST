import Link from 'next/link'
import { BookOpen } from 'lucide-react'
import type { NavLink } from '@/types/database'

interface FooterProps {
  serviceLinks?: NavLink[]
  supportLinks?: NavLink[]
  copyright?: string
}

const DEFAULT_SERVICE: NavLink[] = [
  { id: 0, label: '강좌 목록', href: '/courses', target: '_self' },
  { id: 1, label: '기업 도입', href: '/b2b', target: '_self' },
  { id: 2, label: '공지사항', href: '/notice', target: '_self' },
  { id: 3, label: 'FAQ', href: '/faq', target: '_self' },
]

const DEFAULT_SUPPORT: NavLink[] = [
  { id: 0, label: '이용문의', href: '/contact', target: '_self' },
  { id: 1, label: '마이페이지', href: '/my', target: '_self' },
  { id: 2, label: '수료증', href: '/my/certificates', target: '_self' },
]

export function Footer({ serviceLinks, supportLinks, copyright }: FooterProps) {
  const sLinks = serviceLinks && serviceLinks.length > 0 ? serviceLinks : DEFAULT_SERVICE
  const supLinks = supportLinks && supportLinks.length > 0 ? supportLinks : DEFAULT_SUPPORT
  const copyrightText = copyright || `${new Date().getFullYear()} Ingrow LMS. All rights reserved.`

  return (
    <footer className="border-t border-gray-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {/* 브랜드 */}
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-navy">
                <BookOpen className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-bold text-navy">Ingrow LMS</span>
            </Link>
            <p className="mt-3 text-sm text-gray-500">
              AI·실무 역량 강화를 위한 이러닝 플랫폼.
              <br />
              기업과 개인 모두를 위한 맞춤형 학습 경험을 제공합니다.
            </p>
          </div>

          {/* 서비스 링크 */}
          <div>
            <h3 className="text-sm font-semibold text-navy">서비스</h3>
            <ul className="mt-3 space-y-2">
              {sLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    target={link.target !== '_self' ? link.target : undefined}
                    rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                    className="text-sm text-gray-500 hover:text-navy"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* 고객지원 */}
          <div>
            <h3 className="text-sm font-semibold text-navy">고객지원</h3>
            <ul className="mt-3 space-y-2">
              {supLinks.map((link) => (
                <li key={link.id}>
                  <Link
                    href={link.href}
                    target={link.target !== '_self' ? link.target : undefined}
                    rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                    className="text-sm text-gray-500 hover:text-navy"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-gray-100 pt-6">
          <p className="text-xs text-gray-400">
            © {copyrightText}
          </p>
        </div>
      </div>
    </footer>
  )
}
