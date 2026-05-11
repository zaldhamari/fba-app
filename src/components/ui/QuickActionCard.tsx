import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../../theme';

export interface QuickActionCardProps {
  icon: string;
  label: string;
  sublabel?: string;
  /** Accent color for icon background and badge */
  color?: string;
  /** Optional numeric or string badge (e.g. "3" or "NEW") */
  badge?: string | number;
  /** Disabled state — mutes the card and blocks press */
  disabled?: boolean;
  onPress: () => void;
  /** Layout: column (default) stacks icon above label; row places them side by side */
  layout?: 'column' | 'row';
  style?: StyleProp<ViewStyle>;
}

export function QuickActionCard({
  icon,
  label,
  sublabel,
  color = colors.purple,
  badge,
  disabled = false,
  onPress,
  layout = 'column',
  style,
}: QuickActionCardProps) {
  const isRow = layout === 'row';

  return (
    <TouchableOpacity
      style={[
        s.card,
        isRow && s.cardRow,
        disabled && s.cardDisabled,
        style,
      ]}
      onPress={onPress}
      activeOpacity={disabled ? 1 : 0.78}
      disabled={disabled}
    >
      {/* Icon */}
      <View style={[
        s.iconWrap,
        isRow && s.iconWrapRow,
        { backgroundColor: disabled ? '#F0F3F8' : color + '16', borderColor: disabled ? '#E0E8F5' : color + '28' },
      ]}>
        <Text style={[s.icon, isRow && s.iconRow, disabled && s.iconDisabled]}>{icon}</Text>
      </View>

      {/* Labels */}
      <View style={[s.textBlock, isRow && s.textBlockRow]}>
        <Text
          style={[s.label, isRow && s.labelRow, disabled && s.labelDisabled]}
          numberOfLines={isRow ? 1 : 2}
        >
          {label}
        </Text>
        {sublabel ? (
          <Text style={[s.sublabel, disabled && s.sublabelDisabled]} numberOfLines={1}>
            {sublabel}
          </Text>
        ) : null}
      </View>

      {/* Badge */}
      {badge != null ? (
        <View style={[s.badge, { backgroundColor: disabled ? colors.textMuted + '22' : color }]}>
          <Text style={s.badgeText}>{badge}</Text>
        </View>
      ) : null}

      {/* Chevron for row layout */}
      {isRow ? (
        <Text style={[s.chevron, disabled && s.chevronDisabled]}>›</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Grid of QuickActionCards ─────────────────────────────────────────────────

export interface QuickActionGridProps {
  actions: Omit<QuickActionCardProps, 'style'>[];
  columns?: 2 | 3 | 4;
  style?: StyleProp<ViewStyle>;
}

export function QuickActionGrid({
  actions,
  columns = 2,
  style,
}: QuickActionGridProps) {
  return (
    <View style={[g.wrap, style]}>
      {actions.map((action, i) => (
        <QuickActionCard
          key={i}
          {...action}
          style={[g.item, { width: `${100 / columns}%` as any }]}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
    ...shadow.sm,
    position: 'relative',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
  },
  cardDisabled: {
    opacity: 0.55,
  },

  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapRow: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    flexShrink: 0,
  },
  icon:         { fontSize: 22 },
  iconRow:      { fontSize: 18 },
  iconDisabled: { opacity: 0.5 },

  textBlock:    { alignItems: 'center', gap: 2 },
  textBlockRow: { flex: 1, alignItems: 'flex-start' },

  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  labelRow:      { textAlign: 'left' },
  labelDisabled: { color: colors.textMuted },

  sublabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  sublabelDisabled: { color: colors.textMuted },

  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    minWidth: 18,
    height: 18,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: colors.white,
    letterSpacing: 0.3,
  },

  chevron: {
    fontSize: 22,
    color: colors.textMuted,
    lineHeight: 24,
    marginLeft: 'auto',
  },
  chevronDisabled: { opacity: 0.4 },
});

const g = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  item: {
    flexGrow: 1,
  },
});
