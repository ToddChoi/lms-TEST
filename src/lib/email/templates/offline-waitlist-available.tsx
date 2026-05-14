import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface OfflineWaitlistAvailableEmailProps {
  name?: string | null
  programTitle: string
  sessionLabel: string
  sessionPeriod: string
  programSlug: string
  sessionId: string
  reservationDeadline: string  // ISO TIMESTAMPTZ
  graceHours: number
}

export function OfflineWaitlistAvailableEmail({
  name, programTitle, sessionLabel, sessionPeriod, programSlug, sessionId,
  reservationDeadline, graceHours,
}: OfflineWaitlistAvailableEmailProps) {
  const displayName = name?.trim() || '회원님'
  const dueText = new Date(reservationDeadline).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })

  return (
    <EmailLayout
      preview={`자리 발생 — ${graceHours}시간 안에 결제 진행`}
      title="대기 회차에 자리가 발생했습니다 🎉"
    >
      <Text style={p}>
        {displayName}님, 신청 대기 중인 회차에 자리가 났습니다.
      </Text>

      <Section style={card}>
        <Text style={cardTitle}>{programTitle}</Text>
        {sessionLabel && <Text style={cardSub}>{sessionLabel}</Text>}
        <Text style={cardMeta}>📅 {sessionPeriod}</Text>
      </Section>

      <Section style={alertBox}>
        <Text style={alertTitle}>⏰ {graceHours}시간 안에 결제</Text>
        <Text style={alertText}>{dueText} 까지</Text>
        <Text style={alertSub}>
          기한 내 결제하지 않으면 다음 대기자에게 자동으로 자리가 넘어갑니다.
        </Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Button href={`${appUrl()}/offline/${programSlug}/apply/${sessionId}`} style={btn}>
          지금 신청하기
        </Button>
      </Section>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const card: React.CSSProperties = { backgroundColor: '#DCFCE7', borderRadius: '8px', padding: '16px', margin: '16px 0' }
const cardTitle: React.CSSProperties = { color: '#14532D', fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }
const cardSub: React.CSSProperties = { color: '#16803C', fontSize: '12px', margin: '0 0 8px' }
const cardMeta: React.CSSProperties = { color: '#15803D', fontSize: '13px', margin: '4px 0' }
const alertBox: React.CSSProperties = { backgroundColor: '#FEF3C7', borderRadius: '8px', padding: '14px 16px', margin: '12px 0' }
const alertTitle: React.CSSProperties = { color: '#92400E', fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }
const alertText: React.CSSProperties = { color: '#92400E', fontSize: '15px', fontWeight: 700, margin: '0' }
const alertSub: React.CSSProperties = { color: '#92400E', fontSize: '12px', margin: '4px 0 0' }
const btn: React.CSSProperties = {
  backgroundColor: '#2D7DD2', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  padding: '12px 28px', borderRadius: '8px', textDecoration: 'none',
}
