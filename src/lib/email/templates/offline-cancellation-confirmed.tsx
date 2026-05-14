import { Text, Section } from '@react-email/components'
import EmailLayout from './_layout'

export interface OfflineCancellationConfirmedEmailProps {
  name?: string | null
  programTitle: string
  sessionLabel: string
  sessionPeriod: string
  refundAmount: number
  refundRate: 0 | 50 | 100
  paymentMethod: 'card' | 'invoice' | null
  cancelledByAdmin?: boolean
}

export function OfflineCancellationConfirmedEmail({
  name, programTitle, sessionLabel, sessionPeriod,
  refundAmount, refundRate, paymentMethod, cancelledByAdmin,
}: OfflineCancellationConfirmedEmailProps) {
  const displayName = name?.trim() || '회원님'

  const refundMessage =
    refundRate === 0
      ? '환불 가능 기간이 지나 환불은 진행되지 않습니다.'
      : paymentMethod === 'card'
      ? `결제하신 카드로 ${refundAmount.toLocaleString()}원 (${refundRate}%) 자동 환불 처리됩니다. (영업일 기준 3-7일 소요)`
      : `${refundAmount.toLocaleString()}원 (${refundRate}%) 환불 예정. 운영팀이 입금 계좌로 직접 송금합니다 (영업일 기준 3-7일 소요).`

  return (
    <EmailLayout
      preview={`신청 취소 — ${programTitle}`}
      title={cancelledByAdmin ? '관리자에 의해 신청이 취소되었습니다' : '신청 취소가 완료되었습니다'}
    >
      <Text style={p}>
        {displayName}님, 아래 신청이 취소되었습니다.
      </Text>

      <Section style={card}>
        <Text style={cardTitle}>{programTitle}</Text>
        {sessionLabel && <Text style={cardSub}>{sessionLabel}</Text>}
        <Text style={cardMeta}>📅 {sessionPeriod}</Text>
      </Section>

      <Section style={refundBox}>
        <Text style={refundTitle}>💰 환불 안내</Text>
        <Text style={refundText}>{refundMessage}</Text>
      </Section>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const card: React.CSSProperties = { backgroundColor: '#F4F6FA', borderRadius: '8px', padding: '16px', margin: '16px 0' }
const cardTitle: React.CSSProperties = { color: '#0B1F3A', fontSize: '15px', fontWeight: 600, margin: '0 0 4px' }
const cardSub: React.CSSProperties = { color: '#6B7280', fontSize: '12px', margin: '0 0 8px' }
const cardMeta: React.CSSProperties = { color: '#374151', fontSize: '13px', margin: '4px 0' }
const refundBox: React.CSSProperties = {
  backgroundColor: '#E8F2FC', borderRadius: '8px', padding: '14px 16px', margin: '12px 0',
}
const refundTitle: React.CSSProperties = { color: '#0B1F3A', fontSize: '13px', fontWeight: 600, margin: '0 0 8px' }
const refundText: React.CSSProperties = { color: '#374151', fontSize: '13px', lineHeight: 1.6, margin: '0' }
