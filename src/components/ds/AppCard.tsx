import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { DS } from '../../theme/ds';

export interface AppCardProps {
  children: React.ReactNode;
  /** Inner padding — defaults to DS.cardPadding (20) */
  padding?: number;
  /** Border-radius — defaults to DS.radiusCard (24) */
  radius?: number;
  /** Apply soft drop-shadow — default true */
  shadow?: boolean;
  /** Remove the 1px border — default false */
  noBorder?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Accessible label for the card container */
  accessibilityLabel?: string;
}

export function AppCard({
  children,
  padding  = DS.cardPadding,
  radius   = DS.radiusCard,
  shadow   = true,
  noBorder = false,
  style,
  accessibilityLabel,
}: AppCardProps) {
  return (
    <View
      style={[
        s.base,
        shadow    && s.shadow,
        noBorder  && s.noBorder,
        { padding, borderRadius: radius },
        style,
      ]}
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  base: {
    backgroundColor: DS.bgCard,
    borderWidth: 1,
    borderColor:  DS.border,
  },
  shadow: {
    shadowColor:   DS.textPrimary,
    shadowOffset:  { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius:  12,
    elevation:     3,
  },
  noBorder: {
    borderWidth: 0,
  },
});
