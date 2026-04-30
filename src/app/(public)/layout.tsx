import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { MobileBottomNav } from '@/components/layout/MobileBottomNav'
import { createClient } from '@/lib/supabase/server'
import type { Profile, NavLink } from '@/types/database'

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  let profile: Profile | null = null
  let headerLinks: NavLink[] = []
  let serviceLinks: NavLink[] = []
  let supportLinks: NavLink[] = []
  let copyright: string | undefined

  try {
    const supabase = createClient()
    const user = (await supabase.auth.getUser()).data?.user ?? null

    if (user) {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      profile = data as Profile | null
    }

    // nav_menus 테이블에서 헤더/푸터 메뉴 가져오기
    const { data: rawMenus } = await supabase
      .from('nav_menus')
      .select('id, location, label, url, target, sort_order')
      .eq('is_visible', true)
      .order('sort_order')

    if (rawMenus) {
      const menus = rawMenus as unknown as {
        id: string; location: string; label: string; url: string; target: string; sort_order: number
      }[]

      headerLinks = menus
        .filter((m) => m.location === 'header')
        .map((m) => ({ id: m.id, label: m.label, href: m.url, target: m.target ?? '_self' }))

      const footerMenus = menus.filter((m) => m.location === 'footer')
      serviceLinks = footerMenus.slice(0, 4).map((m) => ({ id: m.id, label: m.label, href: m.url, target: m.target ?? '_self' }))
      supportLinks = footerMenus.slice(4).map((m) => ({ id: m.id, label: m.label, href: m.url, target: m.target ?? '_self' }))
    }

    // 저작권 문구: footer_text 키 우선, 없으면 footer_copyright (이전 키명 호환)
    const { data: rawSettings } = await supabase
      .from('site_settings')
      .select('key, value')
      .in('key', ['footer_text', 'footer_copyright'])
    const settings = rawSettings as unknown as { key: string; value: string }[] | null
    const settingsMap = Object.fromEntries((settings ?? []).map((s) => [s.key, s.value]))
    copyright = settingsMap.footer_text || settingsMap.footer_copyright || undefined

  } catch {
    // 오류 시 기본값으로 렌더링
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header profile={profile} navLinks={headerLinks} />
      <main className="flex-1">{children}</main>
      <Footer serviceLinks={serviceLinks} supportLinks={supportLinks} copyright={copyright} />
      <MobileBottomNav />
    </div>
  )
}
