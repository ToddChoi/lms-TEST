import type { Metadata } from 'next'
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
