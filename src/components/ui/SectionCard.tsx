import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, spacing, radius, shadow } from '../../theme';

export interface SectionCardProps {
  children?: React.ReactNode;
  eyebrow?: string;
  title?: string;
  /** Left-border accent color and eyebrow color */
  accentColor?: string;
  /** Internal padding — defaults to spacing.lg */
  padding?: number;
  /** Extra style overrides for the outer container */
  style?: StyleProp<ViewStyle>;
  /** Show the colored left border stripe */
  showAccentBorder?: boolean;
  /** Gap between children */
  gap?: number;
}

export function SectionCard({
  children,
  eyebrow,
  title,
  accentColor,
  padding = spacing.lg,
  style,
  showAccentBorder = false,
  gap = spacing.sm,
}: SectionCardProps) {
  return (
    <View
      style={[
        s.card,
        { padding },
        showAccentBorder && accentColor
          ? { borderLeftWidth: 3, borderLeftColor: accentColor }
          : undefined,
        style,
      ]}
    >
      {(eyebrow || title) && (
        <View style={[s.header, { marginBottom: children ? gap : 0 }]}>
          {eyebrow ? (
            <Text style={[s.eyebrow, accentColor ? { color: accentColor } : undefined]}>
              {eyebrow}
            </Text>
          ) : null}
          {title ? <Text style={s.title}>{title}</Text> : null}
        </View>
      )}
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  header: { gap: 3 },
  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.8,
    lineHeight: 27,
  },
});
