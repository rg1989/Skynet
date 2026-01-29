/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'thinking-dot': 'thinking-dot 1.4s ease-in-out infinite',
      },
      keyframes: {
        'thinking-dot': {
          '0%, 80%, 100%': { 
            opacity: '0.3',
            transform: 'scale(0.8)',
          },
          '40%': { 
            opacity: '1',
            transform: 'scale(1)',
          },
        },
      },
    },
  },
  plugins: [],
};
