/**
 * HostelHub Owner Design System Tokens
 * Phase 1: Design System Foundation
 */

export const colors = {
  // Primary Brand Colors - Dark Teal/Navy & Green/Teal Accent
  primary: {
    // Dark teal/navy sidebar
    navy: {
      50: '#f0f4f8',
      100: '#e0e9f2',
      200: '#c2d4e6',
      300: '#94b9d4',
      400: '#5f9ec2',
      500: '#3a84b0',
      600: '#266a9e',
      700: '#1f5682',
      800: '#1a4668',
      900: '#163c56',
      950: '#0f2838',
    },
    // Green/teal accent
    teal: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e',
      800: '#115e59',
      900: '#134e4a',
      950: '#042f2e',
    },
  },
  
  // Semantic Colors
  semantic: {
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },


  // Secondary Accents (Categorical / Information hierarchy)
  accent: {
    blue: {
      50: '#eff6ff',
      100: '#dbeafe',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8',
    },
    indigo: {
      50: '#eef2ff',
      100: '#e0e7ff',
      500: '#6366f1',
      600: '#4f46e5',
      700: '#4338ca',
    },
    violet: {
      50: '#f5f3ff',
      100: '#ede9fe',
      500: '#8b5cf6',
      600: '#7c3aed',
      700: '#6d28d9',
    },
    amber: {
      50: '#fffbeb',
      100: '#fef3c7',
      500: '#f59e0b',
      600: '#d97706',
      700: '#b45309',
    },
    rose: {
      50: '#fff1f2',
      100: '#ffe4e6',
      500: '#f43f5e',
      600: '#e11d48',
      700: '#be123c',
    },
  },
  
  // Neutral Colors
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
  
  // Backgrounds
  background: {
    primary: '#ffffff',
    secondary: '#f8fafc',
    tertiary: '#f1f5f9',
  },
};

export const semanticAlias = {
  primary: colors.primary.teal,
  room: colors.accent.blue,
  student: colors.accent.violet,
  warning: colors.accent.amber,
  destructive: colors.accent.rose,
  security: colors.accent.indigo,
  info: colors.accent.blue,
  pending: colors.accent.amber,
  rejected: colors.accent.rose,
  active: colors.primary.teal,
};

export const typography = {
  fontFamily: {
    sans: 'var(--font-inter)',
    heading: 'var(--font-inter)',
  },
  fontSize: {
    xs: '0.75rem',    // 12px
    sm: '0.875rem',   // 14px
    base: '1rem',     // 16px
    lg: '1.125rem',   // 18px
    xl: '1.25rem',    // 20px
    '2xl': '1.5rem',  // 24px
    '3xl': '1.875rem', // 30px
    '4xl': '2.25rem',  // 36px
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeight: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },
};

export const spacing = {
  0: '0',
  1: '0.25rem',   // 4px
  2: '0.5rem',    // 8px
  3: '0.75rem',   // 12px
  4: '1rem',      // 16px
  5: '1.25rem',   // 20px
  6: '1.5rem',    // 24px
  8: '2rem',      // 32px
  10: '2.5rem',   // 40px
  12: '3rem',     // 48px
  16: '4rem',     // 64px
};

export const borderRadius = {
  none: '0',
  sm: '0.25rem',   // 4px
  base: '0.375rem', // 6px
  md: '0.5rem',    // 8px
  lg: '0.75rem',   // 12px
  xl: '1rem',      // 16px
  '2xl': '1.5rem', // 24px
  full: '9999px',
};

export const shadows = {
  sm: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  base: '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  md: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  lg: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  xl: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
};

export const borderWidth = {
  thin: '1px',
  base: '2px',
  thick: '3px',
};

// CSS Custom Properties for easy Tailwind integration
export const cssVariables = {
  '--color-navy-50': colors.primary.navy[50],
  '--color-navy-500': colors.primary.navy[500],
  '--color-navy-700': colors.primary.navy[700],
  '--color-navy-900': colors.primary.navy[900],
  '--color-navy-950': colors.primary.navy[950],
  '--color-teal-500': colors.primary.teal[500],
  '--color-teal-600': colors.primary.teal[600],
  '--color-teal-700': colors.primary.teal[700],
} as const;
