import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp,
} from 'react-native';
import { colors, spacing, radius } from '../../theme';

export interface EmptyStateAction {
  label: string;
  onPress: () => void;
  color?: string;
}

export interface EmptyStateProps {
  /** Emoji / glyph centered in the icon circle */
  icon: string;
  title: string;
  subtitle?: string;
  /** Primary CTA button */
  action?: EmptyStateAction;
  /** Secondary / ghost action */
  secondaryAction?: EmptyStateAction;
  /** Icon circle background color (default: #EEF2FA) */
  iconBg?: string;
  /** Icon circle size */
  iconSize?: number;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  secondaryAction,
  iconBg = '#EEF2FA',
  iconSize = 64,
  style,
}: EmptyStateProps) {
  return (
    <View style={[s.wrap, style]}>
      <View style={[s.iconCircle, { width: iconSize, height: iconSize, borderRadius: iconSize / 3, backgroundColor: iconBg }]}>
        <Text style={[s.iconGlyph, { fontSize: iconSize * 0.44 }]}>{icon}</Text>
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
      {action ? (
        <TouchableOpacity
          style={[s.btn, { backgroundColor: action.color ?? colors.purple }]}
          onPress={action.onPress}
          activeOpacity={0.85}
        >
          <Text style={s.btnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
      {secondaryAction ? (
        <TouchableOpacity onPress={secondaryAction.onPress} activeOpacity={0.7}>
          <Text style={[s.secondaryLabel, secondaryAction.color ? { color: secondaryAction.color } : undefined]}>
            {secondaryAction.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconCircle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlyph: {},
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 280,
  },
  btn: {
    borderRadius: radius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  btnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
  },
  secondaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
});
