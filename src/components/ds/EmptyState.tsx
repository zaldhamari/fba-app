import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { DS } from '../../theme/ds';
import { PrimaryButton, SecondaryButton, GhostButton } from './Buttons';

export interface DSEmptyStateAction {
  label:   string;
  onPress: () => void;
}

export interface DSEmptyStateProps {
  /** Emoji or glyph displayed in the icon tile */
  icon:  string;
  title: string;
  /** Supporting body text */
  body?: string;
  /** Primary CTA — solid emerald button */
  action?:          DSEmptyStateAction;
  /** Secondary CTA — outlined button */
  secondaryAction?: DSEmptyStateAction;
  /** Ghost CTA — tinted, text-only feel */
  ghostAction?:     DSEmptyStateAction;
  /** Accent color applied to the icon tile background tint */
  iconBg?: string;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  secondaryAction,
  ghostAction,
  iconBg = DS.bgElevated,
  style,
}: DSEmptyStateProps) {
  return (
    <View
      style={[s.wrap, style]}
      accessibilityRole="none"
      accessibilityLabel={`${title}${body ? `. ${body}` : ''}`}
    >
      {/* Icon tile */}
      <View style={[s.iconTile, { backgroundColor: iconBg }]}>
        <Text style={s.icon}>{icon}</Text>
      </View>

      {/* Copy */}
      <Text style={s.title}>{title}</Text>
      {body ? <Text style={s.body}>{body}</Text> : null}

      {/* CTAs */}
      {action ? (
        <PrimaryButton
          label={action.label}
          onPress={action.onPress}
          style={s.cta}
        />
      ) : null}

      {secondaryAction ? (
        <SecondaryButton
          label={secondaryAction.label}
          onPress={secondaryAction.onPress}
          style={s.cta}
        />
      ) : null}

      {ghostAction ? (
        <GhostButton
          label={ghostAction.label}
          onPress={ghostAction.onPress}
          style={s.cta}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    alignItems:      'center',
    paddingVertical: 40,
    paddingHorizontal: 32,
    gap: 16,
  },
  iconTile: {
    width:        72,
    height:       72,
    borderRadius: 22,
    alignItems:   'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize:      20,
    fontWeight:    '800',
    color:         DS.textPrimary,
    letterSpacing: -0.5,
    textAlign:     'center',
    lineHeight:    26,
  },
  body: {
    fontSize:   14,
    color:      DS.textSecondary,
    lineHeight: 22,
    textAlign:  'center',
    maxWidth:   280,
  },
  cta: {
    alignSelf: 'stretch',
  },
});
