/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: { primary: '#080d08', secondary: '#0e180e', card: '#131f13', hover: '#182918' },
        forest: { border: '#1e3a1e', 'border-light': '#2a4f2a', accent: '#3a7a32', 'accent-hover': '#4a9a40', muted: '#2a5a24' },
        ink: { primary: '#e4ede2', secondary: '#8aab85', muted: '#4a6847' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
      animation: { 'fade-up': 'fadeUp 0.5s ease-out forwards', 'pulse-slow': 'pulse 3s ease-in-out infinite' },
      keyframes: { fadeUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } } },
    },
  },
  plugins: [],
}
