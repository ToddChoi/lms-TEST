import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { ContactAdminEmail } from '@/lib/email/templates/contact-admin'
import { ContactUserEmail } from '@/lib/email/templates/contact-user'

function makeAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

const ALLOWED_TYPES = ['general', 'b2b', 'course', 'technical'] as const
type ContactType = (typeof ALLOWED_TYPES)[number]

export async function POST(req: NextRequest) {
  const body = await req.json()
  const {
    name, email, subject, message,
    type: rawType, phone, company,
    honeypot, // 스팸 봇 차단 (사람은 비워둠)
  } = body as {
    name: string
    email: string
    subject?: string
    message: string
    type?: string
    phone?: string
    company?: string
    honeypot?: string
  }

  // honeypot: 사람은 채우지 않는 숨김 필드. 값이 있으면 봇으로 간주하고 조용히 성공 응답.
  if (honeypot && honeypot.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: '필수 항목이 누락됐습니다.' }, { status: 400 })
  }

  // 이메일 형식 간단 검증
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: '이메일 형식을 확인해주세요.' }, { status: 400 })
  }

  const type: ContactType = ALLOWED_TYPES.includes(rawType as ContactType)
    ? (rawType as ContactType)
    : 'general'

  // B2B 인 경우 회사명 필수
  if (type === 'b2b' && !company?.trim()) {
    return NextResponse.json({ error: '회사명을 입력해주세요.' }, { status: 400 })
  }

  // 로그인 유저면 user_id도 저장
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // DB 스키마: title(제목), content(내용), user_id, type, phone, company
  // name/email은 content 상단에도 한번 더 기록 (관리자 UI에서 빠르게 보기 위함)
  const title = subject?.trim() || (type === 'b2b' ? '기업 도입 문의' : '이용문의')
  const lines = [
    `[이름] ${name.trim()}`,
    `[이메일] ${email.trim()}`,
    phone?.trim() ? `[전화] ${phone.trim()}` : null,
    company?.trim() ? `[회사] ${company.trim()}` : null,
    '',
    message.trim(),
  ].filter(Boolean) as string[]
  const content = lines.join('\n')

  const admin = makeAdminClient() as unknown as {
    from: (t: string) => {
      insert: (v: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }
  }
  const { error } = await admin
    .from('contacts')
    .insert({
      title,
      content,
      user_id: user?.id ?? null,
      status: 'pending',
      type,
      phone: phone?.trim() || null,
      company: company?.trim() || null,
    })

  if (error) {
    console.error('contacts insert error:', error)
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500 })
  }

  // ─── 알림 메일 발송 (실패해도 응답엔 영향 없음) ───
  try {
    // 관리자 메일 주소: site_settings.contact_email → 없으면 EMAIL_FROM_ADDRESS
    const { data: rawSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'contact_email')
      .maybeSingle()
    const adminEmail = (rawSetting as unknown as { value: string } | null)?.value
      || process.env.EMAIL_FROM_ADDRESS
      || null

    // 1) 관리자에게 알림
    if (adminEmail) {
      await sendEmail({
        to: adminEmail,
        subject: `[문의 접수] ${title}`,
        react: ContactAdminEmail({
          type, name: name.trim(), email: email.trim(),
          phone: phone?.trim() ?? null,
          company: company?.trim() ?? null,
          subject: title, message: message.trim(),
        }),
        template: 'contact-admin',
        userId: user?.id ?? null,
      })
    }

    // 2) 문의자에게 접수 확인
    await sendEmail({
      to: email.trim(),
      subject: '[Ingrow LMS] 문의가 정상 접수되었습니다',
      react: ContactUserEmail({ name: name.trim(), subject: title }),
      template: 'contact-user',
      userId: user?.id ?? null,
    })
  } catch (e) {
    console.warn('[contact email] failed:', e)
  }

  return NextResponse.json({ ok: true })
}
