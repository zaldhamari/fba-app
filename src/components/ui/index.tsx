import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../../theme';

// ─── New standalone components ────────────────────────────────────────────────
export { SectionCard }             from './SectionCard';
export type { SectionCardProps }   from './SectionCard';

export { ProgressRing }            from './ProgressRing';
export type { ProgressRingProps }  from './ProgressRing';

export { MetricTile, MetricRow }             from './MetricTile';
export type { MetricTileProps, MetricRowProps } from './MetricTile';

export { SegmentedControl }              from './SegmentedControl';
export type { SegmentedControlProps, SegmentOption } from './SegmentedControl';

export { HeroCard }                from './HeroCard';
export type { HeroCardProps }      from './HeroCard';

export { InsightCard }             from './InsightCard';
export type { InsightCardProps, InsightVariant } from './InsightCard';

export { EmptyState }              from './EmptyState';
export type { EmptyStateProps, EmptyStateAction } from './EmptyState';

export { ActivityFeed }            from './ActivityFeed';
export type { ActivityFeedProps, ActivityItem } from './ActivityFeed';

export { QuickActionCard, QuickActionGrid }  from './QuickActionCard';
export type { QuickActionCardProps, QuickActionGridProps } from './QuickActionCard';

// ─── Design tokens ────────────────────────────────────────────────────────────

export const SECTION_COLORS = {
  pilot:    '#4361EE',
  search:   '#0284C7',
  calc:     '#7C3AED',
  brand:    '#DB2777',
  keywords: '#D97706',
  launch:   '#059669',
} as const;

// ─── HeroStatRow (legacy compound metric bar) ─────────────────────────────────

interface HeroStatRowProps {
  stats: { icon: string; value: string | number; label: string }[];
}

export function HeroStatRow({ stats }: HeroStatRowProps) {
  return (
    <View style={hsr.wrap}>
      {stats.map((s, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={hsr.div} />}
          <View style={hsr.tile}>
            <Text style={hsr.icon}>{s.icon}</Text>
            <Text style={hsr.value}>{s.value}</Text>
            <Text style={hsr.label}>{s.label}</Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const hsr = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    ...shadow.sm,
  },
  tile:  { flex: 1, alignItems: 'center', gap: 2, padding: spacing.xs + 2 },
  icon:  { fontSize: 18, marginBottom: 2 },
  value: { fontSize: 22, fontWeight: '900', letterSpacing: -0.8, color: colors.textPrimary },
  label: { fontSize: 9, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2, textAlign: 'center', textTransform: 'uppercase' },
  div:   { width: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
