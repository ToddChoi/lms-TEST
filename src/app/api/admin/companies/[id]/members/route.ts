import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

async function checkAdmin(supabase: ReturnType<typeof createClient>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) return null
  return user
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin = await checkAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { email, department, is_manager } = body as {
    email?: string
    department?: string
    is_manager?: boolean
  }
  if (!email) return NextResponse.json({ error: '이메일은 필수입니다.' }, { status: 400 })

  const { data: rawUserProfile } = await supabase
    .from('profiles')
    .select('id, name, email')
    .eq('email', email)
    .single()
  const userProfile = rawUserProfile as unknown as { id: string; name: string | null; email: string | null } | null
  if (!userProfile) return NextResponse.json({ error: '해당 이메일의 회원을 찾을 수 없습니다.' }, { status: 404 })

  const { data: rawInsert, error } = await (supabase as any)
    .from('company_members')
    .insert({
      company_id: params.id,
      user_id: userProfile.id,
      department: department || null,
      is_manager: is_manager ?? false,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const inserted = rawInsert as { id: string; user_id: string; department: string | null; is_manager: boolean }
  return NextResponse.json({
    success: true,
    member: {
      id: inserted.id,
      user_id: inserted.user_id,
      department: inserted.department,
      is_manager: inserted.is_manager,
      name: userProfile.name,
      email: userProfile.email,
    },
  })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin = await checkAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { memberId, is_manager } = body as { memberId?: string; is_manager?: boolean }
  if (!memberId) return NextResponse.json({ error: 'memberId 누락' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('company_members')
    .update({ is_manager })
    .eq('id', memberId)
    .eq('company_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const admin = await checkAdmin(supabase)
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { memberId } = body as { memberId?: string }
  if (!memberId) return NextResponse.json({ error: 'memberId 누락' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('company_members')
    .delete()
    .eq('id', memberId)
    .eq('company_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
