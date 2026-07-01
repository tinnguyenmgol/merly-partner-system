import type { Config } from "tailwindcss";
const config: Config = { content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"], theme: { extend: { colors: { merly: { 50: "#fff7f8", 100: "#ffe8ed", 500: "#e75f7d", 700: "#b93155", 900: "#642034" } } } }, plugins: [] };
export default config;
