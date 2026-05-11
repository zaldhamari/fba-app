// ─── Siftly Typography System ─────────────────────────────────────────────────
import { TextStyle } from 'react-native';

// ── Backward-compatible object (existing screens reference these) ──────────────
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
} as const;

// ── Extended text styles (new — used by Phase 1 components) ───────────────────

export const textStyles = {
  // Eyebrow label — small, uppercase, wide tracking
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  } as TextStyle,

  // Display / hero heading
  display: {
    fontSize: 32,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -1.5,
    lineHeight: 38,
  } as TextStyle,

  // Section heading
  sectionTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -0.9,
    lineHeight: 28,
  } as TextStyle,

  // Card heading
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0D1B4B',
    letterSpacing: -0.5,
    lineHeight: 22,
  } as TextStyle,

  // Large metric number
  metricNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -1.5,
    lineHeight: 40,
  } as TextStyle,

  // Medium metric
  metricMedium: {
    fontSize: 24,
    fontWeight: '900',
    color: '#0D1B4B',
    letterSpacing: -0.8,
    lineHeight: 28,
  } as TextStyle,

  // Body — primary readable text
  body: {
    fontSize: 14,
    fontWeight: '400',
    color: '#5C6B8A',
    lineHeight: 22,
  } as TextStyle,

  // Body — slightly larger
  bodyLarge: {
    fontSize: 16,
    fontWeight: '400',
    color: '#5C6B8A',
    lineHeight: 26,
  } as TextStyle,

  // Body — smaller
  bodySmall: {
    fontSize: 13,
    fontWeight: '400',
    color: '#5C6B8A',
    lineHeight: 20,
  } as TextStyle,

  // Caption / meta text
  caption: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8196B0',
    lineHeight: 16,
  } as TextStyle,

  // Tab / chip label
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  } as TextStyle,

  // Strong emphasis
  strong: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0D1B4B',
    letterSpacing: -0.2,
  } as TextStyle,
} as const;
