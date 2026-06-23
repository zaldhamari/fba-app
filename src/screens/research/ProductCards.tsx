import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, DS } from '../../components/ds';
import { useCurrency } from '../../context/CurrencyContext';
import { ProductDisplay, SupplierDisplay } from './types';
import { SmartBadgeStrip, am } from './SharedComponents';
import { openURL } from './utils';
import { ppcColor, confidenceColor } from '../../lib/financialEngine';
import type { PPCPressure, SalesConfidence } from '../../lib/financialEngine';
import { buildOpportunitySignals } from './productHelpers';
import type { SignalType } from './productHelpers';
import { EstimateLabel } from '../../components/EstimateLabel';

// ── Compare helpers ───────────────────────────────────────────────────────────

export function scoreProductForCompare(p: ProductDisplay): number {
  let s = (p.revenueUSD ?? 0) * 0.01;
  s += p.competition === 'Low' ? 30 : p.competition === 'Medium' ? 15 : 0;
  s += p.badge === 'Promising' ? 20 : p.badge === 'Moderate' ? 10 : 0;
  s += (p.rating ?? 0) * 4;
  return s;
}

export function scoreSupplierForCompare(s: SupplierDisplay): number {
  return (s.trust * 10)
    + (s.priceUSD != null ? Math.max(0, 10 - s.priceUSD) * 8 : 0)
    + Math.max(0, 500 - s.moqNum) * 0.02;
}

export function buildSupplierReasons(w: SupplierDisplay, all: SupplierDisplay[]): string[] {
  const r: string[] = [];
  if (all.every(s => s.trust <= w.trust)) r.push(`Highest trust score — ${w.trust}/10`);
  if (all.every(s => (s.priceUSD ?? 999) >= (w.priceUSD ?? 999)) && w.priceUSD)
    r.push(`Lowest unit price — ${w.price}`);
  if (all.every(s => s.moqNum >= w.moqNum)) r.push(`Lowest minimum order — ${w.moq}`);
  if (r.length < 2) r.push('Best overall score across all sourcing metrics');
  return r.slice(0, 3);
}

export function buildProductReasons(w: ProductDisplay, all: ProductDisplay[]): string[] {
  const r: string[] = [];
  if (all.every(p => (p.revenueUSD ?? 0) <= (w.revenueUSD ?? 0)) && w.revenueUSD)
    r.push(`Highest estimated revenue — ${w.revenue}`);
  if (w.competition === 'Low') r.push('Low competition — easier to rank and win the buy box');
  if (w.badge === 'Promising') r.push('Promising opportunity with strong market demand signal');
  if (w.rating != null && all.every(p => (p.rating ?? 0) <= (w.rating ?? 0)))
    r.push(`Top-rated product — ${w.rating.toFixed(1)} ★ customer satisfaction`);
  if (r.length < 2) r.push('Best combined score across all opportunity metrics');
  return r.slice(0, 4);
}

export type HL = 'best' | 'worst' | 'neutral';

export function numHL(vals: (number | null)[], higher: boolean): HL[] {
  const ns = vals.filter((v): v is number => v != null);
  if (ns.length < 2) return vals.map(() => 'neutral');
  const b = higher ? Math.max(...ns) : Math.min(...ns);
  const w = higher ? Math.min(...ns) : Math.max(...ns);
  return vals.map(v =>
    v == null ? 'neutral' : v === b && b !== w ? 'best' : v === w && b !== w ? 'worst' : 'neutral');
}

export function hlBg(h: HL): string {
  return h === 'best' ? DS.accentLight : h === 'worst' ? DS.dangerBg : 'transparent';
}
export function hlTxt(h: HL): string {
  return h === 'best' ? DS.accentDark : h === 'worst' ? DS.dangerText : DS.textPrimary;
}

export const CMP_LABEL_W = 90;
export const CMP_CELL_W  = 110;

// ── Product card — Market mode ────────────────────────────────────────────────

