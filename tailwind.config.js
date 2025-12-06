/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'ide-bg': '#0f0f0f',
        'ide-panel': '#1e1e1e',
        'ide-border': '#2d2d2d',
      },
    },
  },
  plugins: [],
}
