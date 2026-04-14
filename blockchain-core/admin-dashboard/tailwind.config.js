/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Gold accent (matches Android TrustLedger primary)
        brand: {
          50: '#FFF8E7',
          100: '#FFECC0',
          200: '#FFE099',
          300: '#FFD066',
          400: '#FFC233',
          500: '#FFB400',
          600: '#F6A609',
          700: '#D49208',
          800: '#9A6A06',
          900: '#6B4A04',
        },
        // Deep navy panels / typography (matches Android secondary)
        navy: {
          50: '#E8EDF4',
          100: '#D0D9E8',
          200: '#A8B8D0',
          300: '#8098B8',
          400: '#5A7399',
          500: '#3D5278',
          600: '#2A3F5F',
          700: '#1E2D45',
          800: '#121F33',
          900: '#0B1B32',
          950: '#00112C',
        },
        surface: {
          50: '#F4F4F4',
          100: '#E8E8EA',
          200: '#DCDCDE',
          300: '#C4C4C8',
          400: '#9C9CA3',
          500: '#74747C',
          600: '#56565E',
          700: '#3F3F46',
          800: '#27272A',
          900: '#18181B',
        },
      },
      fontFamily: {
        display: ['"DM Serif Display"', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease both',
        'slide-up': 'slideUp 0.35s ease both',
      },
    },
  },
  plugins: [],
}
