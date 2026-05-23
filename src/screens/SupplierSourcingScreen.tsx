import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert, Linking,
} from 'react-native';
import { DS } from '../components/ds';
import { api } from '../services/api';
import { AppHeader } from '../components/AppHeader';
import { useCurrency } from '../context/CurrencyContext';

type Supplier = {
  title:         string;
  price_display: string;
  price_range:   { min: number | null; max: number | null };
  moq:           string;
  supplier:      string;
  image:         string;
  url:           string;
  error?:        string;
};

type ScoredSupplier = Supplier & {
  score?: {
    total_score:      number;
    grade:            string;
    confidence_label: string;
    strengths:        string[];
    risk_flags:       string[];
    recommendation:   string;
  };
};

const GRADE_COLOR: Record<string, string> = {
  A: DS.success,
  B: DS.info,
  C: DS.warning,
  D: DS.danger,
  F: DS.danger,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function SupplierCard({
  supplier,
  index,
  selected,
  onSelect,
  onScore,
  onEmail,
  scoring,
}: {
  supplier: ScoredSupplier;
  index: number;
  selected: boolean;
  onSelect: () => void;
  onScore: () => void;
  onEmail: () => void;
  scoring: boolean;
}) {
  const gradeColor = supplier.score ? (GRADE_COLOR[supplier.score.grade] ?? DS.textMuted) : DS.textMuted;

  return (
    <TouchableOpacity
      style={[sc.card, selected && { borderColor: DS.accent, borderWidth: 2 }]}
      onPress={onSelect}
      activeOpacity={0.85}
    >
      <View style={sc.cardTop}>
        <View style={sc.rank}>
          <Text style={sc.rankTxt}>#{index + 1}</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={sc.supplierName} numberOfLines={1}>{supplier.supplier || 'Supplier'}</Text>
          <Text style={sc.productTitle} numberOfLines={2}>{supplier.title}</Text>
        </View>
        {supplier.score && (
          <View style={[sc.gradeBadge, { backgroundColor: gradeColor + '18' }]}>
            <Text style={[sc.gradeTxt, { color: gradeColor }]}>{supplier.score.grade}</Text>
          </View>
        )}
      </View>

      <View style={sc.metaRow}>
        <View style={sc.metaChip}>
          <Text style={sc.metaLabel}>PRICE</Text>
          <Text style={sc.metaValue}>{supplier.price_display || '—'}</Text>
        </View>
        <View style={sc.metaChip}>
          <Text style={sc.metaLabel}>MOQ</Text>
          <Text style={sc.metaValue}>{supplier.moq || '—'}</Text>
        </View>
      </View>

      {supplier.score && (
        <View style={sc.scoreSection}>
          <View style={sc.scoreBar}>
            <View style={[sc.scoreFill, { width: `${supplier.score.total_score}%`, backgroundColor: gradeColor }]} />
          </View>
          <Text style={[sc.scoreLabel, { color: gradeColor }]}>{supplier.score.confidence_label} · {supplier.score.total_score}/100</Text>
          {supplier.score.recommendation && (
            <Text style={sc.recommendation} numberOfLines={2}>{supplier.score.recommendation}</Text>
          )}
          {supplier.score.strengths.length > 0 && (
            <View style={sc.tagsRow}>
              {supplier.score.strengths.slice(0, 2).map((s, i) => (
                <View key={i} style={[sc.tag, { backgroundColor: DS.success + '12' }]}>
                  <Text style={[sc.tagTxt, { color: DS.success }]}>✓ {s}</Text>
                </View>
              ))}
            </View>
          )}
          {supplier.score.risk_flags.length > 0 && (
            <View style={sc.tagsRow}>
              {supplier.score.risk_flags.slice(0, 2).map((r, i) => (
                <View key={i} style={[sc.tag, { backgroundColor: DS.warning + '12' }]}>
                  <Text style={[sc.tagTxt, { color: DS.warning }]}>⚠ {r}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      <View style={sc.actions}>
        {!supplier.score && (
          <TouchableOpacity style={sc.actionBtn} onPress={onScore} activeOpacity={0.8} disabled={scoring}>
            {scoring
              ? <ActivityIndicator size="small" color={DS.accent} />
              : <Text style={sc.actionBtnTxt}>Score ◈</Text>}
          </TouchableOpacity>
        )}
        <TouchableOpacity style={sc.actionBtn} onPress={onEmail} activeOpacity={0.8}>
          <Text style={sc.actionBtnTxt}>Email ✉</Text>
        </TouchableOpacity>
        {!!supplier.url && (
          <TouchableOpacity style={sc.actionBtn} onPress={() => Linking.openURL(supplier.url)} activeOpacity={0.8}>
            <Text style={sc.actionBtnTxt}>View →</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function SupplierSourcingScreen() {
  const { marketplace } = useCurrency();

  const [product,     setProduct]     = useState('');
  const [maxPrice,    setMaxPrice]    = useState('');
  const [maxMoq,      setMaxMoq]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [suppliers,   setSuppliers]   = useState<ScoredSupplier[]>([]);
  const [error,       setError]       = useState('');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [scoringIdx,  setScoringIdx]  = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [emailModal,  setEmailModal]  = useState<{ subject: string; body: string; tips: string[] } | null>(null);

  async function handleSearch() {
    const p = product.trim();
    if (!p) { Alert.alert('Enter a product to source'); return; }
    setLoading(true);
    setError('');
    setSuppliers([]);
    setSelectedIdx(null);
    try {
      const result = await api.searchSuppliersV2({
        product:        p,
        marketplace,
        max_unit_price: maxPrice ? parseFloat(maxPrice) : undefined,
        max_moq:        maxMoq   ? parseInt(maxMoq)    : undefined,
      });
      setSuppliers((result.suppliers ?? []).map(s => ({ ...s })));
    } catch (e: any) {
      setError(e?.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleScore(idx: number) {
    const s = suppliers[idx];
    if (!s) return;
    setScoringIdx(idx);
    try {
      const priceMin = s.price_range?.min ?? 5;
      const result = await api.scoreSupplier({
        supplier_name:   s.supplier || s.title,
        price_per_unit:  priceMin,
        moq:             parseInt(s.moq) || 200,
        product_name:    product,
      });
      setSuppliers(prev => prev.map((sup, i) => i === idx ? { ...sup, score: result } : sup));
    } catch {
      Alert.alert('Could not score supplier');
    } finally {
      setScoringIdx(null);
    }
  }

  async function handleEmail(idx: number) {
    const s = suppliers[idx];
    if (!s) return;
    try {
      const result = await api.getSupplierEmail(product, s.supplier || s.title);
      setEmailModal(result);
    } catch {
      Alert.alert('Could not generate email');
    }
  }

  const selectedSuppliers = selectedIdx !== null ? [suppliers[selectedIdx]] : [];
  const compareMode = selectedIdx !== null;

  return (
    <View style={s.container}>
      <AppHeader helpKey="research" />
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Hero */}
        <View style={s.hero}>
          <Text style={s.heroTitle}>Supplier Sourcing</Text>
          <Text style={s.heroSub}>Find, evaluate, and contact verified manufacturers. AI-scored for quality and risk.</Text>
        </View>

        {/* Search card */}
        <View style={s.searchCard}>
          <View style={s.searchRow}>
            <TextInput
              style={s.input}
              value={product}
              onChangeText={setProduct}
              placeholder="e.g. bamboo cutting board, silicone pet bowl..."
              placeholderTextColor={DS.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
            />
            <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.85} disabled={loading}>
              <Text style={s.searchBtnTxt}>{loading ? '…' : '⬡'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.filterToggle} onPress={() => setShowFilters(f => !f)} activeOpacity={0.7}>
            <Text style={s.filterToggleTxt}>{showFilters ? '▲ Hide filters' : '▼ Filters'}</Text>
          </TouchableOpacity>

          {showFilters && (
            <View style={s.filterRow}>
              <View style={s.filterField}>
                <Text style={s.filterLabel}>MAX UNIT PRICE $</Text>
                <TextInput style={s.filterInput} value={maxPrice} onChangeText={setMaxPrice} keyboardType="decimal-pad" placeholder="e.g. 8" placeholderTextColor={DS.textMuted} />
              </View>
              <View style={s.filterField}>
                <Text style={s.filterLabel}>MAX MOQ (units)</Text>
                <TextInput style={s.filterInput} value={maxMoq} onChangeText={setMaxMoq} keyboardType="number-pad" placeholder="e.g. 500" placeholderTextColor={DS.textMuted} />
              </View>
            </View>
          )}
        </View>

        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={DS.accent} size="large" />
            <Text style={s.loadingTxt}>Finding suppliers…</Text>
          </View>
        )}

        {!!error && <Text style={s.errorTxt}>{error}</Text>}

        {/* Results */}
        {suppliers.length > 0 && (
          <>
            <View style={s.resultsHeader}>
              <Text style={s.resultsCount}>{suppliers.length} suppliers found</Text>
              <Text style={s.resultsSub}>Tap "Score" to get AI assessment · Tap "Email" for outreach template</Text>
            </View>

            {suppliers.map((sup, idx) => (
              <SupplierCard
                key={idx}
                supplier={sup}
                index={idx}
                selected={selectedIdx === idx}
                onSelect={() => setSelectedIdx(prev => prev === idx ? null : idx)}
                onScore={() => handleScore(idx)}
                onEmail={() => handleEmail(idx)}
                scoring={scoringIdx === idx}
              />
            ))}
          </>
        )}

        {/* Email modal content rendered inline */}
        {emailModal && (
          <View style={s.emailCard}>
            <View style={s.emailHeader}>
              <Text style={s.emailTitle}>Outreach Email</Text>
              <TouchableOpacity onPress={() => setEmailModal(null)} activeOpacity={0.7}>
                <Text style={s.emailClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.emailSubject}>
              <Text style={s.emailSubjectLabel}>SUBJECT</Text>
              <Text style={s.emailSubjectTxt}>{emailModal.subject}</Text>
            </View>
            <ScrollView style={s.emailBody} nestedScrollEnabled>
              <Text style={s.emailBodyTxt}>{emailModal.body}</Text>
            </ScrollView>
            {emailModal.tips?.length > 0 && (
              <View style={s.emailTips}>
                <Text style={s.emailTipsTitle}>TIPS</Text>
                {emailModal.tips.map((t, i) => (
                  <Text key={i} style={s.emailTip}>· {t}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Empty state */}
        {!loading && suppliers.length === 0 && !error && (
          <View style={s.emptyWrap}>
            <Text style={s.emptyIcon}>⬡</Text>
            <Text style={s.emptyTitle}>Find Your Supplier</Text>
            <Text style={s.emptySub}>Enter what you want to source above. We'll search verified manufacturers and score them for you.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  card: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             12,
  },
  cardTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  rank:        { width: 28, height: 28, borderRadius: 14, backgroundColor: DS.bgElevated, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  rankTxt:     { fontSize: 10, fontWeight: '800', color: DS.textSecondary },
  supplierName: { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.3 },
  productTitle: { fontSize: 13, fontWeight: '700', color: DS.textPrimary, lineHeight: 18 },
  gradeBadge:  { width: 36, height: 36, borderRadius: DS.radiusButton, alignItems: 'center', justifyContent: 'center' },
  gradeTxt:    { fontSize: 16, fontWeight: '900' },
  metaRow:     { flexDirection: 'row', gap: 8 },
  metaChip:    { flex: 1, backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, padding: 10, gap: 3 },
  metaLabel:   { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 1 },
  metaValue:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  scoreSection: { gap: 8 },
  scoreBar:    { height: 4, backgroundColor: DS.bgElevated, borderRadius: 2 },
  scoreFill:   { height: 4, borderRadius: 2 },
  scoreLabel:  { fontSize: 11, fontWeight: '700' },
  recommendation: { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  tagsRow:     { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag:         { borderRadius: DS.radiusChip, paddingHorizontal: 8, paddingVertical: 3 },
  tagTxt:      { fontSize: 10, fontWeight: '700' },
  actions:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn:   { borderWidth: 1, borderColor: DS.border, borderRadius: DS.radiusButton, paddingHorizontal: 14, paddingVertical: 8, minWidth: 70, alignItems: 'center' },
  actionBtnTxt: { fontSize: 12, fontWeight: '700', color: DS.accent },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.bgCanvas },
  scroll:    { flex: 1 },
  content:   { paddingHorizontal: DS.pagePadding, paddingBottom: 60, gap: DS.sectionGap },

  hero:      { paddingTop: DS.sectionGap, gap: 4 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6 },
  heroSub:   { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  searchCard: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             10,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex:              1,
    backgroundColor:   DS.bgElevated,
    borderRadius:      DS.radiusInput,
    borderWidth:       1,
    borderColor:       DS.border,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontSize:          14,
    color:             DS.textPrimary,
  },
  searchBtn: {
    backgroundColor: DS.success,
    borderRadius:    DS.radiusInput,
    paddingHorizontal: 18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  searchBtnTxt: { fontSize: 18, color: '#fff', fontWeight: '800' },

  filterToggle:    { alignSelf: 'flex-start' },
  filterToggleTxt: { fontSize: 11, color: DS.accent, fontWeight: '700' },
  filterRow:       { flexDirection: 'row', gap: 8 },
  filterField:     { flex: 1, gap: 4 },
  filterLabel:     { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1 },
  filterInput: {
    backgroundColor: DS.bgElevated,
    borderRadius:    DS.radiusInput,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         10,
    fontSize:        13,
    color:           DS.textPrimary,
  },

  loadingWrap: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  loadingTxt:  { fontSize: 14, color: DS.textSecondary },
  errorTxt:    { fontSize: 13, color: DS.danger, textAlign: 'center' },

  resultsHeader: { gap: 3 },
  resultsCount:  { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  resultsSub:    { fontSize: 11, color: DS.textMuted },

  emailCard: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1.5,
    borderColor:     DS.accent + '30',
    padding:         DS.cardPadding,
    gap:             12,
    maxHeight:       400,
  },
  emailHeader:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emailTitle:      { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  emailClose:      { fontSize: 16, color: DS.textMuted, padding: 4 },
  emailSubject:    { gap: 4 },
  emailSubjectLabel: { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1 },
  emailSubjectTxt: { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  emailBody:       { maxHeight: 160 },
  emailBodyTxt:    { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  emailTips:       { gap: 4 },
  emailTipsTitle:  { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1 },
  emailTip:        { fontSize: 11, color: DS.textSecondary },

  emptyWrap:  { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon:  { fontSize: 40, color: DS.textMuted },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: DS.textPrimary },
  emptySub:   { fontSize: 13, color: DS.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 280 },
});
