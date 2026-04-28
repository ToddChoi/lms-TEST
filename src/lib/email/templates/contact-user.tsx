import { Text } from '@react-email/components'
import EmailLayout from './_layout'

export interface ContactUserEmailProps {
  name: string
  subject: string
}

export function ContactUserEmail({ name, subject }: ContactUserEmailProps) {
  return (
    <EmailLayout
      preview="문의가 정상 접수되었습니다"
      title="문의가 정상 접수되었습니다"
    >
      <Text style={p}>
        {name}님, 안녕하세요. <br />
        남겨주신 문의(<strong>{subject}</strong>)가 정상적으로 접수되었습니다.
      </Text>
      <Text style={p}>
        담당자가 검토 후 영업일 기준 1~2일 내에 답변드릴 예정입니다. <br />
        조금만 기다려주세요.
      </Text>
      <Text style={p}>감사합니다.</Text>
    </EmailLayout>
  )
}

const p: React.CSSProperties = { color: '#374151', fontSize: '14px', lineHeight: 1.7, margin: '8px 0' }
