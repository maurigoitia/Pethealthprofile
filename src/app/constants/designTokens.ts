// Plano Design System - PESSY
// Paleta de colores, tipografía, espaciado y radios de esquina

export const PESSY_COLORS = {
  // Colores principales
  primary: '#074738',
  accent: '#1A9B7D',
  surface: '#E0F2F1',
  background: '#F0FAF9',
  purpleAccent: '#5048CA',

  // Colores de texto
  text: '#1A1A1A',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',

  // Colores de estado
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',

  // Neutros y bordes
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  borderDark: '#D1D5DB',
  divider: '#F0F0F0',

  // Fondos suplementarios
  backgroundLight: '#FFFFFF',
  backgroundAlt: '#F9FAFB',
} as const;

export const PESSY_SPACING = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px',
  '3xl': '64px',
} as const;

export const PESSY_RADIUS = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '24px',
  full: '9999px',
  none: '0',
} as const;

export const PESSY_TYPOGRAPHY = {
  // Headings - Plus Jakarta Sans
  h1: {
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: '1.2',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h2: {
    fontSize: '28px',
    fontWeight: 700,
    lineHeight: '1.3',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h3: {
    fontSize: '24px',
    fontWeight: 700,
    lineHeight: '1.3',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h4: {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: '1.4',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h5: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '1.4',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  h6: {
    fontSize: '14px',
    fontWeight: 600,
    lineHeight: '1.5',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },

  // Body - Manrope
  body: {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: '1.6',
    fontFamily: "'Manrope', sans-serif",
  },
  bodySmall: {
    fontSize: '14px',
    fontWeight: 400,
    lineHeight: '1.5',
    fontFamily: "'Manrope', sans-serif",
  },
  bodyExtraSmall: {
    fontSize: '12px',
    fontWeight: 400,
    lineHeight: '1.4',
    fontFamily: "'Manrope', sans-serif",
  },

  // Labels
  label: {
    fontSize: '12px',
    fontWeight: 600,
    lineHeight: '1.4',
    fontFamily: "'Manrope', sans-serif",
    textTransform: 'uppercase' as const,
  },
  labelSmall: {
    fontSize: '11px',
    fontWeight: 600,
    lineHeight: '1.4',
    fontFamily: "'Manrope', sans-serif",
  },
} as const;

export const PESSY_SHADOWS = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
} as const;

// Helper para aplicar estilos de tipografía
export const getTypographyStyles = (variant: keyof typeof PESSY_TYPOGRAPHY) => {
  const style = PESSY_TYPOGRAPHY[variant];
  return `font-family: ${style.fontFamily}; font-size: ${style.fontSize}; font-weight: ${style.fontWeight}; line-height: ${style.lineHeight};`;
};
