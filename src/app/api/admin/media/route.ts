/**
 * Admin API — media_assets 라이브러리.
 *
 * GET    ?kind=image            → 미디어 list (최신순)
 * POST   FormData(file, alt?)   → 업로드 + media_assets row 생성
 * DELETE { id }                 → DB row + storage 파일 삭제
 *
 * Storage 버킷: 'media' (없으면 자동 생성 시도 — 또는 운영자 수동)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'
import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'media'

export async function GET(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const kind = req.nextUrl.searchParams.get('kind') ?? 'image'

  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .eq('kind', kind)
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assets: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { guard, user } = await requireAdmin()
  if (guard) return guard

  const form = await req.formData()
  const file = form.get('file') as File | null
  const alt = (form.get('alt') as string | null) ?? null
  if (!file) return NextResponse.json({ error: 'file 필수' }, { status: 400 })

  // 단순 검증 — 이미지 5MB 이하
  const isImage = file.type.startsWith('image/')
  if (!isImage) return NextResponse.json({ error: '이미지 파일만 업로드 가능' }, { status: 400 })
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: '5MB 이하만 업로드 가능' }, { status: 400 })
  }

  const admin = createAdminClient() as any

  // 파일명 정제 + path
  const ext = (file.name.split('.').pop() ?? 'png').toLowerCase()
  const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60)
  const path = `${Date.now()}_${safeBase}.${ext}`

  // Storage 업로드
  const buffer = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await admin.storage.from(BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })
  if (upErr) {
    console.error('[media upload] storage error:', upErr)
    return NextResponse.json({ error: `업로드 실패: ${upErr.message}` }, { status: 500 })
  }

  // public URL — media 버킷이 public 이면 직접, 아니면 signed URL.
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path)
  const url = urlData?.publicUrl ?? path

  // DB row
  const { data: rawRow, error: dbErr } = await admin
    .from('media_assets')
    .insert({
      url,
      bucket: BUCKET,
      kind: 'image',
      alt,
      size_bytes: file.size,
      uploaded_by: user?.id ?? null,
    })
    .select()
    .single()
  if (dbErr) {
    console.error('[media upload] db error:', dbErr)
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }
  return NextResponse.json({ asset: rawRow }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { id } = await req.json() as { id?: string }
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  // url 에서 storage path 추출
  const { data: row } = await supabase
    .from('media_assets').select('url, bucket').eq('id', id).maybeSingle()
  const asset = row as unknown as { url: string; bucket: string | null } | null

  if (asset?.bucket) {
    const marker = `/object/public/${asset.bucket}/`
    const idx = asset.url.indexOf(marker)
    const path = idx >= 0 ? asset.url.slice(idx + marker.length).split('?')[0] : null
    if (path) {
      const admin = createAdminClient() as any
      await admin.storage.from(asset.bucket).remove([path]).catch(() => null)
    }
  }

  const { error } = await (supabase as any).from('media_assets').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
