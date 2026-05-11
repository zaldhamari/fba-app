import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp,
} from 'react-native';
import { colors, spacing, radius, shadow } from '../../theme';
import { ProgressRing } from './ProgressRing';

export interface HeroCardProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Emoji / glyph displayed in the icon circle */
  icon?: string;
  /** Controls icon circle and eyebrow color */
  accentColor?: string;
  /** If provided, renders a ProgressRing on the right */
  progress?: number;
  /** Decorative background orbs */
  showOrbs?: boolean;
  /** Taps the entire card */
  onPress?: () => void;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function HeroCard({
  eyebrow,
  title,
  subtitle,
  icon,
  accentColor = colors.purple,
  progress,
  showOrbs = true,
  onPress,
  children,
  style,
}: HeroCardProps) {
  const Card = onPress ? TouchableOpacity : View;
  const cardProps = onPress ? { onPress, activeOpacity: 0.88 } : {};

  return (
    // @ts-ignore — polymorphic as/onPress pattern
    <Card style={[s.card, style]} {...cardProps}>
      {/* Decorative atmosphere orbs */}
      {showOrbs && (
        <>
          <View
            style={[s.orb1, { backgroundColor: accentColor + '12' }]}
            pointerEvents="none"
          />
          <View
            style={[s.orb2, { backgroundColor: accentColor + '08' }]}
            pointerEvents="none"
          />
        </>
      )}

      <View style={s.body}>
        {/* Left content */}
        <View style={s.left}>
          {eyebrow ? (
            <Text style={[s.eyebrow, { color: accentColor }]}>{eyebrow}</Text>
          ) : null}
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
          {icon ? (
            <View style={[s.iconWrap, { backgroundColor: accentColor + '14', borderColor: accentColor + '28' }]}>
              <Text style={s.iconGlyph}>{icon}</Text>
            </View>
          ) : null}
          {children ? <View style={s.childrenWrap}>{children}</View> : null}
        </View>

        {/* Right — optional progress ring */}
        {progress !== undefined && (
          <View style={s.right}>
            <ProgressRing
              progress={progress}
              size={76}
              color={accentColor}
              strokeWidth={8}
            />
          </View>
        )}
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xxl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
    ...shadow.md,
  },

  // Orbs
  orb1: {
    position: 'absolute',
    top: -60,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  orb2: {
    position: 'absolute',
    bottom: -40,
    left: -30,
    width: 140,
    height: 140,
    borderRadius: 70,
  },

  body:  { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  left:  { flex: 1, gap: spacing.sm },
  right: { alignItems: 'center', justifyContent: 'center' },

  eyebrow: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -1,
    lineHeight: 30,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },

  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  iconGlyph: { fontSize: 22 },

  childrenWrap: { marginTop: spacing.sm },
});
