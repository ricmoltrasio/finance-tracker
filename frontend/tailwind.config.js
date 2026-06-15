/** @type {import('tailwindcss').Config} */
// NB: questi valori devono restare allineati alle CSS custom properties
// definite in src/index.css (:root) — unica fonte di verita del tema.
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#090B0E', // --bg
        surface: '#13171E', // --surface
        surface2: '#191E27', // --surface-2
        accent: '#57D9B0', // --accent
        income: '#46CB78', // --in
        expense: '#FF6B6B', // --out
        label: '#ECEEF2', // --text
        muted: '#A8B2BC', // --text-2
        ghost: '#7E8A97', // --text-3
      },
    },
  },
  plugins: [],
}
