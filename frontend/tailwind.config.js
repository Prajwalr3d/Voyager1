/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#09090B',
          sidebar: '#0D0D10',
          card: '#131316',
          cardElevated: '#17171B',
          cardHover: '#1C1C22',
          border: '#29292F',
          borderSubtle: '#222227',
          borderStrong: '#3A3A44',
        },
        brand: {
          50: '#F5F3FF',
          100: '#EDE9FE',
          200: '#DDD6FE',
          300: '#C4B5FD',
          400: '#A78BFA',
          500: '#8B5CF6',
          600: '#7C3AED',
          700: '#6D28D9',
          800: '#5B21B6',
          900: '#4C1D95',
        },
        status: {
          pass: '#10B981',
          passBg: 'rgba(16, 185, 129, 0.12)',
          warning: '#F59E0B',
          warningBg: 'rgba(245, 158, 11, 0.12)',
          repair: '#3B82F6',
          repairBg: 'rgba(59, 130, 246, 0.12)',
          reject: '#EF4444',
          rejectBg: 'rgba(239, 68, 68, 0.12)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}

