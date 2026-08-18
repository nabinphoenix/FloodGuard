/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0B5394",
          light: "#1A75BB",
        },
        flood: {
          safe: "#16A34A",
          watch: "#F59E0B",
          warning: "#EA580C",
          emergency: "#DC2626",
        },
        surface: {
          bg: "#F8FAFC",
          card: "#FFFFFF",
        },
        ink: {
          primary: "#1E293B",
          secondary: "#64748B",
          border: "#E2E8F0",
        },
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
