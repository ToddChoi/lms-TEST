/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image is PDF, not HTML img */
import { Document, Page, Text, View, Font } from '@react-pdf/renderer'
import path from 'path'

const fontDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'NanumGothic',
  fonts: [
    { src: path.join(fontDir, 'NanumGothic.ttf'), fontWeight: 'normal' },
    { src: path.join(fontDir, 'NanumGothic-Bold.ttf'), fontWeight: 'bold' },
  ],
})

export interface OfflineCertificatePdfProps {
  recipientName: string
  programTitle: string
  sessionLabel: string  // "1기" / "10월차" 등 (없으면 빈 문자열)
  sessionPeriod: string // "2026-06-01" or "2026-06-01 ~ 2026-06-03"
  attendanceRate: number  // 0-100
  certificateNumber: string
  issuedAt: string  // YYYY-MM-DD
  organizationName?: string
}

/**
 * 오프라인 교육 수료증 — A4 portrait, 단순 디자인.
 */
export function OfflineCertificatePDF({
  recipientName, programTitle, sessionLabel, sessionPeriod,
  attendanceRate, certificateNumber, issuedAt,
  organizationName = 'Ingrow LMS',
}: OfflineCertificatePdfProps) {
  return (
    <Document title={`수료증 — ${certificateNumber}`} author={organizationName}>
      <Page size="A4" orientation="portrait" style={pageStyle}>
        {/* 외곽 테두리 (장식) */}
        <View style={borderOuter} />
        <View style={borderInner} />

        {/* 콘텐츠 */}
        <View style={content}>
          <Text style={brand}>{organizationName}</Text>

          <Text style={title}>수 료 증</Text>
          <Text style={titleEn}>Certificate of Completion</Text>

          <View style={divider} />

          <Text style={recipientLabel}>아 래 사 람 은</Text>
          <Text style={recipient}>{recipientName}</Text>

          <Text style={courseLabel}>아래 교육 과정을 성실히 이수하였기에</Text>
          <Text style={courseLabel}>이 증서를 수여합니다.</Text>

          <View style={courseBox}>
            <Text style={courseTitle}>{programTitle}</Text>
            {sessionLabel && <Text style={courseSession}>{sessionLabel}</Text>}
            <Text style={courseMeta}>교육 기간: {sessionPeriod}</Text>
            <Text style={courseMeta}>출석률: {attendanceRate}%</Text>
          </View>

          <View style={dateBox}>
            <Text style={dateText}>{issuedAt}</Text>
            <Text style={orgText}>{organizationName}</Text>
          </View>

          <View style={footer}>
            <Text style={footerText}>수료번호: {certificateNumber}</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}

const pageStyle = {
  backgroundColor: '#FFFFFF',
  fontFamily: 'NanumGothic',
  padding: 0,
  position: 'relative' as const,
}

const borderOuter = {
  position: 'absolute' as const,
  top: 30, left: 30, right: 30, bottom: 30,
  borderWidth: 4,
  borderColor: '#0B1F3A',
  borderStyle: 'solid' as const,
}
const borderInner = {
  position: 'absolute' as const,
  top: 38, left: 38, right: 38, bottom: 38,
  borderWidth: 1,
  borderColor: '#0B1F3A',
  borderStyle: 'solid' as const,
}

const content = {
  flex: 1,
  padding: '70 50 50 50',
  alignItems: 'center' as const,
}

const brand = {
  fontSize: 14,
  color: '#2D7DD2',
  fontWeight: 'bold' as const,
  letterSpacing: 4,
  marginBottom: 30,
}

const title = {
  fontSize: 56,
  color: '#0B1F3A',
  fontWeight: 'bold' as const,
  letterSpacing: 12,
  marginBottom: 8,
}
const titleEn = {
  fontSize: 13,
  color: '#9CA3AF',
  letterSpacing: 4,
  marginBottom: 24,
}

const divider = {
  width: 80,
  height: 2,
  backgroundColor: '#2D7DD2',
  marginBottom: 30,
}

const recipientLabel = {
  fontSize: 12,
  color: '#374151',
  marginBottom: 8,
  letterSpacing: 4,
}
const recipient = {
  fontSize: 32,
  color: '#0B1F3A',
  fontWeight: 'bold' as const,
  marginBottom: 24,
}

const courseLabel = {
  fontSize: 12,
  color: '#374151',
  textAlign: 'center' as const,
  lineHeight: 1.7,
}

const courseBox = {
  marginTop: 24,
  marginBottom: 30,
  padding: '20 30',
  backgroundColor: '#F4F6FA',
  borderRadius: 4,
  width: '85%',
  alignItems: 'center' as const,
}
const courseTitle = {
  fontSize: 18,
  color: '#0B1F3A',
  fontWeight: 'bold' as const,
  marginBottom: 4,
}
const courseSession = {
  fontSize: 12,
  color: '#6B7280',
  marginBottom: 8,
}
const courseMeta = {
  fontSize: 11,
  color: '#374151',
  marginTop: 2,
}

const dateBox = {
  marginTop: 30,
  alignItems: 'center' as const,
}
const dateText = {
  fontSize: 14,
  color: '#0B1F3A',
  marginBottom: 8,
}
const orgText = {
  fontSize: 16,
  color: '#0B1F3A',
  fontWeight: 'bold' as const,
}

const footer = {
  position: 'absolute' as const,
  bottom: 60,
  left: 0, right: 0,
  alignItems: 'center' as const,
}
const footerText = {
  fontSize: 9,
  color: '#9CA3AF',
}
