import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { colors, spacing, radius } from '../theme';
import { useCurrency } from '../context/CurrencyContext';
import { Product } from '../services/api';
import { AnalyzeResult } from '../types/research';

export default function CompareModal({
  items, cache, onClose,
}: {
  items: Product[];
  cache: Record<string, AnalyzeResult>;
  onClose: () => void;
}) {
  const { fmt } = useCurrency();
  const scored = items.filter(i => cache[i.asin]);
  const best = scored.reduce<Product | null>((b, i) => {
    if (!b) return i;
    const bScore = (cache[b.asin]?.verdict === 'LAUNCH' ? 100 : 0) + (cache[b.asin]?.confidence ?? 0);
    const iScore = (cache[i.asin]?.verdict === 'LAUNCH' ? 100 : 0) + (cache[i.asin]?.confidence ?? 0);
    return iScore > bScore ? i : b;
  }, null);

  const bestResult = best ? cache[best.asin] : null;
  const bestWhy    = bestResult
    ? [
        bestResult.verdict === 'LAUNCH' ? 'LAUNCH verdict' : `Highest at ${bestResult.confidence}%`,
        `${bestResult.metrics.margin}% margin`,
        `${bestResult.metrics.competition} competition`,
      ].join(' · ')
    : '';

  const unanalyzed = items.length - scored.length;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={cmp.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={cmp.sheet}>
        <View style={cmp.handle} />
        <Text style={cmp.title}>Compare Products</Text>

        {best && (
          <View style={cmp.bestPickBanner}>
            <View style={cmp.bestPickHeader}>
              <View style={cmp.bestPickCrown}><Text style={cmp.bestPickCrownIcon}>✦</Text></View>
              <Text style={cmp.bestPickEye}>BEST PICK</Text>
            </View>
            <Text style={cmp.bestPickName} numberOfLines={1}>{best.title}</Text>
            <Text style={cmp.bestPickWhy}>{bestWhy}</Text>
          </View>
        )}

        {unanalyzed > 0 && (
          <Text style={cmp.unanalyzedNote}>
            {`${unanalyzed} product${unanalyzed > 1 ? 's' : ''} not yet analyzed — tap Analyze Product on each to include them`}
          </Text>
        )}

        {scored.length === 0 ? (
          <View style={cmp.emptyState}>
            <Text style={cmp.emptyStateText}>
              {'Analyze each product first\nto see a side-by-side comparison.'}
            </Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={cmp.cards}>
            {scored.map(item => {
              const r      = cache[item.asin];
              const isBest = item.asin === best?.asin;
              const vColor = r.verdict === 'LAUNCH' ? colors.green
                : r.verdict === 'AVOID' ? colors.red : colors.amber;
              const vBg    = r.verdict === 'LAUNCH' ? colors.greenLight
                : r.verdict === 'AVOID' ? colors.redLight : colors.amberLight;
              return (
                <View key={item.asin} style={[cmp.card, isBest && cmp.cardBest]}>
                  {isBest && (
                    <View style={cmp.bestBadge}>
                      <Text style={cmp.bestText}>BEST</Text>
                    </View>
                  )}
                  <View style={[cmp.verdictBadge, { backgroundColor: vBg }]}>
                    <Text style={[cmp.verdictText, { color: vColor }]}>{r.verdict}</Text>
                  </View>
                  <Text style={cmp.conf}>{r.confidence}% confident</Text>
                  <Text style={cmp.margin}>{r.metrics.margin}% margin</Text>
                  <Text style={cmp.price}>{fmt(r.metrics.price)}</Text>
                  <Text style={cmp.productName} numberOfLines={3}>{item.title}</Text>
                  <View style={cmp.riskBox}>
                    <Text style={cmp.riskLabel}>RISK</Text>
                    <Text style={cmp.riskText} numberOfLines={2}>{r.risk}</Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        )}

        <TouchableOpacity style={cmp.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={cmp.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const cmp = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl,
    padding: spacing.lg, maxHeight: '72%',
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.border, gap: spacing.md,
    shadowColor: '#0F172A', shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14, shadowRadius: 18, elevation: 12,
  },
  handle:   { width: 40, height: 4, backgroundColor: colors.bgElevated, borderRadius: 2, alignSelf: 'center' },
  title:    { fontSize: 17, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.4 },
  bestPickBanner: {
    backgroundColor: colors.greenLight, borderRadius: radius.xl,
    padding: spacing.md, borderWidth: 1.5, borderColor: `${colors.green}50`, gap: 4,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 5,
  },
  bestPickHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bestPickCrown:     { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  bestPickCrownIcon: { fontSize: 10, color: colors.white },
  bestPickEye:       { fontSize: 9, fontWeight: '900', color: colors.green, letterSpacing: 2.5 },
  bestPickName:      { fontSize: 15, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.4 },
  bestPickWhy:       { fontSize: 12, color: colors.textSecondary, letterSpacing: -0.1 },
  cards:             { gap: spacing.sm, paddingBottom: spacing.sm },
  card: {
    width: 168, backgroundColor: colors.bgSubtle,
    borderRadius: radius.xl, padding: spacing.md,
    borderWidth: 1, borderColor: colors.border, gap: 6,
    shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 2,
  },
  cardBest: {
    borderColor: colors.green, borderWidth: 2,
    backgroundColor: colors.greenLight,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18, shadowRadius: 12, elevation: 6,
  },
  bestBadge:    { backgroundColor: colors.green, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  bestText:     { fontSize: 9, fontWeight: '900', color: colors.white, letterSpacing: 1.2 },
  verdictBadge: { borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  verdictText:  { fontSize: 13, fontWeight: '900', letterSpacing: 0.5 },
  conf:         { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },
  margin:       { fontSize: 20, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.6 },
  price:        { fontSize: 12, color: colors.textMuted },
  productName:  { fontSize: 11, color: colors.textSecondary, lineHeight: 16 },
  riskBox:      { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 7, marginTop: 2 },
  riskLabel:    { fontSize: 8, fontWeight: '800', color: colors.red, letterSpacing: 1.5, marginBottom: 2 },
  riskText:     { fontSize: 10, color: colors.textMuted, lineHeight: 14 },
  closeBtn:     { backgroundColor: colors.cyan, borderRadius: radius.full, paddingVertical: spacing.md, alignItems: 'center' },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  emptyState:     { alignItems: 'center', paddingVertical: spacing.lg },
  emptyStateText: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  unanalyzedNote: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: -spacing.xs },
});
