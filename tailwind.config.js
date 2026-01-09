/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/!(node_modules)/**/*.{jsx,tsx,scss,sass}", "./node_modules/streamdown/dist/*.js"],
  theme: {
    extend: {},
  },
  plugins: [],
  darkMode: "class",
};
