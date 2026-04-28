import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface WelcomeEmailProps {
  name?: string | null
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  const displayName = name?.trim() || '회원님'
  return (
    <EmailLayout
      preview="Ingrow LMS 가입을 환영합니다"
      title={`${displayName}님, 가입을 환영합니다 🎉`}
    >
      <Text style={p}>
        Ingrow LMS에 가입해주셔서 감사합니다.
        지금 바로 강좌를 둘러보고 학습을 시작해보세요.
      </Text>
      <Section style={{ textAlign: 'center', margin: '24px 0' }}>
        <Button href={`${appUrl()}/courses`} style={btn}>강좌 둘러보기</Button>
      </Section>
      <Text style={p}>
        궁금하신 점이 있으면 언제든지 문의해주세요.
      </Text>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const btn: React.CSSProperties = {
  backgroundColor: '#2D7DD2',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
}
