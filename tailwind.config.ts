import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: {
          DEFAULT: '#09090b',
          hover: '#121215',
          active: '#18181b',
        },
        border: {
          subtle: '#27272a',
          strong: '#3f3f46',
        },
        accent: {
          DEFAULT: '#2563eb', // Flat cobalt
          hover: '#1d4ed8',
        },
      },
      borderRadius: {
        DEFAULT: '0.375rem',
        sm: '0.25rem',
        md: '0.375rem',
        lg: '0.375rem', // Cap border-radius at rounded-md
        xl: '0.375rem', // Cap border-radius at rounded-md
        '2xl': '0.375rem', // Cap border-radius at rounded-md
        '3xl': '0.375rem', // Cap border-radius at rounded-md
      },
      fontFamily: {
        sans: ['var(--font-geist-sans)', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        mono: ['var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.035em',
        tighter: '-0.025em',
        tight: '-0.015em',
      },
    },
  },
  plugins: [],
};

export default config;
