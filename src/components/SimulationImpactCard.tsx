// ── Phase 15: Simulation Impact Card ─────────────────────────────────────────
// Shows what improved, worsened, or stayed neutral after a simulation.
// Proportionate language only — no alarmist wording.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS } from '../theme/ds';
import type { SimulationImpact, SimulationDelta } from '../lib/productSimulation/types';

interface Props {
  impacts:        SimulationImpact[];
  delta:          SimulationDelta;
  isEstimated:    boolean;
  estimatedNote?: string;
}

const DIR_ICON: Record<SimulationImpact['direction'], string> = {
  improved: '↑',
  worsened: '↓',
  neutral:  '→',
};

const DIR_COLOR: Record<SimulationImpact['direction'], string> = {
  improved: DS.success,
  worsened: DS.warning,
  neutral:  DS.textMuted,
};

export function SimulationImpactCard({ impacts, delta, isEstimated, estimatedNote }: Props) {
  if (impacts.length === 0) return null;

  const improved = impacts.filter(i => i.direction === 'improved').length;
  const worsened = impacts.filter(i => i.direction === 'worsened').length;

  return (
    <View style={c.card}>
      <View style={c.header}>
        <Text style={c.heading}>SIMULATION IMPACT</Text>
        <View style={c.scoreRow}>
          {improved > 0 && (
            <View style={[c.scorePill, { backgroundColor: DS.success + '18' }]}>
              <Text style={[c.scoreTxt, { color: DS.success }]}>↑ {improved} improved</Text>
            </View>
          )}
          {worsened > 0 && (
            <View style={[c.scorePill, { backgroundColor: DS.warning + '18' }]}>
              <Text style={[c.scoreTxt, { color: DS.warning }]}>↓ {worsened} tradeoff</Text>
            </View>
          )}
        </View>
      </View>

      {/* Overall delta callout */}
      {delta.overallLabelChanged && (
        <View style={c.labelChange}>
          <Text style={c.labelChangeTxt}>
            Overall: <Text style={c.labelChangeBold}>{delta.overallLabelDelta}</Text>
          </Text>
        </View>
      )}
      {delta.sellerFitLevelChanged && (
        <View style={c.labelChange}>
          <Text style={c.labelChangeTxt}>
            Seller fit: <Text style={c.labelChangeBold}>{delta.sellerFitLevelDelta}</Text>
          </Text>
        </View>
      )}

      {/* Per-domain impacts */}
      {impacts.map((impact, i) => (
        <View key={i} style={c.row}>
          <Text style={[c.icon, { color: DIR_COLOR[impact.direction] }]}>
            {DIR_ICON[impact.direction]}
          </Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[c.domain, { color: DIR_COLOR[impact.direction] }]}>
              {impact.domain}
            </Text>
            <Text style={c.summary} numberOfLines={3}>{impact.summary}</Text>
            {impact.detail && (
              <Text style={c.detail} numberOfLines={2}>{impact.detail}</Text>
            )}
          </View>
        </View>
      ))}

      {/* Estimated inputs warning */}
      {isEstimated && estimatedNote && (
        <Text style={c.estimatedNote}>{estimatedNote}</Text>
      )}
    </View>
  );
}

const c = StyleSheet.create({
  card:        { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 10 },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  heading:     { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  scoreRow:    { flexDirection: 'row', gap: 6 },
  scorePill:   { paddingHorizontal: 8, paddingVertical: 2, borderRadius: DS.radiusBadge },
  scoreTxt:    { fontSize: 10, fontWeight: '800' },
  labelChange: { paddingHorizontal: 10, paddingVertical: 5, backgroundColor: DS.accent + '08', borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.accent + '20' },
  labelChangeTxt:  { fontSize: 12, color: DS.textSecondary },
  labelChangeBold: { fontWeight: '700', color: DS.accent },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  icon:        { fontSize: 14, fontWeight: '800', width: 16, marginTop: 1 },
  domain:      { fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  summary:     { fontSize: 12, color: DS.textPrimary, lineHeight: 17 },
  detail:      { fontSize: 11, color: DS.textSecondary, lineHeight: 15, fontStyle: 'italic' },
  estimatedNote: { fontSize: 11, color: DS.textMuted, lineHeight: 15, fontStyle: 'italic', paddingTop: 4, borderTopWidth: 1, borderTopColor: DS.border },
});
