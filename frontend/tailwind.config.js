/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#18161f',
        mist: '#f5efe6',
        ember: '#f06d4f',
        gold: '#f3b95f',
        ocean: '#2a748f',
        leaf: '#6a9d77',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        display: ['"Clash Display"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        glow: '0 30px 80px rgba(24, 22, 31, 0.14)',
      },
      backgroundImage: {
        mesh:
          'radial-gradient(circle at top left, rgba(240,109,79,0.22), transparent 34%), radial-gradient(circle at top right, rgba(42,116,143,0.18), transparent 30%), radial-gradient(circle at bottom center, rgba(243,185,95,0.2), transparent 28%)',
      },
    },
  },
  plugins: [],
}
