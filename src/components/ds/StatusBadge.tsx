import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { DS, DSStatusVariant } from '../../theme/ds';

// ── Variant → color mapping ───────────────────────────────────────────────────

interface VariantConfig {
  color: string;
  bg:    string;
}

const VARIANT_CONFIG: Record<DSStatusVariant, VariantConfig> = {
  success: { color: DS.successText, bg: DS.successBg },
  warning: { color: DS.warningText, bg: DS.warningBg },
  danger:  { color: DS.dangerText,  bg: DS.dangerBg  },
  info:    { color: DS.infoText,    bg: DS.infoBg    },
  neutral: { color: DS.neutralText, bg: DS.neutralBg },
};

// ── Component ─────────────────────────────────────────────────────────────────

export interface StatusBadgeProps {
  label:    string;
  variant?: DSStatusVariant;
  /** Override text color directly */
  color?:   string;
  /** Override background directly */
  bg?:      string;
  /** Show a small colored dot before the label */
  dot?:     boolean;
  /** Uppercase label text */
  uppercase?: boolean;
  style?:   StyleProp<ViewStyle>;
}

export function StatusBadge({
  label,
  variant   = 'neutral',
  color,
  bg,
  dot       = false,
  uppercase = false,
  style,
}: StatusBadgeProps) {
  const cfg           = VARIANT_CONFIG[variant];
  const resolvedColor = color ?? cfg.color;
  const resolvedBg    = bg    ?? cfg.bg;
  const displayLabel  = uppercase ? label.toUpperCase() : label;

  return (
    <View
      style={[s.pill, { backgroundColor: resolvedBg }, style]}
      accessibilityLabel={label}
      accessibilityRole="text"
    >
      {dot ? (
        <View style={[s.dot, { backgroundColor: resolvedColor }]} />
      ) : null}
      <Text style={[s.label, { color: resolvedColor }]}>
        {displayLabel}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               5,
    paddingHorizontal: 10,
    paddingVertical:   4,
    borderRadius:      DS.radiusBadge,
  },
  dot: {
    width:        6,
    height:       6,
    borderRadius: 3,
    flexShrink:   0,
  },
  label: {
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.1,
  },
});
