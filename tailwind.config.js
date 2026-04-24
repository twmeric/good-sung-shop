/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontSize: {
        'xxl': '1.5rem',     // 24px - 正文
        'xxxl': '1.75rem',   // 28px - 小標題
        'huge': '2.25rem',   // 36px - 標題
        'giant': '3rem',     // 48px - 大標題
      },
      colors: {
        'brand': {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        }
      }
    },
  },
  plugins: [],
}
