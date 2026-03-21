/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Royal gold palette
        brand: {
          light: '#FFF07C',
          DEFAULT: '#FFD700', // Gold accent
          dark: '#B8860B',
          accent: '#FFD700',
        },
        casino: {
          bg: '#0D0020', // Dark purple background
          DEFAULT: '#0D0020',
          card: '#1A0B2E',
          accent: '#FFD700',
        },
      },
      fontFamily: {
        sans: ['Nunito', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Boogaloo', 'cursive', 'serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-gold': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2.5s linear infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
      },
    },
  },
  plugins: [],
};
