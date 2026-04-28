import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Ingrow LMS — AI·실무 이러닝 플랫폼'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background:
            'linear-gradient(135deg, #0B1F3A 0%, #2D7DD2 100%)',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, letterSpacing: -2 }}>
          Ingrow LMS
        </div>
        <div style={{ fontSize: 36, marginTop: 24, opacity: 0.9 }}>
          AI·실무 이러닝 플랫폼
        </div>
      </div>
    ),
    { ...size }
  )
}
