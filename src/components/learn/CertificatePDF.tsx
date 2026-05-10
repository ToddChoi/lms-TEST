/* eslint-disable jsx-a11y/alt-text -- @react-pdf/renderer Image is PDF, not HTML img */
import { Document, Page, Text, View, Image, Font } from '@react-pdf/renderer'
import path from 'path'
import { substitute, type CertData } from '@/lib/cert-render'
import type { CertElement } from '@/types/database'

// 한국어 폰트 등록 (서버 사이드 전용 — public/fonts 경로)
const fontDir = path.join(process.cwd(), 'public', 'fonts')

Font.register({
  family: 'NanumGothic',
  fonts: [
    { src: path.join(fontDir, 'NanumGothic.ttf'), fontWeight: 'normal' },
    { src: path.join(fontDir, 'NanumGothic-Bold.ttf'), fontWeight: 'bold' },
  ],
})

interface Props {
  template: {
    page_size: 'A4' | 'letter'
    page_orientation: 'landscape' | 'portrait'
    background_color: string
    background_url: string | null
    elements: CertElement[]
  }
  data: CertData
  certTitle?: string             // PDF 메타 제목
}

/**
 * 일반화된 PDF 렌더러 — 템플릿 elements + dynamic data 받음.
 *
 * 좌표계: pt. A4 landscape = 842 × 595.
 * elements 의 절대 좌표(x, y) 를 position:'absolute' 로 매핑.
 */
export function CertificatePDF({ template, data, certTitle }: Props) {
  const pageStyle = {
    backgroundColor: template.background_color,
    fontFamily: 'NanumGothic',
    position: 'relative' as const,
  }

  return (
    <Document title={certTitle ?? `수료증 — ${data.cert_number}`} author="Ingrow LMS">
      <Page
        size={template.page_size === 'letter' ? 'LETTER' : 'A4'}
        orientation={template.page_orientation}
        style={pageStyle}
      >
        {/* 배경 이미지 (옵션) — 풀 페이지 */}
        {template.background_url && (
          <Image
            src={template.background_url}
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
          />
        )}

        {/* elements 절대 좌표 렌더 */}
        {template.elements.map((el) => renderElement(el, data))}
      </Page>
    </Document>
  )
}

function renderElement(el: CertElement, data: CertData) {
  const base = {
    position: 'absolute' as const,
    left: el.x,
    top: el.y,
    width: el.w,
    height: el.h,
  }

  if (el.type === 'rect') {
    return (
      <View
        key={el.id}
        style={{
          ...base,
          backgroundColor: el.fill ?? 'transparent',
          borderRadius: el.radius ?? 0,
          ...(el.border ? { border: el.border } : {}),
        }}
      />
    )
  }

  if (el.type === 'image') {
    return (
      <Image
        key={el.id}
        src={el.url}
        style={{ ...base, opacity: el.opacity ?? 1 }}
      />
    )
  }

  // text
  return (
    <Text
      key={el.id}
      style={{
        ...base,
        fontSize: el.font_size,
        fontFamily: 'NanumGothic',
        fontWeight: el.font_weight ?? 'normal',
        color: el.color ?? '#0B1F3A',
        textAlign: el.align ?? 'left',
      }}
    >
      {substitute(el.content, data)}
    </Text>
  )
}
