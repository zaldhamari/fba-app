import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, radius } from '../../theme';

export interface MetricTileProps {
  label: string;
  value: string | number;
  /** Optional emoji or symbol icon above the value */
  icon?: string;
  /** Color for the value and icon */
  color?: string;
  /** Positive trend indicator */
  trend?: 'up' | 'down' | 'neutral';
  /** e.g. "+12%" */
  trendValue?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  /** Show a subtle tinted background matching color */
  tinted?: boolean;
}

const TREND_ICON: Record<'up' | 'down' | 'neutral', string> = {
  up:      '↑',
  down:    '↓',
  neutral: '→',
};
const TREND_COLOR: Record<'up' | 'down' | 'neutral', string> = {
  up:      colors.success,
  down:    colors.danger,
  neutral: colors.textMuted,
};

export function MetricTile({
  label,
  value,
  icon,
  color = colors.textPrimary,
  trend,
  trendValue,
  onPress,
  style,
  tinted = false,
}: MetricTileProps) {
  const tintBg = tinted && color
    ? { backgroundColor: color + '12', borderRadius: radius.lg, borderWidth: 1, borderColor: color + '22' }
    : undefined;

  const Inner = (
    <View style={[s.tile, tintBg, style]}>
      {icon ? <Text style={[s.icon, { color }]}>{icon}</Text> : null}
      <Text style={[s.value, { color }]}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Text>
      <Text style={s.label}>{label}</Text>
      {trend && (
        <View style={s.trendRow}>
          <Text style={[s.trendIcon, { color: TREND_COLOR[trend] }]}>
            {TREND_ICON[trend]}
          </Text>
          {trendValue ? (
            <Text style={[s.trendValue, { color: TREND_COLOR[trend] }]}>
              {trendValue}
            </Text>
          ) : null}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.75}>
        {Inner}
      </TouchableOpacity>
    );
  }
  return Inner;
}

// ─── Horizontal row of MetricTiles with dividers ──────────────────────────────

export interface MetricRowProps {
  metrics: Omit<MetricTileProps, 'style'>[];
  style?: StyleProp<ViewStyle>;
}

export function MetricRow({ metrics, style }: MetricRowProps) {
  return (
    <View style={[s.row, style]}>
      {metrics.map((m, i) => (
        <React.Fragment key={i}>
          {i > 0 && <View style={s.divider} />}
          <MetricTile {...m} style={s.rowTile} />
        </React.Fragment>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  tile: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
  },
  icon:  { fontSize: 18, marginBottom: 2 },
  value: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 30,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.2,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  trendRow:  { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 1 },
  trendIcon: { fontSize: 10, fontWeight: '800' },
  trendValue:{ fontSize: 10, fontWeight: '700' },

  // Row layout
  row: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
  },
  rowTile: { flex: 1 },
  divider: { width: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
});
