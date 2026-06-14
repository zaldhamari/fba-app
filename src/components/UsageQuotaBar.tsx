import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';
import { useSubscription } from '../hooks/useSubscription';
import type { Feature } from '../hooks/useSubscription';
import { MONTHLY_LIMITS } from '../hooks/useSubscription';

interface Props {
  feature: Feature;
  onUpgrade?: () => void;
}

export function UsageQuotaBar({ feature, onUpgrade }: Props) {
  const { tier, usage, remaining } = useSubscription();

  const limit = MONTHLY_LIMITS[tier][feature];
  if (limit >= 9999) return null; // unlimited — don't show bar

  const used = (usage as unknown as Record<string, number>)[feature] ?? 0;
  const left = remaining(feature);
  const pct  = limit > 0 ? Math.min(1, used / limit) : 1;

  const barColor = left === 0 ? DS.danger : left <= 2 ? DS.warning : DS.success;

  return (
    <View style={q.wrap}>
      <View style={q.row}>
        <Text style={q.label}>
          {left === 0
            ? `${feature} limit reached`
            : `${left} of ${limit} ${feature} searches left this month`}
        </Text>
        {onUpgrade && (
          <TouchableOpacity onPress={onUpgrade} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
            <Text style={q.upgrade}>Upgrade ›</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={q.track}>
        <View style={[q.fill, { width: `${pct * 100}%` as any, backgroundColor: barColor }]} />
      </View>
    </View>
  );
}

const q = StyleSheet.create({
  wrap:    { gap: 5 },
  row:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label:   { fontSize: 11, color: DS.textMuted, fontWeight: '500' },
  upgrade: { fontSize: 11, color: DS.accent, fontWeight: '700' },
  track:   { height: 4, borderRadius: 2, backgroundColor: DS.border, overflow: 'hidden' },
  fill:    { height: 4, borderRadius: 2 },
});
