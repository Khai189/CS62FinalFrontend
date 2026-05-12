import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        parchment: "#f6efe2",
        ink: "#1d2433",
        ember: "#d86f45",
        tide: "#2f6f73",
        moss: "#677c5b",
        slate: "#475467"
      },
      boxShadow: {
        card: "0 18px 50px rgba(28, 37, 56, 0.12)"
      },
      borderRadius: {
        "4xl": "2rem"
      }
    }
  },
  plugins: []
};

export default config;
