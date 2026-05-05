import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function GET(_req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { data: rawSettings } = await supabase!
    .from('site_settings')
    .select('key, value')
  const settings = rawSettings as unknown as { key: string; value: string }[] | null

  const result: Record<string, string> = {}
  ;(settings ?? []).forEach((s) => { result[s.key] = s.value })

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()

  const upsertRows = Object.entries(body).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
  }))

  if (upsertRows.length === 0) return NextResponse.json({ success: true })

  const { error } = await (supabase as any)
    .from('site_settings')
    .upsert(upsertRows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
