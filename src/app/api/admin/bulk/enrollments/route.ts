import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
  const { course_id, emails } = body as { course_id?: string; emails?: string[] }
  if (!course_id || !Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: 'course_id와 emails 배열이 필요합니다.' }, { status: 400 })
  }

  // Look up profiles by email
  const { data: rawProfiles } = await supabase
    .from('profiles')
    .select('id, email')
    .in('email', emails)
  const profiles = rawProfiles as unknown as { id: string; email: string }[] | null

  const emailToId = new Map<string, string>()
  ;(profiles ?? []).forEach((p) => {
    if (p.email) emailToId.set(p.email, p.id)
  })

  // Existing enrollments to detect duplicates
  const foundIds = Array.from(emailToId.values())
  let existingUserIds = new Set<string>()
  if (foundIds.length > 0) {
    const { data: rawExisting } = await supabase
      .from('enrollments')
      .select('user_id')
      .eq('course_id', course_id)
      .in('user_id', foundIds)
    const existing = rawExisting as unknown as { user_id: string }[] | null
    existingUserIds = new Set((existing ?? []).map((e) => e.user_id))
  }

  let success = 0
  let skipped = 0
  let notFound = 0

  for (const email of emails) {
    const uid = emailToId.get(email)
    if (!uid) {
      notFound++
      continue
    }
    if (existingUserIds.has(uid)) {
      skipped++
      continue
    }
    const { error } = await (supabase as any)
      .from('enrollments')
      .insert({ user_id: uid, course_id, status: 'active' })
    if (error) {
      skipped++
    } else {
      success++
      existingUserIds.add(uid)
    }
  }

  return NextResponse.json({ success, skipped, notFound })
}
