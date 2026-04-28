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

async function checkAdmin(supabase: ReturnType<typeof makeSupabase>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) return null
  return user
}

// GET: return profile + enrollments with progress
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = makeSupabase()
  const adminUser = await checkAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  // compute progress per enrollment
  const enrollmentsWithProgress = await Promise.all(
    (enrollments ?? []).map(async (enroll) => {
      if (!enroll.courses) return { ...enroll, progress_percent: 0 }

      const { data: rawLessons } = await supabase
        .from('lessons')
        .select('id, sections!inner(course_id)')
        .eq('sections.course_id', enroll.courses.id)
      const lessons = rawLessons as unknown as { id: string }[] | null
      const totalLessons = lessons?.length ?? 0

      if (totalLessons === 0) return { ...enroll, progress_percent: 0 }

      const { data: rawProgress } = await supabase
        .from('lesson_progress')
        .select('id')
        .eq('user_id', params.id)
        .eq('enrollment_id', enroll.id)
        .eq('completed', true)
      const completedCount = (rawProgress as unknown as any[] | null)?.length ?? 0

      const progress_percent = Math.round((completedCount / totalLessons) * 100)
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
  const adminUser = await checkAdmin(supabase)
  if (!adminUser) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { role, isActive } = body as { role?: string; isActive?: boolean }

  const validRoles = ['student', 'instructor', 'admin', 'superadmin']
  if (role && !validRoles.includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
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
