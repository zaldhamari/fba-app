import React, { useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, Animated, Linking,
} from 'react-native';
import { colors, spacing, radius, shadow, motion } from '../theme';
import { useCurrency } from '../context/CurrencyContext';
import { Product } from '../services/api';
import PulseDots from './PulseDots';

// ─── Sub-components ──────────────────────────────────────────────────────────

function CompBar({ competition }: { competition: string }) {
  const levels: Record<string, number> = { Low: 1, Medium: 2, High: 3, Unknown: 0 };
  const filled = levels[competition] ?? 0;
  const color  = competition === 'Low' ? colors.green : competition === 'High' ? colors.red : colors.amber;
  return (
    <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
      {[1, 2, 3].map(i => (
        <View
          key={i}
          style={{ width: 14, height: 5, borderRadius: 3,
            backgroundColor: i <= filled ? color : colors.bgElevated }}
        />
      ))}
    </View>
  );
}

function Stars({ rating }: { rating: number }) {
  const full = Math.round(rating);
  return (
    <Text style={{ fontSize: 11, color: colors.amber, letterSpacing: 1 }}>
      {'★'.repeat(Math.min(full, 5))}{'☆'.repeat(Math.max(0, 5 - full))}
    </Text>
  );
}

function Scorecard({ item }: { item: Product }) {
  const checks = [
    { label: 'Price $20–$70',    pass: item.price != null && item.price >= 20 && item.price <= 70 },
    { label: '<1k reviews',      pass: item.review_count != null && item.review_count < 1000 },
    { label: 'Good opportunity', pass: item.opportunity === 'Good' },
    { label: 'Low/med comp.',    pass: item.competition === 'Low' || item.competition === 'Medium' },
  ];
  const score      = checks.filter(c => c.pass).length;
  const scoreColor = score >= 3 ? colors.green : score >= 2 ? colors.amber : colors.red;
  const scoreBg    = score >= 3 ? colors.greenLight : score >= 2 ? colors.orangeLight : colors.redLight;
  return (
    <View style={sc.wrap}>
      <View style={[sc.scoreBadge, { backgroundColor: scoreBg }]}>
        <Text style={[sc.scoreNum, { color: scoreColor }]}>{score}/4</Text>
      </View>
      <View style={sc.checks}>
        {checks.map((c, i) => (
          <View key={i} style={sc.check}>
            <Text style={[sc.checkDot, { color: c.pass ? colors.green : colors.textMuted }]}>{c.pass ? '✓' : '✗'}</Text>
            <Text style={[sc.checkLabel, { color: c.pass ? colors.textPrimary : colors.textMuted }]}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const sc = StyleSheet.create({
  wrap:       { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: 4, paddingTop: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border },
  scoreBadge: { borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3, alignItems: 'center', minWidth: 34 },
  scoreNum:   { fontSize: 12, fontWeight: '800' },
  checks:     { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  check:      { flexDirection: 'row', alignItems: 'center', gap: 2 },
  checkDot:   { fontSize: 10, fontWeight: '800' },
  checkLabel: { fontSize: 9, fontWeight: '600' },
});

// ─── ProductCard ─────────────────────────────────────────────────────────────

export default function ProductCard({
  item, isSaved, onSave, onInsight, onAnalyze, expanded, analyzing, usageMeter, showHint, cardIndex, opportunityScore,
}: {
  item: Product;
  isSaved: boolean;
  onSave: () => void;
  onInsight: () => void;
  onAnalyze: () => void;
  expanded: boolean;
  analyzing: boolean;
  usageMeter?: string | null;
  showHint?: boolean;
  cardIndex?: number;
  opportunityScore?: number;
}) {
  const { fmt } = useCurrency();
  const opp      = item.opportunity;
  const oppColor = opp === 'Good' ? colors.green : opp === 'Saturated' ? colors.red : colors.amber;
  const oppBg    = opp === 'Good' ? colors.greenLight : opp === 'Saturated' ? colors.redLight : colors.orangeLight;
  const oppLabel = opp === 'Good' ? 'GOOD' : opp === 'Saturated' ? 'SAT.' : 'MOD.';

  const enterY  = useRef(new Animated.Value(22)).current;
  const enterOp = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const delay = Math.min(cardIndex ?? 0, 5) * motion.stagger;
    Animated.parallel([
      Animated.timing(enterOp, { toValue: 1, duration: motion.reveal, delay, useNativeDriver: true }),
      Animated.spring(enterY,  { toValue: 0, ...motion.spring, delay, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.cardShadow, { opacity: enterOp, transform: [{ translateY: enterY }] }]}>
      <TouchableOpacity
        style={[s.card, { borderTopColor: oppColor }]}
        onPress={onAnalyze}
        activeOpacity={0.88}
      >
        {/* Image */}
        <View style={s.imgSection}>
          {item.image
            ? <Image source={{ uri: item.image }} style={s.img} resizeMode="contain" />
            : <View style={[s.img, s.imgPlaceholder]}><Text style={{ fontSize: 26, color: colors.textMuted }}>◈</Text></View>
          }
          <View style={[s.oppBadge, { backgroundColor: oppBg }]}>
            <Text style={[s.oppBadgeText, { color: oppColor }]}>{oppLabel}</Text>
          </View>
          {opportunityScore != null && (
            <View style={[s.aiBadge, {
              backgroundColor: opportunityScore >= 70
                ? colors.greenLight
                : opportunityScore >= 45 ? colors.orangeLight : colors.redLight,
            }]}>
              <Text style={[s.aiBadgeNum, {
                color: opportunityScore >= 70
                  ? colors.green
                  : opportunityScore >= 45 ? colors.amber : colors.red,
              }]}>{opportunityScore}</Text>
              <Text style={s.aiBadgeLabel}>AI</Text>
            </View>
          )}
        </View>

        {/* Body */}
        <View style={s.cardBody}>
          <View style={s.cardTopRow}>
            {item.price != null
              ? <Text style={s.cardPrice}>{fmt(item.price)}</Text>
              : <Text style={s.cardPriceMuted}>—</Text>
            }
            <TouchableOpacity onPress={onSave} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[s.heartBtn, { color: isSaved ? colors.green : colors.textMuted }]}>
                {isSaved ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={s.cardTitle} numberOfLines={2}>{item.title}</Text>

          <View style={s.signalRow}>
            {item.rating != null && (
              <>
                <Stars rating={item.rating} />
                <Text style={s.reviewCount}>
                  {item.rating.toFixed(1)}{item.review_count != null ? ` (${item.review_count.toLocaleString()})` : ''}
                </Text>
                <Text style={s.rowDivider}>·</Text>
              </>
            )}
            <CompBar competition={item.competition} />
            <View style={{ flex: 1 }} />
            {item.url ? (
              <TouchableOpacity onPress={() => Linking.openURL(item.url!)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                <Text style={[s.insightBtn, { color: colors.textMuted }]}>↗</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={onInsight} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={s.insightBtn}>Insights</Text>
            </TouchableOpacity>
          </View>

          <Scorecard item={item} />

          {showHint && !expanded && !analyzing && (
            <View style={s.analyzeHint}>
              <Text style={s.analyzeHintText}>⚡  Tap below for AI verdict</Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.analyzeBtn, expanded && s.analyzeBtnExpanded]}
            onPress={onAnalyze}
            activeOpacity={0.85}
            disabled={analyzing}
          >
            {analyzing
              ? <PulseDots color={expanded ? '#2563EB' : colors.white} />
              : <Text style={[s.analyzeBtnText, expanded && s.analyzeBtnTextExpanded]}>
                  {expanded ? 'Hide Analysis ↑' : 'Analyze Product →'}
                </Text>
            }
          </TouchableOpacity>

          {usageMeter && <Text style={s.usageMeter}>{usageMeter}</Text>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  cardShadow: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.bgCard,
    ...shadow.card,
  },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 3,
  },
  imgSection: {
    width: 100, paddingHorizontal: 10, paddingTop: 14, paddingBottom: 12,
    alignItems: 'center', gap: 7, flexShrink: 0,
  },
  img:            { width: 78, height: 78, borderRadius: radius.md, backgroundColor: colors.bgElevated },
  imgPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  oppBadge:     { borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'center' },
  oppBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8 },
  aiBadge:      { borderRadius: radius.sm, paddingHorizontal: 5, paddingVertical: 2, alignItems: 'center', alignSelf: 'center', minWidth: 32 },
  aiBadgeNum:   { fontSize: 12, fontWeight: '900', letterSpacing: -0.3, lineHeight: 15 },
  aiBadgeLabel: { fontSize: 7, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
  cardBody:       { flex: 1, paddingTop: 12, paddingBottom: 14, paddingRight: 12, gap: 5 },
  cardTopRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardPrice:      { fontSize: 22, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.8 },
  cardPriceMuted: { fontSize: 22, fontWeight: '900', color: colors.textMuted },
  heartBtn:       { fontSize: 22, marginTop: -1 },
  cardTitle:      { fontSize: 12, fontWeight: '600', color: colors.textPrimary, lineHeight: 18, letterSpacing: -0.1 },
  signalRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 1 },
  reviewCount:    { fontSize: 10, color: colors.textSecondary },
  rowDivider:     { fontSize: 10, color: colors.textMuted },
  insightBtn:     { fontSize: 10, fontWeight: '700', color: '#2563EB' },
  analyzeBtn: {
    marginTop: spacing.sm, backgroundColor: '#2563EB',
    borderRadius: radius.full, paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#2563EB', minHeight: 38,
  },
  analyzeBtnExpanded:     { backgroundColor: 'transparent', borderColor: '#2563EB' },
  analyzeBtnText:         { fontSize: 13, fontWeight: '700', color: colors.white, letterSpacing: -0.1 },
  analyzeBtnTextExpanded: { color: '#2563EB' },
  usageMeter:             { fontSize: 10, color: colors.textMuted, textAlign: 'center', marginTop: 2 },
  analyzeHint: {
    backgroundColor: 'rgba(37,99,235,0.10)', borderRadius: radius.sm,
    paddingVertical: 4, paddingHorizontal: 8,
    alignSelf: 'flex-start', marginBottom: 2,
    borderWidth: 1, borderColor: 'rgba(37,99,235,0.22)',
  },
  analyzeHintText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
});
