import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer'
import path from 'path'

// 한국어 폰트 등록 (서버 사이드 전용 — public/fonts 경로)
const fontDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'NanumGothic',
  fonts: [
    { src: path.join(fontDir, 'NanumGothic.ttf'), fontWeight: 'normal' },
    { src: path.join(fontDir, 'NanumGothic-Bold.ttf'), fontWeight: 'bold' },
  ],
})

// 날짜 포맷 (PDF 전용 — dayjs 없이 직접 처리)
function formatPdfDate(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#FFFFFF',
    fontFamily: 'NanumGothic',
  },
  header: {
    backgroundColor: '#0B1F3A',
    padding: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandSmall: {
    color: '#8AA8CC',
    fontSize: 9,
    letterSpacing: 3,
    fontFamily: 'NanumGothic',
  },
  titleLarge: {
    color: '#FFFFFF',
    fontSize: 26,
    fontFamily: 'NanumGothic',
    fontWeight: 'bold',
    marginTop: 4,
  },
  titleSub: {
    color: '#8AA8CC',
    fontSize: 10,
    fontFamily: 'NanumGothic',
    marginTop: 2,
  },
  stamp: {
    width: 60,
    height: 60,
    borderRadius: 30,
    border: '2px solid #2D7DD2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampText: {
    color: '#2D7DD2',
    fontSize: 8,
    fontFamily: 'NanumGothic',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  body: {
    padding: '28px 50px',
  },
  subtext: {
    textAlign: 'center',
    color: '#666666',
    fontSize: 10,
    fontFamily: 'NanumGothic',
    marginTop: 16,
  },
  recipientLabel: {
    textAlign: 'center',
    color: '#888888',
    fontSize: 9,
    fontFamily: 'NanumGothic',
    marginTop: 20,
    letterSpacing: 2,
  },
  recipientName: {
    textAlign: 'center',
    color: '#0B1F3A',
    fontFamily: 'NanumGothic',
    fontWeight: 'bold',
    fontSize: 26,
    marginTop: 4,
  },
  courseBox: {
    backgroundColor: '#F4F6FA',
    borderRadius: 8,
    padding: '14px 24px',
    marginTop: 18,
  },
  courseLabel: {
    textAlign: 'center',
    color: '#888888',
    fontSize: 9,
    fontFamily: 'NanumGothic',
    letterSpacing: 2,
  },
  courseTitle: {
    textAlign: 'center',
    color: '#0B1F3A',
    fontFamily: 'NanumGothic',
    fontWeight: 'bold',
    fontSize: 15,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    paddingTop: 14,
    borderTop: '1px solid #E5E7EB',
  },
  footerLabel: {
    color: '#888888',
    fontSize: 9,
    fontFamily: 'NanumGothic',
  },
  footerValue: {
    color: '#374151',
    fontSize: 10,
    fontFamily: 'NanumGothic',
    marginTop: 2,
  },
  verify: {
    textAlign: 'center',
    color: '#16A34A',
    fontSize: 9,
    fontFamily: 'NanumGothic',
    marginTop: 10,
  },
})

interface CertificatePDFProps {
  certNumber: string
  issuedAt: string
  courseName: string
  recipientName: string
}

export function CertificatePDF({ certNumber, issuedAt, courseName, recipientName }: CertificatePDFProps) {
  return (
    <Document title={`수료증 — ${certNumber}`} author="Ingrow LMS">
      <Page size="A4" orientation="landscape" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandSmall}>INGROW LMS</Text>
            <Text style={styles.titleLarge}>수료증</Text>
            <Text style={styles.titleSub}>Certificate of Completion</Text>
          </View>
          <View style={styles.stamp}>
            <Text style={styles.stampText}>{'INGROW\nLMS'}</Text>
          </View>
        </View>

        {/* 본문 */}
        <View style={styles.body}>
          <Text style={styles.subtext}>
            아래 학습자가 과정을 성공적으로 수료하였음을 증명합니다.
          </Text>

          <Text style={styles.recipientLabel}>수료자</Text>
          <Text style={styles.recipientName}>{recipientName}</Text>

          <View style={styles.courseBox}>
            <Text style={styles.courseLabel}>수료 과정</Text>
            <Text style={styles.courseTitle}>{courseName}</Text>
          </View>

          <View style={styles.footer}>
            <View>
              <Text style={styles.footerLabel}>발급일</Text>
              <Text style={styles.footerValue}>{formatPdfDate(issuedAt)}</Text>
            </View>
            <View>
              <Text style={styles.footerLabel}>수료증 번호</Text>
              <Text style={styles.footerValue}>{certNumber}</Text>
            </View>
            <View>
              <Text style={styles.footerLabel}>발급기관</Text>
              <Text style={styles.footerValue}>Ingrow LMS</Text>
            </View>
          </View>

          <Text style={styles.verify}>
            본 수료증은 Ingrow LMS에서 공식 발급하였습니다 • ingrow.co.kr
          </Text>
        </View>
      </Page>
    </Document>
  )
}
