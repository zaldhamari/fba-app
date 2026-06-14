// ProductQuickIntel — compact intelligence preview for research screens.
// Uses directional, proportionate language (14C.8): never says "Unsafe" or "Avoid"
// in a research context. These are guidance signals, not final verdicts.

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { DS } from '../theme/ds';
import type { ProductIntelligenceProfile } from '../lib/productIntelligence/types';
import type { PipelineReconInsights } from '../context/PipelineContext';

// ── Directional labels (research context — calmer than final verdict labels) ──

const SURV_PREVIEW: Record<string, string> = {
  Strong:   'Promising',
  Viable:   'Viable',
  Marginal: 'Uncertain',
  Risky:    'Caution Required',
  Unknown:  'Uncertain',
};

const SURV_COLOR: Record<string, string> = {
  Strong:   DS.success,
  Viable:   DS.accent,
  Marginal: DS.warning,
  Risky:    DS.warning,    // DS.warning not DS.danger — proportionate in early research
  Unknown:  DS.textMuted,
};

const FIT_PREVIEW: Record<string, string> = {
  BeginnerSafe:     'Beginner-Friendly',
  Intermediate:     'Intermediate',
  AdvancedOnly:     'Advanced',
  UnsafeForSeller:  'Expert Only',
};

const FIT_COLOR: Record<string, string> = {
  BeginnerSafe:     DS.success,
  Intermediate:     DS.accent,
  AdvancedOnly:     DS.warning,
  UnsafeForSeller:  DS.warning,   // proportionate — not red in early research
};

const CONF_COLOR: Record<string, string> = {
  High:    DS.success,
  Medium:  DS.warning,
  Low:     DS.textMuted,
  Unknown: DS.textMuted,
};

// ── Early-warning text map — explains WHY and HOW to improve ─────────────────

function confidenceExplanation(confidence: string, missingCount: number): string | null {
  if (confidence === 'Unknown') {
    return 'Intelligence is limited — add a product and supplier to unlock full assessment.';
  }
  if (confidence === 'Low') {
    if (missingCount > 0) {
      return `Low confidence — ${missingCount} input${missingCount > 1 ? 's' : ''} missing. Add a supplier and cost model in Sourcing to improve.`;
    }
    return 'Low confidence — add a supplier and confirmed freight to improve accuracy.';
  }
  return null;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  profile:       ProductIntelligenceProfile;
  reconInsights?: PipelineReconInsights | null;
  label?:        string;   // optional header label override
}

