import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface OfflineCertificateIssuedEmailProps {
  name?: string | null
  programTitle: string
  sessionLabel: string
  attendanceRate: number
  certificateNumber: string
  certificateId: string
}

export function OfflineCertificateIssuedEmail({
  name, programTitle, sessionLabel, attendanceRate, certificateNumber, certificateId,
}: OfflineCertificateIssuedEmailProps) {
  const displayName = name?.trim() || '회원님'

  return (
    <EmailLayout
      preview={`수료증 발급 완료 — ${programTitle}`}
      title="수료증이 발급되었습니다 🎉"
    >
      <Text style={p}>
        {displayName}님, 축하드립니다. 아래 교육 과정을 성공적으로 이수하셨습니다.
      </Text>

      <Section style={card}>
        <Text style={cardTitle}>{programTitle}</Text>
        {sessionLabel && <Text style={cardSub}>{sessionLabel}</Text>}
        <Text style={cardMeta}>출석률: {attendanceRate}%</Text>
        <Text style={cardMeta}>수료번호: {certificateNumber}</Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Button href={`${appUrl()}/api/offline/certificates/${certificateId}/download`} style={btn}>
          수료증 다운로드 (PDF)
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
const btn: React.CSSProperties = {
  backgroundColor: '#2D7DD2', color: '#ffffff', fontSize: '14px', fontWeight: 600,
  padding: '12px 28px', borderRadius: '8px', textDecoration: 'none',
}
