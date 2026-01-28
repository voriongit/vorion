/**
 * Vorion Ecosystem Design Tokens
 *
 * Unified color system for all Vorion products:
 * - vorion.org (main site)
 * - agentanchorai.com (B2B trust platform)
 * - aurais.net (consumer frontend)
 * - cognigate.dev (API docs)
 * - basis.vorion.org (spec site)
 * - bai-cc.com (portfolio)
 */

// Core brand colors - Indigo as primary
export const colors = {
  // Primary brand - Indigo
  brand: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',  // Primary
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },

  // Secondary - Violet (for accents, CTAs)
  secondary: {
    50: '#f5f3ff',
    100: '#ede9fe',
    200: '#ddd6fe',
    300: '#c4b5fd',
    400: '#a78bfa',
    500: '#8b5cf6',  // Secondary
    600: '#7c3aed',
    700: '#6d28d9',
    800: '#5b21b6',
    900: '#4c1d95',
    950: '#2e1065',
  },

  // Accent - Purple (for highlights)
  accent: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',  // Accent
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },

  // Trust tiers (BASIS spec)
  trust: {
    sandbox: '#ef4444',      // Red - 0-99
    provisional: '#f97316',  // Orange - 100-299
    standard: '#eab308',     // Yellow - 300-499
    trusted: '#3b82f6',      // Blue - 500-699
    certified: '#8b5cf6',    // Purple - 700-899
    autonomous: '#22c55e',   // Green - 900-1000
  },

  // Semantic colors
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },

  // Backgrounds (dark theme)
  background: {
    primary: '#0f172a',   // Slate 900
    secondary: '#1e293b', // Slate 800
    tertiary: '#334155',  // Slate 700
    elevated: '#1e1b4b',  // Brand 950
  },

  // Text colors
  text: {
    primary: '#f8fafc',   // Slate 50
    secondary: '#94a3b8', // Slate 400
    muted: '#64748b',     // Slate 500
    inverted: '#0f172a',  // Slate 900
  },

  // Border colors
  border: {
    default: 'rgba(255, 255, 255, 0.1)',
    hover: 'rgba(255, 255, 255, 0.2)',
    focus: '#6366f1',
  },
} as const

// Tailwind config preset
export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        secondary: colors.secondary,
        accent: colors.accent,
        trust: colors.trust,
      },
      backgroundColor: {
        dark: colors.background.primary,
        'dark-secondary': colors.background.secondary,
        'dark-elevated': colors.background.elevated,
      },
      textColor: {
        primary: colors.text.primary,
        secondary: colors.text.secondary,
        muted: colors.text.muted,
      },
      borderColor: {
        subtle: colors.border.default,
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
}

// CSS custom properties for non-Tailwind sites
export const cssVariables = `
:root {
  /* Brand */
  --color-brand-500: #6366f1;
  --color-brand-600: #4f46e5;
  --color-secondary-500: #8b5cf6;
  --color-accent-500: #a855f7;

  /* Trust tiers */
  --color-trust-sandbox: #ef4444;
  --color-trust-provisional: #f97316;
  --color-trust-standard: #eab308;
  --color-trust-trusted: #3b82f6;
  --color-trust-certified: #8b5cf6;
  --color-trust-autonomous: #22c55e;

  /* Backgrounds */
  --color-bg-primary: #0f172a;
  --color-bg-secondary: #1e293b;
  --color-bg-elevated: #1e1b4b;

  /* Text */
  --color-text-primary: #f8fafc;
  --color-text-secondary: #94a3b8;
  --color-text-muted: #64748b;

  /* Borders */
  --color-border-default: rgba(255, 255, 255, 0.1);
  --color-border-hover: rgba(255, 255, 255, 0.2);
  --color-border-focus: #6366f1;
}
`

export default colors
