/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class', // We can toggle dark mode, but we will make it dark by default
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#bae0fd',
          300: '#7cc8fc',
          400: '#38abf9',
          500: '#0e90e9',
          600: '#0273c7',
          700: '#035ca1',
          800: '#074f85',
          900: '#0c426e',
          950: '#082a49',
        },
        dark: {
          50: '#f6f6f7',
          100: '#e1e2e5',
          200: '#c3c5cb',
          300: '#9b9eb2',
          400: '#717591',
          500: '#535773',
          600: '#41445b',
          700: '#35374a',
          800: '#2b2c3d',
          900: '#1b1c28',
          950: '#0f0f15',
        }
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
        'glass-hover': '0 8px 32px 0 rgba(14, 144, 233, 0.25)',
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
