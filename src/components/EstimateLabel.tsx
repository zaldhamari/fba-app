import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS } from '../theme/ds';

export type EstimateType = 'estimated' | 'directional' | 'confirmed' | 'user-entered';

const ESTIMATE_CFG: Record<EstimateType, { label: string; color: string }> = {
  estimated:      { label: 'Est.',        color: DS.warning },
  directional:    { label: 'Directional', color: DS.textMuted },
  confirmed:      { label: 'Confirmed',   color: DS.success },
  'user-entered': { label: 'Entered',     color: DS.accent },
};

export function EstimateLabel({ type }: { type: EstimateType }) {
  const cfg = ESTIMATE_CFG[type];
  return (
    <View style={[s.pill, { backgroundColor: cfg.color + '18', borderColor: cfg.color + '44' }]}>
      <Text style={[s.text, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  pill: {
    borderRadius: DS.radiusBadge,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
});
