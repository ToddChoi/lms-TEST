import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

// 호출자의 role 까지 함께 반환 — superadmin 권한 분리 (H2) 에 사용.
async function checkAdmin(supabase: ReturnType<typeof makeSupabase>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) return null
  return { user, role: profile.role as 'admin' | 'superadmin' }
}

// GET: return profile + enrollments with progress
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeSupabase()
  const adminInfo = await checkAdmin(supabase)
  if (!adminInfo) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('id, name, email, role, phone, company, department, is_active, created_at')
    .eq('id', params.id)
    .single()
  const profile = rawProfile as unknown as {
    id: string; name: string | null; email: string | null; role: string
    phone: string | null; company: string | null; department: string | null
    is_active: boolean; created_at: string
  } | null

  if (!profile) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: rawEnrollments } = await supabase
    .from('enrollments')
    .select('id, status, enrolled_at, expires_at, courses(id, title)')
    .eq('user_id', params.id)
    .order('enrolled_at', { ascending: false })
  const enrollments = rawEnrollments as unknown as {
    id: string; status: string; enrolled_at: string; expires_at: string | null
    courses: { id: string; title: string } | null
  }[] | null

  // 진도율 계산 — courses.id 직접 사용 + lesson_progress.is_completed
  // (이전 버전: 'enrollment_id' / 'completed' — 컬럼 자체 없음. 항상 0% 반환되는 silent 버그였음)
  const enrollmentsWithProgress = await Promise.all(
    (enrollments ?? []).map(async (enroll) => {
      if (!enroll.courses) return { ...enroll, progress_percent: 0 }

      const courseId = enroll.courses.id

      const { count: totalLessons } = await supabase
        .from('lessons')
        .select('*', { count: 'exact', head: true })
        .eq('course_id', courseId)

      if (!totalLessons || totalLessons === 0) {
        return { ...enroll, progress_percent: 0 }
      }

      const { count: completedCount } = await supabase
        .from('lesson_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', params.id)
        .eq('course_id', courseId)
        .eq('is_completed', true)

      const progress_percent = Math.round(((completedCount ?? 0) / totalLessons) * 100)
      return { ...enroll, progress_percent }
    })
  )

  return NextResponse.json({ profile, enrollments: enrollmentsWithProgress })
}

// POST: update role and/or isActive
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeSupabase()
  const adminInfo = await checkAdmin(supabase)
  if (!adminInfo) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { role, isActive } = body as { role?: string; isActive?: boolean }

  const validRoles = ['student', 'instructor', 'org_admin', 'admin', 'superadmin']
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // ★ H2: superadmin 임명/해임은 superadmin 만. admin 의 자기·동료 승격 차단.
  if (role === 'superadmin' && adminInfo.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'superadmin 권한 부여는 superadmin 만 할 수 있습니다.' },
      { status: 403 }
    )
  }
  // 추가: superadmin 인 사용자의 role/is_active 변경도 superadmin 만.
  // (admin 이 다른 superadmin 을 강등시켜 자기 권한 확장하는 경로 차단)
  const { data: rawTarget } = await supabase
    .from('profiles').select('role').eq('id', params.id).single()
  const target = rawTarget as unknown as { role: string } | null
  if (target?.role === 'superadmin' && adminInfo.role !== 'superadmin') {
    return NextResponse.json(
      { error: 'superadmin 사용자 변경은 superadmin 만 할 수 있습니다.' },
      { status: 403 }
    )
  }

  const updateData: Record<string, unknown> = {}
  if (role !== undefined) updateData.role = role
  if (isActive !== undefined) updateData.is_active = isActive

  const { error } = await (supabase as any)
    .from('profiles')
    .update(updateData)
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
