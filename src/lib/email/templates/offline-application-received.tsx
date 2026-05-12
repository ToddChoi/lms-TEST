import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface OfflineApplicationReceivedEmailProps {
  name?: string | null
  programTitle: string
  sessionLabel: string  // "1기" / "10월차" 등 (없으면 빈 문자열)
  sessionPeriod: string // "2026-06-01" 또는 "2026-06-01 ~ 2026-06-03"
  locationName?: string | null
  totalAmount: number
  vatIncluded: boolean
  paymentDueAt: string  // ISO TIMESTAMPTZ
  enrollmentId: string
}

export function OfflineApplicationReceivedEmail({
  name,
  programTitle,
  sessionLabel,
  sessionPeriod,
  locationName,
  totalAmount,
  vatIncluded,
  paymentDueAt,
  enrollmentId,
}: OfflineApplicationReceivedEmailProps) {
  const displayName = name?.trim() || '회원님'
  const dueDate = new Date(paymentDueAt).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })

  return (
    <EmailLayout
      preview={`${programTitle} 신청 접수 — 결제 기한 ${dueDate}`}
      title="오프라인 교육 신청이 접수되었습니다"
    >
      <Text style={p}>
        {displayName}님, 안녕하세요. <br />
        아래 회차 신청이 정상 접수되었습니다. <strong>자리는 결제 완료 시점에 확정</strong>됩니다.
      </Text>

      <Section style={card}>
        <Text style={cardTitle}>{programTitle}</Text>
        {sessionLabel && <Text style={cardSub}>{sessionLabel}</Text>}
        <Text style={cardMeta}>📅 {sessionPeriod}</Text>
        {locationName && <Text style={cardMeta}>📍 {locationName}</Text>}
        <Text style={cardAmount}>
          {totalAmount.toLocaleString()}원{!vatIncluded && ' (VAT 별도)'}
        </Text>
      </Section>

      <Section style={alertBox}>
        <Text style={alertTitle}>⏰ 결제 기한</Text>
        <Text style={alertText}>{dueDate} 까지</Text>
        <Text style={alertSub}>
          기한 내 결제하지 않으면 자동 취소됩니다.
        </Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Button href={`${appUrl()}/my/offline/${enrollmentId}`} style={btn}>
          신청 내역 확인
        </Button>
      </Section>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const card: React.CSSProperties = {
  backgroundColor: '#E8F2FC', borderRadius: '8px', padding: '16px', margin: '16px 0',
}
const cardTitle: React.CSSProperties = { color: '#0B1F3A', fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }
const cardSub: React.CSSProperties = { color: '#6B7280', fontSize: '12px', margin: '0 0 8px' }
const cardMeta: React.CSSProperties = { color: '#374151', fontSize: '13px', margin: '4px 0' }
const cardAmount: React.CSSProperties = { color: '#0B1F3A', fontSize: '16px', fontWeight: 700, margin: '8px 0 0' }
const alertBox: React.CSSProperties = {
  backgroundColor: '#FEF3C7', borderRadius: '8px', padding: '14px 16px', margin: '12px 0',
}
const alertTitle: React.CSSProperties = { color: '#92400E', fontSize: '13px', fontWeight: 600, margin: '0 0 4px' }
const alertText: React.CSSProperties = { color: '#92400E', fontSize: '15px', fontWeight: 700, margin: '0' }
const alertSub: React.CSSProperties = { color: '#92400E', fontSize: '12px', margin: '4px 0 0' }
const btn: React.CSSProperties = {
  backgroundColor: '#2D7DD2', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  padding: '12px 28px', borderRadius: '8px', textDecoration: 'none',
}
