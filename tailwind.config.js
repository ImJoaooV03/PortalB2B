/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Override default colors to force monochrome if needed, 
        // but mostly we will use black/white utilities directly.
        gray: {
          50: '#FFFFFF', // Force light grays to white for cleaner look
          100: '#F5F5F5', // Very light gray allowed for subtle differentiation
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#000000',
        },
        indigo: {
          50: '#FFFFFF',
          100: '#F5F5F5',
          500: '#000000',
          600: '#000000',
          700: '#333333',
        },
        // Map semantic colors to black/white logic
        success: '#000000',
        danger: '#000000',
        warning: '#000000',
        info: '#000000',
      },
      boxShadow: {
        'sharp': '4px 4px 0px 0px rgba(0,0,0,1)', // Brutalist shadow
        'sharp-sm': '2px 2px 0px 0px rgba(0,0,0,1)',
      }
    }
  },
  plugins: [],
};
