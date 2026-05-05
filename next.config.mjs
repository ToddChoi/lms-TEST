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
  async headers() {
    // CSP — 알려진 외부 출처를 명시. Report-Only 로 시작해서 위반 모니터링 후
    // 안정되면 'Content-Security-Policy' 로 전환 (브라우저 DevTools Console 에서
    // CSP report 메시지로 위반 추적 가능).
    //
    // 알려진 외부 출처:
    //   - *.supabase.co       : Supabase REST + Storage + Auth
    //   - js.stripe.com       : Stripe SDK
    //   - hooks.stripe.com    : Stripe webhook iframe
    //   - youtube/youtube-nocookie + ytimg : YouTube 영상 임베드
    //   - vimeo + player.vimeo: Vimeo 영상 임베드
    //   - images.unsplash     : 이미지 소스
    //   - 'unsafe-inline'      : Next.js 14 + Tailwind 가 인라인 style 사용 → nonce 도입 전엔 필수
    //   - 'unsafe-eval'        : 일부 SDK(Next dev/Stripe) 가 eval 사용
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://i.ytimg.com https://*.vimeocdn.com",
      "font-src 'self' data:",
      "media-src 'self' blob: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
      "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://*.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'self'",
      "upgrade-insecure-requests",
    ].join('; ')

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
          // CSP — Report-Only 로 시작. 며칠 가용성 모니터링 후 위 주석 따라 enforcement 로 전환.
          { key: 'Content-Security-Policy-Report-Only', value: csp },
        ],
      },
    ]
  },
}

export default nextConfig
