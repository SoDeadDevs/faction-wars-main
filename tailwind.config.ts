import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/app/**/*.{js,ts,jsx,tsx}",
    "./src/components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gangrel: "#b91c1c",   // crimson
        bat: "#0047AB",       // vivid cobalt
        lycan: "#228b22",     // forest green
        neutral: {
          900: "#0a0a0a",
          800: "#171717",
          700: "#262626",
          600: "#404040",
          400: "#a3a3a3",
          300: "#d4d4d4",
          100: "#f5f5f5",
        },
      },
      fontFamily: {
        sans: ["Arial", "Helvetica", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
