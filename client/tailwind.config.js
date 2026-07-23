/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' },
        surface: {
          50: 'var(--surface-50)',
          100: 'var(--surface-100)',
          200: 'var(--surface-200)',
          300: 'var(--surface-300)',
          400: 'var(--surface-400)',
          500: 'var(--surface-500)',
          600: 'var(--surface-600)',
          700: 'var(--surface-700)',
          800: 'var(--surface-800)',
          900: 'var(--surface-900)',
          950: 'var(--surface-950)',
        },
      },
      fontFamily: { sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'], mono: ['JetBrains Mono', 'Fira Code', 'monospace'] },
      animation: { 'fade-in': 'fadeIn 0.5s ease-in-out', 'slide-up': 'slideUp 0.3s ease-out', 'slide-down': 'slideDown 0.3s ease-out' },
      keyframes: { fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } }, slideUp: { '0%': { transform: 'translateY(10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } }, slideDown: { '0%': { transform: 'translateY(-10px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } } },
    },
  },
  plugins: [],
};
