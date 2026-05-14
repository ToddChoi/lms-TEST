import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface OfflinePaymentExpiredEmailProps {
  name?: string | null
  programTitle: string
  sessionLabel: string
  sessionPeriod: string
  programSlug?: string
}

export function OfflinePaymentExpiredEmail({
  name, programTitle, sessionLabel, sessionPeriod, programSlug,
}: OfflinePaymentExpiredEmailProps) {
  const displayName = name?.trim() || '회원님'
  const reapplyHref = programSlug
    ? `${appUrl()}/offline/${programSlug}`
    : `${appUrl()}/offline`

  return (
    <EmailLayout
      preview={`결제 기한 만료 — ${programTitle}`}
      title="결제 기한이 만료되었습니다"
    >
      <Text style={p}>
        {displayName}님, 결제 기한이 지나 신청이 자동 취소되었습니다.
      </Text>

      <Section style={card}>
        <Text style={cardTitle}>{programTitle}</Text>
        {sessionLabel && <Text style={cardSub}>{sessionLabel}</Text>}
        <Text style={cardMeta}>📅 {sessionPeriod}</Text>
      </Section>

      <Text style={p}>
        다시 신청하시려면 아래 버튼을 클릭해주세요. 잔여석이 있으면 재신청 가능합니다.
      </Text>

      <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Button href={reapplyHref} style={btn}>재신청 하러 가기</Button>
      </Section>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const card: React.CSSProperties = { backgroundColor: '#F4F6FA', borderRadius: '8px', padding: '16px', margin: '16px 0' }
const cardTitle: React.CSSProperties = { color: '#0B1F3A', fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }
const cardSub: React.CSSProperties = { color: '#6B7280', fontSize: '12px', margin: '0 0 8px' }
const cardMeta: React.CSSProperties = { color: '#374151', fontSize: '13px', margin: '4px 0' }
const btn: React.CSSProperties = {
  backgroundColor: '#2D7DD2', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  padding: '12px 28px', borderRadius: '8px', textDecoration: 'none',
}
