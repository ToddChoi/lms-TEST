/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },

  // 보안 헤더 — 운영 표준 적용
  // CSP 는 사이트가 깨질 수 있어서 별도 라운드로 (Report-Only 부터 시작 권장)
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // clickjacking 방어 — 외부 사이트가 iframe 으로 못 띄움
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // MIME sniffing 방어
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // referrer 정보 누출 최소화
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // HTTPS 강제 (Vercel 은 기본 HTTPS — 쿠키 보호 강화)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // 카메라·마이크·GPS 권한 차단 (LMS 에선 불필요)
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ]
  },
}

export default nextConfig
