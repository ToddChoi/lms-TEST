import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface OfflinePaymentConfirmedEmailProps {
  name?: string | null
  programTitle: string
  sessionLabel: string
  sessionPeriod: string
  locationName?: string | null
  locationAddress?: string | null
  enrollmentId: string
}

export function OfflinePaymentConfirmedEmail({
  name,
  programTitle,
  sessionLabel,
  sessionPeriod,
  locationName,
  locationAddress,
  enrollmentId,
}: OfflinePaymentConfirmedEmailProps) {
  const displayName = name?.trim() || '회원님'

  return (
    <EmailLayout
      preview={`${programTitle} 자리 확정 — ${sessionPeriod}`}
      title="결제 완료 · 자리가 확정되었습니다"
    >
      <Text style={p}>
        {displayName}님, 결제가 정상 처리되어 자리가 <strong>확정</strong>되었습니다. 🎉
      </Text>

      <Section style={card}>
        <Text style={cardTitle}>{programTitle}</Text>
        {sessionLabel && <Text style={cardSub}>{sessionLabel}</Text>}
        <Text style={cardMeta}>📅 {sessionPeriod}</Text>
        {locationName && <Text style={cardMeta}>📍 {locationName}</Text>}
        {locationAddress && <Text style={cardMetaSub}>{locationAddress}</Text>}
      </Section>

      <Section style={infoBox}>
        <Text style={infoText}>
          🎫 강좌 당일 현장에서 <strong>QR 출석 체크</strong>를 진행합니다. 마이페이지에서 신청 상세를 확인해주세요.
        </Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Button href={`${appUrl()}/my/offline/${enrollmentId}`} style={btn}>
          신청 상세 보기
        </Button>
      </Section>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const card: React.CSSProperties = {
  backgroundColor: '#DCFCE7', borderRadius: '8px', padding: '16px', margin: '16px 0',
}
const cardTitle: React.CSSProperties = { color: '#14532D', fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }
const cardSub: React.CSSProperties = { color: '#16803C', fontSize: '12px', margin: '0 0 8px' }
const cardMeta: React.CSSProperties = { color: '#15803D', fontSize: '13px', margin: '4px 0' }
const cardMetaSub: React.CSSProperties = { color: '#16803C', fontSize: '12px', margin: '0 0 0 16px' }
const infoBox: React.CSSProperties = {
  backgroundColor: '#E8F2FC', borderRadius: '8px', padding: '14px 16px', margin: '12px 0',
}
const infoText: React.CSSProperties = { color: '#0B1F3A', fontSize: '13px', lineHeight: 1.6, margin: 0 }
const btn: React.CSSProperties = {
  backgroundColor: '#2D7DD2', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  padding: '12px 28px', borderRadius: '8px', textDecoration: 'none',
}
