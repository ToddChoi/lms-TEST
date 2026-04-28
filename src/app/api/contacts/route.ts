import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

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

  const admin = makeAdminClient()
  const { error } = await (admin as any)
    .from('contacts')
    .insert({ name: name.trim(), email: email.trim(), subject: subject?.trim() ?? '', message: message.trim() })

  if (error) {
    console.error('contacts insert error:', error)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
