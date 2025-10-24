/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/!(node_modules)/**/*.{jsx,tsx,scss,sass}"],
  theme: {
    extend: {},
  },
  plugins: [],
  darkMode: "class",
};
