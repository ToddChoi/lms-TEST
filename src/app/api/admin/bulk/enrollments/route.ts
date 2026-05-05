import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_guard'

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

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

  let notFound = 0
  const targets: { user_id: string; course_id: string; status: string }[] = []
  for (const email of emails) {
    const uid = emailToId.get(email)
    if (!uid) { notFound++; continue }
    targets.push({ user_id: uid, course_id, status: 'active' })
  }

  // race-safe batch upsert — 한 건의 race 가 batch 전체를 깨지 않음.
  // 이전 버전은 per-row insert 루프 + 일부만 성공한 부분 상태가 가능했음.
  let upsertError: string | null = null
  if (targets.length > 0) {
    const { error } = await (supabase as any)
      .from('enrollments')
      .upsert(targets, { onConflict: 'user_id,course_id', ignoreDuplicates: true })
    if (error) upsertError = error.message
  }

  const success = targets.filter((t) => !existingUserIds.has(t.user_id)).length
  const skipped = targets.length - success

  return NextResponse.json({
    success: upsertError ? 0 : success,
    skipped,
    notFound,
    error: upsertError,
  })
}
