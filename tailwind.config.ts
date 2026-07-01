import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        merly: {
          50: "#fff7f8",
          100: "#ffe4ec",
          200: "#fecddc",
          300: "#fda4c4",
          400: "#fb718f",
          500: "#f43f6a",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },
      },
    },
  },
  plugins: [],
};

export default config;
