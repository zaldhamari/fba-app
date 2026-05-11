import React from 'react';
import {
  View, Text, TouchableOpacity,
  StyleSheet, ViewStyle, StyleProp,
} from 'react-native';
import { DS } from '../../theme/ds';

export interface SectionHeaderProps {
  title:        string;
  subtitle?:    string;
  /** Label for the right-hand action link, e.g. "View All" */
  actionLabel?: string;
  onAction?:    () => void;
  style?:       StyleProp<ViewStyle>;
}

export function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  style,
}: SectionHeaderProps) {
  const hasAction = Boolean(actionLabel && onAction);

  return (
    <View
      style={[s.row, style]}
      accessibilityRole="header"
    >
      <View style={s.textBlock}>
        <Text style={s.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={s.subtitle}>{subtitle}</Text>
        ) : null}
      </View>

      {hasAction ? (
        <TouchableOpacity
          onPress={onAction}
          hitSlop={{ top: 8, bottom: 8, left: 16, right: 0 }}
          activeOpacity={0.65}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={s.action}>{actionLabel} →</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    gap:            8,
  },
  textBlock: {
    flex: 1,
    gap:  3,
  },
  title: {
    fontSize:      18,
    fontWeight:    '800',
    color:         DS.textPrimary,
    letterSpacing: -0.5,
    lineHeight:    24,
  },
  subtitle: {
    fontSize:   13,
    color:      DS.textSecondary,
    lineHeight: 18,
  },
  action: {
    fontSize:      13,
    fontWeight:    '600',
    color:         DS.accent,
    letterSpacing: -0.1,
  },
});
