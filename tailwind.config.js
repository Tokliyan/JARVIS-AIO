/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#f6f7f8',
        surface: '#ffffff',
        border: '#e2e4e8',
        ink: '#14171c',
        muted: '#6b7280',
        accent: '#2f5f8a',
        good: '#3f8f5f',
        warn: '#b8863a',
        bad: '#b3452f',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '4px',
      },
    },
  },
  plugins: [],
};
