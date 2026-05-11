// ─── Siftly Design System — Central Export ────────────────────────────────────
// All existing import paths (import { colors, ... } from '../theme') continue
// to work unchanged. Sub-files are the canonical source of truth.

export { colors }                     from './colors';
export type { ColorKey }              from './colors';
export { bg, accent, section, status, palette, text, border, util } from './colors';

export { spacing, space, radius, borders } from './spacing';

export { typography, textStyles }    from './typography';

export { shadow, motion }            from './shadows';

// Phase 1 Design System tokens
export { DS } from './ds';
export type { DSStatusVariant, DSButtonSize } from './ds';
