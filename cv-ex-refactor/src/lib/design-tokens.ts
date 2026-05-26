/**
 * TypeScript mirror of globals.css @theme block.
 * Used ONLY by TS code that needs raw token values at runtime
 * (e.g., SVG stroke colors in circular-progress.tsx).
 * All other styling uses Tailwind utility classes bound to @theme tokens.
 * Keep in sync with src/app/globals.css @theme block.
 */
export const tokens = {
  colors: {
    // Surface scale
    surface: '#f7f9fb',
    surfaceDim: '#d8dadc',
    surfaceBright: '#f7f9fb',
    surfaceContainerLowest: '#ffffff',
    surfaceContainerLow: '#f2f4f6',
    surfaceContainer: '#eceef0',
    surfaceContainerHigh: '#e6e8ea',
    surfaceContainerHighest: '#e0e3e5',
    onSurface: '#191c1e',
    onSurfaceVariant: '#45464d',
    inverseSurface: '#2d3133',
    inverseOnSurface: '#eff1f3',

    // Outline
    outline: '#76777d',
    outlineVariant: '#c6c6cd',
    surfaceTint: '#565e74',

    // Primary
    primary: '#000000',
    onPrimary: '#ffffff',
    primaryContainer: '#131b2e',
    onPrimaryContainer: '#7c839b',
    primaryFixed: '#dae2fd',
    primaryFixedDim: '#bec6e0',
    onPrimaryFixed: '#131b2e',
    onPrimaryFixedVariant: '#3f465c',
    inversePrimary: '#bec6e0',

    // Secondary (Success Green)
    secondary: '#006e2f',
    onSecondary: '#ffffff',
    secondaryContainer: '#6bff8f',
    onSecondaryContainer: '#007432',
    secondaryFixed: '#6bff8f',
    secondaryFixedDim: '#4ae176',
    onSecondaryFixed: '#002109',
    onSecondaryFixedVariant: '#005321',

    // Tertiary (Action Blue)
    tertiary: '#3980f4',
    onTertiary: '#ffffff',
    tertiaryContainer: '#001a42',
    onTertiaryContainer: '#3980f4',
    tertiaryFixed: '#d8e2ff',
    tertiaryFixedDim: '#adc6ff',
    onTertiaryFixed: '#001a42',
    onTertiaryFixedVariant: '#004395',

    // Error
    error: '#ba1a1a',
    onError: '#ffffff',
    errorContainer: '#ffdad6',
    onErrorContainer: '#93000a',

    // Background
    background: '#f7f9fb',
    onBackground: '#191c1e',
    surfaceVariant: '#e0e3e5',
  },

  typography: {
    displayLg: { family: 'Plus Jakarta Sans', size: '48px', weight: 700, lineHeight: 1.2, letterSpacing: '-0.02em' },
    headlineLg: { family: 'Plus Jakarta Sans', size: '32px', weight: 700, lineHeight: 1.25, letterSpacing: '-0.01em' },
    headlineLgMobile: { family: 'Plus Jakarta Sans', size: '24px', weight: 700, lineHeight: 1.3 },
    headlineMd: { family: 'Plus Jakarta Sans', size: '24px', weight: 600, lineHeight: 1.4 },
    bodyLg: { family: 'Inter', size: '18px', weight: 400, lineHeight: 1.6 },
    bodyMd: { family: 'Inter', size: '16px', weight: 400, lineHeight: 1.6 },
    labelMd: { family: 'Inter', size: '14px', weight: 500, lineHeight: 1.4, letterSpacing: '0.01em' },
    labelSm: { family: 'Inter', size: '12px', weight: 600, lineHeight: 1.4, letterSpacing: '0.03em' },
  },

  radius: {
    sm: '0.25rem',
    DEFAULT: '0.5rem',
    md: '0.75rem',
    lg: '1rem',
    xl: '1.5rem',
    full: '9999px',
  },

  spacing: {
    base: '8px',
    gutter: '24px',
    sectionGap: '80px',
    marginMobile: '16px',
    marginDesktop: '40px',
    containerMax: '1280px',
  },

  shadow: {
    soft: '0 20px 40px -5px rgba(15, 23, 42, 0.08)',
    softLg: '0 20px 40px -15px rgba(15, 23, 42, 0.06)',
    ghostBorder: '0 0 0 1px #c6c6cd',
  },

  layout: {
    sidebarWidth: '256px',
    topnavHeight: '80px',
    authCardMaxWidth: '480px',
  },

  status: {
    success: { bg: 'var(--color-secondary-fixed)', fg: 'var(--color-on-secondary-fixed)' },
    warning: { bg: 'var(--color-tertiary-fixed)', fg: 'var(--color-on-tertiary-fixed)' },
    error: { bg: 'var(--color-error-container)', fg: 'var(--color-on-error-container)' },
    info: { bg: 'var(--color-tertiary-fixed)', fg: 'var(--color-on-tertiary-fixed-variant)' },
    neutral: { bg: 'var(--color-surface-container-high)', fg: 'var(--color-on-surface-variant)' },
  },
} as const;

export type Tokens = typeof tokens;
