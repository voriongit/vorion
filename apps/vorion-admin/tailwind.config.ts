import type { Config } from 'tailwindcss'

export default {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        admin: {
          primary: '#3b82f6',    // Blue 500
          secondary: '#6366f1',  // Indigo 500
          accent: '#8b5cf6',     // Violet 500
          dark: '#030712',       // Gray 950
          light: '#f9fafb',      // Gray 50
          surface: '#111827',    // Gray 900
          border: '#1f2937',     // Gray 800
        },
        status: {
          success: '#22c55e',
          warning: '#f59e0b',
          error: '#ef4444',
          info: '#3b82f6',
        },
        trust: {
          t0: '#ef4444',  // Sandbox - Red
          t1: '#f97316',  // Observed - Orange
          t2: '#eab308',  // Provisional - Yellow
          t3: '#84cc16',  // Verified - Lime
          t4: '#22c55e',  // Operational - Green
          t5: '#14b8a6',  // Trusted - Teal
          t6: '#3b82f6',  // Certified - Blue
          t7: '#8b5cf6',  // Autonomous - Violet
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
