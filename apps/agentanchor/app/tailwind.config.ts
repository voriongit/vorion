import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // A3I Brand Colors
        'a3i': {
          primary: '#6366f1',    // Indigo
          secondary: '#8b5cf6',  // Violet
          accent: '#06b6d4',     // Cyan
          success: '#10b981',    // Emerald
          warning: '#f59e0b',    // Amber
          danger: '#ef4444',     // Red
          dark: '#0f172a',       // Slate 900
          light: '#f8fafc',      // Slate 50
        },
        // Trust tiers
        'trust': {
          untrusted: '#ef4444',
          probationary: '#f97316',
          verified: '#eab308',
          trusted: '#22c55e',
          certified: '#3b82f6',
          elite: '#a855f7',
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'hero-pattern': 'linear-gradient(to right bottom, rgba(99, 102, 241, 0.1), rgba(139, 92, 246, 0.1))',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'gradient': 'gradient 8s linear infinite',
      },
      keyframes: {
        gradient: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
    },
  },
  plugins: [],
}

export default config
