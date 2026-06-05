import defaultTheme from 'tailwindcss/defaultTheme'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...defaultTheme.colors,
        primary: {
          DEFAULT: '#F59E0B',
          dark: '#D97706',
        },
        secondary: {
          DEFAULT: '#EF4444',
        }
      }
    },
  },
  plugins: [],
}
