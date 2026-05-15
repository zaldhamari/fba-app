import React, { useState, useEffect } from 'react';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { AppCard, DS } from '../components/ds';
import { useFeasibilityTags } from '../hooks/useFeasibilityTags';
import { useVault } from '../hooks/useVault';
import { api } from '../services/api';
import type { FeasibilityTag } from '../types/feasibilityReport';

const TYPE_CONFIG: Record<FeasibilityTag['type'], { icon: string; label: string; color: string }> = {
  calculation: { icon: '◈', label: 'Profit Calc',  color: '#2563EB' },
  brand:       { icon: '✦', label: 'Brand Kit',    color: '#EC4899' },
  keywords:    { icon: '≋', label: 'SEO Keywords', color: '#7C3AED' },
  freight:     { icon: '🚢', label: 'Freight',      color: '#F59E0B' },
};

function verdictColor(v: string) {
  if (v === 'GO')      return '#059669';
  if (v === 'CAUTION') return '#D97706';
  return '#DC2626';
}
function verdictBg(v: string) {
  if (v === 'GO')      return '#ECFDF5';
  if (v === 'CAUTION') return '#FFFBEB';
  return '#FEF2F2';
}

// ── Product picker ────────────────────────────────────────────────────────────

function ProductPicker({
  products,
  onSelect,
}: {
  products: { asin: string; title: string; count: number }[];
  onSelect: (asin: string) => void;
}) {
  return (
    <View style={pp.wrap}>
      <Text style={pp.heading}>Select a product to generate its feasibility report</Text>
      <Text style={pp.sub}>Only products with tagged data appear here.</Text>
      {products.map(p => (
        <TouchableOpacity
          key={p.asin}
          style={pp.row}
          onPress={() => onSelect(p.asin)}
          activeOpacity={0.8}
        >
          <View style={{ flex: 1, gap: 3 }}>
            <Text style={pp.title} numberOfLines={2}>{p.title}</Text>
            <Text style={pp.asin}>{p.asin} · {p.count} item{p.count !== 1 ? 's' : ''} tagged</Text>
          </View>
          <View style={pp.arrow}>
            <Text style={pp.arrowText}>›</Text>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const pp = StyleSheet.create({
  wrap:      { gap: 12 },
  heading:   { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:       { fontSize: 12, color: DS.textSecondary, marginTop: -6 },
  row:       { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: DS.bgCard, borderRadius: 14, borderWidth: 1, borderColor: DS.border, padding: 14 },
  title:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary, lineHeight: 19 },
  asin:      { fontSize: 10, color: DS.textMuted },
  arrow:     { width: 30, height: 30, borderRadius: 8, backgroundColor: DS.indigoLight, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 18, color: DS.indigo, fontWeight: '300' },
});

// ── Tagged items summary ──────────────────────────────────────────────────────

function TaggedItemsSummary({ tags }: { tags: FeasibilityTag[] }) {
  return (
    <AppCard>
      <Text style={ts.heading}>Data included in this report</Text>
      <View style={ts.list}>
        {tags.map(tag => {
          const cfg = TYPE_CONFIG[tag.type];
          return (
            <View key={tag.id} style={ts.row}>
              <View style={[ts.iconWrap, { backgroundColor: cfg.color + '15' }]}>
                <Text style={{ fontSize: 14 }}>{cfg.icon}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[ts.typeLabel, { color: cfg.color }]}>{cfg.label}</Text>
                <Text style={ts.tagLabel} numberOfLines={1}>{tag.label}</Text>
              </View>
              <View style={[ts.dot, { backgroundColor: '#10B981' }]} />
            </View>
          );
        })}
        {(['calculation', 'brand', 'keywords', 'freight'] as const)
          .filter(t => !tags.some(tag => tag.type === t))
          .map(t => {
            const cfg = TYPE_CONFIG[t];
            return (
              <View key={t} style={[ts.row, { opacity: 0.4 }]}>
                <View style={[ts.iconWrap, { backgroundColor: DS.bgSubtle }]}>
                  <Text style={{ fontSize: 14 }}>{cfg.icon}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[ts.typeLabel, { color: DS.textMuted }]}>{cfg.label}</Text>
                  <Text style={ts.tagLabel}>Not tagged — report will note this gap</Text>
                </View>
                <View style={[ts.dot, { backgroundColor: DS.border }]} />
              </View>
            );
          })}
      </View>
    </AppCard>
  );
}

const ts = StyleSheet.create({
  heading:  { fontSize: 12, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, marginBottom: 10 },
  list:     { gap: 10 },
  row:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  typeLabel:{ fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  tagLabel: { fontSize: 12, color: DS.textSecondary, marginTop: 1 },
  dot:      { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
});

// ── Report view ───────────────────────────────────────────────────────────────

function ReportView({
  report,
  productTitle,
  onReset,
}: {
  report: {
    verdict: string; confidence: number; headline: string;
    sections: { title: string; body?: string; items?: string[] }[];
    data_completeness: string;
  };
  productTitle: string;
  onReset: () => void;
}) {
  const vc  = verdictColor(report.verdict);
  const vbg = verdictBg(report.verdict);

  const dataQuality = report.data_completeness === 'full'    ? { label: 'High',   color: '#059669' }
                    : report.data_completeness === 'partial'  ? { label: 'Medium', color: '#D97706' }
                    :                                           { label: 'Low',    color: '#DC2626' };

  return (
    <View style={{ gap: 12 }}>
      {/* Verdict hero */}
      <View style={[rv.hero, { backgroundColor: vbg, borderColor: vc + '40' }]}>
        <View style={rv.heroTop}>
          <View style={[rv.verdictBadge, { backgroundColor: vc }]}>
            <Text style={rv.verdictText}>{report.verdict}</Text>
          </View>
          <View style={rv.confidenceWrap}>
            <Text style={[rv.confidenceNum, { color: dataQuality.color }]}>{dataQuality.label}</Text>
            <Text style={rv.confidenceLabel}>DATA QUALITY</Text>
          </View>
        </View>
        <Text style={rv.headline}>{report.headline}</Text>
        <Text style={rv.productTitle} numberOfLines={1}>{productTitle}</Text>
        {report.data_completeness !== 'full' && (
          <View style={rv.completeness}>
            <Text style={rv.completenessText}>
              {report.data_completeness === 'partial'
                ? '⚡ Partial data — add more tags to improve accuracy'
                : '⚠ Limited data — report is an estimate only'}
            </Text>
          </View>
        )}
        <View style={rv.disclaimer}>
          <Text style={rv.disclaimerText}>⚠️ Based on estimated data. Always verify numbers before placing an order.</Text>
        </View>
      </View>

      {/* Sections */}
      {report.sections.map((section, i) => (
        <AppCard key={i} style={{ gap: 10 }}>
          <Text style={rv.sectionTitle}>{section.title.toUpperCase()}</Text>
          {section.body && <Text style={rv.sectionBody}>{section.body}</Text>}
          {section.items && section.items.map((item, j) => (
            <View key={j} style={rv.itemRow}>
              <View style={[rv.itemDot, {
                backgroundColor: section.title.toLowerCase().includes('risk') ? DS.danger
                  : section.title.toLowerCase().includes('strength') ? DS.accent
                  : DS.indigo,
              }]} />
              <Text style={rv.itemText}>{item}</Text>
            </View>
          ))}
        </AppCard>
      ))}

      {/* Generate again */}
      <TouchableOpacity style={rv.resetBtn} onPress={onReset} activeOpacity={0.8}>
        <Text style={rv.resetText}>← Back to product selection</Text>
      </TouchableOpacity>
    </View>
  );
}

const rv = StyleSheet.create({
  hero:           { borderRadius: 18, borderWidth: 1.5, padding: 16, gap: 10 },
  heroTop:        { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verdictBadge:   { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6 },
  verdictText:    { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: 0.5 },
  confidenceWrap: { gap: 1 },
  confidenceNum:  { fontSize: 22, fontWeight: '900', letterSpacing: -0.8 },
  confidenceLabel:{ fontSize: 7, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  headline:       { fontSize: 15, fontWeight: '700', color: DS.textPrimary, lineHeight: 22, letterSpacing: -0.3 },
  productTitle:   { fontSize: 11, color: DS.textMuted, fontStyle: 'italic' },
  completeness:    { backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 8 },
  completenessText:{ fontSize: 11, color: DS.textSecondary },
  disclaimer:      { backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FDE68A' },
  disclaimerText:  { fontSize: 11, color: '#92400E', lineHeight: 16 },
  sectionTitle:   { fontSize: 8, fontWeight: '900', letterSpacing: 2, color: DS.textMuted },
  sectionBody:    { fontSize: 13, color: DS.textSecondary, lineHeight: 21 },
  itemRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  itemDot:        { width: 7, height: 7, borderRadius: 3.5, marginTop: 6, flexShrink: 0 },
  itemText:       { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  resetBtn:       { alignItems: 'center', paddingVertical: 12 },
  resetText:      { fontSize: 13, color: DS.accent, fontWeight: '700' },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function FeasibilityReportScreen() {
  const nav = useNavigation();
  const { taggedProducts, tagsForProduct } = useFeasibilityTags();
  const { entries } = useVault();

  const [selectedAsin, setSelectedAsin] = useState<string | null>(null);
  const [generating, setGenerating]     = useState(false);
  const [error, setError]               = useState('');
  const [report, setReport]             = useState<{
    verdict: string; confidence: number; headline: string;
    sections: { title: string; body?: string; items?: string[] }[];
    data_completeness: string;
  } | null>(null);

  const selectedEntry   = entries.find(e => e.asin === selectedAsin) ?? null;
  const selectedTags    = selectedAsin ? tagsForProduct(selectedAsin) : [];
  const selectedTitle   = selectedEntry?.product.title ?? selectedAsin ?? '';

  async function handleGenerate() {
    if (!selectedAsin) return;
    setGenerating(true);
    setError('');
    setReport(null);

    const calcTag    = selectedTags.find(t => t.type === 'calculation');
    const brandTag   = selectedTags.find(t => t.type === 'brand');
    const keyTag     = selectedTags.find(t => t.type === 'keywords');
    const freightTag = selectedTags.find(t => t.type === 'freight');

    try {
      const result = await api.generateFeasibilityReport({
        product_name:      selectedTitle,
        amazon_price:      selectedEntry?.product.price ?? null,
        supplier_analysis: selectedEntry?.analysis ? {
          verdict:    selectedEntry.analysis.verdict,
          confidence: selectedEntry.analysis.confidence,
          margin:     selectedEntry.analysis.metrics.margin,
          price:      selectedEntry.analysis.metrics.price,
          reviews:    selectedEntry.analysis.metrics.reviews,
        } : null,
        calculation: calcTag?.data ?? null,
        brand:       brandTag?.data ?? null,
        keywords:    keyTag?.data ?? null,
        freight:     freightTag?.data ?? null,
        marketplace: selectedEntry?.marketplace ?? 'US',
        currency:    selectedEntry?.currency ?? 'USD',
      });
      setReport(result);
    } catch (e: any) {
      setError(e?.message ?? 'Could not generate report. Try again.');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => nav.goBack()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={s.back}>‹</Text>
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.eyebrow}>FEASIBILITY REPORT</Text>
          <Text style={s.title}>Go / No-Go Analysis</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* No tagged products yet */}
        {taggedProducts.length === 0 && (
          <AppCard style={s.emptyCard}>
            <Text style={s.emptyIcon}>♡</Text>
            <Text style={s.emptyTitle}>No data tagged yet</Text>
            <Text style={s.emptyBody}>
              Tap the ♡ heart button on your calculations, brand kit, keywords, and freight results — then select which product each belongs to. Come back here to generate the report.
            </Text>
          </AppCard>
        )}

        {/* Product picker */}
        {taggedProducts.length > 0 && !selectedAsin && !report && (
          <ProductPicker products={taggedProducts} onSelect={setSelectedAsin} />
        )}

        {/* Selected product — tagged items + generate */}
        {selectedAsin && !report && (
          <>
            <View style={s.selectedHeader}>
              <TouchableOpacity onPress={() => setSelectedAsin(null)} activeOpacity={0.7}>
                <Text style={s.changeBtn}>← Change product</Text>
              </TouchableOpacity>
              <Text style={s.selectedTitle} numberOfLines={2}>{selectedTitle}</Text>
            </View>

            <TaggedItemsSummary tags={selectedTags} />

            {error !== '' && (
              <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View>
            )}

            <TouchableOpacity
              style={[s.generateBtn, generating && s.generateBtnDisabled]}
              onPress={handleGenerate}
              activeOpacity={0.85}
              disabled={generating}
            >
              {generating
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={s.generateText}>✦  Generate Feasibility Report</Text>
              }
            </TouchableOpacity>
            {generating && (
              <Text style={s.generatingHint}>Analysing all your data… this takes a few seconds.</Text>
            )}
          </>
        )}

        {/* Report */}
        {report && (
          <ReportView
            report={report}
            productTitle={selectedTitle}
            onReset={() => { setReport(null); setSelectedAsin(null); }}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:            { flex: 1, backgroundColor: DS.bgCanvas },
  header:          { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: DS.pagePadding, paddingTop: 10, paddingBottom: 14, backgroundColor: DS.bgCard, borderBottomWidth: 1, borderBottomColor: DS.border },
  back:            { fontSize: 28, color: DS.textPrimary, fontWeight: '300', lineHeight: 32 },
  eyebrow:         { fontSize: 8, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  title:           { fontSize: 18, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  scroll:          { paddingHorizontal: DS.pagePadding, paddingTop: 16, paddingBottom: 60, gap: 12 },
  emptyCard:       { gap: 12, alignItems: 'center', paddingVertical: 32 },
  emptyIcon:       { fontSize: 40, color: DS.textMuted },
  emptyTitle:      { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4 },
  emptyBody:       { fontSize: 13, color: DS.textSecondary, lineHeight: 20, textAlign: 'center' },
  selectedHeader:  { gap: 4 },
  changeBtn:       { fontSize: 12, color: DS.accent, fontWeight: '700' },
  selectedTitle:   { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4, lineHeight: 22 },
  errorBox:        { backgroundColor: DS.dangerBg, borderRadius: 10, padding: 12 },
  errorText:       { fontSize: 13, color: DS.danger },
  generateBtn:     { backgroundColor: DS.accent, borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
  generateBtnDisabled: { backgroundColor: DS.border },
  generateText:    { fontSize: 15, fontWeight: '800', color: '#fff' },
  generatingHint:  { fontSize: 11, color: DS.textMuted, textAlign: 'center', marginTop: -4 },
});
