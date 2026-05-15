// ─── Siftly Shadow System ─────────────────────────────────────────────────────
// All shadows use low opacity over the primary navy (#0D1B4B) for cohesion.
// Chromatic glows are reserved for verdict reveals and CTA moments.

export const shadow = {
  // ── Structural shadows — elevation hierarchy ───────────────────────────────
  sm:   { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 6,  elevation: 2 },
  md:   { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16, elevation: 5 },
  lg:   { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.14, shadowRadius: 28, elevation: 9 },
  card: { shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.09, shadowRadius: 14, elevation: 4 },
  float:{ shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 12}, shadowOpacity: 0.18, shadowRadius: 36, elevation: 14 },

  // ── Chromatic — verdict accents ────────────────────────────────────────────
  purple:    { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 14, elevation: 6 },
  green:     { shadowColor: '#059669', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.20, shadowRadius: 14, elevation: 7 },
  red:       { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 6 },
  amber:     { shadowColor: '#D97706', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 12, elevation: 6 },

  // ── Hero glows — cinematic moments ────────────────────────────────────────
  glowGreen:  { shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.32, shadowRadius: 24, elevation: 12 },
  glowRed:    { shadowColor: '#DC2626', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 20, elevation: 10 },
  glowAmber:  { shadowColor: '#D97706', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.26, shadowRadius: 20, elevation: 10 },
  glowCyan:   { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 11 },
  glowPurple: { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.28, shadowRadius: 22, elevation: 11 },
  glowPink:   { shadowColor: '#2563EB', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.24, shadowRadius: 20, elevation: 10 },

  // ── New semantic aliases (matching Phase 1 spec) ───────────────────────────
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
} as const;

// ── Motion timing constants ────────────────────────────────────────────────────
export const motion = {
  snap:    150,   // Immediate feedback: tap, dismiss, toggle
  flow:    250,   // Navigation and expand/collapse
  reveal:  420,   // Content entrance
  verdict: 580,   // Cinematic verdict reveal
  fill:    950,   // Confidence bar — slow fill creates anticipation
  stagger: 55,    // Per-item delay for list entrance animations
  spring:  { tension: 120, friction: 7 },
} as const;
