import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppCard,
  PrimaryButton,
  DS,
} from '../../components/ds';
import FeasibilityHeart from '../../components/FeasibilityHeart';
import VerdictFeedback from '../../components/VerdictFeedback';
import { useCurrency } from '../../context/CurrencyContext';
import { SmartSearchSummary } from '../../lib/smartSearch';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';
import {
  Mode,
  ProductDisplay,
  KeywordMetric,
  EnrichedKeyword,
  AnalyzeProductResult,
  AnalyzeSupplierResult,
  KeepaSignals,
} from './types';
import { buildKeywordCSV } from './productHelpers';

// ── Recent searches component ─────────────────────────────────────────────────

export function RecentSearches({
  items,
  accentColor,
  onSelect,
  onClear,
}: {
  items:       string[];
  accentColor: string;
  onSelect:    (q: string) => void;
  onClear:     () => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={recent.wrap}>
      <View style={recent.header}>
        <Text style={recent.heading}>Recent</Text>
        <TouchableOpacity onPress={onClear} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={recent.clear}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={recent.chips}>
        {items.map((q, i) => (
          <TouchableOpacity key={i} style={[recent.chip, { borderColor: accentColor + '33' }]} onPress={() => onSelect(q)} activeOpacity={0.75}>
            <Text style={[recent.icon, { color: accentColor }]}>↺</Text>
            <Text style={recent.text} numberOfLines={1}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const recent = StyleSheet.create({
  wrap:    { gap: 8 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  clear:   { fontSize: 11, fontWeight: '700', color: DS.textMuted },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: DS.bgCard, borderRadius: DS.radiusBadge,
    borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7,
  },
  icon:    { fontSize: 11 },
  text:    { fontSize: 12, fontWeight: '600', color: DS.textSecondary, maxWidth: 180 },
});

// ── Mode segmented control (3 tabs) ──────────────────────────────────────────

export const MODE_TABS: { id: Mode; label: string; color: string }[] = [
  { id: 'lookup',    label: 'Teardown',  color: DS.accent  },
  { id: 'market',   label: 'Products',  color: DS.info    },
  { id: 'suppliers', label: 'Suppliers', color: DS.accent  },
  { id: 'freight',   label: 'Shipping',  color: DS.warning },
];

export function ModeSegment({ value, onChange, exclude }: { value: Mode; onChange: (v: Mode) => void; exclude?: Mode[] }) {
  const tabs = exclude ? MODE_TABS.filter(t => !exclude.includes(t.id)) : MODE_TABS;
  return (
    <View style={seg.wrap}>
      {tabs.map(t => {
        const active = value === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[seg.tab, active && { backgroundColor: t.color, borderColor: t.color }]}
            onPress={() => onChange(t.id)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[seg.label, active && seg.labelActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap:        { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, alignItems: 'center',
    backgroundColor: DS.bgCard, borderRadius: 20, borderWidth: 1, borderColor: DS.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  label:       { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  labelActive: { color: '#fff' },
});

// ── Mode description strip ────────────────────────────────────────────────────

const MODE_DESC: Record<Mode, string> = {
  market:    'Find products: search any keyword to discover opportunities ranked by demand and competition.',
  lookup:    'Teardown a product: paste any product, ASIN, or Amazon URL — AI reads the reviews and surfaces every flaw you can fix to beat it.',
  suppliers: 'Find suppliers: matching factories on Alibaba, DHgate, and 1688. Pick a product in the Products tab first for better matches.',
  freight:   'Estimate shipping: costs from China to your FBA warehouse. Enter units, weight, and dimensions to compare air vs sea.',
};

export function ModeDescStrip({ mode }: { mode: Mode }) {
  const color = MODE_TABS.find(t => t.id === mode)!.color;
  return (
    <View style={[mds.wrap, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Text style={[mds.text, { color }]}>{MODE_DESC[mode]}</Text>
    </View>
  );
}
const mds = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  text: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
});

// ── Utility sub-components ────────────────────────────────────────────────────

export function InfoTip({ text }: { text: string }) {
  return (
    <View style={tip.wrap}>
      <Text style={tip.icon}>ℹ</Text>
      <Text style={tip.text}>{text}</Text>
    </View>
  );
}
const tip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  icon: { fontSize: 10, color: DS.accent },
  text: { fontSize: 10, fontWeight: '600', color: DS.accent },
});

export function StarRating({ rating }: { rating: number }) {
  const full = Math.min(5, Math.round(rating));
  return (
    <View style={star.row}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} style={[star.s, { color: i < full ? DS.warning : DS.border }]}>★</Text>
      ))}
      <Text style={star.num}>{rating.toFixed(1)}</Text>
    </View>
  );
}
const star = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  s:   { fontSize: 11, fontWeight: '700', color: DS.warning },
  num: { fontSize: 10, color: DS.textMuted, marginLeft: 3, fontWeight: '600' },
});

// ── Smart Search Summary Card ─────────────────────────────────────────────────

export function SmartSummaryCard({ summary }: { summary: SmartSearchSummary }) {
  const [expanded, setExpanded] = useState(false);
  const kwPreview = summary.expandedKeywords.slice(0, 3).join(', ');
  const kwExtra   = summary.expandedKeywords.length - 3;
  return (
    <AppCard padding={14} radius={18} style={ss.card}>
      <TouchableOpacity
        style={ss.row}
        onPress={() => setExpanded(p => !p)}
        activeOpacity={0.8}
      >
        <View style={ss.iconWrap}>
          <Text style={ss.icon}>⊛</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ss.headline}>
            Smart Search — {summary.expandedKeywords.length} keywords · {summary.totalScanned} scanned · {summary.finalCount} ranked
          </Text>
          {summary.duplicatesRemoved > 0 && (
            <Text style={ss.sub}>{summary.duplicatesRemoved} duplicates removed · {summary.topCategory}</Text>
          )}
        </View>
        <Text style={ss.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={ss.details}>
          <View style={ss.detailRow}>
            <Text style={ss.detailLabel}>Original query</Text>
            <Text style={ss.detailVal}>"{summary.originalQuery}"</Text>
          </View>
          <View style={ss.detailRow}>
            <Text style={ss.detailLabel}>Keywords used</Text>
            <Text style={ss.detailVal} numberOfLines={2}>
              {kwPreview}{kwExtra > 0 ? ` +${kwExtra} more` : ''}
            </Text>
          </View>
          <View style={ss.detailRow}>
            <Text style={ss.detailLabel}>Category</Text>
            <Text style={ss.detailVal}>{summary.topCategory}</Text>
          </View>
        </View>
      )}
    </AppCard>
  );
}
const ss = StyleSheet.create({
  card:        { gap: 0 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:    { width: 30, height: 30, borderRadius: 10, backgroundColor: DS.accentLight, alignItems: 'center', justifyContent: 'center' },
  icon:        { fontSize: 14, color: DS.accent },
  headline:    { fontSize: 12, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 17 },
  sub:         { fontSize: 10, color: DS.textMuted, marginTop: 2 },
  chevron:     { fontSize: 9, color: DS.textMuted },
  details:     { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: DS.borderLight, paddingTop: 12 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 },
  detailVal:   { fontSize: 11, fontWeight: '600', color: DS.textSecondary, textAlign: 'right', flex: 1 },
});

// ── Smart score badge strip ───────────────────────────────────────────────────

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  'Smart Pick':             { bg: DS.accentLight,   color: DS.accent    },
  'Low Competition':        { bg: DS.accentLight,   color: DS.accentDark },
  'High Demand':            { bg: DS.warningBg,     color: DS.warningText },
  'Quick Win':              { bg: DS.successBg,        color: DS.successText },
  'Well Rated':             { bg: DS.goldLight,     color: DS.gold      },
  'Low MOQ':                { bg: DS.accentLight,   color: DS.accentDark },
  'Great Price':            { bg: DS.accentLight,   color: DS.accentDark },
  'Verified':               { bg: DS.accentLight,   color: DS.accentDark    },
  'Private Label Friendly': { bg: DS.bgElevated,    color: DS.textSecondary },
};

export function SmartBadgeStrip({ badges, finalScore }: { badges?: string[]; finalScore?: number }) {
  if (!badges || badges.length === 0) return null;
  return (
    <View style={sbs.row}>
      {badges.slice(0, 3).map(b => {
        const style = BADGE_STYLE[b] ?? { bg: DS.bgSubtle, color: DS.textMuted };
        return (
          <View key={b} style={[sbs.badge, { backgroundColor: style.bg }]}>
            <Text style={[sbs.badgeTxt, { color: style.color }]}>{b}</Text>
          </View>
        );
      })}
      {finalScore != null && (
        <View style={sbs.scorePill}>
          <Text style={sbs.scoreTxt}>Score {finalScore}</Text>
        </View>
      )}
    </View>
  );
}
const sbs = StyleSheet.create({
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge:    { borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  scorePill:{ backgroundColor: DS.bgSubtle, borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: DS.border },
  scoreTxt: { fontSize: 9, fontWeight: '700', color: DS.textMuted },
});

// ── Ask AI Panel ──────────────────────────────────────────────────────────────

export function AskAIPanel({
  question, answer, loading, error, onChangeQuestion, onSubmit,
}: {
  question: string;
  answer: string;
  loading: boolean;
  error: string;
  onChangeQuestion: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <AppCard padding={16} radius={18} style={aai.card}>
      <Text style={aai.eyebrow}>ASK AI ADVISOR</Text>
      <Text style={aai.title}>Ask anything about this product or market</Text>
      <View style={aai.inputRow}>
        <TextInput
          style={aai.input}
          placeholder="e.g. Is this product worth launching in 2026?"
          placeholderTextColor={DS.textMuted}
          value={question}
          onChangeText={onChangeQuestion}
          returnKeyType="send"
          onSubmitEditing={onSubmit}
          multiline={false}
        />
        <TouchableOpacity
          style={[aai.sendBtn, (!question.trim() || loading) && aai.sendBtnDisabled]}
          onPress={onSubmit}
          disabled={!question.trim() || loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={aai.sendTxt}>↑</Text>}
        </TouchableOpacity>
      </View>
      {!!error && <Text style={aai.error}>{error}</Text>}
      {!!answer && (
        <View style={aai.answerBox}>
          <Text style={aai.answerTxt}>{answer}</Text>
        </View>
      )}
    </AppCard>
  );
}
const aai = StyleSheet.create({
  card:             { gap: 10 },
  eyebrow:          { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  title:            { fontSize: 14, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.3 },
  inputRow:         { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input:            { flex: 1, backgroundColor: DS.bgSubtle, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: DS.textPrimary, borderWidth: 1, borderColor: DS.border },
  sendBtn:          { backgroundColor: DS.accent, borderRadius: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:  { opacity: 0.4 },
  sendTxt:          { fontSize: 18, fontWeight: '700', color: '#fff' },
  error:            { fontSize: 12, color: DS.danger },
  answerBox:        { backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: DS.border },
  answerTxt:        { fontSize: 13, color: DS.textPrimary, lineHeight: 20 },
});

// ── Empty state ───────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={es.wrap}>
      <Text style={es.icon}>{icon}</Text>
      <Text style={es.title}>{title}</Text>
      <Text style={es.sub}>{sub}</Text>
    </View>
  );
}
const es = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: 36, gap: 8 },
  icon:  { fontSize: 38 },
  title: { fontSize: 15, fontWeight: '800', color: DS.textPrimary },
  sub:   { fontSize: 12, color: DS.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});

// ── Signals block (honesty gate — must appear above verdict, never below) ─────

function SignalsBlock({ signals }: { signals: KeepaSignals }) {
  type Item = { variant: 'warning' | 'neutral' | 'info'; text: string };
  const items: Item[] = [];

  const bsr   = signals.bsr;
  const price = signals.price;

  if (bsr) {
    if (bsr.spike_flag) {
      items.push({ variant: 'warning', text: '⚠ Possible one-time spike — demand may not be durable.' });
    }
    if (bsr.trend === 'declining') {
      items.push({ variant: 'warning', text: '⚠ Demand trending down over 90 days.' });
    } else if (bsr.trend === 'improving') {
      items.push({ variant: 'info',    text: 'Rank improving — demand has been building.' });
    } else if (bsr.trend === 'stable') {
      items.push({ variant: 'neutral', text: 'Rank stable — consistent demand signal.' });
    } else {
      items.push({ variant: 'neutral', text: 'Not enough BSR history to assess trend.' });
    }
  }

  if (price) {
    if (price.direction === 'falling') {
      const pctStr = price.pct_change_90d != null
        ? ` (${Math.abs(price.pct_change_90d).toFixed(1)}% over 90d)`
        : '';
      items.push({ variant: 'warning', text: `⚠ Prices falling${pctStr} — possible race to the bottom.` });
    } else if (price.direction === 'insufficient_data') {
      items.push({ variant: 'neutral', text: 'Not enough price history to assess trend.' });
    }
    if (price.floor_usd != null) {
      items.push({ variant: 'neutral', text: `90-day price floor: $${price.floor_usd.toFixed(2)}` });
    }
  }

  if (items.length === 0) return null;

  return (
    <View style={sig.wrap}>
      <Text style={sig.eyebrow}>MARKET SIGNALS</Text>
      {items.map((item, i) => {
        const isWarn = item.variant === 'warning';
        const isInfo = item.variant === 'info';
        const bg     = isWarn ? DS.warningBg  : isInfo ? DS.accentLight : DS.bgSubtle;
        const border = isWarn ? DS.warning    : isInfo ? DS.accent      : DS.border;
        const color  = isWarn ? DS.warningText : isInfo ? DS.accent     : DS.textSecondary;
        return (
          <View key={i} style={[sig.row, { backgroundColor: bg, borderColor: border }]}>
            <Text style={[sig.txt, { color }]}>{item.text}</Text>
          </View>
        );
      })}
    </View>
  );
}

const sig = StyleSheet.create({
  wrap:    { gap: 8 },
  eyebrow: { fontSize: 9, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 1.2 },
  row:     { borderRadius: DS.radiusChip, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  txt:     { fontSize: 13, fontWeight: '600', lineHeight: 19 },
});

// ── Analyze Product modal ─────────────────────────────────────────────────────

export function AnalyzeProductModal({
  visible, loading, result, error, onClose,
}: {
  visible: boolean;
  loading: boolean;
  result: AnalyzeProductResult | null;
  error: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Product Verdict</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={am.content} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={am.center}>
              <ActivityIndicator size="large" color={DS.accent} />
              <Text style={am.loadTxt}>Analyzing product...</Text>
            </View>
          )}
          {error !== '' && !loading && (
            <View style={am.errBox}><Text style={am.errTxt}>{error}</Text></View>
          )}
          {result && !loading && (() => {
            const verdictColor = result.verdict === 'LAUNCH' ? DS.success : result.verdict === 'TEST' ? DS.warning : DS.danger;
            const verdictIcon  = result.verdict === 'LAUNCH' ? '✓' : result.verdict === 'TEST' ? '◉' : '✕';
            return (
              <>
                {/* Signals — always above verdict so risk can't be missed */}
                {result.signals && <SignalsBlock signals={result.signals} />}

                {/* Go / No-Go verdict card */}
                <View style={[am.verdictCard, { borderColor: verdictColor + '50', backgroundColor: verdictColor + '08' }]}>
                  <View style={am.verdictTop}>
                    <View style={[am.verdictBadge, { backgroundColor: verdictColor }]}>
                      <Text style={am.verdictIcon}>{verdictIcon}</Text>
                      <Text style={am.verdictWord}>{result.verdict}</Text>
                    </View>
                    <View style={{ flex: 1, gap: 6 }}>
                      <Text style={am.confidenceLabel}>{result.confidence}% confidence</Text>
                      <View style={am.confBar}>
                        <View style={[am.confFill, { width: `${result.confidence}%`, backgroundColor: verdictColor }]} />
                      </View>
                    </View>
                  </View>
                  <Text style={am.summaryTxt}>{result.summary}</Text>
                </View>

                {/* Reasons */}
                {result.reasons.length > 0 && (
                  <View style={am.section}>
                    <Text style={am.sectionTitle}>Why This Verdict</Text>
                    {result.reasons.map((r, i) => (
                      <View key={i} style={am.reasonRow}>
                        <Text style={[am.reasonIcon, { color: verdictColor }]}>{result.verdict === 'AVOID' ? '✕' : '✓'}</Text>
                        <Text style={am.bullet}>{r}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Risk */}
                {!!result.risk && (
                  <View style={[am.section, { borderColor: DS.warning + '40', backgroundColor: DS.warning + '08' }]}>
                    <Text style={am.sectionTitle}>Risk to Watch</Text>
                    <View style={am.reasonRow}>
                      <Text style={[am.reasonIcon, { color: DS.warning }]}>⚠</Text>
                      <Text style={[am.bullet, { color: DS.warning }]}>{result.risk}</Text>
                    </View>
                  </View>
                )}

                {/* Next step */}
                {!!result.next_step && (
                  <View style={[am.section, { borderColor: DS.accent + '30', backgroundColor: DS.accent + '06' }]}>
                    <Text style={am.sectionTitle}>Recommended Next Step</Text>
                    <Text style={[am.bullet, { color: DS.accent, fontWeight: '600' }]}>{result.next_step}</Text>
                  </View>
                )}

                {/* Reality-Check feedback — trust / utility / influence → analytics */}
                <VerdictFeedback verdict={result.verdict} confidence={result.confidence} />

                <View style={am.disclaimer}>
                  <Text style={am.disclaimerText}>Based on estimated market data. Always verify before ordering.</Text>
                </View>
              </>
            );
          })()}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export const am = StyleSheet.create({
  sheet:       { flex: 1, backgroundColor: DS.bgCanvas },
  toolbar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:       { fontSize: 17, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4 },
  closeBtn:    { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: DS.bgSubtle, borderRadius: 20 },
  closeTxt:    { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  content:     { paddingHorizontal: 20, paddingBottom: 60, gap: 16 },
  center:      { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadTxt:     { fontSize: 13, color: DS.textMuted, fontWeight: '600' },
  errBox:      { backgroundColor: DS.dangerBg, borderRadius: 14, padding: 16 },
  errTxt:      { fontSize: 13, color: DS.dangerText, textAlign: 'center' },
  section:     { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, padding: 16, gap: 10, borderWidth: 1, borderColor: DS.border },
  sectionTitle:{ fontSize: 10, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  bullet:      { fontSize: 13, color: DS.textSecondary, lineHeight: 20, flex: 1 },
  disclaimer:  { backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, padding: 10, borderWidth: 1, borderColor: DS.border },
  disclaimerText: { fontSize: 11, color: DS.textMuted },
  // Go/No-Go scorecard
  verdictCard: { borderRadius: DS.radiusCard, borderWidth: 1.5, padding: DS.cardPadding, gap: 12 },
  verdictTop:  { flexDirection: 'row', alignItems: 'center', gap: 14 },
  verdictBadge:{ borderRadius: DS.radiusButton, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', gap: 2, minWidth: 72 },
  verdictIcon: { fontSize: 20, color: '#fff', fontWeight: '900' },
  verdictWord: { fontSize: 11, color: '#fff', fontWeight: '900', letterSpacing: 1 },
  confidenceLabel: { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  confBar:     { height: 6, backgroundColor: DS.bgElevated, borderRadius: 3 },
  confFill:    { height: 6, borderRadius: 3 },
  summaryTxt:  { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  reasonRow:   { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonIcon:  { fontSize: 12, fontWeight: '800', marginTop: 3 },
});

// ── Analyze Supplier modal ────────────────────────────────────────────────────

export function AnalyzeSupplierModal({
  visible, loading, result, error, onClose,
}: {
  visible: boolean;
  loading: boolean;
  result: AnalyzeSupplierResult | null;
  error: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Supplier Analysis</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={am.content} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={am.center}>
              <ActivityIndicator size="large" color={DS.accent} />
              <Text style={am.loadTxt}>Scoring supplier...</Text>
            </View>
          )}
          {error !== '' && !loading && (
            <View style={am.errBox}><Text style={am.errTxt}>{error}</Text></View>
          )}
          {result && !loading && (
            <>
              <View style={supm.scoreBox}>
                <Text style={supm.score}>{result.total_score.toFixed(1)}/100</Text>
                <Text style={supm.grade}>{result.grade}</Text>
                <Text style={supm.conf}>{result.confidence_label}</Text>
              </View>
              {result.strengths.length > 0 && (
                <View style={am.section}>
                  <Text style={am.sectionTitle}>Strengths</Text>
                  {result.strengths.map((s, i) => <Text key={i} style={supm.green}>✓ {s}</Text>)}
                </View>
              )}
              {result.risk_flags.length > 0 && (
                <View style={am.section}>
                  <Text style={am.sectionTitle}>Risk Flags</Text>
                  {result.risk_flags.map((r, i) => <Text key={i} style={supm.red}>⚠ {r}</Text>)}
                </View>
              )}
              <View style={am.section}>
                <Text style={am.sectionTitle}>Recommendation</Text>
                <Text style={am.bullet}>{result.recommendation}</Text>
              </View>
              <View style={am.section}>
                <Text style={am.sectionTitle}>Negotiation Strategy</Text>
                <Text style={am.bullet}>Open with: {result.negotiation_strategy.opening_offer}</Text>
                <Text style={am.bullet}>Target price: {result.negotiation_strategy.target_price}</Text>
                <Text style={am.bullet}>MOQ ask: {result.negotiation_strategy.moq_ask}</Text>
                {result.negotiation_strategy.leverage_points.map((lp, i) => (
                  <Text key={i} style={am.bullet}>· {lp}</Text>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const supm = StyleSheet.create({
  scoreBox: { backgroundColor: DS.accentLight, borderRadius: 18, padding: 20, alignItems: 'center', gap: 4 },
  score:    { fontSize: 32, fontWeight: '900', color: DS.accent, letterSpacing: -1 },
  grade:    { fontSize: 18, fontWeight: '800', color: DS.textPrimary },
  conf:     { fontSize: 12, color: DS.textSecondary, fontWeight: '500' },
  green:    { fontSize: 13, color: DS.accentDark, lineHeight: 20 },
  red:      { fontSize: 13, color: DS.dangerText, lineHeight: 20 },
});

// ── Keyword metrics card ──────────────────────────────────────────────────────

export function KeywordMetricsCard({ keyword, metrics }: { keyword: string; metrics: KeywordMetric[] }) {
  return (
    <AppCard style={km.card}>
      <View style={km.header}>
        <Text style={km.title}>Keyword Analysis</Text>
        <InfoTip text={keyword || 'your search'} />
      </View>
      <View style={km.grid}>
        {metrics.map(m => (
          <View key={m.label} style={[km.tile, { backgroundColor: m.bg }]}>
            <Text style={[km.tileIcon, { color: m.color }]}>{m.icon}</Text>
            <Text style={[km.tileValue, { color: m.color }]}>{m.value}</Text>
            <Text style={km.tileLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}
const km = StyleSheet.create({
  card:       { gap: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:      { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile:       { width: '47%', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  tileIcon:   { fontSize: 20, fontWeight: '700' },
  tileValue:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  tileLabel:  { fontSize: 10, fontWeight: '600', color: DS.textSecondary, textAlign: 'center' },
});

// ── Market summary card (aggregates — ONLY shown in Market mode) ───────────────

export function MarketSummaryCard({
  products, keyword,
}: {
  products: ProductDisplay[];
  keyword: string;
}) {
  const { fmt } = useCurrency();
  const prices    = products.filter(p => p.price != null).map(p => p.price as number);
  const revUSD    = products.filter(p => p.revenueUSD != null).map(p => p.revenueUSD as number);
  const avgPrice  = prices.length  ? prices.reduce((a, b) => a + b, 0) / prices.length  : null;
  const avgRev    = revUSD.length   ? revUSD.reduce((a, b) => a + b, 0)  / revUSD.length  : null;
  const reviews   = products.map(p => p.reviewCount ?? 0);
  const avgReview = reviews.length  ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : null;
  const compCounts: Record<string, number> = {};
  products.forEach(p => { compCounts[p.competition] = (compCounts[p.competition] ?? 0) + 1; });
  const topComp = Object.entries(compCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return (
    <AppCard style={ms.card}>
      <View style={ms.header}>
        <Text style={ms.title}>Market Summary</Text>
        <InfoTip text={keyword || 'all results'} />
      </View>
      <Text style={ms.note}>Aggregated from {products.length} products · not product-specific</Text>
      <View style={ms.grid}>
        <View style={ms.tile}>
          <Text style={ms.val}>{avgPrice != null ? fmt(avgPrice) : '—'}</Text>
          <Text style={ms.lbl}>Avg Price</Text>
        </View>
        <View style={[ms.tile, { borderLeftWidth: 1, borderLeftColor: DS.border }]}>
          <Text style={ms.val}>{avgRev != null ? `${fmt(avgRev, 0)}/mo` : '—'}</Text>
          <Text style={ms.lbl}>Avg Revenue</Text>
        </View>
        <View style={[ms.tile, { borderLeftWidth: 1, borderLeftColor: DS.border }]}>
          <Text style={ms.val}>{avgReview != null ? avgReview.toLocaleString() : '—'}</Text>
          <Text style={ms.lbl}>Avg Reviews</Text>
        </View>
        <View style={[ms.tile, { borderLeftWidth: 1, borderLeftColor: DS.border }]}>
          <Text style={[ms.val, { color: topComp === 'Low' ? DS.accent : topComp === 'High' ? DS.danger : DS.warning }]}>{topComp}</Text>
          <Text style={ms.lbl}>Competition</Text>
        </View>
      </View>
    </AppCard>
  );
}
const ms = StyleSheet.create({
  card:   { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:  { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  note:   { fontSize: 10, color: DS.textMuted, fontStyle: 'italic' },
  grid:   { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 14, overflow: 'hidden' },
  tile:   { flex: 1, alignItems: 'center', padding: 12, gap: 3 },
  val:    { fontSize: 13, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  lbl:    { fontSize: 9, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
});

// ── SEO Keywords panel ────────────────────────────────────────────────────────

const KW_TYPE_STYLE: Record<EnrichedKeyword['keywordType'], { color: string; bg: string }> = {
  'Head Term':      { color: DS.info,   bg: DS.infoBg      },
  'Long-tail':      { color: DS.accent, bg: DS.accentLight },
  'Backend':        { color: DS.textMuted, bg: DS.bgSubtle },
  'PPC Candidate':  { color: DS.warning,  bg: DS.warningBg },
};

const HINT_COLOR: Record<EnrichedKeyword['usageHint'], string> = {
  'Title candidate':    DS.accent,
  'Bullet candidate':   DS.accent,
  'Backend keyword':    DS.textMuted,
  'PPC test candidate': DS.warning,
};

export function KeywordRow({
  kw, isSaved, onToggle,
}: {
  kw:       EnrichedKeyword;
  isSaved:  boolean;
  onToggle: () => void;
}) {
  const ts = KW_TYPE_STYLE[kw.keywordType];
  const scoreColor = kw.seoScore >= 7 ? DS.accent : kw.seoScore >= 5 ? DS.accent : DS.textMuted;
  return (
    <View style={kr.row}>
      <View style={kr.left}>
        <View style={kr.topLine}>
          <Text style={kr.phrase} numberOfLines={1}>{kw.phrase}</Text>
          <View style={[kr.typeBadge, { backgroundColor: ts.bg }]}>
            <Text style={[kr.typeText, { color: ts.color }]}>{kw.keywordType}</Text>
          </View>
        </View>
        <View style={kr.meta}>
          <Text style={[kr.hint, { color: HINT_COLOR[kw.usageHint] }]}>{kw.usageHint}</Text>
          <Text style={kr.dot}>·</Text>
          <Text style={[kr.score, { color: scoreColor }]}>{kw.seoScore}/10</Text>
          <Text style={kr.dot}>·</Text>
          <Text style={kr.vol}>{kw.searchVolume}</Text>
          <Text style={kr.dot}>·</Text>
          <Text style={[kr.trend, {
            color: kw.trend === 'Rising' ? DS.accent : kw.trend === 'Declining' ? DS.danger : DS.textMuted,
          }]}>
            {kw.trend === 'Rising' ? '↑ Rising' : kw.trend === 'Declining' ? '↓ Declining' : '→ Stable'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[kr.saveBtn, isSaved && kr.saveBtnActive]}
        activeOpacity={0.7}
      >
        <Text style={[kr.saveBtnTxt, isSaved && kr.saveBtnTxtActive]}>{isSaved ? '★' : '☆'}</Text>
      </TouchableOpacity>
    </View>
  );
}
const kr = StyleSheet.create({
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  left:           { flex: 1, gap: 3 },
  topLine:        { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  phrase:         { fontSize: 13, fontWeight: '700', color: DS.textPrimary, flexShrink: 1 },
  typeBadge:      { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeText:       { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  meta:           { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  hint:           { fontSize: 10, fontWeight: '600' },
  dot:            { fontSize: 10, color: DS.borderLight },
  score:          { fontSize: 10, fontWeight: '700' },
  vol:            { fontSize: 10, color: DS.textMuted },
  trend:          { fontSize: 10, fontWeight: '600' },
  saveBtn:        { width: 30, height: 30, borderRadius: 15, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  saveBtnActive:  { backgroundColor: DS.warningBg, borderColor: DS.warning },
  saveBtnTxt:     { fontSize: 13, color: DS.textMuted },
  saveBtnTxtActive: { color: DS.warning },
});

export function SEOKeywordsPanel({
  keywords,
  savedKWs,
  onSave,
  onUnsave,
  sourceQuery,
}: {
  keywords:    EnrichedKeyword[];
  savedKWs:    EnrichedKeyword[];
  onSave:      (kw: EnrichedKeyword) => void;
  onUnsave:    (phrase: string) => void;
  sourceQuery?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const savedSet = React.useMemo(
    () => new Set(savedKWs.map(k => k.phrase.toLowerCase())),
    [savedKWs],
  );

  const handleExport = async () => {
    const all = keywords.length > 0 ? keywords : savedKWs;
    if (all.length === 0) { Alert.alert('Nothing to export', 'Run a market search first.'); return; }
    setExporting(true);
    try {
      const csv  = buildKeywordCSV(all);
      const uri  = `${FileSystem.cacheDirectory ?? ''}siftly_keywords.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const ok   = await Sharing.isAvailableAsync();
      if (!ok) { Alert.alert('Sharing unavailable', 'Try on a real device.'); return; }
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        UTI:      'public.comma-separated-values-text',
        dialogTitle: 'Export SEO Keywords',
      });
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not export CSV.');
    } finally {
      setExporting(false);
    }
  };

  const savedOnly = savedKWs.filter(k => !keywords.some(kw => kw.phrase.toLowerCase() === k.phrase.toLowerCase()));

  return (
    <AppCard style={sk.card}>
      {/* Header */}
      <View style={sk.header}>
        <Text style={sk.title}>SEO Keywords</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={sk.exportBtn} activeOpacity={0.75}>
          <Text style={sk.exportTxt}>{exporting ? 'Exporting…' : '↑ Export CSV'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={sk.est}>Scores are estimated · tap ☆ to save · {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}</Text>
      {keywords.length > 0 && (
        <FeasibilityHeart
          type="keywords"
          label={`${sourceQuery ?? 'Keywords'} — ${keywords.length} keywords, top: ${keywords.slice(0, 3).map(k => k.phrase).join(', ')}`}
          data={{ keywords: keywords.map(k => ({ phrase: k.phrase, seoScore: k.seoScore, keywordType: k.keywordType })), total: keywords.length, sourceQuery }}
        />
      )}

      {/* Current result rows */}
      {keywords.length === 0 && savedKWs.length === 0 && (
        <Text style={sk.empty}>Search a keyword in Market mode to see SEO suggestions.</Text>
      )}
      {keywords.map(kw => (
        <KeywordRow
          key={kw.phrase}
          kw={kw}
          isSaved={savedSet.has(kw.phrase.toLowerCase())}
          onToggle={() =>
            savedSet.has(kw.phrase.toLowerCase()) ? onUnsave(kw.phrase) : onSave(kw)
          }
        />
      ))}

      {/* Saved-only rows (not in current results) */}
      {savedOnly.length > 0 && (
        <>
          <View style={sk.divider} />
          <Text style={sk.savedHead}>Saved ({savedKWs.length})</Text>
          {savedOnly.map(kw => (
            <KeywordRow key={kw.phrase} kw={kw} isSaved onToggle={() => onUnsave(kw.phrase)} />
          ))}
        </>
      )}
      {savedOnly.length === 0 && savedKWs.length > 0 && keywords.length > 0 && (
        <Text style={sk.savedNote}>{savedKWs.length} saved keyword{savedKWs.length !== 1 ? 's' : ''} visible above ★</Text>
      )}
    </AppCard>
  );
}
const sk = StyleSheet.create({
  card:      { gap: 4 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  title:     { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  exportBtn: { backgroundColor: DS.accentLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: DS.accent + '30' },
  exportTxt: { fontSize: 11, fontWeight: '700', color: DS.accent },
  est:       { fontSize: 10, color: DS.textMuted, fontStyle: 'italic', marginBottom: 4 },
  empty:     { fontSize: 13, color: DS.textMuted, textAlign: 'center', paddingVertical: 16 },
  divider:   { height: 1, backgroundColor: DS.border, marginVertical: 10 },
  savedHead: { fontSize: 11, fontWeight: '800', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  savedNote: { fontSize: 10, color: DS.textMuted, fontStyle: 'italic', textAlign: 'center', paddingTop: 4 },
});
