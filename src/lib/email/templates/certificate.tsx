import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface CertificateEmailProps {
  name?: string | null
  courseTitle: string
  certificateId: string
}

export function CertificateEmail({ name, courseTitle, certificateId }: CertificateEmailProps) {
  const displayName = name?.trim() || '회원님'
  return (
    <EmailLayout
      preview="수료증이 발급되었습니다"
      title="수료증이 발급되었습니다 📜"
    >
      <Text style={p}>
        {displayName}님, 축하합니다! <br />
        <strong style={{ color: '#0B1F3A' }}>{courseTitle}</strong> 강좌의 수료증이 발급되었습니다.
      </Text>

      <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Button href={`${appUrl()}/my/certificates/${certificateId}`} style={btn}>
          수료증 보기
        </Button>
      </Section>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const btn: React.CSSProperties = {
  backgroundColor: '#F59E0B',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
}
