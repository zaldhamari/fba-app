// ─── Siftly Phase 1 Design System Tokens ──────────────────────────────────────
// Single source of truth from the approved 6-screen mockup.
// All Phase 1 DS components import from here exclusively.
// Existing screens continue to import from '../theme' (backward-compat unchanged).

// ── Canvas ────────────────────────────────────────────────────────────────────
export const DS_BG_CANVAS   = '#F5F7FF' as const;
export const DS_BG_CARD     = '#FFFFFF' as const;
export const DS_BG_ELEVATED = '#EEF2FA' as const;
export const DS_BG_SUBTLE   = '#F8FAFF' as const;

// ── Text ──────────────────────────────────────────────────────────────────────
export const DS_TEXT_PRIMARY   = '#0D1B4B' as const;
export const DS_TEXT_SECONDARY = '#5C6B8A' as const;
export const DS_TEXT_MUTED     = '#8196B0' as const;
export const DS_TEXT_INVERSE   = '#FFFFFF' as const;

// ── Borders ───────────────────────────────────────────────────────────────────
export const DS_BORDER       = '#E6ECFF' as const;
export const DS_BORDER_LIGHT = '#F0F4FF' as const;

// ── Primary Accent — Blue (#2563EB) ───────────────────────────────────────────
export const DS_ACCENT       = '#2563EB' as const;
export const DS_ACCENT_LIGHT = '#DBEAFE' as const;
export const DS_ACCENT_DARK  = '#1D4ED8' as const;

// ── Indigo — alias for primary blue (backward compat for components) ──────────
export const DS_INDIGO       = '#2563EB' as const;
export const DS_INDIGO_LIGHT = '#DBEAFE' as const;

// ── Pink — aliased to blue (Brand Studio accent, unified) ─────────────────────
export const DS_PINK       = '#2563EB' as const;
export const DS_PINK_LIGHT = '#DBEAFE' as const;

// ── Gold — Premium / trust score accent (intentional, not removed) ────────────
export const DS_GOLD       = '#B45309' as const;
export const DS_GOLD_LIGHT = '#FFFBEB' as const;

// ── Semantic status — true success / warning / danger / info only ─────────────
export const DS_SUCCESS      = '#10B981' as const;
export const DS_SUCCESS_BG   = '#ECFDF5' as const;
export const DS_SUCCESS_TEXT = '#059669' as const;

export const DS_WARNING      = '#F59E0B' as const;
export const DS_WARNING_BG   = '#FFFBEB' as const;
export const DS_WARNING_TEXT = '#D97706' as const;

export const DS_DANGER       = '#EF4444' as const;
export const DS_DANGER_BG    = '#FEF2F2' as const;
export const DS_DANGER_TEXT  = '#DC2626' as const;

export const DS_INFO         = '#2563EB' as const;
export const DS_INFO_BG      = '#DBEAFE' as const;
export const DS_INFO_TEXT    = '#1D4ED8' as const;

export const DS_NEUTRAL      = '#8196B0' as const;
export const DS_NEUTRAL_BG   = '#F5F7FF' as const;
export const DS_NEUTRAL_TEXT = '#5C6B8A' as const;

// ── Skeleton ──────────────────────────────────────────────────────────────────
export const DS_SKELETON_BASE = '#EEF2FA' as const;

// ── Radius ────────────────────────────────────────────────────────────────────
export const DS_RADIUS_CARD   = 24 as const;
export const DS_RADIUS_HERO   = 28 as const;
export const DS_RADIUS_BUTTON = 14 as const;
export const DS_RADIUS_INPUT  = 14 as const;
export const DS_RADIUS_CHIP   = 8  as const;
export const DS_RADIUS_BADGE  = 999 as const;

// ── Spacing ───────────────────────────────────────────────────────────────────
export const DS_PAGE_PADDING = 20 as const;
export const DS_CARD_PADDING = 20 as const;
export const DS_SECTION_GAP  = 20 as const;
export const DS_CARD_GAP     = 12 as const;
export const DS_ROW_GAP      = 8  as const;

// ── Shadows ───────────────────────────────────────────────────────────────────
export const DS_SHADOW_CARD = {
  shadowColor:   '#0D1B4B',
  shadowOffset:  { width: 0, height: 2 },
  shadowOpacity: 0.06,
  shadowRadius:  12,
  elevation:     3,
} as const;

export const DS_SHADOW_FLOAT = {
  shadowColor:   '#0D1B4B',
  shadowOffset:  { width: 0, height: 6 },
  shadowOpacity: 0.10,
  shadowRadius:  20,
  elevation:     8,
} as const;

export const DS_SHADOW_BUTTON = {
  shadowColor:   '#2563EB',
  shadowOffset:  { width: 0, height: 4 },
  shadowOpacity: 0.28,
  shadowRadius:  10,
  elevation:     5,
} as const;

// ── Status variant type ───────────────────────────────────────────────────────
export type DSStatusVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// ── Button size type ──────────────────────────────────────────────────────────
export type DSButtonSize = 'sm' | 'md' | 'lg';

// ── Convenience object (for components that prefer dot-access) ────────────────
export const DS = {
  bgCanvas:   DS_BG_CANVAS,
  bgCard:     DS_BG_CARD,
  bgElevated: DS_BG_ELEVATED,
  bgSubtle:   DS_BG_SUBTLE,

  textPrimary:   DS_TEXT_PRIMARY,
  textSecondary: DS_TEXT_SECONDARY,
  textMuted:     DS_TEXT_MUTED,
  textInverse:   DS_TEXT_INVERSE,

  border:      DS_BORDER,
  borderLight: DS_BORDER_LIGHT,

  accent:      DS_ACCENT,
  accentLight: DS_ACCENT_LIGHT,
  accentDark:  DS_ACCENT_DARK,

  indigo:      DS_INDIGO,
  indigoLight: DS_INDIGO_LIGHT,

  pink:        DS_PINK,
  pinkLight:   DS_PINK_LIGHT,

  gold:        DS_GOLD,
  goldLight:   DS_GOLD_LIGHT,

  success:     DS_SUCCESS,
  successBg:   DS_SUCCESS_BG,
  successText: DS_SUCCESS_TEXT,

  warning:     DS_WARNING,
  warningBg:   DS_WARNING_BG,
  warningText: DS_WARNING_TEXT,

  danger:      DS_DANGER,
  dangerBg:    DS_DANGER_BG,
  dangerText:  DS_DANGER_TEXT,

  info:        DS_INFO,
  infoBg:      DS_INFO_BG,
  infoText:    DS_INFO_TEXT,

  neutral:     DS_NEUTRAL,
  neutralBg:   DS_NEUTRAL_BG,
  neutralText: DS_NEUTRAL_TEXT,

  skeletonBase: DS_SKELETON_BASE,

  radiusCard:   DS_RADIUS_CARD,
  radiusHero:   DS_RADIUS_HERO,
  radiusButton: DS_RADIUS_BUTTON,
  radiusInput:  DS_RADIUS_INPUT,
  radiusChip:   DS_RADIUS_CHIP,
  radiusBadge:  DS_RADIUS_BADGE,

  pagePadding: DS_PAGE_PADDING,
  cardPadding: DS_CARD_PADDING,
  sectionGap:  DS_SECTION_GAP,
  cardGap:     DS_CARD_GAP,
  rowGap:      DS_ROW_GAP,
} as const;
