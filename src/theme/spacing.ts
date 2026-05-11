// ─── Siftly Spacing System ─────────────────────────────────────────────────────

// ── Named scale (backward-compatible with all existing screens) ────────────────
export const spacing = {
  xs:  4,
  sm:  8,
  sm2: 12,  // added — fills the gap between sm and md
  md:  16,
  md2: 20,  // added — fills the gap between md and lg
  lg:  24,
  xl:  32,
  xl2: 40,  // added
  xxl: 52,
  xxl2: 48, // added — spec's maximum step
} as const;

// ── Numeric scale (for grid / padding math) ────────────────────────────────────
export const space = {
  0:   0,
  4:   4,
  8:   8,
  12:  12,
  16:  16,
  20:  20,
  24:  24,
  32:  32,
  40:  40,
  48:  48,
  64:  64,
} as const;

// ── Border radius ──────────────────────────────────────────────────────────────
// Existing keys kept unchanged; new semantic keys added as aliases.
export const radius = {
  // Existing (all screens reference these — do not change values)
  sm:   6,
  md:   10,
  lg:   16,
  xl:   20,
  xxl:  24,
  full: 999,

  // New semantic aliases matching the Phase 1 spec
  card:    20,   // Medium — standard card rounding
  section: 24,   // Standard section card
  hero:    28,   // Large — hero panels and modals
  pill:    999,  // Pill / full
} as const;

// ── Borders ────────────────────────────────────────────────────────────────────
export const borders = {
  thin:   { borderWidth: 1,   borderColor: '#E0E8F5' } as const,
  medium: { borderWidth: 1.5, borderColor: '#C5D5EB' } as const,
  light:  { borderWidth: 1,   borderColor: '#EEF2FA' } as const,
} as const;
