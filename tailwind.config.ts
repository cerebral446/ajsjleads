import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#EEF2F7",
          100: "#D9E1EC",
          200: "#B3C2D7",
          300: "#8299B8",
          400: "#55719A",
          500: "#3A5680",
          600: "#2A4268",
          700: "#1F3354",
          800: "#162642",
          900: "#0F1C33",
          950: "#0A1324",
        },
        concrete: "#F2F1ED",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Text"',
          '"Segoe UI"',
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
      },
      letterSpacing: { label: "0.14em" },
    },
  },
  plugins: [],
} satisfies Config;
