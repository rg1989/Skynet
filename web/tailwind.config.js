/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'thinking-dot': 'thinking-dot 1.4s ease-in-out infinite',
        'slide-up-out': 'slide-up-out 0.3s ease-out forwards',
        'slide-up-in': 'slide-up-in 0.3s ease-out forwards',
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
        'slide-up-out': {
          '0%': { 
            transform: 'translateY(0)', 
            opacity: '1',
          },
          '100%': { 
            transform: 'translateY(-100%)', 
            opacity: '0',
          },
        },
        'slide-up-in': {
          '0%': { 
            transform: 'translateY(100%)', 
            opacity: '0',
          },
          '100%': { 
            transform: 'translateY(0)', 
            opacity: '1',
          },
        },
      },
    },
  },
  plugins: [],
};
