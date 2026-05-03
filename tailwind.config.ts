import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#DC2626",
          redDeep: "#B91C1C",
          redSoft: "#FEE2E2",
          redTint: "#FFF5F5",
          navy: "#1E2748",
          navyDeep: "#0F1739",
          cream: "#FAF8F4",
          paper: "#FFFFFF",
          ink: "#0F172A",
          smoke: "#475569",
          line: "#E5E7EB",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.06)",
        cardHover: "0 2px 6px rgba(220,38,38,0.08), 0 12px 24px rgba(15,23,42,0.08)",
        glow: "0 8px 24px rgba(220,38,38,0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
