import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function POST(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { name, contact_name, contact_email, contract_start, contract_end, is_active } = body as {
    name?: string
    contact_name?: string | null
    contact_email?: string | null
    contract_start?: string | null
    contract_end?: string | null
    is_active?: boolean
  }

  if (!name) return NextResponse.json({ error: '기업명은 필수입니다.' }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('companies')
    .insert({
      name,
      contact_name: contact_name ?? null,
      contact_email: contact_email ?? null,
      contract_start: contract_start ?? null,
      contract_end: contract_end ?? null,
      is_active: is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, company: data })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { id, ...updates } = body as { id?: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'id 누락' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('companies')
    .update(updates)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { id } = (await req.json()) as { id?: string }
  if (!id) return NextResponse.json({ error: 'id 누락' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('companies')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
