import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Unified Vorion brand colors (Indigo primary)
        aurais: {
          primary: '#6366f1',    // Indigo 500
          secondary: '#8b5cf6',  // Violet 500
          accent: '#a855f7',     // Purple 500
          dark: '#0f172a',       // Slate 900
          light: '#f8fafc',      // Slate 50
        },
        // Full brand scale for gradients
        brand: {
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
          950: '#1e1b4b',
        },
        // Trust tier colors (BASIS spec)
        trust: {
          sandbox: '#ef4444',
          provisional: '#f97316',
          standard: '#eab308',
          trusted: '#3b82f6',
          certified: '#8b5cf6',
          autonomous: '#22c55e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundColor: {
        dark: '#0f172a',
        'dark-secondary': '#1e293b',
        'dark-elevated': '#1e1b4b',
      },
    },
  },
  plugins: [],
} satisfies Config
