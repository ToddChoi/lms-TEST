import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

function randomPassword(len = 12) {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let out = ''
  for (let i = 0; i < len; i++) {
    out += chars[Math.floor(Math.random() * chars.length)]
  }
  return out
}

export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { users } = body as {
    users?: {
      email: string
      name: string
      phone?: string
      company?: string
      department?: string
    }[]
  }
  if (!Array.isArray(users) || users.length === 0) {
    return NextResponse.json({ error: '유효한 사용자 목록이 필요합니다.' }, { status: 400 })
  }

  const admin = createAdminClient()
  let success = 0
  const failed: { email: string; reason: string }[] = []

  for (const u of users) {
    const email = (u.email ?? '').trim()
    const name = (u.name ?? '').trim()
    if (!email || !name) {
      failed.push({ email: email || '(빈 이메일)', reason: 'email/name 누락' })
      continue
    }

    try {
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomPassword(),
        email_confirm: true,
        user_metadata: { name },
      })

      if (createErr || !created?.user) {
        failed.push({ email, reason: createErr?.message ?? '사용자 생성 실패' })
        continue
      }

      const userId = created.user.id
      const updates: Record<string, unknown> = { name }
      if (u.phone) updates.phone = u.phone
      if (u.company) updates.company = u.company
      if (u.department) updates.department = u.department

      const { error: updErr } = await (admin as any)
        .from('profiles')
        .update(updates)
        .eq('id', userId)

      if (updErr) {
        failed.push({ email, reason: `프로필 업데이트 실패: ${updErr.message}` })
        continue
      }

      success++
    } catch (e: any) {
      failed.push({ email, reason: e?.message ?? '알 수 없는 오류' })
    }
  }

  return NextResponse.json({ success, failed })
}
