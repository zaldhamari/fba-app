// ─── Siftly Color System ───────────────────────────────────────────────────────
// Single source of truth for all color tokens.
// All values match the existing runtime theme — additions are purely additive.

// ── Canvas layers ──────────────────────────────────────────────────────────────
export const bg = {
  base:     '#F5F7FF' as const,  // App-wide canvas
  card:     '#FFFFFF' as const,  // Card surfaces
  elevated: '#EEF2FA' as const,  // Inputs, chips, elevated surfaces
  subtle:   '#F8FAFF' as const,  // Very faint tint
  hero:     '#EEF4FF' as const,  // Section hero panels
} as const;

// ── Primary accent — Indigo (#4361EE) ─────────────────────────────────────────
export const accent = {
  base:   '#4361EE' as const,
  light:  '#EEF4FF' as const,
  dim:    'rgba(67,97,238,0.08)'  as const,
  border: 'rgba(67,97,238,0.22)' as const,
} as const;

// ── Section identity colors ────────────────────────────────────────────────────
export const section = {
  pilot:    '#4361EE' as const,  // Co-pilot — Indigo
  search:   '#0284C7' as const,  // Search — Sky Blue
  brand:    '#DB2777' as const,  // Brand — Rose
  calc:     '#7C3AED' as const,  // Calculator — Violet
  keywords: '#D97706' as const,  // Keywords — Amber
  launch:   '#059669' as const,  // Launch — Emerald
} as const;

// ── Semantic status ────────────────────────────────────────────────────────────
export const status = {
  success:       '#10B981' as const,
  successLight:  '#D1FAE5' as const,
  successDim:    'rgba(16,185,129,0.10)'  as const,
  successBorder: 'rgba(16,185,129,0.22)' as const,

  warning:       '#F59E0B' as const,
  warningLight:  '#FEF3C7' as const,
  warningDim:    'rgba(245,158,11,0.10)'  as const,
  warningBorder: 'rgba(245,158,11,0.22)' as const,

  danger:       '#EF4444' as const,
  dangerLight:  '#FEE2E2' as const,
  dangerDim:    'rgba(239,68,68,0.10)'  as const,
  dangerBorder: 'rgba(239,68,68,0.22)' as const,

  info:       '#06B6D4' as const,
  infoLight:  '#CFFAFE' as const,
  infoDim:    'rgba(6,182,212,0.10)'  as const,
  infoBorder: 'rgba(6,182,212,0.22)' as const,
} as const;

// ── Extended palette ───────────────────────────────────────────────────────────
export const palette = {
  violet:  '#8B5CF6' as const,
  pink:    '#EC4899' as const,
  emerald: '#059669' as const,
  orange:  '#F97316' as const,
  cyan:    '#06B6D4' as const,
  sky:     '#0284C7' as const,
  rose:    '#DB2777' as const,
  amber:   '#D97706' as const,
} as const;

// ── Text ───────────────────────────────────────────────────────────────────────
export const text = {
  primary:   '#0D1B4B' as const,
  secondary: '#5C6B8A' as const,
  muted:     '#8196B0' as const,
  inverse:   '#FFFFFF' as const,
  accent:    '#4361EE' as const,
} as const;

// ── Borders ────────────────────────────────────────────────────────────────────
export const border = {
  base:   '#E0E8F5' as const,
  bright: '#C5D5EB' as const,
  light:  '#EEF2FA' as const,
} as const;

// ── Utility ────────────────────────────────────────────────────────────────────
export const util = {
  white: '#FFFFFF' as const,
  black: '#0F172A' as const,
  transparent: 'transparent' as const,
} as const;

// ── Flat colors object (backward-compatible with existing screens) ─────────────
// All existing keys are preserved with identical values.
export const colors = {
  // Canvas
  bg:         '#F5F7FF',
  bgCard:     '#FFFFFF',
  bgElevated: '#EEF2FA',
  bgSubtle:   '#F8FAFF',
  bgHero:     '#EEF4FF',

  // Primary accent
  purple:       '#4361EE',
  purpleLight:  '#EEF4FF',
  purpleDim:    'rgba(67,97,238,0.10)',
  purpleBorder: 'rgba(67,97,238,0.22)',

  // Research / Sky blue
  cyan:       '#0284C7',
  cyanLight:  '#E0F2FE',
  cyanDim:    'rgba(2,132,199,0.09)',
  cyanBorder: 'rgba(2,132,199,0.22)',

  // Brand / Rose
  pink:       '#DB2777',
  pinkLight:  '#FCE7F3',
  pinkDim:    'rgba(219,39,119,0.09)',
  pinkBorder: 'rgba(219,39,119,0.22)',

  // Keywords / Amber
  amber:       '#D97706',
  amberLight:  '#FEF3C7',
  amberDim:    'rgba(217,119,6,0.10)',
  amberBorder: 'rgba(217,119,6,0.22)',

  // Launch / Emerald
  green:      '#059669',
  greenLight: '#D1FAE5',
  greenDim:   'rgba(5,150,105,0.10)',

  // Status
  red:        '#DC2626',
  redLight:   '#FEE2E2',
  orange:     '#D97706',
  orangeLight: 'rgba(217,119,6,0.12)',

  // New semantic status tokens (additive — don't conflict with existing keys)
  success:       '#10B981',
  successLight:  '#D1FAE5',
  successDim:    'rgba(16,185,129,0.10)',
  warning:       '#F59E0B',
  warningLight:  '#FEF3C7',
  warningDim:    'rgba(245,158,11,0.10)',
  danger:        '#EF4444',
  dangerLight:   '#FEE2E2',
  dangerDim:     'rgba(239,68,68,0.10)',
  info:          '#06B6D4',
  infoLight:     '#CFFAFE',
  infoDim:       'rgba(6,182,212,0.10)',

  // New extended palette aliases
  violet: '#8B5CF6',
  hotPink: '#EC4899',
  emerald: '#059669',

  // Text
  textPrimary:   '#0D1B4B',
  textSecondary: '#5C6B8A',
  textMuted:     '#8196B0',

  // Borders
  border:       '#E0E8F5',
  borderBright: '#C5D5EB',

  // Utility
  white: '#FFFFFF',
  black: '#0F172A',

  // Section colors
  sectionSearch:   '#0284C7',
  sectionBrand:    '#DB2777',
  sectionCalc:     '#7C3AED',
  sectionKeywords: '#D97706',
  sectionLaunch:   '#059669',

  // Legacy aliases
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  gray100:     '#EEF2FA',
  gray200:     '#E0E8F5',
  gray400:     '#8196B0',
  gray600:     '#5C6B8A',
  gray800:     '#1A2D45',
  accent:      '#4361EE',
  accentLight: '#EEF4FF',
  accentDim:   'rgba(67,97,238,0.08)',
  blue:        '#0284C7',
  blueLight:   '#E0F2FE',
  bgInput:     '#EEF2FA',
} as const;

export type ColorKey = keyof typeof colors;
