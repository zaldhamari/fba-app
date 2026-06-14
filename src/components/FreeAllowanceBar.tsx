import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS } from './ds';
import type { Tier } from '../hooks/useSubscription';

interface Props {
  tier:      Tier;
  used:      number | null;
  limit:     number;
  resetsOn:  string;
  loading:   boolean;
  onUpgrade: () => void;
}

export function FreeAllowanceBar({ tier, used, limit, resetsOn, loading, onUpgrade }: Props) {
  if (tier !== 'explorer') return null;
  if (loading || used === null) return null;

  const exhausted = used >= limit;
  const labelColor = exhausted ? DS.warningText : DS.textMuted;
  const barBg      = exhausted ? DS.warningBg   : DS.bgSubtle;
  const borderColor = exhausted ? DS.warning + '60' : DS.border;

  const formattedReset = (() => {
    if (!resetsOn) return '';
    try {
      return new Date(resetsOn).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return resetsOn;
    }
  })();

  const fillPct = Math.min(1, used / limit);

  return (
    <TouchableOpacity
      style={[bar.wrap, { backgroundColor: barBg, borderColor }]}
      onPress={exhausted ? onUpgrade : undefined}
      activeOpacity={exhausted ? 0.75 : 1}
      disabled={!exhausted}
    >
      <View style={bar.textRow}>
        <Text style={[bar.label, { color: labelColor }]}>
          {`${used} of ${limit} free lookups used this month`}
        </Text>
        {exhausted ? (
          <Text style={bar.upgrade}>Upgrade →</Text>
        ) : (
          formattedReset
            ? <Text style={bar.reset}>Resets {formattedReset}</Text>
            : null
        )}
      </View>
      <View style={bar.track}>
        <View style={[bar.fill, { width: `${fillPct * 100}%`, backgroundColor: exhausted ? DS.warning : DS.accent }]} />
      </View>
    </TouchableOpacity>
  );
}

const bar = StyleSheet.create({
  wrap:    {
    borderRadius: DS.radiusChip, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 8, gap: 6,
  },
  textRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label:   { fontSize: 11, fontWeight: '600' },
  upgrade: { fontSize: 11, fontWeight: '800', color: DS.warning },
  reset:   { fontSize: 10, color: DS.textMuted },
  track:   { height: 3, backgroundColor: DS.border, borderRadius: 2, overflow: 'hidden' },
  fill:    { height: 3, borderRadius: 2 },
});
