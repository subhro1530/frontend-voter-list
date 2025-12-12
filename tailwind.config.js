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
        display: ['"Work Sans"', "system-ui", "sans-serif"],
        body: ['"Inter"', "system-ui", "sans-serif"],
      },
      colors: {
        sand: {
          50: "#0b1220",
          100: "#111a2b",
          200: "#192338",
          300: "#1f2d45",
          400: "#2a3954",
          500: "#32425f",
          600: "#3d4e70",
          700: "#4b5e86",
          800: "#5c719e",
          900: "#6d85b6",
        },
        teal: {
          50: "#e6fffb",
          100: "#c3fff3",
          200: "#8bf5e3",
          300: "#4de2cf",
          400: "#25c7b3",
          500: "#12a798",
          600: "#0f867b",
          700: "#0f6a62",
          800: "#0f524d",
          900: "#0c3d3a",
        },
      },
      boxShadow: {
        card: "0 16px 40px rgba(0,0,0,0.35)",
      },
    },
  },
  plugins: [],
};
