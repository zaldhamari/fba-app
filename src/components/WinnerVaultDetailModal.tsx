import React, { useState } from 'react';
import {
  View, Text, Modal, ScrollView, TouchableOpacity,
  StyleSheet, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { DS } from '../theme/ds';
import type { WinnerEntry } from '../types/builder';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt$(n: number | undefined) {
  if (n == null) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtPct(n: number | undefined) {
  if (n == null) return '—';
  return n.toFixed(1) + '%';
}
function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return iso; }
}

function marginColor(pct: number) {
  if (pct >= 35) return DS.success;
  if (pct >= 25) return DS.warning;
  return DS.danger;
}

// ─── Derived financials ───────────────────────────────────────────────────────

function deriveFinancials(e: WinnerEntry) {
  const netPerUnit      = e.sellingPrice * (e.marginPct / 100);
  const fbaFeeEst       = e.sellingPrice - e.unitCost - e.freightPerUnit - netPerUnit;
  const grossPerUnit    = e.sellingPrice - e.unitCost - e.freightPerUnit;
  const unitsPerMonth   = e.monthlyProfitEst > 0 && netPerUnit > 0
    ? Math.round(e.monthlyProfitEst / netPerUnit) : 0;
  return { netPerUnit, fbaFeeEst, grossPerUnit, unitsPerMonth };
}

// ─── PDF HTML builder ─────────────────────────────────────────────────────────

