/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: '#FAF6E9',
        ink: '#111111',
        blue: '#2563EB',
        yellow: '#FFD23F',
        lime: '#A3E635',
        bgrey: '#E5E1D4',
        bred: '#FF5436',
      },
    },
  },
  plugins: [],
}
