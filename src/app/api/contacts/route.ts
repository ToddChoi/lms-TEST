import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email/send'
import { ContactAdminEmail } from '@/lib/email/templates/contact-admin'
import { ContactUserEmail } from '@/lib/email/templates/contact-user'

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

  if (honeypot && honeypot.trim().length > 0) {
    return NextResponse.json({ ok: true })
  }

  if (!name?.trim() || !email?.trim() || !message?.trim()) {
    return NextResponse.json({ error: '필수 항목이 누락됐습니다.' }, { status: 400 })
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return NextResponse.json({ error: '이메일 형식을 확인해주세요.' }, { status: 400 })
  }

  // 길이 상한 — 폼 abuse 1차 방어
  if (name.length > 100 || email.length > 200 || (subject ?? '').length > 200 || message.length > 5000) {
    return NextResponse.json({ error: '입력값이 너무 깁니다.' }, { status: 400 })
  }

  const type: ContactType = ALLOWED_TYPES.includes(rawType as ContactType)
    ? (rawType as ContactType)
    : 'general'

  if (type === 'b2b' && !company?.trim()) {
    return NextResponse.json({ error: '회사명을 입력해주세요.' }, { status: 400 })
  }

  // ★ 보안: cookie-bound anon client 사용. 'contacts: self insert' RLS 정책이
  //   WITH CHECK (TRUE) 라 비로그인도 INSERT 가능. service_role 키는 불필요.
  //   이전 버전은 service_role 로 INSERT 했는데, 이는 RLS 우회만 부르고 보안 이점 0.
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

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

  const { error } = await (supabase as any)
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

  // ─── 알림 메일 (실패해도 응답 영향 없음) ───
  try {
    const { data: rawSetting } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'contact_email')
      .maybeSingle()
    const adminEmail = (rawSetting as unknown as { value: string } | null)?.value
      || process.env.EMAIL_FROM_ADDRESS
      || null

    // 1) 관리자 알림 — 고정 수신자 (settings.contact_email). 안전.
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

    // 2) ★ 보안: 사용자 ack 메일은 "로그인된 사용자의 user.email" 로만 발송.
    //    이전 버전은 body.email 로 보내서 임의 수신자에게 ingrow 도메인 메일을
    //    뿌릴 수 있는 오픈 릴레이였음 (Resend 도메인 평판 위험). 비로그인 문의는
    //    UI 의 "접수 완료" 토스트로만 안내하고 메일 발송 안 함.
    if (user?.email && user.email === email.trim()) {
      await sendEmail({
        to: user.email,
        subject: '[Ingrow LMS] 문의가 정상 접수되었습니다',
        react: ContactUserEmail({ name: name.trim(), subject: title }),
        template: 'contact-user',
        userId: user.id,
      })
    }
  } catch (e) {
    console.warn('[contact email] failed:', e)
  }

  return NextResponse.json({ ok: true })
}
