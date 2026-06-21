import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, StyleSheet, TouchableOpacity, Linking,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppCard, DS } from '../../components/ds';
import { useCurrency } from '../../context/CurrencyContext';
import { SupplierDisplay, OutreachEmail } from './types';
import { SmartBadgeStrip, am } from './SharedComponents';
import { prm, numHL, hlBg, hlTxt, scoreSupplierForCompare, buildSupplierReasons, CMP_LABEL_W, CMP_CELL_W, HL } from './ProductCards';
import { openURL } from './utils';
import { roughLandedCost, roughROIPct, roiColor } from '../../lib/financialEngine';

// ── Grade colors ──────────────────────────────────────────────────────────────

export const GRADE_COLOR: Record<string, string> = {
  A: DS.success,
  B: DS.info,
  C: DS.warning,
  D: DS.danger,
  F: DS.danger,
};

// ── Platform colors ───────────────────────────────────────────────────────────

export const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  'Alibaba':               { bg: '#FFF4E0', color: '#E8720C' },
  'AliExpress Wholesale':  { bg: '#FFF0ED', color: '#E62335' },
  'DHgate':                { bg: DS.infoBg,     color: DS.info   },
  'Made-in-China':         { bg: DS.successBg,  color: DS.successText },
  'Global Sources':        { bg: DS.accentLight, color: DS.accent },
  '1688 (Domestic China)': { bg: '#FFF7ED', color: DS.warningText },
  '1688':                  { bg: '#FFF7ED', color: DS.warningText },
};

// ── Supplier card ─────────────────────────────────────────────────────────────

interface SupplierCardProps {
  item:                  SupplierDisplay;
  inCompare:             boolean;
  analyzeLoading:        boolean;
  outreachLoading:       boolean;
  isEmailOpen:           boolean;
  onView:                () => void;
  onAnalyze:             () => void;
  onToggleCompare:       () => void;
  onOutreach:            () => void;
  onAttachFeasibility?:  () => void;
  isFeasAttached?:       boolean;
  onSelect?:             () => void;
  isSelected?:           boolean;
  grade?:                string;
  sellingPrice?:         number;
}

