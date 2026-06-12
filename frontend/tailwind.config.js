/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A0C0F',
        surface: '#111418',
        surface2: '#161A20',
        accent: '#57D9B0',
        income: '#46CB78',
        expense: '#FF6B6B',
        label: '#E8EBEF',
        muted: '#99A2AD',
        ghost: '#5E6772',
      },
    },
  },
  plugins: [],
}
