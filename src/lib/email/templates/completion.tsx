import { Text, Button, Section } from '@react-email/components'
import EmailLayout, { appUrl } from './_layout'

export interface CompletionEmailProps {
  name?: string | null
  courseTitle: string
  courseId: string
}

export function CompletionEmail({ name, courseTitle, courseId }: CompletionEmailProps) {
  const displayName = name?.trim() || '회원님'
  return (
    <EmailLayout
      preview={`${courseTitle} 강좌 수료를 축하합니다`}
      title="강좌 수료를 축하합니다 🎓"
    >
      <Text style={p}>
        {displayName}님, 끝까지 학습해주셔서 감사합니다. <br />
        아래 강좌의 모든 강의를 완료하셨습니다.
      </Text>

      <Section style={card}>
        <Text style={cardTitle}>{courseTitle}</Text>
      </Section>

      <Section style={{ textAlign: 'center', margin: '20px 0 8px' }}>
        <Button href={`${appUrl()}/my/courses/${courseId}`} style={btn}>
          학습 결과 보기
        </Button>
      </Section>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
const card: React.CSSProperties = {
  backgroundColor: '#E8F2FC',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '16px 0',
}
const cardTitle: React.CSSProperties = {
  color: '#0B1F3A',
  fontSize: '15px',
  fontWeight: 600,
  margin: 0,
}
const btn: React.CSSProperties = {
  backgroundColor: '#10B981',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  padding: '12px 28px',
  borderRadius: '8px',
  textDecoration: 'none',
}
