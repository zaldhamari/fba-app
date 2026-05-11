import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  StyleSheet, ViewStyle, StyleProp,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../../theme';

export type InsightVariant = 'default' | 'tip' | 'warning' | 'success' | 'info';

export interface InsightCardProps {
  /** Eyebrow label above the text */
  label?: string;
  text: string;
  /** Emoji / glyph shown in the leading icon circle */
  icon?: string;
  /** Overrides the variant color for the icon and eyebrow */
  color?: string;
  variant?: InsightVariant;
  /** Make the whole card tappable */
  onPress?: () => void;
  /** Optional CTA text */
  actionLabel?: string;
  onAction?: () => void;
  /** Animate in on mount */
  animated?: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

const VARIANT_COLORS: Record<InsightVariant, string> = {
  default: colors.purple,
  tip:     '#4361EE',
  warning: colors.warning,
  success: colors.success,
  info:    colors.info,
};

const VARIANT_BG: Record<InsightVariant, string> = {
  default: '#EEF4FF',
  tip:     '#EEF4FF',
  warning: '#FFFBEB',
  success: '#ECFDF5',
  info:    '#F0FDFF',
};

const VARIANT_BORDER: Record<InsightVariant, string> = {
  default: 'rgba(67,97,238,0.22)',
  tip:     'rgba(67,97,238,0.22)',
  warning: 'rgba(245,158,11,0.30)',
  success: 'rgba(16,185,129,0.30)',
  info:    'rgba(6,182,212,0.30)',
};

export function InsightCard({
  label,
  text,
  icon,
  color,
  variant = 'default',
  onPress,
  actionLabel,
  onAction,
  animated: shouldAnimate = false,
  children,
  style,
}: InsightCardProps) {
  const resolvedColor  = color ?? VARIANT_COLORS[variant];
  const resolvedBg     = VARIANT_BG[variant];
  const resolvedBorder = VARIANT_BORDER[variant];

  const opacity   = useRef(new Animated.Value(shouldAnimate ? 0 : 1)).current;
  const translateY = useRef(new Animated.Value(shouldAnimate ? 8 : 0)).current;

  useEffect(() => {
    if (!shouldAnimate) return;
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.spring(translateY, { toValue: 0, tension: 140, friction: 14, useNativeDriver: true }),
    ]).start();
  }, []);

  const Wrapper = onPress ? TouchableOpacity : View;
  const wrapperProps = onPress ? { onPress, activeOpacity: 0.82 } : {};

  return (
    // @ts-ignore
    <Animated.View style={[{ opacity, transform: [{ translateY }] }, style]}>
      <Wrapper
        // @ts-ignore
        style={[
          s.card,
          {
            backgroundColor: resolvedBg,
            borderColor: resolvedBorder,
          },
        ]}
        {...wrapperProps}
      >
        <View style={s.row}>
          {/* Leading icon */}
          {icon ? (
            <View style={[s.iconWrap, { backgroundColor: resolvedColor + '18', borderColor: resolvedColor + '30' }]}>
              <Text style={s.icon}>{icon}</Text>
            </View>
          ) : (
            /* Pulsing dot when no icon */
            <View style={[s.dot, { backgroundColor: resolvedColor }]} />
          )}

          {/* Text block */}
          <View style={s.content}>
            {label ? (
              <Text style={[s.label, { color: resolvedColor }]}>{label.toUpperCase()}</Text>
            ) : null}
            <Text style={s.text}>{text}</Text>
            {children}
          </View>
        </View>

        {/* Optional CTA */}
        {actionLabel && onAction ? (
          <TouchableOpacity style={[s.action, { borderTopColor: resolvedBorder }]} onPress={onAction} activeOpacity={0.75}>
            <Text style={[s.actionLabel, { color: resolvedColor }]}>{actionLabel} →</Text>
          </TouchableOpacity>
        ) : null}
      </Wrapper>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...shadow.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  icon:    { fontSize: 16 },
  dot:     { width: 8, height: 8, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  content: { flex: 1, gap: 3 },
  label: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2,
  },
  text: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    letterSpacing: -0.1,
  },
  action: {
    borderTopWidth: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignItems: 'flex-end',
  },
  actionLabel: { fontSize: 12, fontWeight: '700' },
});
