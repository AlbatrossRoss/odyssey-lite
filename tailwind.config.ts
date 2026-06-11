import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#18231f",
        moss: "#445f4d",
        tide: "#3d7a82",
        coral: "#df7b67",
        shell: "#f7f2e9",
        mist: "#dfe8e3",
      },
      boxShadow: {
        soft: "0 18px 50px rgba(24, 35, 31, 0.16)",
        lift: "0 12px 28px rgba(24, 35, 31, 0.18)",
      },
    },
  },
  plugins: [],
};

export default config;
