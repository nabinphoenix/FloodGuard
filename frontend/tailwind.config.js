/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0EA5E9",
          gradientEnd: "#0D9488",
        },
        flood: {
          safe: "#22C55E",
          watch: "#EAB308",
          warning: "#F97316",
          emergency: "#EF4444",
        },
        surface: {
          bg: "#F0F9FF",
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