export function ProductMarketCard({
  item,
  inCompare, canCompare, onToggleCompare, onAnalyze, analyzeLoading,
  onTrackInPipeline, isTracked,
  onSave, isSaved, saveLoading,
}: {
  item: ProductDisplay;
  inCompare?: boolean;
  canCompare?: boolean;
  onToggleCompare?: () => void;
  onAnalyze?: () => void;
  analyzeLoading?: boolean;
  onTrackInPipeline?: () => void;
  isTracked?: boolean;
  onSave?: () => void;
  isSaved?: boolean;
  saveLoading?: boolean;
}) {
  const { fmt } = useCurrency();
  const hasLink = !!item.url;

  const oppLabel = (item.badge ?? 'Moderate').toUpperCase();
  const oppColor = item.badge === 'Promising' ? DS.successText : item.badge === 'Saturated' ? DS.dangerText : DS.warningText;
  const oppBg    = item.badge === 'Promising' ? DS.successBg   : item.badge === 'Saturated' ? DS.dangerBg  : DS.warningBg;
  const compColor = item.competition === 'Low' ? DS.successText : item.competition === 'High' ? DS.dangerText : DS.warningText;
  const compBg    = item.competition === 'Low' ? DS.successBg   : item.competition === 'High' ? DS.dangerBg  : DS.warningBg;
  const oppSignals = buildOpportunitySignals(item);

  return (
    <AppCard padding={14} radius={18} style={pmc.card}>

      {/* ── Header ─── */}
      <View style={pmc.header}>
        <View style={pmc.imgBox}>
          {item.image
            ? <Image source={{ uri: item.image }} style={pmc.img} contentFit="contain" transition={150} accessibilityRole="image" accessibilityLabel={`Product photo: ${item.name}`} />
            : <Text style={pmc.imgPlaceholder}>🛒</Text>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={pmc.productName} numberOfLines={2}>{item.name}</Text>
          <View style={pmc.badgesRow}>
            <View style={[pmc.oppPill, { backgroundColor: oppBg }]}>
              <View style={[pmc.oppDot, { backgroundColor: oppColor }]} />
              <Text style={[pmc.oppTxt, { color: oppColor }]}>{oppLabel}</Text>
            </View>
            <Text style={[pmc.compText, { color: compColor }]}>{item.competition} competition</Text>
          </View>
        </View>
      </View>

      {/* Price isn't from a real listing yet (no Amazon data API configured) — disclose it
          rather than showing a category-average guess as if it were the actual price. */}
      {item.source && item.source !== 'dataforseo' && item.price != null && (
        <View style={pmc.rowBetween}>
          <Text style={pmc.intelDisclaimer}>Price is a category estimate, not a live listing</Text>
          <EstimateLabel type="estimated" />
        </View>
      )}

      {/* ── Stats row ─── */}
      <View style={pmc.stats}>
        <View style={pmc.stat}>
          <Text style={[pmc.statVal, { color: DS.accent }]}>
            {item.price != null ? fmt(item.price) : '—'}
          </Text>
          <Text style={pmc.statLbl}>Price</Text>
        </View>
        <View style={pmc.div} />
        <View style={pmc.stat}>
          <Text style={pmc.statVal}>
            {item.rating != null ? `${item.rating.toFixed(1)} ★` : '—'}
          </Text>
          <Text style={pmc.statLbl}>Rating</Text>
        </View>
        <View style={pmc.div} />
        <View style={pmc.stat}>
          <Text style={pmc.statVal}>
            {item.reviewCount != null ? item.reviewCount.toLocaleString() : '—'}
          </Text>
          <Text style={pmc.statLbl}>Reviews</Text>
        </View>
        <View style={pmc.div} />
        <View style={pmc.stat}>
          <Text style={pmc.statVal}>
            {item.salesEstMonthly ?? (item.monthlySalesEst != null ? `~${item.monthlySalesEst}/mo` : '—')}
          </Text>
          <Text style={pmc.statLbl}>Est. Sales</Text>
          {item.salesEstDaily && (
            <Text style={pmc.statSub}>{item.salesEstDaily}</Text>
          )}
        </View>
      </View>

      {/* ── Sales intelligence strip ─── */}
      {(item.salesConfidence || item.ppcPressure || oppSignals.length > 0) && (
        <View style={pmc.intelStrip}>
          {item.revenueEstLow != null && item.revenueEstHigh != null && (
            <View style={pmc.intelChip}>
              <Text style={pmc.intelIcon}>💰</Text>
              <Text style={pmc.intelTxt}>
                ~${item.revenueEstLow.toLocaleString()}–${item.revenueEstHigh.toLocaleString()}/mo est. revenue
              </Text>
            </View>
          )}
          {item.ppcPressure && (
            <View style={[pmc.intelChip, { backgroundColor: ppcColor(item.ppcPressure) + '18' }]}>
              <Text style={pmc.intelIcon}>📣</Text>
              <Text style={[pmc.intelTxt, { color: ppcColor(item.ppcPressure) }]}>
                {item.ppcPressure} PPC Pressure
              </Text>
            </View>
          )}
          {item.salesConfidence && (
            <View style={[pmc.intelChip, { backgroundColor: confidenceColor(item.salesConfidence) + '18' }]}>
              <Text style={pmc.intelIcon}>◎</Text>
              <Text style={[pmc.intelTxt, { color: confidenceColor(item.salesConfidence) }]}>
                {item.salesConfidence} confidence
              </Text>
            </View>
          )}
          {oppSignals.map((sig, i) => (
            <View
              key={i}
              style={[pmc.intelChip, {
                backgroundColor: sig.type === 'positive' ? DS.success + '14'
                  : sig.type === 'warning' ? DS.warning + '14'
                  : DS.bgSubtle,
              }]}
            >
              <Text style={pmc.intelIcon}>
                {sig.type === 'positive' ? '✓' : sig.type === 'warning' ? '⚠' : '◈'}
              </Text>
              <Text style={[pmc.intelTxt, {
                color: sig.type === 'positive' ? DS.success
                  : sig.type === 'warning' ? DS.warning
                  : DS.textSecondary,
              }]}>
                {sig.label}
              </Text>
            </View>
          ))}
          <Text style={pmc.intelDisclaimer}>
            Directional — review velocity model, not live BSR data
          </Text>
          {(item.competition === 'High' || (item.reviewCount ?? 0) > 500) && (
            <View style={pmc.coachChip}>
              <Text style={pmc.coachTxt}>
                💡 High review markets usually require more PPC spend to rank — budget 15–20% of revenue.
              </Text>
            </View>
          )}
          {item.competition === 'Low' && (item.reviewCount ?? 999) < 100 && (
            <View style={[pmc.coachChip, { backgroundColor: DS.success + '10', borderColor: DS.success + '20' }]}>
              <Text style={[pmc.coachTxt, { color: DS.success }]}>
                💡 Low competition with few reviews — strong early-mover opportunity. Validate demand before ordering.
              </Text>
            </View>
          )}
        </View>
      )}

      <SmartBadgeStrip badges={item.badges} finalScore={item.finalScore} />

      {/* ── Primary action ─── */}
      <TouchableOpacity
        style={[pmc.amazonBtn, !hasLink && pmc.amazonBtnDisabled]}
        onPress={() => openURL(item.url)}
        activeOpacity={hasLink ? 0.8 : 1}
        disabled={!hasLink}
      >
        <Text style={[pmc.amazonTxt, !hasLink && pmc.amazonTxtDisabled]}>
          {hasLink ? '↗  View on Amazon' : 'Link unavailable'}
        </Text>
      </TouchableOpacity>

      {/* ── Secondary actions ─── */}
      <View style={pmc.actionsRow}>
        <TouchableOpacity
          style={[pmc.actionBtn, pmc.analyzeBtn, analyzeLoading && { opacity: 0.6 }]}
          onPress={onAnalyze}
          activeOpacity={0.8}
          disabled={analyzeLoading || !onAnalyze}
        >
          <Text style={pmc.analyzeTxt}>{analyzeLoading ? '…' : '⊛  Verdict'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[pmc.actionBtn, inCompare ? pmc.compareActive : pmc.compareBtn]}
          onPress={canCompare ? onToggleCompare : undefined}
          activeOpacity={canCompare ? 0.8 : 1}
          disabled={!canCompare}
        >
          <Text style={[pmc.compareTxt, inCompare && pmc.compareTxtActive]}>
            {inCompare ? '✓  Added' : '⊞  Compare'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[pmc.actionBtn, isSaved ? pmc.savedBtn : pmc.saveBtn, saveLoading && { opacity: 0.6 }]}
          onPress={onSave}
          activeOpacity={0.8}
          disabled={saveLoading || !onSave}
        >
          <Text style={[pmc.saveTxt, isSaved && pmc.savedTxt]}>
            {saveLoading ? '…' : isSaved ? '✓  Saved' : '🔖  Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Pipeline CTA ─── */}
      {onTrackInPipeline && (
        <TouchableOpacity
          style={[pmc.pipelineBtn, isTracked && pmc.pipelineBtnActive]}
          onPress={onTrackInPipeline}
          activeOpacity={0.8}
        >
          <Text style={[pmc.pipelineTxt, isTracked && pmc.pipelineTxtActive]}>
            {isTracked ? '⬡  Continue to Sourcing →' : '⬡  Find Suppliers →'}
          </Text>
        </TouchableOpacity>
      )}
    </AppCard>
  );
}

const pmc = StyleSheet.create({
  card:             { gap: 12 },
  rowBetween:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardSelected:     { borderWidth: 2, borderColor: DS.accent },
  // Header
  header:           { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  imgBox:           { width: 52, height: 52, borderRadius: 12, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  img:              { width: 50, height: 50, borderRadius: 11 },
  imgPlaceholder:   { fontSize: 22 },
  productName:      { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 18 },
  badgesRow:        { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  oppPill:          { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  oppDot:           { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  oppTxt:           { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  compText:         { fontSize: 12, fontWeight: '600', alignSelf: 'center' },
  // Stats
  stats:            { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, paddingVertical: 10 },
  stat:             { flex: 1, alignItems: 'center', gap: 2 },
  div:              { width: 1, height: 28, backgroundColor: DS.border },
  statVal:          { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  statLbl:          { fontSize: 9, color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  statSub:          { fontSize: 9, color: DS.textMuted, marginTop: 1 },
  // Intelligence strip
  intelStrip:       { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  intelChip:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.bgSubtle, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  intelIcon:        { fontSize: 11 },
  intelTxt:         { fontSize: 10, fontWeight: '600', color: DS.textSecondary },
  intelDisclaimer:  { fontSize: 9, color: DS.textMuted, fontStyle: 'italic', width: '100%' },
  coachChip:        { width: '100%', backgroundColor: DS.warning + '10', borderRadius: 8, borderWidth: 1, borderColor: DS.warning + '20', paddingHorizontal: 8, paddingVertical: 5 },
  coachTxt:         { fontSize: 10, color: DS.textSecondary, lineHeight: 14 },
  // Primary button
  amazonBtn:        { backgroundColor: '#FF9900', borderRadius: 12, paddingVertical: 10, alignItems: 'center' as const },
  amazonBtnDisabled:{ backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  amazonTxt:        { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  amazonTxtDisabled:{ color: DS.textMuted },
  // Actions row
  actionsRow:       { flexDirection: 'row', gap: 6 },
  actionBtn:        { flex: 1, borderRadius: DS.radiusButton, paddingVertical: 11, alignItems: 'center' as const },
  analyzeBtn:       { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent + '44' },
  analyzeTxt:       { fontSize: 13, fontWeight: '700', color: DS.accent },
  compareBtn:       { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  compareActive:    { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  compareTxt:       { fontSize: 13, fontWeight: '700', color: DS.textSecondary },
  compareTxtActive: { color: DS.accent },
  saveBtn:          { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  savedBtn:         { backgroundColor: DS.success + '18', borderWidth: 1, borderColor: DS.success },
  saveTxt:          { fontSize: 13, fontWeight: '700', color: DS.textSecondary },
  savedTxt:         { color: DS.success },
  // Pipeline CTA
  pipelineBtn:      { borderRadius: DS.radiusButton, paddingVertical: 12, alignItems: 'center' as const, backgroundColor: DS.accent, borderWidth: 0 },
  pipelineBtnActive:{ backgroundColor: DS.accent },
  pipelineTxt:      { fontSize: 13, fontWeight: '800' as const, color: '#fff', letterSpacing: -0.2 },
  pipelineTxtActive:{ color: '#fff' },
});

// ── Premium Compare products modal ───────────────────────────────────────────

export function CompareProductsModal({
  visible, items, onClose, onSaveWinner,
}: {
  visible:       boolean;
  items:         ProductDisplay[];
  onClose:       () => void;
  onSaveWinner?: (item: ProductDisplay) => void;
}) {
  const { fmt } = useCurrency();
  const scores  = items.length > 0 ? items.map(scoreProductForCompare) : [];
  const autoIdx = scores.length > 0 ? scores.indexOf(Math.max(...scores)) : 0;
  const [selectedIdx, setSelectedIdx] = useState(autoIdx);

  // Keep selectedIdx in bounds if items change while modal is open
  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1));

  if (items.length === 0) return null;

  const winner  = items[safeIdx];
  const second  = [...scores].sort((a, b) => b - a)[1] ?? 0;
  const rawConf = scores[safeIdx] > 0 ? ((scores[safeIdx] - second) / scores[safeIdx]) * 100 : 50;
  const conf    = Math.round(Math.min(97, Math.max(54, 65 + rawConf * 0.3)));
  const reasons = buildProductReasons(winner, items);
  const vLabel  = winner.badge === 'Promising' ? 'PROCEED' : winner.badge === 'Saturated' ? 'SKIP' : 'EXPLORE';
  const vColor  = winner.badge === 'Promising' ? DS.successText : winner.badge === 'Saturated' ? DS.dangerText : DS.warningText;
  const vBg     = winner.badge === 'Promising' ? DS.successBg   : winner.badge === 'Saturated' ? DS.dangerBg  : DS.warningBg;

  const priceHL   = numHL(items.map(p => p.price), false);
  const ratingHL  = numHL(items.map(p => p.rating), true);
  const reviewHL  = numHL(items.map(p => p.reviewCount), true);
  const revenueHL = numHL(items.map(p => p.revenueUSD), true);
  const compHL: HL[]  = items.map(p => p.competition === 'Low' ? 'best' : p.competition === 'High' ? 'worst' : 'neutral');
  const badgeHL: HL[] = items.map(p => p.badge === 'Promising' ? 'best' : p.badge === 'Saturated' ? 'worst' : 'neutral');

  const sections = [
    {
      title: 'MARKET METRICS',
      rows: [
        { label: 'Price',        vals: items.map(p => p.price != null ? fmt(p.price) : '—'),                              hls: priceHL   },
        { label: 'Rating',       vals: items.map(p => p.rating != null ? `${p.rating.toFixed(1)} ★` : '—'),               hls: ratingHL  },
        { label: 'Reviews',      vals: items.map(p => p.reviewCount != null ? p.reviewCount.toLocaleString() : '—'),       hls: reviewHL  },
        { label: 'Est. Revenue', vals: items.map(p => p.revenueUSD != null ? `${fmt(p.revenueUSD, 0)}/mo` : '—'),         hls: revenueHL },
      ],
    },
    {
      title: 'OPPORTUNITY METRICS',
      rows: [
        { label: 'Competition', vals: items.map(p => p.competition), hls: compHL  },
        { label: 'Opportunity', vals: items.map(p => p.badge),       hls: badgeHL },
      ],
    },
  ];

  const tableW = CMP_LABEL_W + CMP_CELL_W * items.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Product Comparison</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={prm.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={prm.hero}>
            <View style={prm.heroBall1} />
            <View style={prm.heroBall2} />
            <Text style={prm.heroEye}>AI COMPARISON ENGINE</Text>
            <Text style={prm.heroH}>Product Comparison</Text>
            <Text style={prm.heroSub}>Side-by-side analysis of your selected opportunities</Text>
            <View style={prm.heroChip}>
              <Text style={prm.heroChipTxt}>{items.length} Products Selected</Text>
            </View>
          </View>

          {/* ── AI Recommendation ─────────────────────────────────── */}
          <View style={prm.recCard}>
            <View style={prm.recTopRow}>
              <View style={prm.crownWrap}>
                <Text style={prm.crownIcon}>{safeIdx === autoIdx ? '🏆' : '✦'}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={prm.recEye}>{safeIdx === autoIdx ? 'AI RECOMMENDED' : 'YOUR SELECTION'}</Text>
                <Text style={prm.recName} numberOfLines={2}>{winner.name}</Text>
              </View>
              <View style={[prm.vPill, { backgroundColor: vBg }]}>
                <Text style={[prm.vTxt, { color: vColor }]}>{vLabel}</Text>
              </View>
            </View>

            <View style={prm.confWrap}>
              <View style={prm.confBg}>
                <View style={[prm.confFill, { width: `${conf}%` as any }]} />
              </View>
              <Text style={prm.confTxt}>{conf}% confidence</Text>
            </View>

            {reasons.map((r, i) => (
              <View key={i} style={prm.reason}>
                <Text style={prm.reasonDot}>✦</Text>
                <Text style={prm.reasonTxt}>{r}</Text>
              </View>
            ))}

            {onSaveWinner && (
              <TouchableOpacity style={prm.saveWinBtn} onPress={() => onSaveWinner(winner)} activeOpacity={0.8}>
                <Text style={prm.saveWinTxt}>✦  Save to Vault</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Column headers ────────────────────────────────────── */}
          <AppCard padding={14} radius={18}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={prm.secEye}>PRODUCTS COMPARED</Text>
              <Text style={prm.tapHint}>Tap to select</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {items.map((p, i) => {
                  const isSel  = i === safeIdx;
                  const isAuto = i === autoIdx;
                  const bLabel = p.badge === 'Promising' ? 'PROCEED' : p.badge === 'Saturated' ? 'SKIP' : 'EXPLORE';
                  const bColor = p.badge === 'Promising' ? DS.successText : p.badge === 'Saturated' ? DS.dangerText : DS.warningText;
                  const bBg    = p.badge === 'Promising' ? DS.successBg   : p.badge === 'Saturated' ? DS.dangerBg  : DS.warningBg;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[prm.colCard, isSel && prm.colCardWin]}
                      onPress={() => setSelectedIdx(i)}
                      activeOpacity={0.75}
                    >
                      {p.image ? (
                        <Image source={{ uri: p.image }} style={prm.colImg} contentFit="contain" transition={150} accessibilityRole="image" accessibilityLabel={`Product photo: ${p.name}`} />
                      ) : (
                        <View style={prm.colImgFallback}>
                          <Text style={prm.colImgIcon}>◎</Text>
                        </View>
                      )}
                      <Text style={prm.colTitle} numberOfLines={2}>{p.name}</Text>
                      <View style={prm.colFooter}>
                        <View style={[prm.colBadge, { backgroundColor: bBg }]}>
                          <Text style={[prm.colBadgeTxt, { color: bColor }]}>{bLabel}</Text>
                        </View>
                        {isSel  && <Text style={prm.winTag}>SELECTED</Text>}
                        {!isSel && isAuto && <Text style={prm.aiTag}>AI PICK</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </AppCard>

          {/* ── Metric sections ───────────────────────────────────── */}
          {sections.map(sec => (
            <AppCard key={sec.title} padding={14} radius={18} style={{ gap: 0 }}>
              <Text style={prm.secEye}>{sec.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ width: tableW }}>
                  {sec.rows.map((row, ri) => (
                    <View key={row.label} style={[prm.mRow, ri % 2 === 0 && prm.mRowAlt]}>
                      <View style={[prm.mLabel, { width: CMP_LABEL_W }]}>
                        <Text style={prm.mLabelTxt}>{row.label}</Text>
                      </View>
                      {row.vals.map((v, vi) => (
                        <View
                          key={vi}
                          style={[prm.mCell, { width: CMP_CELL_W, backgroundColor: hlBg(row.hls[vi]) }]}
                        >
                          <Text style={[prm.mCellTxt, { color: hlTxt(row.hls[vi]) }]} numberOfLines={1}>{v}</Text>
                          {row.hls[vi] === 'best' && <Text style={prm.trophy}>🏆</Text>}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </AppCard>
          ))}

          {/* ── Action bar ────────────────────────────────────────── */}
          <View style={prm.actions}>
            {onSaveWinner && (
              <TouchableOpacity
                style={prm.actionPrimary}
                onPress={() => { onSaveWinner(winner); onClose(); }}
                activeOpacity={0.85}
              >
                <Text style={prm.actionPrimaryTxt}>✦  Save Winner</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={prm.actionGhost} onPress={onClose} activeOpacity={0.8}>
              <Text style={prm.actionGhostTxt}>Close Comparison</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Premium compare styles (shared with SupplierCards) ───────────────────────

export const prm = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 14 },

  // Hero
  hero: {
    backgroundColor: DS.accentLight, borderRadius: DS.radiusCard,
    padding: 22, overflow: 'hidden', gap: 5,
    borderWidth: 1, borderColor: `${DS.accent}22`,
  },
  heroSupplier: { backgroundColor: DS.accentLight, borderColor: `${DS.accent}22` },
  heroBall1: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60, backgroundColor: `${DS.accent}18`,
  },
  heroBall2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40, backgroundColor: `${DS.accent}10`,
  },
  heroBall1Sup: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60, backgroundColor: `${DS.accent}18`,
  },
  heroBall2Sup: {
    position: 'absolute', bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40, backgroundColor: `${DS.accent}10`,
  },
  heroEye:     { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  heroH:       { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  heroSub:     { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  heroChip:    {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: DS.accent, borderRadius: DS.radiusBadge,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  heroChipTxt: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  // AI Recommendation card
  recCard: {
    backgroundColor: DS.bgCard, borderRadius: DS.radiusCard,
    borderWidth: 1.5, borderColor: `${DS.accent}44`,
    padding: 18, gap: 10,
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 5,
  },
  recTopRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  crownWrap:   { width: 40, height: 40, borderRadius: 12, backgroundColor: DS.goldLight, alignItems: 'center', justifyContent: 'center' },
  crownIcon:   { fontSize: 20 },
  recEye:      { fontSize: 9, fontWeight: '800', color: DS.accentDark, letterSpacing: 2 },
  recName:     { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  vPill:       { borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  vTxt:        { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  platformPill: { backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  platformTxt:  { fontSize: 11, fontWeight: '700', color: DS.accentDark },

  // Confidence bar
  confWrap: { gap: 5 },
  confBg:   { height: 6, backgroundColor: DS.bgElevated, borderRadius: 3, overflow: 'hidden' },
  confFill: { height: 6, backgroundColor: DS.accent, borderRadius: 3 },
  confTxt:  { fontSize: 11, fontWeight: '600', color: DS.textMuted },

  // Reasons
  reason:    { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  reasonDot: { fontSize: 10, color: DS.accent, marginTop: 3 },
  reasonTxt: { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  // Save winner CTA
  saveWinBtn: {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 11, alignItems: 'center', marginTop: 4,
  },
  saveWinTxt: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  // Section eyebrow
  secEye: { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2, textTransform: 'uppercase' },

  // Column header cards
  colCard: {
    width: CMP_CELL_W + 16,
    backgroundColor: DS.bgSubtle, borderRadius: 14,
    borderWidth: 1, borderColor: DS.border, padding: 10, gap: 6,
  },
  colCardWin: {
    borderColor: DS.accent, borderWidth: 2, backgroundColor: DS.accentLight,
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  colImg:        { width: 44, height: 44, borderRadius: 8, backgroundColor: DS.bgElevated },
  colImgFallback:{ width: 44, height: 44, borderRadius: 8, backgroundColor: DS.bgElevated, alignItems: 'center', justifyContent: 'center' },
  colImgIcon:    { fontSize: 20, color: DS.textMuted },
  colTitle:      { fontSize: 11, fontWeight: '700', color: DS.textPrimary, lineHeight: 15 },
  colFooter:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  colBadge:      { borderRadius: DS.radiusBadge, paddingHorizontal: 7, paddingVertical: 3 },
  colBadgeTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  winTag:        { fontSize: 9, fontWeight: '900', color: DS.accentDark, letterSpacing: 0.5 },
  aiTag:         { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 0.5 },
  tapHint:       { fontSize: 10, fontWeight: '600', color: DS.textMuted },
  supCountry:    { fontSize: 22 },
  platformBadge:    { backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge, paddingHorizontal: 7, paddingVertical: 3 },
  platformBadgeTxt: { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 0.3 },

  // Metric table rows
  mRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  mRowAlt:  { backgroundColor: DS.bgSubtle },
  mLabel:   { paddingRight: 8, justifyContent: 'center' },
  mLabelTxt:{ fontSize: 11, fontWeight: '700', color: DS.textMuted },
  mCell:    { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mCellTxt: { fontSize: 12, fontWeight: '700' },
  trophy:   { fontSize: 10 },

  // Action bar
  actions:         { gap: 10, marginTop: 4 },
  actionPrimary:   {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 5,
  },
  actionPrimaryTxt:{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  actionGhost:     { backgroundColor: DS.bgSubtle, borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: DS.border },
  actionGhostTxt:  { fontSize: 14, fontWeight: '700', color: DS.textSecondary },
});
