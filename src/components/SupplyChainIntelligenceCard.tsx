import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { DS } from '../theme/ds';
import { AppCard } from './ds/AppCard';
import type { ProductIntelligenceProfile, SellerFitLevel } from '../lib/productIntelligence/types';

// ── Colour helpers ──────────────────────────────────────────────────────────

const SURVIVABILITY_COLOR: Record<string, string> = {
  Strong:   DS.success,
  Viable:   DS.accent,
  Marginal: DS.warning,
  Risky:    DS.danger,
  Unknown:  DS.textMuted,
};

const SELLER_FIT_COLOR: Record<SellerFitLevel, string> = {
  BeginnerSafe:     DS.success,
  Intermediate:     DS.accent,
  AdvancedOnly:     DS.warning,
  UnsafeForSeller:  DS.danger,
};

const SELLER_FIT_LABEL: Record<SellerFitLevel, string> = {
  BeginnerSafe:     'Beginner Safe',
  Intermediate:     'Intermediate',
  AdvancedOnly:     'Advanced Only',
  UnsafeForSeller:  'Not Recommended',
};

const CONFIDENCE_COLOR: Record<string, string> = {
  High:    DS.success,
  Medium:  DS.warning,
  Low:     DS.danger,
  Unknown: DS.textMuted,
};

function domainLevelColor(level: string): string {
  if (level === 'Unknown')                                                     return DS.textMuted;
  if (level === 'Low' || level === 'Stable' || level === 'None' ||
      level === 'Confirmed' || level === 'Strong' || level === 'Viable' ||
      level === 'BeginnerSafe')                                                return DS.success;
  if (level === 'Medium' || level === 'Moderate' || level === 'DocumentationOnly' ||
      level === 'Standard' || level === 'Estimated' || level === 'Intermediate')
                                                                               return DS.warning;
  return DS.danger;
}

// ── Component ───────────────────────────────────────────────────────────────

interface Props {
  profile:     ProductIntelligenceProfile;
  onNavigate?: (tab: string) => void;
}

