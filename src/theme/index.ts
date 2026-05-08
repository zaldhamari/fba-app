// ─── Signal v4 — Cinematic Premium System ──────────────────────────────────────
// Apple restraint · Linear polish · Arc atmosphere · premium SaaS

export const colors = {
  // ── Canvas layers ─────────────────────────────────────────────────────────
  bg:         '#ECF1FB',   // Richer blue-tinted canvas
  bgCard:     '#FFFFFF',   // White card surface
  bgElevated: '#E3EBF7',   // Deeper recessed (inputs, chips)
  bgSubtle:   '#F4F8FF',   // Very subtle tinted surface
  bgHero:     '#D8E8FF',   // Atmospheric hero — stronger cyan-blue depth layer

  // ── Primary — Deep Indigo (Co-Pilot) ──────────────────────────────────────
  purple:       '#5B50E8',
  purpleLight:  '#EEF2FF',
  purpleDim:    'rgba(91,80,232,0.10)',
  purpleBorder: 'rgba(91,80,232,0.22)',

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
  textPrimary:   '#091428',   // Rich navy-black, maximum depth
  textSecondary: '#375170',   // Blue-tinted medium — strong on cool bg
  textMuted:     '#6D8DAF',   // Blue-tinted muted — readable, atmospheric

  // ── Borders ───────────────────────────────────────────────────────────────
  border:       '#C8D5EA',   // Richer border — more definition
  borderBright: '#B0C4DF',   // Stronger accent border

  // ── Utility ───────────────────────────────────────────────────────────────
  white: '#FFFFFF',
  black: '#0F172A',

  // ── Legacy compatibility (screens that reference old keys) ─────────────────
  surface:    '#FFFFFF',
  card:       '#FFFFFF',
  gray100:    '#EDF2FA',
  gray200:    '#C8D5EA',
  gray400:    '#6D8DAF',
  gray600:    '#375170',
  gray800:    '#1A2D45',
  accent:     '#5B50E8',
  accentLight:'#EEF2FF',
  accentDim:  'rgba(91,80,232,0.08)',
  blue:       '#0284C7',
  blueLight:  '#E0F2FE',
  bgInput:    '#E3EBF7',
};

export const typography = {
  h1:      { fontSize: 24, fontWeight: '800' as const, color: '#091428', letterSpacing: -0.8, lineHeight: 30 },
  h2:      { fontSize: 18, fontWeight: '700' as const, color: '#091428', letterSpacing: -0.4, lineHeight: 24 },
  h3:      { fontSize: 15, fontWeight: '600' as const, color: '#091428', letterSpacing: -0.2 },
  body:    { fontSize: 14, fontWeight: '400' as const, color: '#375170', lineHeight: 22 },
  caption: { fontSize: 12, fontWeight: '400' as const, color: '#6D8DAF' },
  label:   {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#6D8DAF',
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 52,
};

export const radius = {
  sm: 6, md: 10, lg: 14, xl: 18, xxl: 24, full: 999,
};

export const shadow = {
  sm:   { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.10, shadowRadius: 5,  elevation: 2 },
  md:   { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 5 },
  lg:   { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.17, shadowRadius: 24, elevation: 9 },
  card: { shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 5 },
  float:{ shadowColor: '#0D1E3A', shadowOffset: { width: 0, height: 12}, shadowOpacity: 0.22, shadowRadius: 32, elevation: 14 },
  purple: { shadowColor: '#5B50E8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 6 },
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
  thin:   { borderWidth: 1,   borderColor: '#C8D5EA' },
  medium: { borderWidth: 1.5, borderColor: '#B0C4DF' },
  light:  { borderWidth: 1,   borderColor: '#D8E8FF' },
};
