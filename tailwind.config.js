/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#FBFBFA',
        surface: '#FFFFFF',
        border: '#E6E4E0',
        rule: '#D8D5D0',
        ink: '#1C1B19',
        muted: '#6E6B66',
        faint: '#9B9791',
        accent: '#2F6F4E',
        good: '#2F6F4E',
        warn: '#B4761F',
        bad: '#B0432A',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        sm: '4px',
        DEFAULT: '6px',
        lg: '8px',
      },
      keyframes: {
        'spine-draw': {
          from: { transform: 'scaleY(0)' },
          to: { transform: 'scaleY(1)' },
        },
        'now-settle': {
          from: { opacity: '0', transform: 'translateX(-6px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'row-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
      },
      animation: {
        'spine-draw': 'spine-draw 700ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        'now-settle': 'now-settle 400ms 600ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        'row-in': 'row-in 300ms cubic-bezier(0.2, 0.8, 0.2, 1) backwards',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
