import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, Clipboard, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, DS } from '../../components/ds';
import { useCurrency } from '../../context/CurrencyContext';
import { SupplierDisplay, OutreachEmail } from './types';
import { SmartBadgeStrip, am } from './SharedComponents';
import { prm, numHL, hlBg, hlTxt, scoreSupplierForCompare, buildSupplierReasons, CMP_LABEL_W, CMP_CELL_W, HL } from './ProductCards';
import { openURL } from './utils';

// ── Platform colors ───────────────────────────────────────────────────────────

export const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  'Alibaba':               { bg: '#FFF4E0', color: '#E8720C' },
  'AliExpress Wholesale':  { bg: '#FFF0ED', color: '#E62335' },
  'DHgate':                { bg: DS.infoBg,     color: DS.info   },
  'Made-in-China':         { bg: '#F0FDF4',     color: '#16A34A' },
  'Global Sources':        { bg: DS.indigoLight, color: DS.indigo },
  '1688 (Domestic China)': { bg: '#FFF7ED', color: '#D97706' },
  '1688':                  { bg: '#FFF7ED', color: '#D97706' },
};

// ── Supplier card ─────────────────────────────────────────────────────────────

interface SupplierCardProps {
  item:                  SupplierDisplay;
  inCompare:             boolean;
  analyzeLoading:        boolean;
  outreachLoading:       boolean;
  onView:                () => void;
  onAnalyze:             () => void;
  onToggleCompare:       () => void;
  onOutreach:            () => void;
  onAttachFeasibility?:  () => void;
  isFeasAttached?:       boolean;
}

