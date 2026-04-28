import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

function makeAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { name, email, subject, message } = body as {
    name: string; email: string; subject?: string; message: string
  }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: '필수 항목이 누락됐습니다.' }, { status: 400 })
  }

  // 로그인 유저면 user_id도 저장
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // DB 스키마: title(제목), content(내용), user_id
  // name/email을 content 상단에 포함
  const title = subject?.trim() || '이용문의'
  const content = `[이름] ${name.trim()}\n[이메일] ${email.trim()}\n\n${message.trim()}`

  const admin = makeAdminClient() as any
  const { error } = await admin
    .from('contacts')
    .insert({
      title,
      content,
      user_id: user?.id ?? null,
      status: 'pending',
    })

  if (error) {
    console.error('contacts insert error:', error)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
