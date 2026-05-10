// ─── Signal v5 — Premium SaaS Design System ───────────────────────────────────
// Linear · Stripe · Notion · Arc · Superhuman · Modern B2B SaaS

export const colors = {
  // ── Canvas layers ─────────────────────────────────────────────────────────
  bg:         '#F5F7FF',   // Clean blue-white canvas — the premium SaaS baseline
  bgCard:     '#FFFFFF',   // White card surface
  bgElevated: '#EEF2FA',   // Slightly elevated (inputs, chips)
  bgSubtle:   '#F8FAFF',   // Very subtle tinted surface
  bgHero:     '#EEF4FF',   // Indigo hero bg — light and airy

  // ── Primary — Indigo (unified accent) ─────────────────────────────────────
  purple:       '#4361EE',   // Unified indigo accent
  purpleLight:  '#EEF4FF',
  purpleDim:    'rgba(67,97,238,0.10)',
  purpleBorder: 'rgba(67,97,238,0.22)',

  // ── Research — Sky Blue ───────────────────────────────────────────────────
  cyan:       '#0284C7',
  cyanLight:  '#E0F2FE',
  cyanDim:    'rgba(2,132,199,0.09)',
  cyanBorder: 'rgba(2,132,199,0.22)',

  // ── Brand — Rose ──────────────────────────────────────────────────────────
  pink:       '#DB2777',
  pinkLight:  '#FCE7F3',
  pinkDim:    'rgba(219,39,119,0.09)',
  pinkBorder: 'rgba(219,39,119,0.22)',

  // ── Keywords — Amber ──────────────────────────────────────────────────────
  amber:       '#D97706',
  amberLight:  '#FEF3C7',
  amberDim:    'rgba(217,119,6,0.10)',
  amberBorder: 'rgba(217,119,6,0.22)',

  // ── Suppliers / Launch — Emerald ──────────────────────────────────────────
  green:       '#059669',
  greenLight:  '#D1FAE5',
  greenDim:    'rgba(5,150,105,0.10)',

  // ── Status ────────────────────────────────────────────────────────────────
  red:       '#DC2626',
  redLight:  '#FEE2E2',
  orange:    '#D97706',
  orangeLight:'rgba(217,119,6,0.12)',

  // ── Text — WCAG AA+ on light bg ───────────────────────────────────────────
  textPrimary:   '#0D1B4B',   // Deep navy — premium SaaS standard
  textSecondary: '#5C6B8A',   // Blue-tinted medium — readable on #F5F7FF
  textMuted:     '#8196B0',   // Soft muted — atmospheric but readable

  // ── Borders ───────────────────────────────────────────────────────────────
  border:       '#E0E8F5',   // Soft border — premium SaaS standard
  borderBright: '#C5D5EB',   // Slightly stronger accent border

  // ── Utility ───────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#0F172A',

  // ── Section colors (per-tab identity) ────────────────────────────────────
  sectionSearch:   '#0284C7',   // Search — Blue
  sectionBrand:    '#DB2777',   // Brand — Pink
  sectionCalc:     '#7C3AED',   // Calculate — Purple
  sectionKeywords: '#D97706',   // Keywords — Amber
  sectionLaunch:   '#059669',   // Launch — Emerald

  // ── Legacy compatibility (screens that reference old keys) ─────────────────
  surface:    '#FFFFFF',
  card:       '#FFFFFF',
  gray100:    '#EEF2FA',
  gray200:    '#E0E8F5',
  gray400:    '#8196B0',
  gray600:    '#5C6B8A',
  gray800:    '#1A2D45',
  accent:     '#4361EE',
  accentLight:'#EEF4FF',
  accentDim:  'rgba(67,97,238,0.08)',
  blue:       '#0284C7',
  blueLight:  '#E0F2FE',
  bgInput:    '#EEF2FA',
};

export const typography = {
  h1:      { fontSize: 24, fontWeight: '800' as const, color: '#0D1B4B', letterSpacing: -0.8, lineHeight: 30 },
  h2:      { fontSize: 18, fontWeight: '700' as const, color: '#0D1B4B', letterSpacing: -0.4, lineHeight: 24 },
  h3:      { fontSize: 15, fontWeight: '600' as const, color: '#0D1B4B', letterSpacing: -0.2 },
  body:    { fontSize: 14, fontWeight: '400' as const, color: '#5C6B8A', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, color: '#8196B0' },
  label:   {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#8196B0',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 52,
};

export const radius = {
  sm: 6, md: 10, lg: 16, xl: 20, xxl: 24, full: 999,
};

export const shadow = {
  sm:   { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6,  elevation: 2 },
  md:   { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 5 },
  lg:   { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 9 },
  card: { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 14, elevation: 4 },
  float:{ shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 12}, shadowOpacity: 0.18, shadowRadius: 36, elevation: 14 },
  purple: { shadowColor: '#4361EE', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 6 },
  // Verdict chromatic — mid-weight (inline card)
  green: { shadowColor: '#059669', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.20, shadowRadius: 14, elevation: 7 },
  red:   { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 6 },
  amber: { shadowColor: '#D97706', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 6 },
  // Hero-weight glows — verdict reveal + CTA moments
  glowGreen:  { shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 24, elevation: 12 },
  glowRed:    { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 20, elevation: 10 },
  glowAmber:  { shadowColor: '#D97706', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 20, elevation: 10 },
  glowCyan:   { shadowColor: '#0284C7', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 11 },
  glowPurple: { shadowColor: '#5B50E8', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 11 },
};

// Motion timing constants — keep animations coherent across the app
export const motion = {
  snap:    150,   // Immediate feedback: tap, dismiss, toggle
  flow:    250,   // Navigation and expand/collapse
  reveal:  420,   // Content entrance
  verdict: 580,   // Cinematic verdict reveal — slower = more weight
  fill:    950,   // Confidence bar — slow fill creates anticipation
  stagger: 55,    // Per-item delay for list entrance animations
  spring:  { tension: 120, friction: 7 },   // AI verdict badge entrance — snappier
};

export const borders = {
  thin:   { borderWidth: 1,   borderColor: '#E0E8F5' },
  medium: { borderWidth: 1.5, borderColor: '#C5D5EB' },
  light:  { borderWidth: 1,   borderColor: '#EEF2FA' },
};
