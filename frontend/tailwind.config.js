/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#2563EB",
          gradientEnd: "#06B6D4",
        },
        aqua: {
          DEFAULT: "#06B6D4",
          soft: "#CFFAFE",
          pale: "#ECFEFF",
          deep: "#0E7490",
        },
        flood: {
          safe: "#22C55E",
          watch: "#EAB308",
          warning: "#F97316",
          emergency: "#EF4444",
        },
        surface: {
          bg: "#F4FAFF",
          card: "#FFFFFF",
        },
        ink: {
          primary: "#0F172A",
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
