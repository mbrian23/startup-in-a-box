import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0A142E',
        dialog: '#1C2A4C',
        dialog2: '#121C38',
        gold: '#D4A84A',
        magenta: '#C45A5A',
        cyan: '#6BA8B8',
        cream: '#ECDFC0',
        moss: '#7A9E56',
        lila: '#8B6FA6',
        orange: '#C87A3A',
        greyline: '#5A5F7A',
      },
      fontFamily: {
        display: ['var(--font-display)', 'monospace'],
        pixel: ['var(--font-pixel)', 'monospace'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      keyframes: {
        crtOn: {
          '0%': { opacity: '0', transform: 'scaleY(0.01) scaleX(1.2)' },
          '60%': { opacity: '0.5', transform: 'scaleY(1.05) scaleX(1.0)' },
          '100%': { opacity: '1', transform: 'scaleY(1) scaleX(1)' },
        },
        flicker: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.96' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        caret: { '50%': { opacity: '0' } },
      },
      animation: {
        crtOn: 'crtOn 420ms cubic-bezier(.2,.7,.2,1)',
        flicker: 'flicker 7s infinite',
        rise: 'rise 360ms ease-out both',
        caret: 'caret 1s step-end infinite',
      },
    },
  },
  plugins: [],
};
export default config;