export function SupplierCard({
  item, inCompare, analyzeLoading, outreachLoading,
  onView, onAnalyze, onToggleCompare, onOutreach, onAttachFeasibility, isFeasAttached,
}: SupplierCardProps) {
  const { fmt } = useCurrency();
  const hasLink      = !!item.url;
  const isGold       = item.badge === 'Gold Supplier';
  const priceDisplay = item.priceUSD != null ? `${fmt(item.priceUSD)}/unit` : item.price;
  const pStyle       = PLATFORM_COLORS[item.platform] ?? { bg: DS.bgSubtle, color: DS.textSecondary };

  return (
    <AppCard padding={14} radius={18} style={sc.card}>
      {/* Header */}
      <View style={sc.header}>
        <View style={sc.nameLine}>
          <Text style={sc.country}>{item.country}</Text>
          <View style={{ flex: 1 }}>
            <Text style={sc.name} numberOfLines={1}>{item.name}</Text>
            <View style={[sc.platBadge, { backgroundColor: pStyle.bg }]}>
              <Text style={[sc.platText, { color: pStyle.color }]}>{item.platform}</Text>
            </View>
          </View>
        </View>
        <View style={[sc.trustBadge, isGold ? sc.trustGold : sc.trustVerified]}>
          <Text style={[sc.trustText, isGold ? sc.trustTextGold : sc.trustTextVerified]}>
            {isGold ? '★ Gold' : '✓ Verified'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      {item.wideRange && (
        <View style={sc.rangeNote}>
          <Text style={sc.rangeNoteTxt}>⚠ Wide price range — using high estimate for safer calculations</Text>
        </View>
      )}
      <View style={sc.stats}>
        <View style={sc.stat}>
          <Text style={[sc.statVal, { color: DS.accent }]}>{priceDisplay}</Text>
          <Text style={sc.statLbl}>{item.wideRange ? 'Price (range)' : 'Unit Price'}</Text>
        </View>
        <View style={sc.div} />
        <View style={sc.stat}>
          <Text style={sc.statVal}>{item.moq}</Text>
          <Text style={sc.statLbl}>Min. Order</Text>
        </View>
        <View style={sc.div} />
        <View style={sc.stat}>
          <Text style={[sc.statVal, { color: DS.info }]}>{item.trust.toFixed(1)}</Text>
          <Text style={sc.statLbl}>Score (est.)</Text>
        </View>
      </View>

      <SmartBadgeStrip badges={item.badges} finalScore={item.finalScore} />

      {/* Primary action */}
      <TouchableOpacity
        style={[sc.viewBtn, !hasLink && sc.disabledBtn]}
        onPress={onView}
        activeOpacity={hasLink ? 0.8 : 1}
        disabled={!hasLink}
      >
        <Text style={[sc.viewTxt, !hasLink && sc.disabledTxt]}>
          {hasLink ? `↗  View on ${item.platform}` : 'Link unavailable'}
        </Text>
      </TouchableOpacity>

      {/* Secondary actions */}
      <View style={sc.actionsRow}>
        <TouchableOpacity
          style={[sc.actionBtn, sc.analyzeBtn, analyzeLoading && { opacity: 0.6 }]}
          onPress={onAnalyze}
          activeOpacity={0.8}
          disabled={analyzeLoading}
        >
          <Text style={sc.analyzeTxt}>{analyzeLoading ? '…' : '⊛  Analyze'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sc.actionBtn, inCompare ? sc.compareActive : sc.compareBtn]}
          onPress={onToggleCompare}
          activeOpacity={0.8}
        >
          <Text style={[sc.compareTxt, inCompare && sc.compareTxtActive]}>
            {inCompare ? '✓  Added' : '⊞  Compare'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sc.actionBtn, sc.outreachBtn, outreachLoading && { opacity: 0.6 }]}
          onPress={onOutreach}
          activeOpacity={0.8}
          disabled={outreachLoading}
        >
          <Text style={sc.outreachTxt}>{outreachLoading ? '…' : '✉  Email'}</Text>
        </TouchableOpacity>
      </View>

      {onAttachFeasibility && (
        <TouchableOpacity
          style={[sc.feasBtn, isFeasAttached && sc.feasBtnSaved]}
          onPress={onAttachFeasibility}
          activeOpacity={0.8}
        >
          <Text style={[sc.feasTxt, isFeasAttached && sc.feasTxtSaved]}>
            {isFeasAttached ? '✕  Remove' : '→  Run Feasibility Check'}
          </Text>
        </TouchableOpacity>
      )}
    </AppCard>
  );
}
const sc = StyleSheet.create({
  card:             { gap: 12 },
  rangeNote:        { backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FDE68A' },
  rangeNoteTxt:     { fontSize: 11, color: '#92400E', lineHeight: 16 },
  header:           { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  nameLine:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 },
  country:          { fontSize: 22, marginTop: 2 },
  name:             { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 18 },
  platBadge:        { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3 },
  platText:         { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  trustBadge:       { borderRadius: DS.radiusBadge, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  trustGold:        { backgroundColor: DS.goldLight },
  trustVerified:    { backgroundColor: DS.accentLight },
  trustText:        { fontSize: 11, fontWeight: '800' },
  trustTextGold:    { color: DS.gold },
  trustTextVerified:{ color: DS.accentDark },
  stats:            { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 11 },
  stat:             { flex: 1, alignItems: 'center', gap: 3 },
  statVal:          { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  statLbl:          { fontSize: 8, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  div:              { width: 1, height: 26, backgroundColor: DS.border },
  viewBtn:          { backgroundColor: DS.info, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  disabledBtn:      { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  viewTxt:          { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  disabledTxt:      { color: DS.textMuted },
  actionsRow:       { flexDirection: 'row', gap: 7 },
  actionBtn:        { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  analyzeBtn:       { backgroundColor: DS.indigoLight },
  analyzeTxt:       { fontSize: 11, fontWeight: '700', color: DS.indigo },
  compareBtn:       { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  compareActive:    { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  compareTxt:       { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  compareTxtActive: { color: DS.accent },
  outreachBtn:      { backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigoLight },
  outreachTxt:      { fontSize: 11, fontWeight: '700', color: DS.indigo },
  feasBtn:          { borderRadius: 10, paddingVertical: 7, alignItems: 'center' as const, backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigo + '44' },
  feasBtnSaved:     { backgroundColor: DS.bgSubtle, borderColor: DS.border },
  feasTxt:          { fontSize: 11, fontWeight: '700' as const, color: DS.indigo },
  feasTxtSaved:     { color: DS.textMuted },
});

// ── Premium Compare suppliers modal ──────────────────────────────────────────

export function CompareSuppliersModal({
  visible, items, onClose,
}: {
  visible: boolean;
  items:   SupplierDisplay[];
  onClose: () => void;
}) {
  const { fmt } = useCurrency();
  const scores  = items.length > 0 ? items.map(scoreSupplierForCompare) : [];
  const maxIdx  = scores.length > 0 ? scores.indexOf(Math.max(...scores)) : 0;
  const [selectedIdx, setSelectedIdx] = useState(maxIdx);
  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1));

  if (items.length === 0) return null;

  const winner  = items[safeIdx];
  const second  = [...scores].sort((a, b) => b - a)[1] ?? 0;
  const rawConf = scores[safeIdx] > 0 ? ((scores[safeIdx] - second) / scores[safeIdx]) * 100 : 50;
  const conf    = Math.round(Math.min(96, Math.max(54, 65 + rawConf * 0.3)));
  const reasons = buildSupplierReasons(winner, items);

  const priceHL = numHL(items.map(s => s.priceUSD), false);
  const moqHL   = numHL(items.map(s => s.moqNum), false);
  const trustHL = numHL(items.map(s => s.trust), true);

  const tableW = CMP_LABEL_W + CMP_CELL_W * items.length;

  const rows: { label: string; vals: string[]; hls: HL[] }[] = [
    { label: 'Unit Price',  vals: items.map(s => s.priceUSD != null ? `${fmt(s.priceUSD)}/unit` : s.price), hls: priceHL },
    { label: 'Min. Order',  vals: items.map(s => s.moq),                                                    hls: moqHL   },
    { label: 'Score (est.)', vals: items.map(s => `${s.trust.toFixed(1)}/10`),                              hls: trustHL },
    { label: 'Platform',    vals: items.map(s => s.platform),    hls: items.map(() => 'neutral' as HL) },
    { label: 'Country',     vals: items.map(s => s.country),     hls: items.map(() => 'neutral' as HL) },
    { label: 'Badge',       vals: items.map(s => s.badge),       hls: items.map(() => 'neutral' as HL) },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Supplier Comparison</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={prm.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={[prm.hero, prm.heroSupplier]}>
            <View style={prm.heroBall1Sup} />
            <View style={prm.heroBall2Sup} />
            <Text style={[prm.heroEye, { color: DS.accentDark }]}>AI COMPARISON ENGINE</Text>
            <Text style={prm.heroH}>Supplier Comparison</Text>
            <Text style={prm.heroSub}>Side-by-side analysis of your sourcing options</Text>
            <View style={[prm.heroChip, { backgroundColor: DS.accent }]}>
              <Text style={prm.heroChipTxt}>{items.length} Suppliers Selected</Text>
            </View>
          </View>

          {/* ── AI Recommendation ─────────────────────────────────── */}
          <View style={prm.recCard}>
            <View style={prm.recTopRow}>
              <View style={prm.crownWrap}>
                <Text style={prm.crownIcon}>{safeIdx === maxIdx ? '🏆' : '✦'}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={prm.recEye}>{safeIdx === maxIdx ? 'BEST SUPPLIER' : 'YOUR SELECTION'}</Text>
                <Text style={prm.recName} numberOfLines={2}>{winner.name}</Text>
              </View>
              <View style={prm.platformPill}>
                <Text style={prm.platformTxt}>{winner.platform}</Text>
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
          </View>

          {/* ── Column headers ────────────────────────────────────── */}
          <AppCard padding={14} radius={18}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={prm.secEye}>SUPPLIERS COMPARED</Text>
              <Text style={prm.tapHint}>Tap to select</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {items.map((s, i) => {
                  const isSel  = i === safeIdx;
                  const isAuto = i === maxIdx;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[prm.colCard, isSel && prm.colCardWin, { width: CMP_CELL_W + 20 }]}
                      onPress={() => setSelectedIdx(i)}
                      activeOpacity={0.75}
                    >
                      <Text style={prm.supCountry}>{s.country}</Text>
                      <Text style={prm.colTitle} numberOfLines={2}>{s.name}</Text>
                      <View style={prm.colFooter}>
                        <View style={prm.platformBadge}>
                          <Text style={prm.platformBadgeTxt}>{s.platform}</Text>
                        </View>
                        {isSel  && isAuto && <Text style={prm.winTag}>WINNER</Text>}
                        {isSel  && !isAuto && <Text style={prm.aiTag}>SELECTED</Text>}
                        {!isSel && isAuto  && <Text style={prm.aiTag}>AI PICK</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </AppCard>

          {/* ── Sourcing metrics ──────────────────────────────────── */}
          <AppCard padding={14} radius={18} style={{ gap: 0 }}>
            <Text style={prm.secEye}>SOURCING METRICS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ width: tableW }}>
                {rows.map((row, ri) => (
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

          {/* ── Action bar ────────────────────────────────────────── */}
          <View style={prm.actions}>
            <TouchableOpacity style={prm.actionGhost} onPress={onClose} activeOpacity={0.8}>
              <Text style={prm.actionGhostTxt}>Close Comparison</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Outreach email card ───────────────────────────────────────────────────────

export function OutreachEmailCard({ email }: { email: OutreachEmail }) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    const full = `Subject: ${email.subject}\n\n${email.body}`;
    Clipboard.setString(full);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppCard padding={16} radius={18} style={oe.card}>
      <View style={oe.header}>
        <Text style={oe.headerTxt}>✉  Outreach Script</Text>
        {email.supplierName && (
          <Text style={oe.supplierName}>{email.supplierName}</Text>
        )}
      </View>
      <Text style={oe.hint}>Use this as your message when contacting the supplier on their platform.</Text>
      <View style={oe.subjectRow}>
        <Text style={oe.label}>Subject</Text>
        <Text style={oe.subject}>{email.subject}</Text>
      </View>
      <View style={oe.bodyBox}><Text style={oe.body}>{email.body}</Text></View>
      {email.tips.length > 0 && (
        <View style={oe.tips}>
          <Text style={oe.tipsTitle}>Tips</Text>
          {email.tips.map((t, i) => <Text key={i} style={oe.tip}>· {t}</Text>)}
        </View>
      )}
      <View style={oe.btnRow}>
        <TouchableOpacity style={oe.copyBtn} onPress={handleCopy} activeOpacity={0.8}>
          <Text style={oe.copyTxt}>{copied ? '✓  Copied!' : '⎘  Copy Message'}</Text>
        </TouchableOpacity>
        {email.supplierUrl && (
          <TouchableOpacity
            style={oe.messageBtn}
            onPress={() => Linking.openURL(email.supplierUrl!)}
            activeOpacity={0.8}
          >
            <Text style={oe.messageTxt}>Message Supplier  →</Text>
          </TouchableOpacity>
        )}
      </View>
    </AppCard>
  );
}
const oe = StyleSheet.create({
  card:         { gap: 14 },
  header:       { backgroundColor: DS.indigoLight, borderRadius: 10, padding: 10, gap: 2 },
  headerTxt:    { fontSize: 12, fontWeight: '800', color: DS.indigo, letterSpacing: 0.2 },
  supplierName: { fontSize: 11, color: DS.indigo + 'aa', fontWeight: '600' },
  hint:         { fontSize: 12, color: DS.textMuted, lineHeight: 17 },
  subjectRow:   { gap: 4 },
  label:        { fontSize: 9, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  subject:      { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2 },
  bodyBox:      { backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 12 },
  body:         { fontSize: 12, color: DS.textSecondary, lineHeight: 19 },
  tips:         { gap: 5 },
  tipsTitle:    { fontSize: 10, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tip:          { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  btnRow:       { flexDirection: 'row', gap: 10 },
  copyBtn:      { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle },
  copyTxt:      { fontSize: 13, fontWeight: '700', color: DS.textSecondary },
  messageBtn:   { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: DS.indigo },
  messageTxt:   { fontSize: 13, fontWeight: '700', color: '#fff' },
});
