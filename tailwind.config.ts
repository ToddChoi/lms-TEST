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
          DEFAULT: '#2D7DD2',
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
