import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { colors, spacing, radius, shadow, motion } from '../theme';
import { useCurrency } from '../context/CurrencyContext';
import PulseDots from './PulseDots';
import { AnalyzeResult } from '../types/research';

export type { AnalyzeResult };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidenceLabel(n: number): string {
  if (n >= 80) return 'Strong Opportunity';
  if (n >= 60) return 'Worth Testing';
  if (n >= 40) return 'Risky';
  return 'Avoid';
}

function urgencyBadge(r: { trend: string; reviews: number }): { label: string; color: string; bg: string } | null {
  const trend = r.trend.toLowerCase();
  if (trend === 'rising' && r.reviews < 300) return { label: 'Early Opportunity', color: colors.green,  bg: colors.greenLight };
  if (r.reviews > 1000)                       return { label: 'Market Saturating',  color: colors.red,   bg: colors.redLight   };
  if (trend === 'declining')                  return { label: 'Demand Dropping',    color: colors.red,   bg: colors.redLight   };
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AnalyzeInlineCard({
  result, loading, fromCache, onRefresh,
  isCompareSelected, canAddCompare, onToggleCompare,
  isSaved, onSaveWinner,
  limitReached, analyzeUsed, analyzeLimit, onUpgrade,
}: {
  result: AnalyzeResult | null;
  loading: boolean;
  fromCache: boolean;
  onRefresh: () => void;
  isCompareSelected: boolean;
  canAddCompare: boolean;
  onToggleCompare: () => void;
  isSaved: boolean;
  onSaveWinner: () => void;
  limitReached: boolean;
  analyzeUsed: number;
  analyzeLimit: number;
  onUpgrade: () => void;
}) {
  const { fmt } = useCurrency();
  const fade         = useRef(new Animated.Value(0)).current;
  const slide        = useRef(new Animated.Value(12)).current;
  const verdictScale = useRef(new Animated.Value(0.82)).current;
  const confFill     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade,  { toValue: 1, duration: motion.flow, useNativeDriver: true }),
      Animated.timing(slide, { toValue: 0, duration: motion.flow, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (result && !loading) {
      Animated.sequence([
        Animated.spring(verdictScale, { toValue: 1, ...motion.spring, useNativeDriver: true }),
        Animated.timing(confFill, { toValue: result.confidence, duration: motion.fill, useNativeDriver: false }),
      ]).start();
    }
  }, [result, loading]);

  const vColor  = result?.verdict === 'LAUNCH' ? colors.green
    : result?.verdict === 'AVOID' ? colors.red : colors.amber;
  const vBg     = result?.verdict === 'LAUNCH' ? colors.greenLight
    : result?.verdict === 'AVOID' ? colors.redLight : colors.amberLight;
  const vShadow = result?.verdict === 'LAUNCH' ? shadow.green
    : result?.verdict === 'AVOID' ? shadow.red : shadow.amber;

  const urgency = result ? urgencyBadge(result.metrics) : null;
  const confBarWidth = confFill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });

  const verdictFraming = result?.verdict === 'LAUNCH'
    ? 'Strong fundamentals — this is worth pursuing'
    : result?.verdict === 'TEST'
    ? 'Validate with a small test order first'
    : 'Too much risk — deploy your capital elsewhere';

  return (
    <Animated.View style={[ai.wrap, { opacity: fade, transform: [{ translateY: slide }] }]}>
      {limitReached ? (
        <View style={ai.limitCard}>
          <Text style={ai.limitTitle}>Free analyses used up</Text>
          <Text style={ai.limitSub}>
            {`${analyzeUsed} of ${analyzeLimit} free analyses used this month.\nSaved and cached analyses always remain free.`}
          </Text>
          <TouchableOpacity style={ai.upgradeBtn} onPress={onUpgrade} activeOpacity={0.85}>
            <Text style={ai.upgradeBtnText}>Unlock Unlimited AI Analysis →</Text>
          </TouchableOpacity>
          <Text style={ai.upgradePerks}>Unlimited decisions · Compare more products · Save more winners</Text>
        </View>
      ) : loading ? (
        <View style={ai.loadingWrap}>
          <PulseDots color={'#4361EE'} />
          <View style={ai.loadingTextWrap}>
            <Text style={ai.loadingTitle}>Analyzing market signals…</Text>
            <Text style={ai.loadingSub}>Margin · competition · trend · risk</Text>
          </View>
        </View>
      ) : result ? (
        <>
          {/* Verdict card */}
          <Animated.View style={[ai.verdictCard, { borderColor: `${vColor}40` }, vShadow, { transform: [{ scale: verdictScale }] }]}>
            <View style={[ai.verdictBgWash, { backgroundColor: vBg }]} pointerEvents="none" />
            <View style={ai.verdictTopRow}>
              <View style={[ai.verdictBadgePill, { backgroundColor: vBg }]}>
                <Text style={[ai.verdictWord, { color: vColor }]}>{result.verdict}</Text>
              </View>
              <View style={ai.verdictMetaCol}>
                <Text style={[ai.confPercent, { color: vColor }]}>{result.confidence}%</Text>
                <Text style={ai.confLabelText}>{confidenceLabel(result.confidence)}</Text>
              </View>
            </View>
            <View style={ai.confBarTrack}>
              <Animated.View style={[ai.confBarFill, { width: confBarWidth, backgroundColor: vColor }]} />
            </View>
            <Text style={[ai.verdictFraming, { color: vColor }]}>{verdictFraming}</Text>
            {urgency && (
              <View style={[ai.urgencyBadge, { backgroundColor: urgency.bg }]}>
                <Text style={[ai.urgencyText, { color: urgency.color }]}>{urgency.label}</Text>
              </View>
            )}
            {fromCache && (
              <TouchableOpacity onPress={onRefresh} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={ai.refreshBtn}>↻ Refresh analysis</Text>
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Reasons */}
          <View style={ai.reasons}>
            {result.reasons.map((r, i) => (
              <View key={i} style={ai.reasonRow}>
                <View style={[ai.reasonDot, { backgroundColor: vColor }]} />
                <Text style={ai.reasonText}>{r}</Text>
              </View>
            ))}
          </View>

          {/* Risk */}
          <View style={ai.riskCard}>
            <Text style={ai.riskLabel}>RISK TO WATCH</Text>
            <Text style={ai.riskText}>{result.risk}</Text>
          </View>

          {/* Next move */}
          <View style={ai.nextCard}>
            <Text style={ai.nextLabel}>NEXT MOVE</Text>
            <Text style={ai.nextText}>{result.next_step}</Text>
          </View>

          {/* Metrics grid */}
          <View style={ai.metricsRow}>
            {([
              [fmt(result.metrics.price), 'Price'],
              [`${result.metrics.margin}%`, 'Margin'],
              [`${result.metrics.reviews}`, 'Reviews'],
              [result.metrics.competition, 'Comp.'],
            ] as [string, string][]).map(([val, label]) => (
              <View key={label} style={ai.metric}>
                <Text style={ai.metricVal}>{val}</Text>
                <Text style={ai.metricLabel}>{label}</Text>
              </View>
            ))}
          </View>

          {/* LAUNCH: single hero CTA only */}
          {result.verdict === 'LAUNCH' && (
            <TouchableOpacity
              style={[ai.launchCta, isSaved && ai.launchCtaSaved]}
              onPress={onSaveWinner}
              activeOpacity={0.80}
            >
              <Text style={[ai.launchCtaIcon, isSaved && { color: colors.green }]}>
                {isSaved ? '✓' : '⚡'}
              </Text>
              <Text style={[ai.launchCtaText, isSaved && { color: colors.green }]}>
                {isSaved ? 'Saved — tap to remove' : 'Save to Winner Vault'}
              </Text>
            </TouchableOpacity>
          )}

          {/* Action row: save button only shown for TEST/AVOID; compare always shown */}
          <View style={ai.footer}>
            {result.verdict !== 'LAUNCH' && (
              <TouchableOpacity
                style={[ai.saveBtn, isSaved && ai.saveBtnDone]}
                onPress={onSaveWinner}
                activeOpacity={0.8}
              >
                <Text style={[ai.saveBtnText, isSaved && ai.saveBtnTextDone]}>
                  {isSaved ? '✓ Saved — tap to remove' : 'Save to Vault'}
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                ai.compareBtn,
                isCompareSelected && ai.compareBtnActive,
                (!canAddCompare && !isCompareSelected) && ai.compareBtnDim,
                result.verdict === 'LAUNCH' && ai.compareBtnFullWidth,
              ]}
              onPress={onToggleCompare}
              disabled={!canAddCompare && !isCompareSelected}
              activeOpacity={0.7}
            >
              <Text style={[ai.compareBtnText, isCompareSelected && ai.compareBtnTextActive]}>
                {isCompareSelected ? '✓ Selected' : '+ Compare'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </Animated.View>
  );
}

const ai = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md, marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1, borderColor: colors.border,
    borderBottomLeftRadius: radius.xl, borderBottomRightRadius: radius.xl,
    borderTopWidth: 0,
    padding: spacing.md, gap: spacing.sm,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.10, shadowRadius: 14, elevation: 4,
  },
  loadingWrap:     { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: spacing.md },
  loadingTextWrap: { gap: 3 },
  loadingTitle:    { fontSize: 14, fontWeight: '700', color: colors.textPrimary, letterSpacing: -0.2 },
  loadingSub:      { fontSize: 11, color: colors.textMuted, letterSpacing: 0.3 },
  limitCard: {
    backgroundColor: colors.bgElevated, borderRadius: radius.lg,
    padding: spacing.md, gap: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  limitTitle:     { fontSize: 14, fontWeight: '800', color: colors.textPrimary },
  limitSub:       { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
  upgradeBtn:     { backgroundColor: '#4361EE', borderRadius: radius.full, paddingVertical: 12, alignItems: 'center' },
  upgradeBtnText: { fontSize: 14, fontWeight: '700', color: colors.white },
  upgradePerks:   { fontSize: 10, color: colors.textMuted, textAlign: 'center' },
  verdictCard: {
    borderRadius: radius.xl, borderWidth: 1.5,
    padding: spacing.md, gap: 10,
    backgroundColor: colors.bgCard,
  },
  verdictBgWash: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.08, borderRadius: radius.xl,
  },
  verdictTopRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verdictBadgePill: { borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 8, alignSelf: 'flex-start' },
  verdictWord:      { fontSize: 18, fontWeight: '900', letterSpacing: 2.2 },
  verdictMetaCol:   { alignItems: 'flex-end', gap: 2 },
  confPercent:      { fontSize: 32, fontWeight: '900', letterSpacing: -1.2 },
  confLabelText:    { fontSize: 10, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.3 },
  confBarTrack:     { height: 7, backgroundColor: colors.bgElevated, borderRadius: 4, overflow: 'hidden' },
  confBarFill:      { height: 7, borderRadius: 4 },
  verdictFraming:   { fontSize: 13, fontWeight: '600', letterSpacing: -0.1, lineHeight: 19, opacity: 0.88 },
  refreshBtn:       { fontSize: 11, fontWeight: '600', color: colors.textMuted, marginTop: -2 },
  urgencyBadge:     { alignSelf: 'flex-start', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4 },
  urgencyText:      { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  reasons:          { gap: 10 },
  reasonRow:        { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  reasonDot:        { width: 7, height: 7, borderRadius: 3.5, marginTop: 6, flexShrink: 0 },
  reasonText:       { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
  riskCard: {
    backgroundColor: colors.redLight, borderRadius: radius.lg,
    padding: spacing.sm + 4, borderLeftWidth: 3, borderLeftColor: colors.red,
  },
  riskLabel: { fontSize: 8, fontWeight: '800', color: colors.red, letterSpacing: 1.8, marginBottom: 3 },
  riskText:  { fontSize: 12, color: colors.textPrimary, lineHeight: 18 },
  nextCard: {
    backgroundColor: 'rgba(67,97,238,0.10)', borderRadius: radius.lg,
    padding: spacing.sm + 4, borderLeftWidth: 3, borderLeftColor: '#4361EE',
  },
  nextLabel: { fontSize: 8, fontWeight: '800', color: '#4361EE', letterSpacing: 1.8, marginBottom: 3 },
  nextText:  { fontSize: 13, fontWeight: '600', color: colors.textPrimary, lineHeight: 18 },
  metricsRow: {
    flexDirection: 'row', backgroundColor: colors.bgElevated,
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: colors.border,
  },
  metric:      { flex: 1, alignItems: 'center', paddingVertical: 10 },
  metricVal:   { fontSize: 13, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.3 },
  metricLabel: { fontSize: 7, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginTop: 2 },
  launchCta: {
    backgroundColor: colors.green, borderRadius: radius.full,
    paddingVertical: 15, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 8,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.32, shadowRadius: 16, elevation: 8,
  },
  launchCtaSaved:    { backgroundColor: colors.greenLight, shadowOpacity: 0, elevation: 0 },
  launchCtaIcon:     { fontSize: 16, color: colors.white },
  launchCtaText:     { fontSize: 15, fontWeight: '800', color: colors.white, letterSpacing: -0.3 },
  footer:            { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  saveBtn: {
    flex: 1, borderWidth: 1, borderColor: '#4361EE',
    borderRadius: radius.full, paddingVertical: 9, alignItems: 'center',
    backgroundColor: 'rgba(67,97,238,0.10)',
  },
  saveBtnDone:         { backgroundColor: colors.greenLight, borderColor: colors.green },
  saveBtnText:         { fontSize: 12, fontWeight: '700', color: '#4361EE' },
  saveBtnTextDone:     { color: colors.green, fontWeight: '700' },
  compareBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    paddingHorizontal: 16, paddingVertical: 9, backgroundColor: colors.bgCard,
  },
  compareBtnFullWidth:    { flex: 1, alignItems: 'center' },
  compareBtnActive:       { backgroundColor: colors.purple, borderColor: colors.purple },
  compareBtnDim:          { opacity: 0.4 },
  compareBtnText:         { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  compareBtnTextActive:   { color: colors.white },
});
