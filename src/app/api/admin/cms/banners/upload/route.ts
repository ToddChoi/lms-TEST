import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin, makeSupabase } from '../../../_guard'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const MAX_SIZE = 5 * 1024 * 1024

export async function POST(req: NextRequest) {
  const { guard } = await requireAdmin()
  if (guard) return guard

  const supabase = makeSupabase()

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: '파일을 읽을 수 없습니다.' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '허용되지 않는 파일 형식입니다. (JPG, PNG, WebP, GIF만 가능)' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: '파일 크기는 5MB 이하여야 합니다.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const buffer = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await (supabase as any).storage
    .from('banners')
    .upload(fileName, buffer, { contentType: file.type, upsert: false })

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = (supabase as any).storage.from('banners').getPublicUrl(fileName)
  return NextResponse.json({ url: publicUrl })
}
