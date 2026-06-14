import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';
import type { ProductIntelligenceProfile } from '../lib/productIntelligence/types';

const SURV_COLOR: Record<string, string> = {
  Strong: DS.success, Viable: DS.accent, Marginal: DS.warning,
  Risky: DS.danger,  Unknown: DS.textMuted,
};
const FIT_COLOR: Record<string, string> = {
  BeginnerSafe: DS.success, Intermediate: DS.accent,
  AdvancedOnly: DS.warning, UnsafeForSeller: DS.danger,
};
const FIT_LABEL: Record<string, string> = {
  BeginnerSafe: 'Beginner Safe', Intermediate: 'Intermediate',
  AdvancedOnly: 'Advanced Only', UnsafeForSeller: 'Not Recommended',
};
const CONF_COLOR: Record<string, string> = {
  High: DS.success, Medium: DS.warning, Low: DS.danger, Unknown: DS.textMuted,
};

interface Props {
  profile:     ProductIntelligenceProfile;
  onNavigate?: (tab: string) => void;
}

export function IntelligenceSummaryBanner({ profile, onNavigate }: Props) {
  const { domains, sellerFit, topRisks, topActions, overallConfidence } = profile;
  const surv     = domains.survivability;
  const survColor = SURV_COLOR[surv.level] ?? DS.textMuted;
  const fitColor  = FIT_COLOR[sellerFit.level]  ?? DS.textMuted;
  const confColor = CONF_COLOR[overallConfidence] ?? DS.textMuted;
  const topRisk   = topRisks[0];
  const topAction = topActions[0];

  return (
    <View style={b.card}>
      {/* Pill row */}
      <View style={b.pills}>
        <View style={[b.pill, { backgroundColor: survColor + '18' }]}>
          <Text style={[b.pillTxt, { color: survColor }]}>
            {surv.level === 'Unknown' ? 'Survivability?' : surv.level}
          </Text>
        </View>
        <View style={[b.pill, { backgroundColor: fitColor + '18' }]}>
          <Text style={[b.pillTxt, { color: fitColor }]}>
            {FIT_LABEL[sellerFit.level] ?? sellerFit.label}
          </Text>
        </View>
        <View style={[b.pill, { backgroundColor: confColor + '18' }]}>
          <Text style={[b.pillTxt, { color: confColor }]}>{overallConfidence} confidence</Text>
        </View>
      </View>

      {/* Top risk */}
      {topRisk && (
        <View style={b.row}>
          <Text style={b.rowIcon}>⚠</Text>
          <Text style={b.rowTxt} numberOfLines={2}>{topRisk.action}</Text>
        </View>
      )}

      {/* Next action */}
      {topAction && (
        <TouchableOpacity
          style={b.actionRow}
          onPress={topAction.domain && onNavigate
            ? () => onNavigate(domainToTab(topAction.domain))
            : undefined}
          activeOpacity={0.8}
          disabled={!onNavigate}
        >
          <Text style={b.actionIcon}>→</Text>
          <Text style={b.actionTxt} numberOfLines={2}>{topAction.action}</Text>
        </TouchableOpacity>
      )}

      {/* Empty state */}
      {!topRisk && !topAction && (
        <Text style={b.emptyTxt}>Add a product and supplier to generate intelligence.</Text>
      )}
    </View>
  );
}

function domainToTab(domain: string): string {
  switch (domain) {
    case 'supplier':
    case 'freight':
    case 'certification': return 'Sourcing';
    case 'cashflow':
    case 'negotiation':   return 'Profit';
    case 'returns':       return 'Research';
    default:              return 'Sourcing';
  }
}

const b = StyleSheet.create({
  card:      { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 10 },
  pills:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:      { paddingHorizontal: 10, paddingVertical: 3, borderRadius: DS.radiusBadge },
  pillTxt:   { fontSize: 10, fontWeight: '800' },
  row:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rowIcon:   { fontSize: 11, color: DS.warning, marginTop: 2 },
  rowTxt:    { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, backgroundColor: DS.accent + '08', borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.accent + '20' },
  actionIcon:{ fontSize: 13, color: DS.accent, fontWeight: '800' },
  actionTxt: { flex: 1, fontSize: 12, fontWeight: '700', color: DS.accent, lineHeight: 17 },
  emptyTxt:  { fontSize: 12, color: DS.textMuted, lineHeight: 17 },
});
