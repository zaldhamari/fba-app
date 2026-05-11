// ─── Siftly Phase 1 Design System — barrel export ─────────────────────────────
// Import from this path:  import { AppCard, PrimaryButton, ... } from '../components/ds';

// ── AppCard ───────────────────────────────────────────────────────────────────
export { AppCard }          from './AppCard';
export type { AppCardProps } from './AppCard';

// ── Buttons ───────────────────────────────────────────────────────────────────
export { PrimaryButton, SecondaryButton, GhostButton } from './Buttons';
export type { ButtonProps }                            from './Buttons';

// ── MetricCard ────────────────────────────────────────────────────────────────
export { MetricCard, MetricRow }                          from './MetricCard';
export type { MetricCardProps, MetricRowProps, MetricRowItem } from './MetricCard';

// ── SectionHeader ─────────────────────────────────────────────────────────────
export { SectionHeader }          from './SectionHeader';
export type { SectionHeaderProps } from './SectionHeader';

// ── StatusBadge ───────────────────────────────────────────────────────────────
export { StatusBadge }          from './StatusBadge';
export type { StatusBadgeProps } from './StatusBadge';

// ── InputField ────────────────────────────────────────────────────────────────
export { InputField }          from './InputField';
export type { InputFieldProps } from './InputField';

// ── EmptyState ────────────────────────────────────────────────────────────────
export { EmptyState }                              from './EmptyState';
export type { DSEmptyStateProps, DSEmptyStateAction } from './EmptyState';

// ── LoadingSkeleton ───────────────────────────────────────────────────────────
export {
  SkeletonLine,
  SkeletonCard,
  SkeletonMetricRow,
  SkeletonListItem,
  SkeletonProductCard,
  SkeletonDashboard,
} from './LoadingSkeleton';
export type { SkeletonLineProps } from './LoadingSkeleton';

// ── Re-export DS tokens for convenience ──────────────────────────────────────
export { DS }                       from '../../theme/ds';
export type { DSStatusVariant, DSButtonSize } from '../../theme/ds';
