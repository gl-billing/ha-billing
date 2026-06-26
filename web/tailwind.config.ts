import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0a0a0a",
        navy: "#0a0a0a",
        muted: "#5c5c5c",
        line: "#d8d8d8",
        cream: "#f7f7f7",
        paper: "#ffffff",
        soft: "#f0f0f0",
        gold: {
          DEFAULT: "#111111",
          light: "#333333",
          dark: "#000000"
        },
        charcoal: "#1a1a1a",
        green: "#1f5f3b"
      },
      fontFamily: {
        sans: ["var(--font-ui)", "Arial", "Helvetica", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Arial Black", "Arial", "Helvetica", "sans-serif"]
      },
      boxShadow: {
        card: "0 2px 16px rgba(0, 0, 0, 0.06)",
        premium: "0 8px 32px rgba(0, 0, 0, 0.1)",
        soft: "0 2px 16px rgba(0, 0, 0, 0.05)",
        lift: "0 12px 40px rgba(0, 0, 0, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
