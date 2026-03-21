/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
    "./app/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Merriweather"', "Georgia", "serif"],
        body: ['"Source Sans 3"', "system-ui", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#0b0f1d",
          100: "#0f1427",
          200: "#141b35",
          300: "#1a2245",
          400: "#202c58",
          500: "#243365",
          600: "#2d3f7a",
          700: "#364c91",
          800: "#3f5aa8",
          900: "#4868bf",
        },
        neon: {
          50: "#f5e8ff",
          100: "#e6c9ff",
          200: "#d29dff",
          300: "#b66bff",
          400: "#a24bff",
          500: "#8c2bff",
          600: "#741cd8",
          700: "#5d15ad",
          800: "#470f85",
          900: "#320a5f",
        },
      },
      boxShadow: {
        card: "0 18px 50px rgba(0,0,0,0.4)",
      },
    },
  },
  plugins: [],
};
