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

// ── Primary accent — Blue (#2563EB) ───────────────────────────────────────────
export const accent = {
  base:   '#2563EB' as const,
  light:  '#DBEAFE' as const,
  dim:    'rgba(37,99,235,0.08)'  as const,
  border: 'rgba(37,99,235,0.22)' as const,
} as const;

// ── Section identity — all unified to primary blue ────────────────────────────
export const section = {
  pilot:    '#2563EB' as const,
  search:   '#2563EB' as const,
  brand:    '#2563EB' as const,
  calc:     '#2563EB' as const,
  keywords: '#2563EB' as const,
  launch:   '#2563EB' as const,
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

  info:       '#2563EB' as const,
  infoLight:  '#DBEAFE' as const,
  infoDim:    'rgba(37,99,235,0.10)'  as const,
  infoBorder: 'rgba(37,99,235,0.22)' as const,
} as const;

// ── Extended palette ───────────────────────────────────────────────────────────
export const palette = {
  violet:  '#2563EB' as const,
  pink:    '#2563EB' as const,
  emerald: '#059669' as const,  // kept — semantic success only
  orange:  '#F97316' as const,  // kept — semantic warning only
  cyan:    '#2563EB' as const,
  sky:     '#2563EB' as const,
  rose:    '#2563EB' as const,
  amber:   '#D97706' as const,  // kept — semantic warning only
} as const;

// ── Text ───────────────────────────────────────────────────────────────────────
export const text = {
  primary:   '#0D1B4B' as const,
  secondary: '#5C6B8A' as const,
  muted:     '#8196B0' as const,
  inverse:   '#FFFFFF' as const,
  accent:    '#2563EB' as const,
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
// All existing keys preserved — accent/section colors unified to blue.
export const colors = {
  // Canvas
  bg:         '#F5F7FF',
  bgCard:     '#FFFFFF',
  bgElevated: '#EEF2FA',
  bgSubtle:   '#F8FAFF',
  bgHero:     '#EEF4FF',

  // Primary accent — unified blue
  purple:       '#2563EB',
  purpleLight:  '#DBEAFE',
  purpleDim:    'rgba(37,99,235,0.10)',
  purpleBorder: 'rgba(37,99,235,0.22)',

  // Research section — blue (was sky/cyan)
  cyan:       '#2563EB',
  cyanLight:  '#DBEAFE',
  cyanDim:    'rgba(37,99,235,0.09)',
  cyanBorder: 'rgba(37,99,235,0.22)',

  // Brand section — blue (was rose/pink)
  pink:       '#2563EB',
  pinkLight:  '#DBEAFE',
  pinkDim:    'rgba(37,99,235,0.09)',
  pinkBorder: 'rgba(37,99,235,0.22)',

  // Keywords section — blue (was amber; amber kept only as semantic warning)
  amber:       '#D97706',   // semantic warning — unchanged
  amberLight:  '#FEF3C7',
  amberDim:    'rgba(217,119,6,0.10)',
  amberBorder: 'rgba(217,119,6,0.22)',

  // Semantic status — green: LAUNCH verdict success
  green:      '#059669',
  greenLight: '#D1FAE5',
  greenDim:   'rgba(5,150,105,0.10)',

  // Semantic status — red: AVOID verdict danger
  red:        '#DC2626',
  redLight:   '#FEE2E2',

  // Semantic status — orange: warning
  orange:     '#D97706',
  orangeLight: 'rgba(217,119,6,0.12)',

  // Semantic status tokens
  success:       '#10B981',
  successLight:  '#D1FAE5',
  successDim:    'rgba(16,185,129,0.10)',
  warning:       '#F59E0B',
  warningLight:  '#FEF3C7',
  warningDim:    'rgba(245,158,11,0.10)',
  danger:        '#EF4444',
  dangerLight:   '#FEE2E2',
  dangerDim:     'rgba(239,68,68,0.10)',
  info:          '#2563EB',
  infoLight:     '#DBEAFE',
  infoDim:       'rgba(37,99,235,0.10)',

  // Extended palette aliases — all non-semantic unified to blue
  violet:  '#2563EB',
  hotPink: '#2563EB',
  emerald: '#059669',  // semantic success only

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

  // Section colors — all unified to primary blue
  sectionSearch:   '#2563EB',
  sectionBrand:    '#2563EB',
  sectionCalc:     '#2563EB',
  sectionKeywords: '#2563EB',
  sectionLaunch:   '#2563EB',

  // Legacy aliases
  surface:     '#FFFFFF',
  card:        '#FFFFFF',
  gray100:     '#EEF2FA',
  gray200:     '#E0E8F5',
  gray400:     '#8196B0',
  gray600:     '#5C6B8A',
  gray800:     '#1A2D45',
  accent:      '#2563EB',
  accentLight: '#DBEAFE',
  accentDim:   'rgba(37,99,235,0.08)',
  blue:        '#2563EB',
  blueLight:   '#DBEAFE',
  bgInput:     '#EEF2FA',
} as const;

export type ColorKey = keyof typeof colors;
