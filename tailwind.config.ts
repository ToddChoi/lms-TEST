import type { Config } from 'tailwindcss'

/**
 * Ingrow LMS 디자인 토큰 — Phase 1 (2026-05).
 *
 * 원칙:
 * 1. semantic 토큰을 거치지 않은 색상 직접 호출 (red-500, green-600 등) 점진 제거.
 * 2. 라운드는 4단계: sm(6) / md(10) / lg(16) / xl(20) — 그 외 임의값 금지.
 *    - 인터랙티브(button/input/badge) = md
 *    - 카드/모달                       = lg
 *    - hero·풀폭 패널                   = xl
 *    - 작은 pill/tag                    = sm 또는 full
 * 3. 타이포 스케일 이름 정의 — h1~h6, body-lg/body/body-sm/caption.
 * 4. multi-tenant 대비: accent 는 CSS variable 라 회사별 primary_color 로 즉시 갈아끼울 수 있음.
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ── 브랜드 코어 ────────────────────────────────
        navy: {
          DEFAULT: '#0B1F3A',
          mid:     '#1A3558',
          light:   '#243F65',
        },
        accent: {
          // 사이트/회사별 primary_color 로 덮어쓰기 가능
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          light:   '#4A9AEF',
          pale:    '#E8F2FC',
        },
        silver: '#F4F6FA',

        // ── Semantic ──────────────────────────────────
        // 직접 red-500 같은 거 호출 금지 — 항상 semantic 통해서.
        // 듀오톤 패턴: bg-{name}-soft + text-{name} + border-{name}-border
        success: {
          DEFAULT: '#16A34A',  // green-600
          soft:    '#DCFCE7',  // green-100
          border:  '#86EFAC',  // green-300
        },
        warning: {
          DEFAULT: '#D97706',  // amber-600
          soft:    '#FEF3C7',  // amber-100
          border:  '#FCD34D',  // amber-300
        },
        danger: {
          DEFAULT: '#DC2626',  // red-600
          soft:    '#FEE2E2',  // red-100
          border:  '#FCA5A5',  // red-300
        },
        info: {
          DEFAULT: '#2563EB',  // blue-600
          soft:    '#DBEAFE',  // blue-100
          border:  '#93C5FD',  // blue-300
        },

        // ── Surface / 표면 계층 ───────────────────────
        surface: {
          DEFAULT:  '#FFFFFF',  // 최상단 카드/모달
          subtle:   '#FAFBFC',  // 페이지 배경 대안
          muted:    '#F4F6FA',  // 비활성·구분
          inverted: '#0B1F3A',  // dark
        },
        border: {
          subtle:   '#E5E7EB',  // 옅은 구분선 (gray-200)
          DEFAULT:  '#D1D5DB',  // 일반 테두리 (gray-300)
          strong:   '#9CA3AF',  // 강조 (gray-400)
        },
      },

      // ── 라운드 (4단계) ───────────────────────────────
      borderRadius: {
        // Tailwind 기본 sm/md/lg/xl/2xl 을 우리 토큰으로 덮어씀
        sm: '6px',
        md: '10px',   // 인터랙티브 기본
        lg: '16px',   // 카드 기본
        xl: '20px',   // hero/풀폭
        // 'rounded-full' 그대로 사용
      },

      // ── Shadow elevation (3단계) ─────────────────────
      boxShadow: {
        'elev-1': '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'elev-2': '0 4px 6px -2px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        'elev-3': '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.06)',
      },

      // ── 타이포 스케일 ─────────────────────────────────
      // 코드에서는 클래스 그대로 사용. 일관성 위해 대체 utility 도 components 레이어에서 제공.
      fontSize: {
        // [size, lineHeight] — 한국어 가독성 고려해 lineHeight 1.5~1.65 권장
        'display': ['56px',  { lineHeight: '1.1',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'h1':      ['40px',  { lineHeight: '1.2',  letterSpacing: '-0.02em', fontWeight: '700' }],
        'h2':      ['32px',  { lineHeight: '1.25', letterSpacing: '-0.01em', fontWeight: '700' }],
        'h3':      ['24px',  { lineHeight: '1.3',  letterSpacing: '-0.01em', fontWeight: '600' }],
        'h4':      ['20px',  { lineHeight: '1.4',                            fontWeight: '600' }],
        'h5':      ['18px',  { lineHeight: '1.45',                           fontWeight: '600' }],
        'h6':      ['16px',  { lineHeight: '1.5',                            fontWeight: '600' }],
        'body-lg': ['18px',  { lineHeight: '1.6'  }],
        'body':    ['16px',  { lineHeight: '1.6'  }],
        'body-sm': ['14px',  { lineHeight: '1.55' }],
        'caption': ['13px',  { lineHeight: '1.5'  }],
        'micro':   ['12px',  { lineHeight: '1.4'  }],
      },

      // ── 모션 ─────────────────────────────────────────
      transitionTimingFunction: {
        'out-soft':  'cubic-bezier(0.22, 1, 0.36, 1)',     // 부드러운 감속 (모달/드로어)
        'out-snap':  'cubic-bezier(0.4, 0, 0.2, 1)',       // 일반 hover/focus
        'in-out':    'cubic-bezier(0.65, 0, 0.35, 1)',     // 페이지 전환
      },
      transitionDuration: {
        '120': '120ms',  // 미세 hover
        '180': '180ms',  // 일반
        '240': '240ms',  // 모달
        '320': '320ms',  // 페이지 전환
      },

      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
        en:   ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
