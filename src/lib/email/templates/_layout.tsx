/**
 * 모든 이메일 템플릿이 공유하는 레이아웃.
 * react-email/components 의 표준 컴포넌트로 구성.
 */
import {
  Html, Head, Body, Container, Section, Text, Heading, Link, Hr, Preview,
} from '@react-email/components'
import { ReactNode } from 'react'

interface Props {
  preview: string
  title: string
  children: ReactNode
}

export default function EmailLayout({ preview, title, children }: Props) {
  return (
    <Html lang="ko">
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Heading style={brand}>Ingrow LMS</Heading>
          </Section>

          <Section style={content}>
            <Heading as="h2" style={h2}>{title}</Heading>
            {children}
          </Section>

          <Hr style={hr} />

          <Section style={footer}>
            <Text style={footerText}>
              본 메일은 Ingrow LMS 시스템에서 자동 발송되었습니다.
            </Text>
            <Text style={footerText}>
              <Link href={appUrl()} style={link}>{appUrl()}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// ───────── styles ─────────
const body: React.CSSProperties = {
  backgroundColor: '#F4F6FA',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
  margin: 0,
  padding: '24px 0',
}
const container: React.CSSProperties = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  margin: '0 auto',
  maxWidth: '560px',
  overflow: 'hidden',
}
const header: React.CSSProperties = {
  backgroundColor: '#0B1F3A',
  padding: '20px 28px',
}
const brand: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: 700,
  margin: 0,
}
const content: React.CSSProperties = { padding: '28px 28px 8px' }
const h2: React.CSSProperties = {
  color: '#0B1F3A',
  fontSize: '20px',
  fontWeight: 700,
  margin: '0 0 16px',
}
const hr: React.CSSProperties = { borderColor: '#E8F2FC', margin: '0' }
const footer: React.CSSProperties = { padding: '16px 28px 24px' }
const footerText: React.CSSProperties = {
  color: '#9CA3AF',
  fontSize: '12px',
  margin: '4px 0',
}
const link: React.CSSProperties = { color: '#2D7DD2', textDecoration: 'none' }
