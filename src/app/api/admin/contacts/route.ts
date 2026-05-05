import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

// PATCH: update status and/or answer
export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, status, answer } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (status !== undefined) updateData.status = status
  if (answer !== undefined) {
    updateData.answer = answer || null
    updateData.answered_at = answer ? new Date().toISOString() : null
  }

  const { error } = await (supabase as any)
    .from('contacts')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