function buildPdfHtml(e: WinnerEntry): string {
  const { netPerUnit, fbaFeeEst, unitsPerMonth } = deriveFinancials(e);
  const mc = e.marginPct >= 35 ? DS.success : e.marginPct >= 25 ? DS.warning : DS.danger;
  const verdict = e.marginPct >= 35 ? 'STRONG LAUNCH' : e.marginPct >= 25 ? 'VIABLE' : 'REVIEW MARGINS';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: #F5F7FF; color: #0D1B4B; padding: 32px; }
  .page { max-width: 680px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(13,27,75,0.10); }

  /* Header */
  .header { background: #2563EB; padding: 28px 32px 24px; }
  .header-top { display: flex; justify-content: space-between; align-items: flex-start; }
  .brand-name { font-size: 28px; font-weight: 900; color: #fff; letter-spacing: -0.5px; }
  .app-tag { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.6); letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }
  .verdict-pill { background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.35); border-radius: 20px; padding: 5px 14px; display: inline-block; }
  .verdict-pill span { color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 0.5px; }
  .product-title { font-size: 16px; color: rgba(255,255,255,0.85); margin-top: 12px; line-height: 1.4; font-weight: 500; }
  .meta-row { display: flex; gap: 16px; margin-top: 10px; }
  .meta-item { font-size: 11px; color: rgba(255,255,255,0.65); font-weight: 500; }
  .meta-item span { color: rgba(255,255,255,0.90); font-weight: 700; }

  /* Hero metrics */
  .hero { display: flex; padding: 0; }
  .hero-stat { flex: 1; text-align: center; padding: 20px 12px; border-right: 1px solid #E6ECFF; }
  .hero-stat:last-child { border-right: none; }
  .hero-val { font-size: 28px; font-weight: 900; letter-spacing: -1px; }
  .hero-label { font-size: 10px; color: #8196B0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; }

  /* Section */
  .section { padding: 20px 28px; border-top: 1px solid #E6ECFF; }
  .section-title { font-size: 11px; font-weight: 800; color: #8196B0; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 14px; }

  /* P&L waterfall */
  .pl-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #F0F4FF; }
  .pl-row:last-child { border-bottom: none; }
  .pl-label { font-size: 13px; color: #5C6B8A; }
  .pl-val { font-size: 13px; font-weight: 700; }
  .pl-val.positive { color: #10B981; }
  .pl-val.negative { color: #EF4444; }
  .pl-val.neutral  { color: #0D1B4B; }
  .pl-divider { height: 1px; background: #E6ECFF; margin: 4px 0; }
  .pl-total { font-size: 14px; font-weight: 800; }

  /* Info grid */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .info-cell { background: #F5F7FF; border-radius: 10px; padding: 12px 14px; }
  .info-cell-label { font-size: 10px; color: #8196B0; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
  .info-cell-val { font-size: 15px; font-weight: 800; color: #0D1B4B; margin-top: 3px; }

  /* Progress bar */
  .bar-track { height: 6px; background: #E6ECFF; border-radius: 3px; overflow: hidden; margin-top: 6px; }
  .bar-fill { height: 6px; border-radius: 3px; }

  /* Footer */
  .footer { padding: 16px 28px; background: #F5F7FF; border-top: 1px solid #E6ECFF; display: flex; justify-content: space-between; align-items: center; }
  .footer-brand { font-size: 12px; font-weight: 800; color: #2563EB; }
  .footer-date { font-size: 11px; color: #8196B0; }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div>
        <div class="brand-name">${e.brandName}</div>
        <div class="app-tag">Siftly · Winner Vault</div>
      </div>
      <div class="verdict-pill" style="background:${mc}33; border-color:${mc}88;">
        <span style="color:${mc}">${verdict}</span>
      </div>
    </div>
    <div class="product-title">${e.productTitle}</div>
    <div class="meta-row">
      <div class="meta-item">Marketplace: <span>${e.marketplace}</span></div>
      <div class="meta-item">Completed: <span>${fmtDate(e.completedAt)}</span></div>
    </div>
  </div>

  <!-- Hero metrics -->
  <div class="hero">
    <div class="hero-stat">
      <div class="hero-val" style="color:${mc}">${fmtPct(e.marginPct)}</div>
      <div class="hero-label">Net Margin</div>
    </div>
    <div class="hero-stat">
      <div class="hero-val" style="color:#2563EB">${fmtPct(e.roiPct)}</div>
      <div class="hero-label">ROI</div>
    </div>
    <div class="hero-stat">
      <div class="hero-val" style="color:#10B981">${fmt$(e.monthlyProfitEst)}</div>
      <div class="hero-label">Monthly Profit</div>
    </div>
  </div>

  <!-- P&L Waterfall -->
  <div class="section">
    <div class="section-title">Unit Economics</div>
    <div class="pl-row">
      <span class="pl-label">Selling price</span>
      <span class="pl-val neutral">${fmt$(e.sellingPrice)}</span>
    </div>
    <div class="pl-row">
      <span class="pl-label">Unit cost (COGS)</span>
      <span class="pl-val negative">− ${fmt$(e.unitCost)}</span>
    </div>
    <div class="pl-row">
      <span class="pl-label">Freight per unit</span>
      <span class="pl-val negative">− ${fmt$(e.freightPerUnit)}</span>
    </div>
    <div class="pl-row">
      <span class="pl-label">FBA fees (est.)</span>
      <span class="pl-val negative">− ${fmt$(Math.max(0, fbaFeeEst))}</span>
    </div>
    <div style="height:1px;background:#E6ECFF;margin:8px 0;"></div>
    <div class="pl-row">
      <span class="pl-label pl-total">Net profit / unit</span>
      <span class="pl-val pl-total" style="color:${mc}">${fmt$(netPerUnit)}</span>
    </div>
    <div class="bar-track" style="margin-top:10px;">
      <div class="bar-fill" style="width:${Math.min(100, e.marginPct)}%; background:${mc};"></div>
    </div>
    <div style="font-size:11px;color:#8196B0;margin-top:5px;">${fmtPct(e.marginPct)} margin · ${unitsPerMonth > 0 ? '~' + unitsPerMonth + ' units/month' : ''}</div>
  </div>

  <!-- Supplier & Freight -->
  <div class="section">
    <div class="section-title">Supply Chain</div>
    <div class="info-grid">
      <div class="info-cell">
        <div class="info-cell-label">Supplier</div>
        <div class="info-cell-val">${e.supplierName || '—'}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell-label">Freight Mode</div>
        <div class="info-cell-val">${e.freightMode || '—'}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell-label">Freight / Unit</div>
        <div class="info-cell-val">${fmt$(e.freightPerUnit)}</div>
      </div>
      <div class="info-cell">
        <div class="info-cell-label">Est. Monthly Units</div>
        <div class="info-cell-val">${unitsPerMonth > 0 ? '~' + unitsPerMonth : '—'}</div>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="footer-brand">Siftly</div>
    <div class="footer-date">Generated ${fmtDate(new Date().toISOString())}</div>
  </div>

</div>
</body>
</html>`;
}

// ─── Stat Row helper ──────────────────────────────────────────────────────────

function StatRow({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
  return (
    <View style={d.statRow}>
      <Text style={d.statRowLabel}>{label}</Text>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[d.statRowVal, valueColor ? { color: valueColor } : undefined]}>{value}</Text>
        {sub ? <Text style={d.statRowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

function Divider() { return <View style={d.divider} />; }

function SectionHeader({ title }: { title: string }) {
  return <Text style={d.sectionHeader}>{title}</Text>;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface Props {
  entry: WinnerEntry | null;
  onClose: () => void;
}

export function WinnerVaultDetailModal({ entry, onClose }: Props) {
  const [exporting, setExporting] = useState(false);

  if (!entry) return null;

  const { netPerUnit, fbaFeeEst, unitsPerMonth } = deriveFinancials(entry);
  const mc = marginColor(entry.marginPct);
  const verdict = entry.marginPct >= 35 ? 'STRONG LAUNCH' : entry.marginPct >= 25 ? 'VIABLE' : 'REVIEW MARGINS';

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const html = buildPdfHtml(entry);
      const slug  = entry.brandName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const path  = `${FileSystem.cacheDirectory}siftly_${slug}_report.html`;
      await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/html',
          dialogTitle: `${entry.brandName} — Winner Report`,
          UTI: 'public.html',
        });
      } else {
        Alert.alert('Saved', 'Report saved. Tap "Print" in the share sheet to export as PDF.');
      }
    } catch (e: any) {
      Alert.alert('Export failed', e?.message ?? 'Could not generate report');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Modal visible={!!entry} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>

        {/* Header */}
        <View style={d.header}>
          <View style={{ flex: 1 }}>
            <Text style={d.headerEyebrow}>WINNER VAULT</Text>
            <Text style={d.headerBrand} numberOfLines={1}>{entry.brandName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={d.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={d.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={d.scroll} showsVerticalScrollIndicator={false}>

          {/* Hero card */}
          <View style={d.heroCard}>
            {/* Verdict pill + date */}
            <View style={d.heroTop}>
              <View style={[d.verdictPill, { backgroundColor: mc + '22', borderColor: mc + '66' }]}>
                <Text style={[d.verdictText, { color: mc }]}>{verdict}</Text>
              </View>
              <Text style={d.heroDate}>{fmtDate(entry.completedAt)}</Text>
            </View>

            <Text style={d.productTitle} numberOfLines={3}>{entry.productTitle}</Text>
            <Text style={d.marketplace}>{entry.marketplace} marketplace</Text>

            {/* 3-stat hero row */}
            <View style={d.heroStats}>
              <View style={d.heroStat}>
                <Text style={[d.heroStatVal, { color: mc }]}>{fmtPct(entry.marginPct)}</Text>
                <Text style={d.heroStatLabel}>Net Margin</Text>
                <View style={d.heroBarTrack}>
                  <View style={[d.heroBarFill, { width: `${Math.min(100, entry.marginPct)}%` as any, backgroundColor: mc }]} />
                </View>
              </View>
              <View style={d.heroStatDivider} />
              <View style={d.heroStat}>
                <Text style={[d.heroStatVal, { color: DS.accent }]}>{fmtPct(entry.roiPct)}</Text>
                <Text style={d.heroStatLabel}>ROI</Text>
                <View style={d.heroBarTrack}>
                  <View style={[d.heroBarFill, { width: `${Math.min(100, entry.roiPct / 2)}%` as any, backgroundColor: DS.accent }]} />
                </View>
              </View>
              <View style={d.heroStatDivider} />
              <View style={d.heroStat}>
                <Text style={[d.heroStatVal, { color: DS.success }]}>{fmt$(entry.monthlyProfitEst)}</Text>
                <Text style={d.heroStatLabel}>Monthly Profit</Text>
                <View style={d.heroBarTrack}>
                  <View style={[d.heroBarFill, { width: '85%', backgroundColor: DS.success }]} />
                </View>
              </View>
            </View>
          </View>

          {/* Unit Economics (P&L waterfall) */}
          <View style={d.card}>
            <SectionHeader title="Unit Economics" />

            <StatRow label="Selling price" value={fmt$(entry.sellingPrice)} valueColor={DS.textPrimary} />
            <Divider />
            <StatRow label="Unit cost (COGS)" value={`− ${fmt$(entry.unitCost)}`} valueColor={DS.danger} />
            <StatRow label="Freight per unit" value={`− ${fmt$(entry.freightPerUnit)}`} valueColor={DS.danger} />
            <StatRow label="FBA fees (est.)" value={`− ${fmt$(Math.max(0, fbaFeeEst))}`} valueColor={DS.danger} />
            <View style={d.totalDivider} />
            <StatRow
              label="Net profit / unit"
              value={fmt$(netPerUnit)}
              valueColor={mc}
              sub={`${fmtPct(entry.marginPct)} margin`}
            />

            {unitsPerMonth > 0 && (
              <View style={d.unitsBadge}>
                <Text style={d.unitsBadgeText}>≈ {unitsPerMonth} units/month to hit ${entry.monthlyProfitEst?.toLocaleString()} target</Text>
              </View>
            )}
          </View>

          {/* Supply Chain */}
          <View style={d.card}>
            <SectionHeader title="Supply Chain" />
            <View style={d.infoGrid}>
              <View style={d.infoCell}>
                <Text style={d.infoCellLabel}>Supplier</Text>
                <Text style={d.infoCellVal} numberOfLines={2}>{entry.supplierName || '—'}</Text>
              </View>
              <View style={d.infoCell}>
                <Text style={d.infoCellLabel}>Freight Mode</Text>
                <Text style={d.infoCellVal}>{entry.freightMode || '—'}</Text>
              </View>
              <View style={d.infoCell}>
                <Text style={d.infoCellLabel}>Freight / Unit</Text>
                <Text style={d.infoCellVal}>{fmt$(entry.freightPerUnit)}</Text>
              </View>
              <View style={d.infoCell}>
                <Text style={d.infoCellLabel}>Est. Monthly Units</Text>
                <Text style={d.infoCellVal}>{unitsPerMonth > 0 ? `~${unitsPerMonth}` : '—'}</Text>
              </View>
            </View>
          </View>

          {/* Session meta */}
          <View style={d.card}>
            <SectionHeader title="Session Info" />
            <StatRow label="Session ID" value={entry.sessionId.slice(0, 16) + '…'} />
            <Divider />
            <StatRow label="Completed" value={fmtDate(entry.completedAt)} />
          </View>

          {/* Export button */}
          <TouchableOpacity
            style={[d.exportBtn, exporting && d.exportBtnDisabled]}
            onPress={handleExportPdf}
            disabled={exporting}
            activeOpacity={0.85}
          >
            {exporting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={d.exportBtnText}>⬇  Export Report</Text>
            )}
          </TouchableOpacity>

          <View style={{ height: 16 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const d = StyleSheet.create({
  // Header bar
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: DS.border,
    backgroundColor: DS.bgCard,
  },
  headerEyebrow: { fontSize: 10, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  headerBrand:   { fontSize: 22, fontWeight: '900', color: DS.textPrimary, marginTop: 1 },
  closeBtn:      { width: 32, height: 32, borderRadius: 16, backgroundColor: DS.bgCanvas, alignItems: 'center', justifyContent: 'center' },
  closeTxt:      { fontSize: 14, color: DS.textMuted, fontWeight: '600' },

  scroll: { padding: 16, gap: 12, paddingBottom: 40 },

  // Hero card
  heroCard: {
    backgroundColor: DS.bgCard, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: DS.border, gap: 10,
  },
  heroTop:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verdictPill:    { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  verdictText:    { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  heroDate:       { fontSize: 11, color: DS.textMuted },
  productTitle:   { fontSize: 16, fontWeight: '700', color: DS.textPrimary, lineHeight: 22 },
  marketplace:    { fontSize: 12, color: DS.textMuted },
  heroStats:      { flexDirection: 'row', backgroundColor: DS.bgCanvas, borderRadius: 12, padding: 14, gap: 0 },
  heroStat:       { flex: 1, alignItems: 'center', gap: 3 },
  heroStatDivider:{ width: 1, backgroundColor: DS.border, marginHorizontal: 4 },
  heroStatVal:    { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  heroStatLabel:  { fontSize: 9, color: DS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  heroBarTrack:   { height: 3, width: '100%', backgroundColor: DS.border, borderRadius: 2, overflow: 'hidden', marginTop: 4 },
  heroBarFill:    { height: 3, borderRadius: 2 },

  // General card
  card: {
    backgroundColor: DS.bgCard, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: DS.border, gap: 0,
  },
  sectionHeader: {
    fontSize: 11, fontWeight: '800', color: DS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12,
  },

  // Stat rows
  statRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9 },
  statRowLabel: { fontSize: 13, color: DS.textSecondary, flex: 1 },
  statRowVal:   { fontSize: 14, fontWeight: '700', color: DS.textPrimary, textAlign: 'right' },
  statRowSub:   { fontSize: 10, color: DS.textMuted, textAlign: 'right', marginTop: 1 },
  divider:      { height: 1, backgroundColor: DS.border + '80' },
  totalDivider: { height: 1.5, backgroundColor: DS.border, marginVertical: 6 },

  // Units badge
  unitsBadge:     { backgroundColor: DS.accentLight, borderRadius: 8, padding: 10, marginTop: 8 },
  unitsBadgeText: { fontSize: 12, color: DS.accent, fontWeight: '600', textAlign: 'center' },

  // Info grid
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 0 },
  infoCell: { width: '48%', backgroundColor: DS.bgCanvas, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: DS.border },
  infoCellLabel: { fontSize: 10, color: DS.textMuted, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  infoCellVal:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary, marginTop: 3 },

  // Export button
  exportBtn: {
    backgroundColor: DS.accent, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
    ...Platform.select({
      ios:     { shadowColor: DS.accent, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText:     { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
});
