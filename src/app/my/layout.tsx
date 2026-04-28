import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import type { Profile } from '@/types/database'

export default async function MyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 미리보기 learn 페이지는 비로그인 접근 허용
  const pathname = headers().get('x-pathname') ?? ''
  const isLearnPage = /^\/my\/courses\/[^/]+\/learn/.test(pathname)

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isLearnPage) {
    redirect(`/login?redirectTo=${pathname || '/my'}`)
  }

  // 비로그인 미리보기 접근: Header/Footer 없이 children만 렌더
  if (!user) {
    return <>{children}</>
  }

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as Profile | null

  if (!profile || !profile.is_active) {
    redirect('/login')
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header profile={profile} />
      <main className="flex-1 bg-silver">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  )
}
