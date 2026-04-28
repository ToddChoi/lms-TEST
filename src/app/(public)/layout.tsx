import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { createClient } from '@/lib/supabase/server'
import type { Profile } from '@/types/database'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  let profile: Profile | null = null

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
  } catch {
    // 인증 오류 시 비로그인 상태로 렌더링
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header profile={profile} />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  )
}
