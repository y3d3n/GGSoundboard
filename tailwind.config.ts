import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  content: [
    './components/**/*.{vue,ts}',
    './composables/**/*.ts',
    './pages/**/*.vue',
    './app.vue',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', '"Inter"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        ink: {
          950: '#0b0b0d',
          900: '#111114',
          850: '#16161a',
          800: '#1b1b20',
          700: '#26262c',
          600: '#34343c',
          500: '#4a4a54',
          400: '#71717c',
          300: '#a1a1ab',
          200: '#d4d4da',
          100: '#ededf0',
        },
        accent: {
          DEFAULT: '#8b93ff',
          soft: 'rgba(139,147,255,0.14)',
        },
      },
      fontSize: {
        '2xs': ['10.5px', '14px'],
      },
      keyframes: {
        'pad-pulse': {
          '0%': { boxShadow: '0 0 0 0 rgba(139,147,255,0.35)' },
          '100%': { boxShadow: '0 0 0 10px rgba(139,147,255,0)' },
        },
        eq: {
          '0%,100%': { transform: 'scaleY(0.25)' },
          '50%': { transform: 'scaleY(1)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(4px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        'pad-pulse': 'pad-pulse 0.5s ease-out',
        eq: 'eq 0.9s ease-in-out infinite',
        'fade-in': 'fade-in 0.15s ease-out',
        'pop-in': 'pop-in 0.18s cubic-bezier(0.2,0.8,0.2,1)',
      },
    },
  },
}
