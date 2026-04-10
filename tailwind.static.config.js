/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './public/*.html',
    './public/blog/**/*.html',
  ],
  theme: {
    extend: {
      colors: {
        dk: '#074738',
        green2: '#1A9B7D',
        mint: '#E0F2F1',
        bgm: '#F0FAF9',
        purple2: '#5048CA',
        purplebg: '#e3dfff',
        tx: '#0a2e23',
        tx2: '#3d5a50',
        tx3: '#6b8a7e',
        border2: '#c8d9d2',
      },
      fontFamily: {
        brand: ['Plus Jakarta Sans', 'sans-serif'],
        body: ['Manrope', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