export function SupplyChainIntelligenceCard({ profile, onNavigate }: Props) {
  const [expanded, setExpanded] = useState(false);

  const { domains, sellerFit, topRisks, topActions, missingInputs, overallScore,
          overallConfidence, overallLabel, raw } = profile;
  const { survivability: survDomain, certification, returns, freight, cashflow } = domains;
  const { survivability: survRaw, cashflowStress, certification: certRaw,
          negotiation }  = raw.sourcing;

  const survColor   = SURVIVABILITY_COLOR[survDomain.level] ?? DS.textMuted;
  const confColor   = CONFIDENCE_COLOR[overallConfidence]   ?? DS.textMuted;
  const fitColor    = SELLER_FIT_COLOR[sellerFit.level as SellerFitLevel] ?? DS.textMuted;
  const fitLabel    = SELLER_FIT_LABEL[sellerFit.level as SellerFitLevel] ?? sellerFit.label;

  const signals = [
    { icon: '🔐', label: 'Cert',       value: certification.level,  color: domainLevelColor(certification.level) },
    { icon: '↩',  label: 'Returns',    value: returns.level,        color: domainLevelColor(returns.level) },
    { icon: '🌊', label: 'Volatility', value: freight.level,        color: domainLevelColor(freight.level) },
    { icon: '💸', label: 'Cashflow',   value: cashflow.level,       color: domainLevelColor(cashflow.level) },
    { icon: '👤', label: 'Fit',        value: fitLabel,             color: fitColor },
  ];

  return (
    <AppCard style={sci.card}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.8} style={sci.header}>
        <View style={sci.titleRow}>
          <View style={[sci.badge, { backgroundColor: survColor + '18' }]}>
            <Text style={[sci.badgeTxt, { color: survColor }]}>
              {survDomain.level === 'Unknown' ? 'Assessing...' : survDomain.level}
            </Text>
          </View>
          <View style={sci.rightMeta}>
            <Text style={sci.score}>{overallScore}/100</Text>
            <View style={[sci.confPill, { backgroundColor: confColor + '18' }]}>
              <Text style={[sci.confPillTxt, { color: confColor }]}>{overallConfidence}</Text>
            </View>
          </View>
        </View>

        <View style={sci.titleBlock}>
          <Text style={sci.title}>Supply Chain Intelligence</Text>
          <Text style={sci.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>

        <Text style={sci.sub} numberOfLines={2}>{survDomain.headline}</Text>
      </TouchableOpacity>

      {/* ── Signal chips ───────────────────────────────────────────── */}
      <View style={sci.signals}>
        {signals.map(s => (
          <View key={s.label} style={sci.signal}>
            <Text style={sci.sigIcon}>{s.icon}</Text>
            <Text style={sci.sigLabel}>{s.label}</Text>
            <Text style={[sci.sigValue, { color: s.color }]} numberOfLines={1}>{s.value}</Text>
          </View>
        ))}
      </View>

      {/* ── Expanded detail ────────────────────────────────────────── */}
      {expanded && (
        <View style={sci.expanded}>
          <View style={sci.divider} />

          {/* Seller fit detail */}
          {sellerFit.level !== 'BeginnerSafe' && sellerFit.level !== 'Intermediate' || sellerFit.blockers.length > 0 ? (
            <>
              <Text style={sci.sectionLabel}>SELLER FIT</Text>
              <View style={[sci.fitRow, { borderColor: fitColor + '30', backgroundColor: fitColor + '08' }]}>
                <View style={[sci.fitBadge, { backgroundColor: fitColor + '20' }]}>
                  <Text style={[sci.fitBadgeTxt, { color: fitColor }]}>{fitLabel}</Text>
                </View>
                {sellerFit.blockers.length > 0 && (
                  <Text style={[sci.fitBlocker, { color: fitColor }]} numberOfLines={2}>{sellerFit.blockers[0]}</Text>
                )}
                {sellerFit.blockers.length === 0 && sellerFit.reasons.length > 0 && (
                  <Text style={sci.fitReason} numberOfLines={2}>{sellerFit.reasons[0]}</Text>
                )}
              </View>
            </>
          ) : null}

          {/* Survivability gates — raw engine data, no domain equivalent */}
          <Text style={sci.sectionLabel}>LAUNCH SURVIVABILITY GATES</Text>
          {survRaw.gates.map((g, i) => (
            <View key={i} style={sci.gate}>
              <Text style={[sci.gateIcon, {
                color: g.passed === null ? DS.textMuted : g.passed ? DS.success : DS.danger,
              }]}>
                {g.passed === null ? '?' : g.passed ? '✓' : '✗'}
              </Text>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={[sci.gateLabel, {
                  color: g.passed === null ? DS.textMuted : g.passed ? DS.textPrimary : DS.danger,
                }]}>{g.label}</Text>
                {g.passed === false && (
                  <>
                    <Text style={sci.gateDetail}>{g.detail}</Text>
                    {g.fixHint ? <Text style={sci.gateFix}>→ {g.fixHint}</Text> : null}
                  </>
                )}
              </View>
            </View>
          ))}

          {/* Top risks */}
          {topRisks.length > 0 && (
            <>
              <View style={sci.divider} />
              <Text style={sci.sectionLabel}>TOP RISKS</Text>
              {topRisks.slice(0, 3).map((r, i) => (
                <View key={i} style={sci.riskRow}>
                  <Text style={sci.riskIcon}>⚠</Text>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={sci.riskAction} numberOfLines={2}>{r.action}</Text>
                    <Text style={sci.riskWhy} numberOfLines={2}>{r.why}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* Top actions */}
          {topActions.length > 0 && (
            <>
              <View style={sci.divider} />
              <Text style={sci.sectionLabel}>PRIORITY ACTIONS</Text>
              {topActions.slice(0, 3).map((a, i) => (
                <View key={i} style={sci.actionRow}>
                  <View style={sci.actionNum}>
                    <Text style={sci.actionNumTxt}>{i + 1}</Text>
                  </View>
                  <Text style={sci.actionTxt} numberOfLines={3}>{a.action}</Text>
                </View>
              ))}
            </>
          )}

          {/* Cashflow breakdown — raw engine data for detailed breakdown */}
          {cashflowStress.estimatedCapital > 0 && (
            <>
              <View style={sci.divider} />
              <Text style={sci.sectionLabel}>CASHFLOW STRESS</Text>
              <Text style={sci.cashflowHeadline}>{cashflowStress.headline}</Text>
              {cashflowStress.breakdown.map(b => (
                <View key={b.label} style={sci.cashRow}>
                  <Text style={sci.cashLabel}>{b.label}{b.isEstimated ? ' *' : ''}</Text>
                  <Text style={sci.cashAmount}>${b.amount.toLocaleString()}</Text>
                </View>
              ))}
              {cashflowStress.paybackLabel !== 'Unknown' && cashflowStress.paybackMonths !== null && (
                <Text style={sci.cashMeta}>Estimated payback: {cashflowStress.paybackLabel}</Text>
              )}
            </>
          )}

          {/* Certifications — raw data for chip list, cost, timeline */}
          {certRaw.certs.length > 0 && (
            <>
              <View style={sci.divider} />
              <Text style={sci.sectionLabel}>CERTIFICATIONS REQUIRED</Text>
              <Text style={sci.certDetail}>{certRaw.detail}</Text>
              <View style={sci.certsRow}>
                {certRaw.certs.map(c => (
                  <View key={c} style={sci.certChip}>
                    <Text style={sci.certChipTxt}>{c}</Text>
                  </View>
                ))}
              </View>
              <Text style={sci.certMeta}>{certRaw.estimatedCost} · {certRaw.timeline}</Text>
            </>
          )}

          {/* Negotiation — raw levers and opening script */}
          {negotiation.currentUnitCost > 0 && (
            <>
              <View style={sci.divider} />
              <Text style={sci.sectionLabel}>NEGOTIATION INTELLIGENCE</Text>
              <View style={sci.negRow}>
                <View style={sci.negBox}>
                  <Text style={sci.negLbl}>Current</Text>
                  <Text style={sci.negVal}>${negotiation.currentUnitCost.toFixed(2)}</Text>
                </View>
                <Text style={sci.negArrow}>→</Text>
                <View style={sci.negBox}>
                  <Text style={sci.negLbl}>Target</Text>
                  <Text style={[sci.negVal, { color: DS.success }]}>${negotiation.targetUnitCost.toFixed(2)}</Text>
                </View>
                <View style={sci.negBox}>
                  <Text style={sci.negLbl}>Range</Text>
                  <Text style={[sci.negVal, { color: DS.success }]}>{negotiation.savingsRangeLow}–{negotiation.savingsRangeHigh}%</Text>
                </View>
              </View>
              {negotiation.levers.slice(0, 2).map((lv, i) => (
                <View key={i} style={sci.leverRow}>
                  <View style={[sci.leverImpact, { backgroundColor: lv.impact === 'High' ? DS.success + '20' : DS.warning + '20' }]}>
                    <Text style={[sci.leverImpactTxt, { color: lv.impact === 'High' ? DS.success : DS.warning }]}>{lv.impact}</Text>
                  </View>
                  <Text style={sci.leverLabel}>{lv.lever}</Text>
                </View>
              ))}
            </>
          )}

          {/* Missing inputs — navigable where tab is known */}
          {missingInputs.length > 0 && (
            <>
              <View style={sci.divider} />
              <Text style={sci.sectionLabel}>MISSING DATA</Text>
              {missingInputs.slice(0, 4).map((m, i) => (
                <TouchableOpacity
                  key={i}
                  style={[sci.missingRow, !m.tab && sci.missingRowStatic]}
                  onPress={m.tab && onNavigate ? () => onNavigate(m.tab!) : undefined}
                  activeOpacity={m.tab ? 0.7 : 1}
                  disabled={!m.tab || !onNavigate}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={sci.missingField}>{m.field}</Text>
                    <Text style={sci.missingImpact}>{m.impact}</Text>
                  </View>
                  {m.tab && onNavigate && (
                    <Text style={sci.missingNav}>→ {m.tab}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      )}
    </AppCard>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const sci = StyleSheet.create({
  card:             { gap: 14, borderWidth: 1.5, borderColor: DS.accent + '30' },

  header:           { gap: 6 },
  titleRow:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  badge:            { paddingHorizontal: 10, paddingVertical: 3, borderRadius: DS.radiusBadge },
  badgeTxt:         { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  rightMeta:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  score:            { fontSize: 13, fontWeight: '900', color: DS.textMuted },
  confPill:         { paddingHorizontal: 8, paddingVertical: 2, borderRadius: DS.radiusBadge },
  confPillTxt:      { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  titleBlock:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:            { fontSize: 14, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3, flex: 1 },
  chevron:          { fontSize: 11, color: DS.textMuted },
  sub:              { fontSize: 11, color: DS.textMuted, lineHeight: 15 },

  signals:          { flexDirection: 'row', gap: 6 },
  signal:           { flex: 1, backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, padding: 6, alignItems: 'center', gap: 2 },
  sigIcon:          { fontSize: 12 },
  sigLabel:         { fontSize: 8, color: DS.textMuted, fontWeight: '700', textAlign: 'center' },
  sigValue:         { fontSize: 9, fontWeight: '800', textAlign: 'center' },

  expanded:         { gap: 10 },
  divider:          { height: 1, backgroundColor: DS.border },
  sectionLabel:     { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },

  fitRow:           { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: DS.radiusChip, borderWidth: 1, padding: 8 },
  fitBadge:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: DS.radiusBadge },
  fitBadgeTxt:      { fontSize: 10, fontWeight: '800' },
  fitBlocker:       { flex: 1, fontSize: 11, lineHeight: 15 },
  fitReason:        { flex: 1, fontSize: 11, color: DS.textSecondary, lineHeight: 15 },

  gate:             { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  gateIcon:         { fontSize: 14, fontWeight: '700', marginTop: 1 },
  gateLabel:        { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  gateDetail:       { fontSize: 11, color: DS.textSecondary, lineHeight: 16 },
  gateFix:          { fontSize: 11, color: DS.accent, lineHeight: 16, fontWeight: '600' },

  riskRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  riskIcon:         { fontSize: 12, color: DS.warning, marginTop: 1, width: 14 },
  riskAction:       { fontSize: 12, fontWeight: '700', color: DS.textPrimary, lineHeight: 16 },
  riskWhy:          { fontSize: 11, color: DS.textSecondary, lineHeight: 15 },

  actionRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionNum:        { width: 18, height: 18, borderRadius: 9, backgroundColor: DS.accent + '20', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  actionNumTxt:     { fontSize: 9, fontWeight: '900', color: DS.accent },
  actionTxt:        { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 17 },

  cashflowHeadline: { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  cashRow:          { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  cashLabel:        { fontSize: 12, color: DS.textSecondary, flex: 1 },
  cashAmount:       { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  cashMeta:         { fontSize: 11, color: DS.textMuted, fontStyle: 'italic' },

  certDetail:       { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  certsRow:         { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  certChip:         { backgroundColor: DS.danger + '15', borderRadius: DS.radiusChip, paddingHorizontal: 8, paddingVertical: 3 },
  certChipTxt:      { fontSize: 11, fontWeight: '700', color: DS.danger },
  certMeta:         { fontSize: 11, color: DS.textMuted },

  negRow:           { flexDirection: 'row', alignItems: 'center', gap: 8 },
  negBox:           { flex: 1, alignItems: 'center', gap: 2 },
  negLbl:           { fontSize: 9, color: DS.textMuted, fontWeight: '700', textTransform: 'uppercase' },
  negVal:           { fontSize: 14, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  negArrow:         { fontSize: 18, color: DS.textMuted },
  leverRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  leverImpact:      { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  leverImpactTxt:   { fontSize: 9, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  leverLabel:       { fontSize: 12, color: DS.textSecondary, flex: 1 },

  missingRow:       { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, paddingHorizontal: 8, borderRadius: DS.radiusChip, backgroundColor: DS.bgElevated, borderWidth: 1, borderColor: DS.border },
  missingRowStatic: { backgroundColor: 'transparent', borderColor: 'transparent' },
  missingField:     { fontSize: 12, fontWeight: '700', color: DS.textPrimary },
  missingImpact:    { fontSize: 11, color: DS.textMuted, lineHeight: 14 },
  missingNav:       { fontSize: 11, fontWeight: '700', color: DS.accent },
});
