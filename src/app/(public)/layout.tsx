import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import type { Profile, NavLink } from '@/types/database'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let profile: Profile | null = null
  let headerLinks: NavLink[] = []
  let serviceLinks: NavLink[] = []
  let supportLinks: NavLink[] = []
  let copyright: string | undefined

  try {
    const supabase = createClient()
    const authRes = await supabase.auth.getUser()
    const user = authRes.data?.user ?? null

    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      profile = data as Profile | null
    }

    // 메뉴 가져오기 (header + footer)
    const { data: rawMenus } = await supabase
      .from('menus')
      .select('id, label, href, target, menu_type, sort_order')
      .eq('is_active', true)
      .order('sort_order')

    if (rawMenus) {
      const menus = rawMenus as unknown as {
        id: number
        label: string
        href: string
        target: string
        menu_type: string
        sort_order: number
      }[]

      headerLinks = menus
        .filter((m) => m.menu_type === 'header')
        .map((m) => ({ id: m.id, label: m.label, href: m.href, target: m.target ?? '_self' }))

      const footerMenus = menus.filter((m) => m.menu_type === 'footer')
      // footer 메뉴 앞 4개 = 서비스, 뒤 3개 = 고객지원 (sort_order 기준)
      serviceLinks = footerMenus.slice(0, 4).map((m) => ({
        id: m.id, label: m.label, href: m.href, target: m.target ?? '_self',
      }))
      supportLinks = footerMenus.slice(4).map((m) => ({
        id: m.id, label: m.label, href: m.href, target: m.target ?? '_self',
      }))
    }

    // 저작권 문구 가져오기
    const { data: rawCopyright } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'footer_copyright')
      .single()
    copyright = (rawCopyright as any)?.value ?? undefined

  } catch {
    // 오류 시 기본값 사용 (비로그인 상태로 렌더링)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header profile={profile} navLinks={headerLinks} />
      <main className="flex-1">{children}</main>
      <Footer serviceLinks={serviceLinks} supportLinks={supportLinks} copyright={copyright} />
    </div>
  )
}
