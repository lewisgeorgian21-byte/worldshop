import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17231d",
        pine: "#163d32",
        mint: "#dff2e8",
        sand: "#f7f6f1",
        lime: "#c5e56a"
      },
      fontFamily: {
        sans: ["Arial", "sans-serif"]
      },
      boxShadow: {
        card: "0 12px 40px rgba(22, 61, 50, 0.08)"
      }
    }
  },
  plugins: []
};

export default config;
