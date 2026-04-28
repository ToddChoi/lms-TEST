import { Text, Section } from '@react-email/components'
import EmailLayout from './_layout'

export interface ContactAdminEmailProps {
  type: string
  name: string
  email: string
  phone?: string | null
  company?: string | null
  subject: string
  message: string
}

const TYPE_LABELS: Record<string, string> = {
  general: '일반 문의',
  b2b: '기업(B2B) 문의',
  course: '강좌 문의',
  technical: '기술 문의',
}

export function ContactAdminEmail(props: ContactAdminEmailProps) {
  const typeLabel = TYPE_LABELS[props.type] ?? props.type
  return (
    <EmailLayout
      preview={`[${typeLabel}] ${props.subject}`}
      title={`새 문의가 접수되었습니다 (${typeLabel})`}
    >
      <Section style={card}>
        <Row label="유형">{typeLabel}</Row>
        <Row label="이름">{props.name}</Row>
        <Row label="이메일">{props.email}</Row>
        {props.phone ? <Row label="전화">{props.phone}</Row> : null}
        {props.company ? <Row label="회사">{props.company}</Row> : null}
        <Row label="제목">{props.subject}</Row>
      </Section>

      <Text style={msgLabel}>문의 내용</Text>
      <Text style={msg}>{props.message}</Text>
    </EmailLayout>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Text style={row}>
      <span style={rowLabel}>{label}</span>
      <span style={rowValue}>{children}</span>
    </Text>
  )
}

const card: React.CSSProperties = {
  backgroundColor: '#F4F6FA',
  borderRadius: '8px',
  padding: '14px 16px',
  margin: '8px 0 20px',
}
const row: React.CSSProperties = { fontSize: '13px', margin: '6px 0', color: '#0B1F3A' }
const rowLabel: React.CSSProperties = {
  display: 'inline-block', width: '60px', color: '#6B7280', fontWeight: 600,
}
const rowValue: React.CSSProperties = { color: '#0B1F3A' }
const msgLabel: React.CSSProperties = {
  color: '#6B7280', fontSize: '12px', fontWeight: 700, margin: '12px 0 4px',
}
const msg: React.CSSProperties = {
  color: '#374151', fontSize: '14px', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0,
}
