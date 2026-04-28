import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F3A',
          mid: '#1A3558',
          light: '#243F65',
        },
        accent: {
          // 사이트 설정 → primary_color 변경 시 모든 bg-accent / text-accent 등이 즉시 반영됨.
          DEFAULT: 'rgb(var(--color-primary-rgb) / <alpha-value>)',
          light: '#4A9AEF',
          pale: '#E8F2FC',
        },
        silver: '#F4F6FA',
      },
      fontFamily: {
        sans: ['Noto Sans KR', 'sans-serif'],
        en: ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
