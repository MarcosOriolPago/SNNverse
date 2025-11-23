/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: '#1E1E1E',
        primary: '#2D2D2D',
        secondary: '#3C3C3C',
        accent: '#BB86FC',
        'accent-dark': '#3700B3',
        text: '#E0E0E0',
        'text-secondary': '#A0A0A0',
      },
    },
  },
  plugins: [],
};
