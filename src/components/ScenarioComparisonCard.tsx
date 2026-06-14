// ── Phase 15: Scenario Comparison Card ───────────────────────────────────────
// Side-by-side view of current vs simulated profile across key dimensions.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS } from '../theme/ds';
import type { ProductIntelligenceProfile, IntelligenceConfidence } from '../lib/productIntelligence/types';

interface Props {
  baseProfile: ProductIntelligenceProfile;
  simProfile:  ProductIntelligenceProfile;
}

const SURV_COLOR: Record<string, string> = {
  Strong:  DS.success, Viable: DS.accent, Marginal: DS.warning,
  Risky:   DS.warning, Unknown: DS.textMuted,
};
const FIT_COLOR: Record<string, string> = {
  BeginnerSafe: DS.success, Intermediate: DS.accent,
  AdvancedOnly: DS.warning, UnsafeForSeller: DS.warning,
};
const CONF_COLOR: Record<IntelligenceConfidence, string> = {
  High: DS.success, Medium: DS.accent, Low: DS.warning, Unknown: DS.textMuted,
};
const FIT_SHORT: Record<string, string> = {
  BeginnerSafe: 'Beginner-Safe', Intermediate: 'Intermediate',
  AdvancedOnly: 'Advanced Only', UnsafeForSeller: 'Expert Only',
};

function Row({
  label,
  baseVal, baseColor,
  simVal,  simColor,
  changed,
}: {
  label:     string;
  baseVal:   string;
  baseColor: string;
  simVal:    string;
  simColor:  string;
  changed:   boolean;
}) {
  return (
    <View style={r.row}>
      <Text style={r.rowLabel}>{label}</Text>
      <Text style={[r.cell, { color: baseColor }]} numberOfLines={1}>{baseVal}</Text>
      <View style={r.arrow}>
        <Text style={[r.arrowTxt, changed && r.arrowActive]}>→</Text>
      </View>
      <Text style={[r.cell, r.simCell, { color: simColor }, changed && r.simChanged]} numberOfLines={1}>
        {simVal}
      </Text>
    </View>
  );
}

export function ScenarioComparisonCard({ baseProfile, simProfile }: Props) {
  const baseCapital = baseProfile.raw.sourcing.cashflowStress.estimatedCapital;
  const simCapital  = simProfile.raw.sourcing.cashflowStress.estimatedCapital;
  const capChanged  = Math.abs(simCapital - baseCapital) >= 200;

  const rows: {
    label:     string;
    baseVal:   string;  baseColor: string;
    simVal:    string;  simColor:  string;
    changed:   boolean;
  }[] = [
    {
      label:    'Survivability',
      baseVal:  baseProfile.domains.survivability.level,
      baseColor: SURV_COLOR[baseProfile.domains.survivability.level] ?? DS.textMuted,
      simVal:   simProfile.domains.survivability.level,
      simColor:  SURV_COLOR[simProfile.domains.survivability.level] ?? DS.textMuted,
      changed:  baseProfile.domains.survivability.level !== simProfile.domains.survivability.level,
    },
    {
      label:    'Seller Fit',
      baseVal:  FIT_SHORT[baseProfile.sellerFit.level] ?? baseProfile.sellerFit.label,
      baseColor: FIT_COLOR[baseProfile.sellerFit.level] ?? DS.textMuted,
      simVal:   FIT_SHORT[simProfile.sellerFit.level]  ?? simProfile.sellerFit.label,
      simColor:  FIT_COLOR[simProfile.sellerFit.level]  ?? DS.textMuted,
      changed:  baseProfile.sellerFit.level !== simProfile.sellerFit.level,
    },
    {
      label:    'Confidence',
      baseVal:  baseProfile.overallConfidence,
      baseColor: CONF_COLOR[baseProfile.overallConfidence],
      simVal:   simProfile.overallConfidence,
      simColor:  CONF_COLOR[simProfile.overallConfidence],
      changed:  baseProfile.overallConfidence !== simProfile.overallConfidence,
    },
    {
      label:    'Cert. Risk',
      baseVal:  baseProfile.domains.certification.level,
      baseColor: baseProfile.domains.certification.level === 'Complex' ? DS.warning : DS.success,
      simVal:   simProfile.domains.certification.level,
      simColor:  simProfile.domains.certification.level === 'Complex' ? DS.warning : DS.success,
      changed:  baseProfile.domains.certification.level !== simProfile.domains.certification.level,
    },
    {
      label:    'Launch Capital',
      baseVal:  baseCapital > 0 ? `$${baseCapital.toLocaleString()}` : '—',
      baseColor: DS.textSecondary,
      simVal:   simCapital > 0  ? `$${simCapital.toLocaleString()}`  : '—',
      simColor:  simCapital > baseCapital ? DS.warning : simCapital < baseCapital ? DS.success : DS.textSecondary,
      changed:  capChanged,
    },
    {
      label:    'Overall',
      baseVal:  baseProfile.overallLabel,
      baseColor: SURV_COLOR[baseProfile.overallLabel] ?? DS.textMuted,
      simVal:   simProfile.overallLabel,
      simColor:  SURV_COLOR[simProfile.overallLabel] ?? DS.textMuted,
      changed:  baseProfile.overallLabel !== simProfile.overallLabel,
    },
  ];

  const anyChanged = rows.some(row => row.changed);

  return (
    <View style={s.card}>
      <Text style={s.heading}>CURRENT vs SIMULATED</Text>

      {/* Column headers */}
      <View style={s.colHeaders}>
        <Text style={s.colLabel} />
        <Text style={[s.colHeader, { color: DS.textMuted }]}>Current</Text>
        <Text style={s.colArrowSpacer} />
        <Text style={[s.colHeader, { color: DS.accent }]}>Simulated</Text>
      </View>

      {rows.map(row => (
        <Row key={row.label} {...row} />
      ))}

      {!anyChanged && (
        <Text style={s.noChange}>
          No significant changes detected — adjust sourcing, freight, or seller settings.
        </Text>
      )}
    </View>
  );
}

const r = StyleSheet.create({
  row:        { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: DS.border },
  rowLabel:   { width: 108, fontSize: 11, color: DS.textSecondary, fontWeight: '600' },
  cell:       { flex: 1, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  arrow:      { paddingHorizontal: 6 },
  arrowTxt:   { fontSize: 11, color: DS.border, fontWeight: '800' },
  arrowActive:{ color: DS.accent },
  simCell:    { textAlign: 'right' },
  simChanged: { textDecorationLine: 'underline' },
});

const s = StyleSheet.create({
  card:          { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 8 },
  heading:       { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  colHeaders:    { flexDirection: 'row', alignItems: 'center', paddingBottom: 4 },
  colLabel:      { width: 108 },
  colHeader:     { flex: 1, fontSize: 10, fontWeight: '800', textAlign: 'right', letterSpacing: 0.8 },
  colArrowSpacer:{ width: 28 },
  noChange:      { fontSize: 11, color: DS.textMuted, fontStyle: 'italic', paddingTop: 4 },
});
