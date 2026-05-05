import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { getTenant } from '@/lib/tenant'
import './globals.css'

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000'
  ),
  title: {
    default: 'Ingrow LMS — AI·실무 이러닝 플랫폼',
    template: '%s | Ingrow LMS',
  },
  description:
    'AI·실무 역량 강화를 위한 이러닝 플랫폼. 다양한 강좌와 수료증을 제공합니다.',
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Ingrow LMS',
    title: 'Ingrow LMS — AI·실무 이러닝 플랫폼',
    description: 'AI·실무 역량 강화를 위한 이러닝 플랫폼.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ingrow LMS',
    description: 'AI·실무 이러닝 플랫폼',
  },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.ico' },
}

/** site_settings 의 primary_color (#RRGGBB) 를 RGB 3개 숫자로 변환 */
function hexToRgbTriplet(hex: string | null | undefined): string | null {
  if (!hex) return null
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i)
  if (!m) return null
  let h = m[1]
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r} ${g} ${b}`
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // primary_color 결정 — 회사(tenant) > 사이트 설정 > globals.css 디폴트.
  // 회사 subdomain 으로 접근 시 (예: acme.ingrow.com) 자동으로 해당 회사 컬러.
  let primaryRgb: string | null = null
  try {
    const tenant = await getTenant()
    const tenantColor = tenant?.primary_color ?? null
    if (tenantColor) {
      primaryRgb = hexToRgbTriplet(tenantColor)
    } else {
      const supabase = createClient()
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'primary_color')
        .maybeSingle()
      primaryRgb = hexToRgbTriplet((data as unknown as { value: string } | null)?.value)
    }
  } catch {
    // 비로그인 / DB 미연결 등 — 무시
  }

  return (
    <html lang="ko">
      <head>
        {primaryRgb && (
          <style
            // 사이트 설정에서 가져온 컬러를 CSS 변수로 root 에 주입
            // tailwind 의 bg-accent 등이 즉시 반영됨
            dangerouslySetInnerHTML={{
              __html: `:root { --color-primary-rgb: ${primaryRgb}; }`,
            }}
          />
        )}
      </head>
      <body>
        {/* 스크린 리더·키보드 사용자용 본문 바로가기 (Tab 키로 진입 시 표시) */}
        <a href="#main-content" className="skip-to-content">
          본문으로 건너뛰기
        </a>
        <div id="main-content">{children}</div>
      </body>
    </html>
  )
}