export function SupplierCard({
  item, inCompare, analyzeLoading, outreachLoading, isEmailOpen,
  onView, onAnalyze, onToggleCompare, onOutreach, onAttachFeasibility, isFeasAttached,
  onSelect, isSelected, grade, sellingPrice,
}: SupplierCardProps) {
  const { fmt } = useCurrency();
  const hasLink    = !!item.url;
  const isGold     = item.badge === 'Gold Supplier';
  const unitCost   = item.priceUSD;
  const landed     = unitCost != null && unitCost > 0 ? roughLandedCost(unitCost) : null;
  const roi        = unitCost != null && unitCost > 0 && sellingPrice != null && sellingPrice > 0
    ? roughROIPct(sellingPrice, unitCost) : null;
  const investment = unitCost != null && unitCost > 0 ? unitCost * item.moqNum : null;
  const isHighMoq  = item.moqNum >= 300;

  return (
    <AppCard padding={14} radius={18} style={[sc.card, isSelected && sc.cardSelected]}>

      {/* Header: name + grade badge */}
      <View style={sc.header}>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={sc.name} numberOfLines={2}>{item.name}</Text>
          <View style={sc.trustRow}>
            <Text style={[sc.trustIcon, isGold && { color: DS.warningText }]}>{isGold ? '★' : '✓'}</Text>
            <Text style={sc.trustTxt}>{isGold ? 'Gold Supplier' : 'Verified'}</Text>
            {item.country ? <Text style={sc.trustDot}>·</Text> : null}
            {item.country ? <Text style={sc.trustTxt}>{item.country}</Text> : null}
          </View>
        </View>
        {grade && (
          <View style={[sc.gradeBadge, { backgroundColor: (GRADE_COLOR[grade] ?? DS.textMuted) + '18' }]}>
            <Text style={[sc.gradeTxt, { color: GRADE_COLOR[grade] ?? DS.textMuted }]}>Grade {grade}</Text>
          </View>
        )}
      </View>

      {/* Wide price range warning */}
      {item.wideRange && (
        <View style={sc.rangeNote}>
          <Text style={sc.rangeNoteTxt}>⚠ Wide price range — using high estimate for safer calculations</Text>
        </View>
      )}

      {/* 4-cell metrics grid */}
      <View style={sc.metricsGrid}>
        <View style={sc.metricCell}>
          <Text style={[sc.metricVal, { color: DS.accent }]}>
            {unitCost != null ? fmt(unitCost) : item.price}
          </Text>
          <Text style={sc.metricLbl}>Unit Cost</Text>
        </View>
        <View style={sc.metricCell}>
          <Text style={[sc.metricVal, isHighMoq && { color: DS.warning }]}>
            {item.moq}
          </Text>
          <Text style={sc.metricLbl}>MOQ</Text>
        </View>
        {landed != null && (
          <View style={sc.metricCell}>
            <Text style={sc.metricVal}>{fmt(landed)}</Text>
            <Text style={sc.metricLbl}>~Landed</Text>
          </View>
        )}
        {roi != null && (
          <View style={sc.metricCell}>
            <Text style={[sc.metricVal, { color: roiColor(roi) }]}>
              {Math.max(0, roi).toFixed(0)}%
            </Text>
            <Text style={sc.metricLbl}>~ROI</Text>
          </View>
        )}
      </View>

      {/* Investment / MOQ note */}
      {investment != null && investment > 0 && !isHighMoq && (
        <View style={sc.investNote}>
          <Text style={sc.investIcon}>$</Text>
          <Text style={sc.investTxt}>
            Requires ~{fmt(investment, 0)} initial inventory investment.
          </Text>
        </View>
      )}
      {isHighMoq && investment != null && (
        <View style={sc.moqWarn}>
          <Text style={sc.moqWarnIcon}>⚠</Text>
          <Text style={sc.moqWarnTxt}>
            High MOQ.{roi != null ? ' Better ROI but requires' : ' Requires'} ~{fmt(investment, 0)} investment.
          </Text>
        </View>
      )}

      {/* View on platform — mirrors "View on Amazon" in Research */}
      <TouchableOpacity
        style={[sc.platformBtn, !hasLink && sc.platformBtnDisabled]}
        onPress={onView}
        activeOpacity={hasLink ? 0.8 : 1}
        disabled={!hasLink}
      >
        <Text style={[sc.platformBtnTxt, !hasLink && sc.platformBtnTxtDisabled]}>
          {hasLink ? `↗  View on ${item.platform}` : 'Link unavailable'}
        </Text>
      </TouchableOpacity>

      {/* Actions row — mirrors Research pill buttons */}
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
          style={[sc.actionBtn, isEmailOpen ? sc.emailBtnActive : sc.emailBtn, outreachLoading && { opacity: 0.6 }]}
          onPress={onOutreach}
          activeOpacity={0.8}
          disabled={outreachLoading}
        >
          <Text style={[sc.emailTxt, isEmailOpen && sc.emailTxtActive]}>
            {outreachLoading ? '…' : isEmailOpen ? '✕  Email' : '✉  Email'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Lock In — primary CTA, mirrors "Find Suppliers →" in Research */}
      {onSelect && (
        <TouchableOpacity
          style={[sc.lockInBtn, isSelected && sc.lockInBtnSelected]}
          onPress={onSelect}
          activeOpacity={0.85}
        >
          <Text style={[sc.lockInTxt, isSelected && sc.lockInTxtSelected]}>
            {isSelected ? '✓  Supplier Selected' : 'Lock In This Supplier'}
          </Text>
        </TouchableOpacity>
      )}

    </AppCard>
  );
}
const sc = StyleSheet.create({
  card:             { gap: 12 },
  cardSelected:     { borderWidth: 1.5, borderColor: DS.success },
  rangeNote:        { backgroundColor: DS.warningBg, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: DS.warning + '50' },
  rangeNoteTxt:     { fontSize: 11, color: DS.warningText, lineHeight: 16 },
  header:           { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  name:             { fontSize: 14, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.3, lineHeight: 19 },
  trustRow:         { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' as const },
  trustIcon:        { fontSize: 11, color: DS.success, fontWeight: '700' as const },
  trustTxt:         { fontSize: 11, color: DS.textMuted, fontWeight: '600' as const },
  trustDot:         { fontSize: 11, color: DS.border },
  gradeBadge:       { borderRadius: DS.radiusBadge, paddingHorizontal: 9, paddingVertical: 4 },
  gradeTxt:         { fontSize: 11, fontWeight: '800' as const },
  metricsGrid:      { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 10 },
  metricCell:       { flex: 1, alignItems: 'center' as const, gap: 3 },
  metricVal:        { fontSize: 13, fontWeight: '800' as const, color: DS.textPrimary, letterSpacing: -0.3 },
  metricLbl:        { fontSize: 8, fontWeight: '600' as const, color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  investNote:       { flexDirection: 'row', alignItems: 'flex-start' as const, gap: 6, backgroundColor: DS.success + '12', borderRadius: 8, padding: 9, borderWidth: 1, borderColor: DS.success + '30' },
  investIcon:       { fontSize: 13, color: DS.success, fontWeight: '800' as const, marginTop: 1 },
  investTxt:        { flex: 1, fontSize: 11, color: DS.success, fontWeight: '600' as const, lineHeight: 16 },
  moqWarn:          { flexDirection: 'row', alignItems: 'flex-start' as const, gap: 6, backgroundColor: DS.warningBg, borderRadius: 8, padding: 9, borderWidth: 1, borderColor: DS.warning + '50' },
  moqWarnIcon:      { fontSize: 13, color: DS.warningText, fontWeight: '800' as const, marginTop: 1 },
  moqWarnTxt:       { flex: 1, fontSize: 11, color: DS.warningText, fontWeight: '600' as const, lineHeight: 16 },
  // Platform link button — mirrors "View on Amazon" in Research
  platformBtn:        { backgroundColor: DS.bgSubtle, borderRadius: 12, paddingVertical: 10, alignItems: 'center' as const, borderWidth: 1, borderColor: DS.border },
  platformBtnDisabled:{ opacity: 0.5 },
  platformBtnTxt:     { fontSize: 13, fontWeight: '700' as const, color: DS.textSecondary, letterSpacing: -0.2 },
  platformBtnTxtDisabled: { color: DS.textMuted },
  // Action pills — mirrors Research card pill buttons
  actionsRow:       { flexDirection: 'row', gap: 6 },
  actionBtn:        { flex: 1, borderRadius: DS.radiusButton, paddingVertical: 11, alignItems: 'center' as const },
  analyzeBtn:       { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent + '44' },
  analyzeTxt:       { fontSize: 12, fontWeight: '700' as const, color: DS.accent },
  compareBtn:       { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  compareActive:    { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  compareTxt:       { fontSize: 12, fontWeight: '700' as const, color: DS.textSecondary },
  compareTxtActive: { color: DS.accent },
  emailBtn:         { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  emailBtnActive:   { backgroundColor: DS.dangerBg ?? DS.bgSubtle, borderWidth: 1, borderColor: DS.danger + '44' },
  emailTxt:         { fontSize: 12, fontWeight: '700' as const, color: DS.textSecondary },
  emailTxtActive:   { color: DS.dangerText },
  // Lock In CTA — mirrors "Find Suppliers →" in Research
  lockInBtn:        { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center' as const },
  lockInBtnSelected:{ backgroundColor: DS.success },
  lockInTxt:        { fontSize: 13, fontWeight: '800' as const, color: '#fff', letterSpacing: -0.2 },
  lockInTxtSelected:{ color: '#fff' },
  feasBtn:          { borderRadius: 10, paddingVertical: 7, alignItems: 'center' as const, backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent + '44' },
  feasBtnSaved:     { backgroundColor: DS.bgSubtle, borderColor: DS.border },
  feasTxt:          { fontSize: 11, fontWeight: '700' as const, color: DS.accent },
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

export function OutreachEmailCard({ email, onDismiss }: { email: OutreachEmail; onDismiss?: () => void }) {
  const [copied, setCopied] = React.useState(false);

  function handleCopy() {
    const full = `Subject: ${email.subject}\n\n${email.body}`;
    Clipboard.setStringAsync(full).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <AppCard padding={16} radius={18} style={oe.card}>
      <View style={oe.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={oe.headerTxt}>✉  Outreach Script</Text>
          {email.supplierName && (
            <Text style={oe.supplierName}>{email.supplierName}</Text>
          )}
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} activeOpacity={0.7}>
            <Text style={oe.dismissTxt}>✕</Text>
          </TouchableOpacity>
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
  header:       { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: DS.accentLight, borderRadius: 10, padding: 10, gap: 8 },
  headerTxt:    { fontSize: 12, fontWeight: '800', color: DS.accent, letterSpacing: 0.2 },
  supplierName: { fontSize: 11, color: DS.accent + 'aa', fontWeight: '600' },
  dismissTxt:   { fontSize: 16, color: DS.accent, fontWeight: '600', lineHeight: 20 },
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
  messageBtn:   { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: 'center', backgroundColor: DS.accent },
  messageTxt:   { fontSize: 13, fontWeight: '700', color: '#fff' },
});
