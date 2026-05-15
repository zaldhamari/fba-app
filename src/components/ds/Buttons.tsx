import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator, View,
  StyleSheet, ViewStyle, TextStyle, StyleProp,
} from 'react-native';
import { DS, DSButtonSize } from '../../theme/ds';

// ── Size config ───────────────────────────────────────────────────────────────

interface SizeConfig {
  paddingVertical:   number;
  paddingHorizontal: number;
  minHeight:         number;
  fontSize:          number;
}

const SIZE_CONFIG: Record<DSButtonSize, SizeConfig> = {
  sm: { paddingVertical: 14, paddingHorizontal: 24, minHeight: 50, fontSize: 15 },
  md: { paddingVertical: 14, paddingHorizontal: 24, minHeight: 50, fontSize: 15 },
  lg: { paddingVertical: 14, paddingHorizontal: 24, minHeight: 50, fontSize: 15 },
};

// ── Shared props ──────────────────────────────────────────────────────────────

export interface ButtonProps {
  label: string;
  onPress: () => void;
  size?:     DSButtonSize;
  loading?:  boolean;
  disabled?: boolean;
  /** Leading emoji/glyph icon */
  icon?:     string;
  style?:     StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
  accessibilityLabel?: string;
}

// ── PrimaryButton — solid indigo ─────────────────────────────────────────────

export function PrimaryButton({
  label, onPress,
  size     = 'md',
  loading  = false,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const sz = SIZE_CONFIG[size];
  return (
    <TouchableOpacity
      style={[
        s.base,
        s.primary,
        {
          paddingVertical:   sz.paddingVertical,
          paddingHorizontal: sz.paddingHorizontal,
          minHeight:         sz.minHeight,
        },
        disabled && s.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={DS.textInverse} size="small" />
      ) : (
        <View style={s.inner}>
          {icon ? <Text style={[s.icon, { fontSize: sz.fontSize + 1 }]}>{icon}</Text> : null}
          <Text style={[s.primaryLabel, { fontSize: sz.fontSize }, textStyle]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── SecondaryButton — outlined ────────────────────────────────────────────────

export function SecondaryButton({
  label, onPress,
  size     = 'md',
  loading  = false,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const sz = SIZE_CONFIG[size];
  return (
    <TouchableOpacity
      style={[
        s.base,
        s.secondary,
        {
          paddingVertical:   sz.paddingVertical,
          paddingHorizontal: sz.paddingHorizontal,
          minHeight:         sz.minHeight,
        },
        disabled && s.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={DS.textPrimary} size="small" />
      ) : (
        <View style={s.inner}>
          {icon ? <Text style={[s.iconSecondary, { fontSize: sz.fontSize + 1 }]}>{icon}</Text> : null}
          <Text style={[s.secondaryLabel, { fontSize: sz.fontSize }, textStyle]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── GhostButton — tinted, no border ──────────────────────────────────────────

export function GhostButton({
  label, onPress,
  size     = 'md',
  loading  = false,
  disabled = false,
  icon,
  style,
  textStyle,
  accessibilityLabel,
}: ButtonProps) {
  const sz = SIZE_CONFIG[size];
  return (
    <TouchableOpacity
      style={[
        s.base,
        s.ghost,
        {
          paddingVertical:   sz.paddingVertical,
          paddingHorizontal: sz.paddingHorizontal,
          minHeight:         sz.minHeight,
        },
        disabled && s.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading }}
    >
      {loading ? (
        <ActivityIndicator color={DS.indigo} size="small" />
      ) : (
        <View style={s.inner}>
          {icon ? <Text style={[s.iconGhost, { fontSize: sz.fontSize + 1 }]}>{icon}</Text> : null}
          <Text style={[s.ghostLabel, { fontSize: sz.fontSize }, textStyle]}>{label}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   DS.radiusButton,
  },
  primary: {
    backgroundColor: DS.indigo,
    shadowColor:   DS.indigo,
    shadowOffset:  { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius:  10,
    elevation:     5,
  },
  secondary: {
    backgroundColor: DS.bgCard,
    borderWidth:     1.5,
    borderColor:     DS.border,
  },
  ghost: {
    backgroundColor: DS.indigoLight,
  },
  disabled: {
    opacity: 0.45,
  },
  inner: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            6,
  },
  icon:          { color: DS.textInverse },
  iconSecondary: { color: DS.textPrimary },
  iconGhost:     { color: DS.indigo      },
  primaryLabel:  {
    color:          DS.textInverse,
    fontWeight:     '700',
    letterSpacing:  -0.2,
  },
  secondaryLabel: {
    color:          DS.textPrimary,
    fontWeight:     '600',
    letterSpacing:  -0.2,
  },
  ghostLabel: {
    color:          DS.indigo,
    fontWeight:     '700',
    letterSpacing:  -0.2,
  },
});