export function ProductQuickIntel({ profile, reconInsights, label }: Props) {
  const { domains, sellerFit, topRisks, topActions, overallConfidence, missingInputs } = profile;
  const surv = domains.survivability;

  const survLabel = SURV_PREVIEW[surv.level] ?? 'Uncertain';
  const survColor = SURV_COLOR[surv.level]   ?? DS.textMuted;
  const fitLabel  = FIT_PREVIEW[sellerFit.level] ?? sellerFit.label;
  const fitColor  = FIT_COLOR[sellerFit.level]   ?? DS.textMuted;
  const confColor = CONF_COLOR[overallConfidence]  ?? DS.textMuted;

  // Top warning: hard blocker > cert complex > first supply-chain risk
  const blocker     = sellerFit.blockers[0] ?? null;
  const certWarning = domains.certification.level === 'Complex'
    ? domains.certification.headline
    : null;
  const topRisk     = topRisks[0] ?? null;
  const topWarning  = blocker ?? certWarning ?? topRisk?.action ?? null;
  const topWarningWhy = blocker
    ? (sellerFit.reasons[0] ?? null)
    : certWarning
    ? `Lab testing required — plan this BEFORE placing production order.`
    : topRisk?.why ?? null;

  // Differentiation opportunities: recon opportunities + improvement specs (max 2)
  const diffs: string[] = [];
  if (reconInsights) {
    if (reconInsights.opportunities.length > 0)    diffs.push(reconInsights.opportunities[0]);
    if (reconInsights.improvementSpecs.length > 0) diffs.push(reconInsights.improvementSpecs[0]);
  }
  // Also surface domain return mitigations if recon is fresh
  if (diffs.length === 0 && domains.returns.actionableRecommendations.length > 0) {
    diffs.push(`Opportunity: ${domains.returns.actionableRecommendations[0]}`);
  }

  const confNote   = confidenceExplanation(overallConfidence, missingInputs.length);
  const nextAction = overallConfidence !== 'Unknown' ? (topActions[0] ?? null) : null;

  // Early-exit: nothing useful to show (profile is fully unknown)
  const isFullyUnknown = surv.level === 'Unknown' && sellerFit.level === 'BeginnerSafe' && !topRisk;
  if (isFullyUnknown) return null;

  return (
    <View style={q.card}>
      {/* Heading */}
      <Text style={q.heading}>{label ?? 'Product Intelligence Preview'}</Text>

      {/* Directional pills: survivability · seller fit · confidence */}
      <View style={q.pills}>
        <View style={[q.pill, { backgroundColor: survColor + '18' }]}>
          <Text style={[q.pillTxt, { color: survColor }]}>{survLabel}</Text>
        </View>
        <View style={[q.pill, { backgroundColor: fitColor + '18' }]}>
          <Text style={[q.pillTxt, { color: fitColor }]}>{fitLabel}</Text>
        </View>
        <View style={[q.pill, { backgroundColor: confColor + '18' }]}>
          <Text style={[q.pillTxt, { color: confColor }]}>{overallConfidence} conf.</Text>
        </View>
      </View>

      {/* Top early warning with WHY */}
      {topWarning && (
        <View style={q.warningRow}>
          <Text style={q.warningIcon}>⚠</Text>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={q.warningTxt} numberOfLines={3}>{topWarning}</Text>
            {topWarningWhy && (
              <Text style={q.warningWhy} numberOfLines={2}>{topWarningWhy}</Text>
            )}
          </View>
        </View>
      )}

      {/* Differentiation opportunities from recon */}
      {diffs.slice(0, 2).map((opp, i) => (
        <View key={i} style={q.oppRow}>
          <Text style={q.oppIcon}>✦</Text>
          <Text style={q.oppTxt} numberOfLines={2}>{opp}</Text>
        </View>
      ))}

      {/* Confidence explanation — teaches users that confidence grows with data */}
      {confNote && <Text style={q.confNote}>{confNote}</Text>}

      {/* Priority next action */}
      {nextAction && (
        <View style={q.actionRow}>
          <Text style={q.actionArrow}>→</Text>
          <Text style={q.actionTxt} numberOfLines={2}>{nextAction.action}</Text>
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const q = StyleSheet.create({
  card:        { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 14, gap: 10 },
  heading:     { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },

  pills:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill:        { paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radiusBadge },
  pillTxt:     { fontSize: 10, fontWeight: '800' },

  warningRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warningIcon: { fontSize: 11, color: DS.warning, marginTop: 2 },
  warningTxt:  { fontSize: 12, fontWeight: '700', color: DS.textPrimary, lineHeight: 17 },
  warningWhy:  { fontSize: 11, color: DS.textSecondary, lineHeight: 15 },

  oppRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  oppIcon:     { fontSize: 11, color: DS.accent, marginTop: 2 },
  oppTxt:      { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 17 },

  confNote:    { fontSize: 11, color: DS.textMuted, lineHeight: 16, fontStyle: 'italic' },

  actionRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: DS.accent + '08', borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.accent + '20' },
  actionArrow: { fontSize: 12, color: DS.accent, fontWeight: '800', marginTop: 1 },
  actionTxt:   { flex: 1, fontSize: 11, fontWeight: '700', color: DS.accent, lineHeight: 16 },
});
