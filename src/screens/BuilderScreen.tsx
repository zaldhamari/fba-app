import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  SafeAreaView, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { DS } from '../components/ds';
import { SkeletonCard, SkeletonDashboard } from '../components/ds/LoadingSkeleton';
import { useBuilderSession } from '../hooks/useBuilderSession';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { api, prewarmServer } from '../services/api';
import type {
  BuilderSession, BuilderStage,
  DiscoveryData, AnalysisData, SupplierData,
  FreightData, CalculationsData, BrandData,
} from '../types/builder';
import { STAGE_ORDER, STAGE_LABELS, STAGE_ICONS } from '../types/builder';
import { HelpButton } from '../components/HelpModal';
import { AppHeader } from '../components/AppHeader';
import { useNavigation } from '@react-navigation/native';
import { track } from '../lib/analytics';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STAGE_ACCENT: Record<BuilderStage, string> = {
  discovery:    DS.info,
  analysis:     DS.accent,
  supplier:     DS.accent,
  freight:      DS.warning,
  calculations: DS.successText,
  brand:        '#7C3AED',
  complete:     DS.warningText,
};

function Field({
  label, value, onChangeText, placeholder, keyboardType = 'default', multiline = false,
}: {
  label: string; value: string; onChangeText: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={f.fieldWrap}>
      <Text style={f.fieldLabel}>{label}</Text>
      <TextInput
        style={[f.input, multiline && f.inputMulti]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={DS.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
      />
    </View>
  );
}

const f = StyleSheet.create({
  fieldWrap:  { gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  input:      { backgroundColor: DS.bgElevated, borderRadius: 10, borderWidth: 1, borderColor: DS.border, padding: 12, fontSize: 14, color: DS.textPrimary },
  inputMulti: { height: 100, textAlignVertical: 'top' },
});

function Btn({ label, onPress, color = DS.accent, loading = false, disabled = false, outline = false }: {
  label: string; onPress: () => void; color?: string;
  loading?: boolean; disabled?: boolean; outline?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        btn.base,
        outline ? { backgroundColor: 'transparent', borderColor: color, borderWidth: 1.5 } : { backgroundColor: color },
        (disabled || loading) && btn.disabled,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={outline ? color : DS.bgCard} size="small" />
        : <Text style={[btn.label, outline && { color }]}>{label}</Text>}
    </TouchableOpacity>
  );
}

const btn = StyleSheet.create({
  base:    { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  label:   { fontSize: 15, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.3 },
  disabled:{ opacity: 0.4 },
});

function GateCard({ passed, warning, label }: { passed: boolean; warning?: boolean; label: string }) {
  const color = passed ? DS.successText : warning ? DS.warning : DS.danger;
  const icon  = passed ? '✓' : warning ? '⚠' : '✕';
  return (
    <View style={[gate.wrap, { borderColor: color + '40', backgroundColor: color + '10' }]}>
      <Text style={[gate.icon, { color }]}>{icon}</Text>
      <Text style={[gate.label, { color }]}>{label}</Text>
    </View>
  );
}

const gate = StyleSheet.create({
  wrap:  { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12 },
  icon:  { fontSize: 16, fontWeight: '900' },
  label: { fontSize: 13, fontWeight: '700', flex: 1, lineHeight: 18 },
});

// ── Stat Row ──────────────────────────────────────────────────────────────────

function StatRow({ stats }: { stats: { label: string; value: string; color?: string }[] }) {
  return (
    <View style={sr.row}>
      {stats.map((s, i) => (
        <React.Fragment key={i}>
          <View style={sr.cell}>
            <Text style={sr.label}>{s.label}</Text>
            <Text style={[sr.value, s.color ? { color: s.color } : {}]}>{s.value}</Text>
          </View>
          {i < stats.length - 1 && <View style={sr.divider} />}
        </React.Fragment>
      ))}
    </View>
  );
}

const sr = StyleSheet.create({
  row:     { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12 },
  cell:    { flex: 1, alignItems: 'center', gap: 2 },
  label:   { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: DS.textMuted },
  value:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  divider: { width: 1, backgroundColor: DS.border },
});

// ── Stage: Discovery ──────────────────────────────────────────────────────────

function StageDiscovery({ session, onComplete }: {
  session: BuilderSession;
  onComplete: (data: DiscoveryData) => void;
}) {
  const { profile } = useSellerProfile();
  const [query,    setQuery]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [results,  setResults]  = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  async function search() {
    if (!query.trim()) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const res = await api.searchAmazon(query.trim(), 'all');
      setResults(res.products ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Search failed');
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!selected) return;
    onComplete({
      keyword:     query.trim(),
      marketplace: profile?.marketplace ?? 'US',
      product: {
        id:          selected.asin,
        title:       selected.title,
        price:       selected.price ?? 0,
        rating:      selected.rating ?? null,
        reviewCount: selected.review_count ?? null,
        competition: selected.competition ?? 'Medium',
        url:         selected.url ?? undefined,
      },
    });
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[f.input, { flex: 1 }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Search a product idea..."
          placeholderTextColor={DS.textMuted}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity style={stg.searchBtn} onPress={search} activeOpacity={0.8}>
          <Text style={stg.searchBtnTxt}>{loading ? '…' : '◎'}</Text>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={{ color: DS.danger, fontSize: 13 }}>{error}</Text>}

      {results.map(p => {
        const isSel = selected?.asin === p.asin;
        const compColor = p.competition === 'Low' ? DS.successText : p.competition === 'High' ? DS.danger : DS.warning;
        const compBg    = p.competition === 'Low' ? DS.successBg : p.competition === 'High' ? DS.dangerBg : DS.warningBg;
        const priceMin  = profile?.priceMin ?? 0;
        const priceMax  = profile?.priceMax ?? 999;
        const maxRevs   = (profile as any)?.maxTopSellerReviews ?? 500;
        const fitsProfile = (p.price ?? 0) >= priceMin && (p.price ?? 0) <= priceMax && (p.review_count ?? 0) < maxRevs;
        const estRevenue  = Math.round(((p.price ?? 0) * (p.review_count ?? 0)) * 0.05);

        return (
          <TouchableOpacity
            key={p.asin}
            style={[stg.resultCard, isSel && stg.resultCardSel]}
            onPress={() => setSelected(isSel ? null : p)}
            activeOpacity={0.8}
          >
            {/* Title row */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <Text style={[stg.resultTitle, isSel && { color: DS.info }]} numberOfLines={2}>{p.title}</Text>
              {isSel && (
                <View style={{ backgroundColor: DS.info, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: '900', color: DS.bgCard }}>✓ Selected</Text>
                </View>
              )}
            </View>

            {/* 4-stat row */}
            <View style={{ marginTop: 10 }}>
              <StatRow stats={[
                { label: 'Price',       value: `$${(p.price ?? 0).toFixed(2)}` },
                { label: 'Reviews',     value: (p.review_count ?? 0).toLocaleString() },
                { label: 'Rating',      value: p.rating != null ? `${p.rating}★` : '—' },
                { label: 'Competition', value: p.competition ?? '—', color: compColor },
              ]} />
            </View>

            {/* Footer chips */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <View style={[stg.resultBadge, { backgroundColor: fitsProfile ? DS.successBg : DS.warningBg }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: fitsProfile ? DS.successText : DS.warning }}>
                  {fitsProfile ? 'Fits profile ✓' : 'Outside profile'}
                </Text>
              </View>
              <Text style={stg.resultMeta}>~${estRevenue.toLocaleString()}/mo est.</Text>
              {p.source && p.source !== 'dataforseo' && (
                <View style={[stg.resultBadge, { backgroundColor: DS.warningBg }]}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: DS.warning }}>Price is an estimate</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      {selected && (
        <Btn label="Lock In This Product →" color={DS.info} onPress={confirm} />
      )}
    </View>
  );
}

// ── Stage: Analysis ───────────────────────────────────────────────────────────

function StageAnalysis({ session, onComplete }: {
  session: BuilderSession;
  onComplete: (data: AnalysisData) => void;
}) {
  const product = session.discovery?.product;
  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState<any | null>(null);
  const [error,    setError]    = useState('');

  useEffect(() => { prewarmServer(); if (product) runAnalysis(); }, []);

  async function runAnalysis() {
    if (!product) return;
    setLoading(true); setError('');
    try {
      const res = await api.analyzeProduct(
        product.price,
        product.reviewCount ?? 0,
        product.competition,
        'Stable',
        { marketplace: session.discovery?.marketplace ?? 'US' },
      );
      setResult(res);
    } catch (e: any) {
      setError(e?.message ?? 'Analysis failed');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return (
    <View style={{ paddingVertical: 16, gap: 10 }}>
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );

  if (error) return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: DS.danger, fontSize: 13 }}>{error}</Text>
      <Btn label="Retry" color={DS.accent} onPress={runAnalysis} />
    </View>
  );

  if (!result) return null;

  const isAvoid   = result.verdict === 'AVOID';
  const isTest    = result.verdict === 'TEST';
  const isLaunch  = result.verdict === 'LAUNCH';
  const gateColor = isLaunch ? DS.successText : isTest ? DS.warning : DS.danger;

  function advance(override = false) {
    if (isAvoid && !override) return;
    onComplete({
      verdict:          result.verdict,
      confidence:       result.confidence,
      opportunityScore: result.confidence,
      summary:          result.summary,
      reasons:          result.reasons ?? [],
      risk:             result.risk ?? '',
      userOverride:     override,
    });
  }

  return (
    <View style={{ gap: 14 }}>
      {/* Hero verdict card */}
      <View style={[stg.verdictHero, { backgroundColor: gateColor + '12', borderColor: gateColor + '40' }]}>
        {product?.title && (
          <Text style={[stg.eyebrow, { marginBottom: 4 }]} numberOfLines={1}>{product.title}</Text>
        )}
        <Text style={stg.eyebrow}>AI VERDICT</Text>
        <Text style={[stg.verdictWord, { color: gateColor }]}>{result.verdict}</Text>
        {/* Confidence bar */}
        <View style={stg.confBarTrack}>
          <View style={[stg.confBarFill, { width: `${result.confidence}%` as any, backgroundColor: gateColor }]} />
        </View>
        <Text style={[stg.confLabel, { color: gateColor }]}>Confidence: {result.confidence}/100</Text>
      </View>

      <Text style={stg.analysisSummary}>{result.summary}</Text>

      {(result.reasons ?? []).map((r: string, i: number) => (
        <View key={i} style={stg.reasonRow}>
          <Text style={{ color: gateColor, fontSize: 12 }}>•</Text>
          <Text style={stg.reasonTxt}>{r}</Text>
        </View>
      ))}

      {!!result.risk && (
        <GateCard passed={false} warning label={result.risk} />
      )}

      {isAvoid ? (
        <View style={{ gap: 10 }}>
          <GateCard passed={false} label="AI recommends avoiding this product. Go back and pick a different one." />
          <Btn label="Override Anyway (not recommended)" color={DS.danger} outline onPress={() => {
            Alert.alert(
              'Override Warning',
              'The AI analysis recommends avoiding this product. Are you sure you want to continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Continue Anyway', style: 'destructive', onPress: () => advance(true) },
              ]
            );
          }} />
        </View>
      ) : isTest ? (
        <View style={{ gap: 10 }}>
          <GateCard passed={false} warning label="Marginal opportunity — proceed with caution." />
          <Btn label="Continue with Caution →" color={DS.warning} onPress={() => advance(false)} />
        </View>
      ) : (
        <Btn label="Looks Good — Find Suppliers →" color={DS.successText} onPress={() => advance(false)} />
      )}
    </View>
  );
}

// ── Stage: Supplier ───────────────────────────────────────────────────────────

function StageSupplier({ session, onComplete }: {
  session: BuilderSession;
  onComplete: (data: SupplierData) => void;
}) {
  const { profile } = useSellerProfile();
  const productName = session.discovery?.product.title ?? '';
  const [query,    setQuery]    = useState(productName);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [results,  setResults]  = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);

  async function search() {
    const q = query.trim();
    if (!q) return;
    setLoading(true); setError(''); setResults([]);
    try {
      const res = await api.searchSuppliersV2({ product: q });
      setResults(res.suppliers ?? []);
    } catch (e: any) {
      setError(e?.message ?? 'Supplier search failed');
    } finally {
      setLoading(false);
    }
  }

  function confirm() {
    if (!selected) return;
    const unitCost = selected.price_range?.max ?? selected.price_range?.min ?? 0;
    const maxUnitPrice = profile ? Math.round(profile.priceMin * 0.28) : 999;
    onComplete({
      name:              selected.title ?? selected.supplier ?? 'Unknown Supplier',
      platform:          selected.supplier ?? 'Alibaba',
      unitCost,
      moq:               parseInt(String(selected.moq ?? '100').replace(/\D/g, ''), 10) || 100,
      url:               selected.url ?? undefined,
      fitsProfileBudget: unitCost <= maxUnitPrice,
    });
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          style={[f.input, { flex: 1 }]}
          value={query}
          onChangeText={setQuery}
          placeholder="Product name..."
          placeholderTextColor={DS.textMuted}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity style={stg.searchBtn} onPress={search} activeOpacity={0.8}>
          <Text style={stg.searchBtnTxt}>{loading ? '…' : '⬡'}</Text>
        </TouchableOpacity>
      </View>

      {!!error && <Text style={{ color: DS.danger, fontSize: 13 }}>{error}</Text>}

      {results.map((s, i) => {
        const isSel = selected?.title === s.title && selected?.supplier === s.supplier;
        const unitCost = s.price_range?.max ?? s.price_range?.min ?? 0;
        const maxUnitPrice = profile ? Math.round(profile.priceMin * 0.28) : 999;
        const fits = unitCost <= maxUnitPrice;
        const platformColor = (s.supplier ?? '').toLowerCase().includes('alibaba') ? DS.warningText
          : (s.supplier ?? '').toLowerCase().includes('dhgate') ? DS.info
          : DS.textMuted;
        const platformBg = (s.supplier ?? '').toLowerCase().includes('alibaba') ? DS.warningBg
          : (s.supplier ?? '').toLowerCase().includes('dhgate') ? DS.accentLight
          : DS.bgElevated;

        return (
          <TouchableOpacity
            key={i}
            style={[stg.resultCard, isSel && { borderColor: DS.accent, backgroundColor: DS.accent + '08' }]}
            onPress={() => setSelected(isSel ? null : s)}
            activeOpacity={0.8}
          >
            {/* Name + platform */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={[stg.resultTitle, isSel && { color: DS.accent }]} numberOfLines={1}>{s.title ?? s.supplier ?? '—'}</Text>
              <View style={{ backgroundColor: platformBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 9, fontWeight: '800', color: platformColor }}>{s.supplier ?? 'Alibaba'}</Text>
              </View>
            </View>

            {/* 3-stat row */}
            <View style={{ marginTop: 10 }}>
              <StatRow stats={[
                { label: 'Price/unit', value: s.price_display ?? '—' },
                { label: 'MOQ',        value: String(s.moq ?? '—') },
                { label: 'Platform',   value: s.supplier ?? 'Alibaba' },
              ]} />
            </View>

            {/* Budget fit */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' }}>
              <View style={[stg.resultBadge, { backgroundColor: fits ? DS.successBg : DS.warningBg }]}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: fits ? DS.successText : DS.warning }}>
                  {fits ? 'Fits budget ✓' : 'Over budget'}
                </Text>
              </View>
              {isSel && <Text style={{ fontSize: 10, fontWeight: '900', color: DS.accent }}>✓ Selected</Text>}
            </View>
          </TouchableOpacity>
        );
      })}

      {selected && (
        <View style={{ gap: 10 }}>
          {!selected.fitsProfileBudget && (
            <GateCard passed={false} warning label="Unit cost is above your profile target — margins may be tight." />
          )}
          <Btn label="Lock In This Supplier →" color={DS.accent} onPress={confirm} />
        </View>
      )}
    </View>
  );
}

// ── Stage: Freight ────────────────────────────────────────────────────────────

function StageFreight({ session, onComplete }: {
  session: BuilderSession;
  onComplete: (data: FreightData) => void;
}) {
  const { profile } = useSellerProfile();
  const [units,     setUnits]     = useState('200');
  const [weightKg,  setWeightKg]  = useState('0.5');
  const [lengthCm,  setLengthCm]  = useState('20');
  const [widthCm,   setWidthCm]   = useState('15');
  const [heightCm,  setHeightCm]  = useState('10');
  const [loading,   setLoading]   = useState(false);
  const [result,    setResult]    = useState<any | null>(null);
  const [selected,  setSelected]  = useState<string | null>(null);

  async function estimate() {
    setLoading(true); setResult(null);
    await new Promise(resolve => setTimeout(resolve, 500));

    const u   = parseInt(units, 10) || 200;
    const wkg = parseFloat(weightKg) || 0.5;
    const l   = parseFloat(lengthCm) || 20;
    const w   = parseFloat(widthCm)  || 15;
    const h   = parseFloat(heightCm) || 10;

    const volWt      = (l * w * h) / 5000;
    const chargeable = Math.max(wkg, volWt);
    const totalCBM   = u * (l / 100) * (w / 100) * (h / 100);

    const airTotal    = Math.max(45, u * chargeable) * 5.80;
    const airUnit     = airTotal / u;
    const lclTotal    = totalCBM * 145 + 65;
    const lclUnit     = lclTotal / u;
    const exprTotal   = Math.max(10, u * chargeable) * 11.50;
    const exprUnit    = exprTotal / u;

    const modes: Record<string, any> = {
      air: {
        mode: 'Air Freight', cost_per_unit: Math.round(airUnit * 100) / 100,
        total_cost: Math.round(airTotal), transit_days: 10,
        notes: 'Fastest option for smaller shipments.',
      },
      sea_lcl: {
        mode: 'Sea LCL', cost_per_unit: Math.round(lclUnit * 100) / 100,
        total_cost: Math.round(lclTotal), transit_days: 32,
        notes: 'Shared container — good for mid-size orders.',
      },
      express: {
        mode: 'Express (DHL/FedEx)', cost_per_unit: Math.round(exprUnit * 100) / 100,
        total_cost: Math.round(exprTotal), transit_days: 5,
        notes: 'Door-to-door express courier.',
      },
    };

    if (totalCBM > 3) {
      const fclTotal = 3800 + totalCBM * 30;
      modes.sea_fcl = {
        mode: 'Sea FCL', cost_per_unit: Math.round((fclTotal / u) * 100) / 100,
        total_cost: Math.round(fclTotal), transit_days: 30,
        notes: 'Full container — best for large orders.',
      };
    }

    let recommended: string;
    if (totalCBM < 0.5) {
      recommended = 'air';
    } else if (totalCBM < 1) {
      recommended = airTotal <= lclTotal ? 'air' : 'sea_lcl';
    } else {
      recommended = (modes.sea_fcl && modes.sea_fcl.total_cost < lclTotal) ? 'sea_fcl' : 'sea_lcl';
    }

    const fbaInboundEst = u * 0.50;
    const prepCost      = u * 0.40;

    setResult({ modes, recommended, fba_inbound_est: fbaInboundEst, prep_cost: prepCost });
    setSelected(recommended);
    setLoading(false);
  }

  function confirm() {
    if (!result || !selected) return;
    const modeData = result.modes[selected];
    if (!modeData) return;
    const sellPrice = session.discovery?.product.price ?? 25;
    onComplete({
      mode:           selected as any,
      modeLabel:      modeData.mode,
      units:          parseInt(units, 10) || 200,
      costPerUnit:    modeData.cost_per_unit,
      totalCost:      modeData.total_cost,
      transitDays:    modeData.transit_days,
      pctOfSellPrice: Math.round((modeData.cost_per_unit / sellPrice) * 100),
    });
  }

  const modeKeys = result ? (['air', 'sea_lcl', 'sea_fcl', 'express'] as const).filter(k => !!result.modes[k]) : [];

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Units" value={units} onChangeText={setUnits} placeholder="200" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Weight/unit (kg)" value={weightKg} onChangeText={setWeightKg} placeholder="0.5" keyboardType="numeric" />
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Length cm" value={lengthCm} onChangeText={setLengthCm} placeholder="20" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Width cm" value={widthCm} onChangeText={setWidthCm} placeholder="15" keyboardType="numeric" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Height cm" value={heightCm} onChangeText={setHeightCm} placeholder="10" keyboardType="numeric" />
        </View>
      </View>

      <Btn label={loading ? 'Calculating...' : 'Get Freight Estimates →'} color={DS.warning} onPress={estimate} loading={loading} />

      {result && modeKeys.map(key => {
        const m = result.modes[key];
        if (!m) return null;
        const isSel = selected === key;
        return (
          <TouchableOpacity
            key={key}
            style={[stg.resultCard, isSel && { borderColor: DS.warning, backgroundColor: DS.warning + '08' }]}
            onPress={() => setSelected(key)}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[stg.resultTitle, isSel && { color: DS.warning }]}>{m.mode}</Text>
              {key === result.recommended && (
                <View style={{ backgroundColor: DS.warning, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                  <Text style={{ fontSize: 9, fontWeight: '900', color: DS.bgCard }}>BEST</Text>
                </View>
              )}
            </View>
            <View style={{ marginTop: 10 }}>
              <StatRow stats={[
                { label: 'Cost/Unit',  value: `$${m.cost_per_unit.toFixed(2)}` },
                { label: 'Total',      value: `$${m.total_cost.toLocaleString()}` },
                { label: 'Days',       value: String(m.transit_days) },
              ]} />
            </View>
            {!!m.notes && <Text style={[stg.resultMeta, { marginTop: 8 }]}>{m.notes}</Text>}
          </TouchableOpacity>
        );
      })}

      {selected && result && (
        <Btn label="Lock In This Freight Method →" color={DS.warning} onPress={confirm} />
      )}
    </View>
  );
}

// ── Stage: Calculations ───────────────────────────────────────────────────────

function StageCalculations({ session, onComplete }: {
  session: BuilderSession;
  onComplete: (data: CalculationsData) => void;
}) {
  const sellPrice    = session.discovery?.product.price ?? 25;
  const unitCost     = session.supplier?.unitCost ?? 0;
  const freightUnit  = session.freight?.costPerUnit ?? 0;

  const [price,      setPrice]      = useState(String(sellPrice.toFixed(2)));
  const [unitsEst,   setUnitsEst]   = useState('150');
  const [ppcUnit,    setPpcUnit]    = useState('1.50');
  const [result,     setResult]     = useState<CalculationsData | null>(null);
  const hasAutoCalc = useRef(false);

  function calculate() {
    const p    = parseFloat(price) || 0;
    const fc   = freightUnit;
    const uc   = unitCost;
    const ppc  = parseFloat(ppcUnit) || 0;
    const fba  = p <= 10 ? 2.47 : p <= 20 ? 3.31 : p <= 30 ? 4.90 : p <= 50 ? 6.08 : 8.66;
    const cogs = uc + fc + ppc + fba;
    const net  = p - cogs;
    const margin   = p > 0 ? Math.round((net / p) * 100) : 0;
    const roi      = uc > 0 ? Math.round((net / uc) * 100) : 0;
    const monthly  = parseInt(unitsEst, 10) || 150;
    const verdict: CalculationsData['verdict'] =
      margin >= 20 ? 'profitable' : margin >= 0 ? 'marginal' : 'unprofitable';

    setResult({
      sellingPrice:     p,
      unitCost:         uc,
      freightPerUnit:   fc,
      fbaFee:           fba,
      ppcPerUnit:       ppc,
      netProfit:        Math.round(net * 100) / 100,
      marginPct:        margin,
      roiPct:           roi,
      monthlyUnitsEst:  monthly,
      monthlyProfitEst: Math.round(net * monthly),
      breakEvenUnits:   uc > 0 ? Math.ceil((uc * monthly) / Math.max(net, 0.01)) : 0,
      verdict,
    });
  }

  useEffect(() => {
    if (!hasAutoCalc.current) { hasAutoCalc.current = true; return; }
    calculate();
  }, [price, unitsEst, ppcUnit]);

  function confirm() {
    if (!result) return;
    if (result.verdict === 'unprofitable') {
      Alert.alert(
        'Numbers Don\'t Work',
        'The calculations show this product would lose money at these prices. You can adjust your selling price, go back and find a cheaper supplier, or find a cheaper freight option.',
        [
          { text: 'Adjust Numbers', style: 'cancel' },
          { text: 'Continue Anyway', style: 'destructive', onPress: () => onComplete(result) },
        ]
      );
    } else {
      onComplete(result);
    }
  }

  const marginColor = !result ? DS.textMuted
    : result.marginPct >= 20 ? DS.successText
    : result.marginPct >= 0  ? DS.warning
    : DS.danger;

  return (
    <View style={{ gap: 14 }}>
      {/* Fixed inputs */}
      <View style={stg.calcRow}>
        <Text style={stg.calcLabel}>Unit Cost (supplier)</Text>
        <Text style={stg.calcValue}>${unitCost.toFixed(2)}</Text>
      </View>
      <View style={stg.calcRow}>
        <Text style={stg.calcLabel}>Freight per unit</Text>
        <Text style={stg.calcValue}>${freightUnit.toFixed(2)}</Text>
      </View>

      <Field label="Your Selling Price ($)" value={price} onChangeText={setPrice} placeholder="24.99" keyboardType="decimal-pad" />
      <Field label="Est. Monthly Sales (units)" value={unitsEst} onChangeText={setUnitsEst} placeholder="150" keyboardType="numeric" />
      <Field label="PPC Cost per Unit ($)" value={ppcUnit} onChangeText={setPpcUnit} placeholder="1.50" keyboardType="decimal-pad" />

      <Btn label="Run the Numbers →" color={DS.successText} onPress={calculate} />

      {result && (
        <View style={{ gap: 10 }}>
          {/* P&L waterfall */}
          <View style={[stg.resultCard, { gap: 6 }]}>
            <Text style={stg.eyebrow}>P&L BREAKDOWN</Text>
            <View style={stg.plRow}>
              <Text style={stg.plLabel}>Selling Price</Text>
              <Text style={stg.plValue}>${result.sellingPrice.toFixed(2)}</Text>
            </View>
            <View style={stg.plRow}>
              <Text style={stg.plLabel}>− Unit Cost</Text>
              <Text style={[stg.plValue, { color: DS.danger }]}>−${result.unitCost.toFixed(2)}</Text>
            </View>
            <View style={stg.plRow}>
              <Text style={stg.plLabel}>− Freight/unit</Text>
              <Text style={[stg.plValue, { color: DS.danger }]}>−${result.freightPerUnit.toFixed(2)}</Text>
            </View>
            <View style={stg.plRow}>
              <Text style={stg.plLabel}>− FBA Fee</Text>
              <Text style={[stg.plValue, { color: DS.danger }]}>−${result.fbaFee.toFixed(2)}</Text>
            </View>
            <View style={stg.plRow}>
              <Text style={stg.plLabel}>− PPC/unit</Text>
              <Text style={[stg.plValue, { color: DS.danger }]}>−${result.ppcPerUnit.toFixed(2)}</Text>
            </View>
            <View style={[stg.plDivider]} />
            <View style={stg.plRow}>
              <Text style={[stg.plLabel, { fontWeight: '900', color: DS.textPrimary }]}>=  Net Profit</Text>
              <Text style={[stg.plValue, { fontWeight: '900', fontSize: 18, color: marginColor }]}>
                ${result.netProfit.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Stats row */}
          <StatRow stats={[
            { label: 'Margin',         value: `${result.marginPct}%`,                  color: marginColor },
            { label: 'ROI',            value: `${result.roiPct}%`,                     color: marginColor },
            { label: 'Monthly Profit', value: `$${result.monthlyProfitEst.toLocaleString()}`, color: marginColor },
          ]} />

          <GateCard
            passed={result.verdict === 'profitable'}
            warning={result.verdict === 'marginal'}
            label={
              result.verdict === 'profitable' ? `${result.marginPct}% margin — numbers look solid.`
              : result.verdict === 'marginal'  ? `${result.marginPct}% margin — thin but workable. Consider raising price.`
              : `Losing money at this price. Go back and find a cheaper supplier or freight option.`
            }
          />

          {result.verdict !== 'unprofitable' && (
            <Btn label="Numbers Check Out — Build the Brand →" color={DS.successText} onPress={confirm} />
          )}
          {result.verdict === 'unprofitable' && (
            <Btn label="Override and Continue Anyway" color={DS.danger} outline onPress={confirm} />
          )}
        </View>
      )}
    </View>
  );
}

// ── Stage: Brand (redirects to Brand Studio) ──────────────────────────────────

function StageBrand({ session, onComplete }: {
  session: BuilderSession;
  onComplete: (data: BrandData) => void;
}) {
  const navigation = useNavigation<any>();
  const productName = session.discovery?.product.title ?? '';

  return (
    <View style={brd.card}>
      <Text style={brd.heading}>Brand Studio</Text>
      <Text style={brd.body}>
        Create your brand identity, logo, listing copy, and packaging in Brand Studio — Siftly's dedicated brand workspace.
      </Text>
      <TouchableOpacity
        style={brd.primaryBtn}
        onPress={() => navigation.navigate('BrandStudio')}
        activeOpacity={0.85}
      >
        <Text style={brd.primaryBtnTxt}>Open Brand Studio →</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={brd.skipBtn}
        onPress={() => onComplete({
          brandName: productName,
          tagline: '',
          productTitle: productName,
          bulletPoints: [],
          productDescription: '',
          backendKeywords: [],
        })}
        activeOpacity={0.7}
      >
        <Text style={brd.skipBtnTxt}>Skip for now — continue build</Text>
      </TouchableOpacity>
    </View>
  );
}

const brd = StyleSheet.create({
  card:         { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1.5, borderColor: DS.border, padding: DS.cardPadding, gap: DS.cardGap },
  heading:      { fontSize: 17, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  body:         { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  primaryBtn:   { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  primaryBtnTxt:{ fontSize: 15, fontWeight: '700', color: DS.bgCard },
  skipBtn:      { alignItems: 'center', paddingVertical: 8 },
  skipBtnTxt:   { fontSize: 13, color: DS.textMuted, fontWeight: '500' },
});

// ── Stage: Complete ───────────────────────────────────────────────────────────

function StageComplete({ session, onPublish }: {
  session: BuilderSession;
  onPublish: () => void;
}) {
  const d = session.discovery;
  const c = session.calculations;
  const b = session.brand;
  const s = session.supplier;
  const fr = session.freight;

  if (session.winnerEntry) {
    return (
      <View style={{ alignItems: 'center', gap: 16, paddingVertical: 12 }}>
        <Text style={{ fontSize: 48 }}>🏆</Text>
        <Text style={stg.missionTitle}>In the Winner Vault</Text>
        <Text style={{ fontSize: 13, color: DS.textSecondary, textAlign: 'center' }}>
          {b?.brandName} is saved to your Winner Vault on the Launch tab.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 16 }}>
      <Text style={stg.missionTitle}>🏆 Launch Ready!</Text>

      {/* 6-row summary table */}
      <View style={{ gap: 0, borderRadius: 16, borderWidth: 1.5, borderColor: DS.border, overflow: 'hidden' }}>
        {d && (
          <View style={stg.summaryRow}>
            <Text style={stg.summaryLabel}>Product</Text>
            <Text style={stg.summaryValue} numberOfLines={2}>{d.product.title}</Text>
          </View>
        )}
        {b && (
          <View style={stg.summaryRow}>
            <Text style={stg.summaryLabel}>Brand</Text>
            <Text style={stg.summaryValue}>{b.brandName}</Text>
          </View>
        )}
        {s && (
          <View style={stg.summaryRow}>
            <Text style={stg.summaryLabel}>Supplier</Text>
            <Text style={stg.summaryValue}>{s.name} · ${s.unitCost.toFixed(2)}/unit</Text>
          </View>
        )}
        {fr && (
          <View style={stg.summaryRow}>
            <Text style={stg.summaryLabel}>Freight</Text>
            <Text style={stg.summaryValue}>{fr.modeLabel} · {fr.transitDays}d</Text>
          </View>
        )}
        {c && (
          <>
            <View style={stg.summaryRow}>
              <Text style={stg.summaryLabel}>Margin</Text>
              <Text style={[stg.summaryValue, { color: DS.successText, fontWeight: '800' }]}>{c.marginPct}%</Text>
            </View>
            <View style={[stg.summaryRow, { borderBottomWidth: 0 }]}>
              <Text style={stg.summaryLabel}>Est. Monthly Profit</Text>
              <Text style={[stg.summaryValue, { color: DS.successText, fontWeight: '800' }]}>${c.monthlyProfitEst.toLocaleString()}</Text>
            </View>
          </>
        )}
      </View>

      {/* Gold publish button */}
      <TouchableOpacity style={stg.publishBtn} onPress={onPublish} activeOpacity={0.85}>
        <Text style={stg.publishBtnTxt}>🏆  Publish to Winner Vault</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Passed Stage Detail Panels ────────────────────────────────────────────────

function PassedDiscoveryDetail({ session, onGoBack }: { session: BuilderSession; onGoBack?: () => void }) {
  const d = session.discovery;
  if (!d) return null;
  const comp = d.product.competition;
  const compColor = comp === 'Low' ? DS.successText : comp === 'High' ? DS.danger : DS.warning;
  return (
    <View style={{ gap: 10 }}>
      <Text style={sc.summaryTxt} numberOfLines={2}>{d.product.title}</Text>
      <StatRow stats={[
        { label: 'Price',       value: `$${d.product.price.toFixed(2)}` },
        { label: 'Reviews',     value: (d.product.reviewCount ?? 0).toLocaleString() },
        { label: 'Competition', value: comp, color: compColor },
      ]} />
      {onGoBack && <TouchableOpacity onPress={onGoBack}><Text style={sc.goBack}>Change product</Text></TouchableOpacity>}
    </View>
  );
}

function PassedAnalysisDetail({ session, onGoBack }: { session: BuilderSession; onGoBack?: () => void }) {
  const a = session.analysis;
  if (!a) return null;
  const isLaunch = a.verdict === 'LAUNCH'; const isTest = a.verdict === 'TEST';
  const color = isLaunch ? DS.successText : isTest ? DS.warning : DS.danger;
  return (
    <View style={{ gap: 10 }}>
      <View style={[stg.verdictHero, { backgroundColor: color + '12', borderColor: color + '40', paddingVertical: 12 }]}>
        <Text style={[stg.verdictWord, { fontSize: 22, color }]}>{a.verdict}</Text>
        <View style={stg.confBarTrack}>
          <View style={[stg.confBarFill, { width: `${a.confidence}%` as any, backgroundColor: color }]} />
        </View>
        <Text style={[stg.confLabel, { color }]}>Confidence: {a.confidence}/100</Text>
      </View>
      <Text style={stg.analysisSummary} numberOfLines={3}>{a.summary}</Text>
      {(a.reasons ?? []).slice(0, 3).map((r, i) => (
        <View key={i} style={stg.reasonRow}>
          <Text style={{ color, fontSize: 12 }}>•</Text>
          <Text style={stg.reasonTxt}>{r}</Text>
        </View>
      ))}
      {onGoBack && <TouchableOpacity onPress={onGoBack}><Text style={sc.goBack}>Re-run analysis</Text></TouchableOpacity>}
    </View>
  );
}

function PassedSupplierDetail({ session, onGoBack }: { session: BuilderSession; onGoBack?: () => void }) {
  const s = session.supplier;
  if (!s) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={sc.summaryTxt}>{s.name}</Text>
      <StatRow stats={[
        { label: 'Unit Price', value: `$${s.unitCost.toFixed(2)}` },
        { label: 'MOQ',        value: String(s.moq) },
        { label: 'Budget fit', value: s.fitsProfileBudget ? 'Yes ✓' : 'Over', color: s.fitsProfileBudget ? DS.successText : DS.warning },
      ]} />
      {onGoBack && <TouchableOpacity onPress={onGoBack}><Text style={sc.goBack}>Change supplier</Text></TouchableOpacity>}
    </View>
  );
}

function PassedFreightDetail({ session, onGoBack }: { session: BuilderSession; onGoBack?: () => void }) {
  const fr = session.freight;
  if (!fr) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={sc.summaryTxt}>{fr.modeLabel}</Text>
      <StatRow stats={[
        { label: 'Cost/Unit', value: `$${fr.costPerUnit.toFixed(2)}` },
        { label: 'Total',     value: `$${fr.totalCost.toLocaleString()}` },
        { label: 'Days',      value: String(fr.transitDays) },
      ]} />
      {onGoBack && <TouchableOpacity onPress={onGoBack}><Text style={sc.goBack}>Change method</Text></TouchableOpacity>}
    </View>
  );
}

function PassedCalculationsDetail({ session, onGoBack }: { session: BuilderSession; onGoBack?: () => void }) {
  const c = session.calculations;
  if (!c) return null;
  const marginColor = c.marginPct >= 20 ? DS.successText : c.marginPct >= 0 ? DS.warning : DS.danger;
  return (
    <View style={{ gap: 10 }}>
      <Text style={[stg.calcBig, { color: marginColor }]}>${c.netProfit.toFixed(2)} <Text style={{ fontSize: 14, fontWeight: '600' }}>net profit/unit</Text></Text>
      <StatRow stats={[
        { label: 'Margin',   value: `${c.marginPct}%`, color: marginColor },
        { label: 'ROI',      value: `${c.roiPct}%`,    color: marginColor },
      ]} />
      <StatRow stats={[
        { label: 'Monthly Revenue', value: `$${(c.sellingPrice * c.monthlyUnitsEst).toLocaleString()}` },
        { label: 'Monthly Profit',  value: `$${c.monthlyProfitEst.toLocaleString()}`, color: marginColor },
      ]} />
      {/* Full P&L */}
      <View style={{ gap: 4 }}>
        {[
          { label: 'Selling Price', value: `$${c.sellingPrice.toFixed(2)}`, sign: '' },
          { label: '− Unit Cost',   value: `−$${c.unitCost.toFixed(2)}`,   sign: 'neg' },
          { label: '− Freight/unit',value: `−$${c.freightPerUnit.toFixed(2)}`, sign: 'neg' },
          { label: '− FBA Fee',     value: `−$${c.fbaFee.toFixed(2)}`,     sign: 'neg' },
          { label: '− PPC/unit',    value: `−$${c.ppcPerUnit.toFixed(2)}`, sign: 'neg' },
        ].map((row, i) => (
          <View key={i} style={stg.plRow}>
            <Text style={stg.plLabel}>{row.label}</Text>
            <Text style={[stg.plValue, row.sign === 'neg' && { color: DS.danger }]}>{row.value}</Text>
          </View>
        ))}
      </View>
      {onGoBack && <TouchableOpacity onPress={onGoBack}><Text style={sc.goBack}>Recalculate</Text></TouchableOpacity>}
    </View>
  );
}

function PassedBrandDetail({ session, onGoBack }: { session: BuilderSession; onGoBack?: () => void }) {
  const b = session.brand;
  if (!b) return null;
  return (
    <View style={{ gap: 10 }}>
      <Text style={stg.brandNameBig}>{b.brandName}</Text>
      {!!b.tagline && <Text style={stg.brandTagline}>"{b.tagline}"</Text>}
      {!!b.productTitle && (
        <View style={stg.brandAsset}>
          <Text style={stg.eyebrow}>LISTING TITLE</Text>
          <Text style={stg.brandAssetValue} numberOfLines={2}>{b.productTitle}</Text>
        </View>
      )}
      {b.bulletPoints.length > 0 && (
        <View style={{ gap: 4 }}>
          {b.bulletPoints.slice(0, 3).map((bp, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={{ color: '#7C3AED', fontWeight: '900' }}>•</Text>
              <Text style={[stg.brandAssetValue, { fontSize: 12, flex: 1 }]}>{bp}</Text>
            </View>
          ))}
        </View>
      )}
      {b.backendKeywords.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {b.backendKeywords.slice(0, 5).map((kw, i) => (
            <View key={i} style={stg.kwChip}><Text style={stg.kwChipTxt}>{kw}</Text></View>
          ))}
        </View>
      )}
      {onGoBack && <TouchableOpacity onPress={onGoBack}><Text style={sc.goBack}>Rebuild</Text></TouchableOpacity>}
    </View>
  );
}

// ── Pipeline stage card ───────────────────────────────────────────────────────

function StageCard({
  stage, status, session, isLast,
  onComplete, onGoBack, scrollRef, cardRef,
}: {
  stage: BuilderStage;
  status: 'locked' | 'active' | 'passed' | 'soft_fail';
  session: BuilderSession;
  isLast: boolean;
  onComplete: (data: any) => void;
  onGoBack?: () => void;
  scrollRef: React.RefObject<ScrollView | null>;
  cardRef: React.RefObject<View | null>;
}) {
  const [expanded, setExpanded] = useState(false);
  const accent = STAGE_ACCENT[stage];
  const label  = STAGE_LABELS[stage];
  const icon   = STAGE_ICONS[stage];

  const isPassed = status === 'passed' || status === 'soft_fail';
  const isActive = status === 'active';
  const isLocked = status === 'locked';

  // One-line summary chip for collapsed passed state
  function CollapsedChip() {
    if (stage === 'discovery' && session.discovery) {
      const p = session.discovery.product;
      return <Text style={sc.summaryMeta} numberOfLines={1}>${p.price.toFixed(2)} · {p.competition} competition</Text>;
    }
    if (stage === 'analysis' && session.analysis) {
      return <Text style={sc.summaryMeta}>{session.analysis.verdict} · {session.analysis.confidence}/100</Text>;
    }
    if (stage === 'supplier' && session.supplier) {
      return <Text style={sc.summaryMeta}>{session.supplier.name} · ${session.supplier.unitCost.toFixed(2)}/unit</Text>;
    }
    if (stage === 'freight' && session.freight) {
      return <Text style={sc.summaryMeta}>{session.freight.modeLabel} · ${session.freight.costPerUnit.toFixed(2)}/unit</Text>;
    }
    if (stage === 'calculations' && session.calculations) {
      return <Text style={sc.summaryMeta}>{session.calculations.marginPct}% margin · ${session.calculations.monthlyProfitEst.toLocaleString()}/mo</Text>;
    }
    if (stage === 'brand' && session.brand) {
      return <Text style={sc.summaryMeta}>{session.brand.brandName} · {session.brand.tagline}</Text>;
    }
    return null;
  }

  return (
    <View ref={cardRef} style={[sc.card, isActive && { borderColor: accent, borderWidth: 2 }, isPassed && sc.cardPassed, isLocked && sc.cardLocked]}>
      {/* ── Card header ──────────────────────────────────────────── */}
      <TouchableOpacity
        style={sc.header}
        onPress={isPassed ? () => setExpanded(e => !e) : undefined}
        activeOpacity={isPassed ? 0.7 : 1}
      >
        <View style={[sc.iconWrap, { backgroundColor: isLocked ? DS.bgElevated : accent + '20' }]}>
          <Text style={[sc.iconTxt, { color: isLocked ? DS.textMuted : accent }]}>{isLocked ? '🔒' : icon}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[sc.stageName, isLocked && { color: DS.textMuted }]}>{label}</Text>
          {isPassed && <Text style={[sc.stageStatus, { color: DS.successText }]}>✓ Complete{status === 'soft_fail' ? ' (override)' : ''}</Text>}
          {isActive  && <Text style={[sc.stageStatus, { color: accent }]}>Your turn →</Text>}
          {isLocked  && <Text style={[sc.stageStatus, { color: DS.textMuted }]}>Locked</Text>}
        </View>
        {isPassed && (
          <Text style={{ fontSize: 16, color: DS.textMuted, fontWeight: '700' }}>{expanded ? '∨' : '›'}</Text>
        )}
      </TouchableOpacity>

      {/* ── Passed: collapsed chip or expanded detail ─────────────── */}
      {isPassed && !expanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <CollapsedChip />
        </View>
      )}

      {isPassed && expanded && (
        <View style={sc.expandedContent}>
          {stage === 'discovery'    && <PassedDiscoveryDetail    session={session} onGoBack={onGoBack} />}
          {stage === 'analysis'     && <PassedAnalysisDetail     session={session} onGoBack={onGoBack} />}
          {stage === 'supplier'     && <PassedSupplierDetail     session={session} onGoBack={onGoBack} />}
          {stage === 'freight'      && <PassedFreightDetail      session={session} onGoBack={onGoBack} />}
          {stage === 'calculations' && <PassedCalculationsDetail session={session} onGoBack={onGoBack} />}
          {stage === 'brand'        && <PassedBrandDetail        session={session} onGoBack={onGoBack} />}
        </View>
      )}

      {/* ── Active stage content ──────────────────────────────────── */}
      {isActive && (
        <View style={sc.activeContent}>
          {stage === 'discovery'    && <StageDiscovery    session={session} onComplete={onComplete} />}
          {stage === 'analysis'     && <StageAnalysis     session={session} onComplete={onComplete} />}
          {stage === 'supplier'     && <StageSupplier     session={session} onComplete={onComplete} />}
          {stage === 'freight'      && <StageFreight      session={session} onComplete={onComplete} />}
          {stage === 'calculations' && <StageCalculations session={session} onComplete={onComplete} />}
          {stage === 'brand'        && <StageBrand        session={session} onComplete={onComplete} />}
          {stage === 'complete'     && <StageComplete     session={session} onPublish={() => onComplete(null)} />}
        </View>
      )}
    </View>
  );
}

// ── Legacy Banner ─────────────────────────────────────────────────────────────

function LegacyBanner({ navigation }: { navigation: any }) {
  return (
    <View style={lb.banner}>
      <View style={lb.titleRow}>
        <Text style={lb.badge}>LEGACY</Text>
        <Text style={lb.title}>Legacy Builder</Text>
      </View>
      <Text style={lb.body}>
        This older builder is kept for reference. For the full current workflow, use the main tabs: Niche → Research → Sourcing → Profit → Brand.
      </Text>
      <View style={lb.actions}>
        <TouchableOpacity style={lb.btnPrimary} onPress={() => navigation.navigate('Main', { screen: 'Research' })} activeOpacity={0.85}>
          <Text style={lb.btnPrimaryTxt}>Go to Research →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={lb.btnSecondary} onPress={() => navigation.navigate('LaunchDecision')} activeOpacity={0.85}>
          <Text style={lb.btnSecondaryTxt}>Go to Launch Decision</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const lb = StyleSheet.create({
  banner:      { backgroundColor: DS.warning + '15', borderRadius: DS.radiusCard, borderWidth: 1.5, borderColor: DS.warning + '60', padding: 16, gap: 10 },
  titleRow:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge:       { fontSize: 9, fontWeight: '900', color: DS.warning, backgroundColor: DS.warning + '25', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, letterSpacing: 1.5 },
  title:       { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  body:        { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  actions:     { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  btnPrimary:  { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingHorizontal: 14, paddingVertical: 9 },
  btnPrimaryTxt: { fontSize: 12, fontWeight: '800', color: DS.bgCard },
  btnSecondary:  { backgroundColor: 'transparent', borderRadius: DS.radiusButton, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1.5, borderColor: DS.border },
  btnSecondaryTxt: { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
});

// ── Main Builder Screen ───────────────────────────────────────────────────────

export default function BuilderScreen() {
  const navigation = useNavigation<any>();
  const {
    loaded, activeSession, archivedSessions,
    startNewSession, abandonSession, goBackToStage,
    completeDiscovery, completeAnalysis, completeSupplier,
    completeFreight, completeCalculations, completeBrand, publishToVault,
  } = useBuilderSession();

  const scrollRef = useRef<ScrollView | null>(null);
  const cardRefs  = useRef<Record<string, React.RefObject<View | null>>>(
    Object.fromEntries(STAGE_ORDER.map(s => [s, React.createRef<View | null>()]))
  );
  const [publishing, setPublishing] = useState(false);
  const [published,  setPublished]  = useState(false);

  const session = activeSession;

  function scrollToStage(stage: BuilderStage) {
    const ref = cardRefs.current[stage];
    if (!ref?.current || !scrollRef.current) return;
    ref.current.measureLayout(
      scrollRef.current as any,
      (_x: number, y: number) => scrollRef.current?.scrollTo({ y: y - 20, animated: true }),
      () => {},
    );
  }

  async function handleComplete(stage: BuilderStage, data: any) {
    if (!session) return;
    switch (stage) {
      case 'discovery':    await completeDiscovery(session.id, data);    break;
      case 'analysis':     await completeAnalysis(session.id, data);     break;
      case 'supplier':     await completeSupplier(session.id, data);     break;
      case 'freight':      await completeFreight(session.id, data);      break;
      case 'calculations': await completeCalculations(session.id, data); break;
      case 'brand':        await completeBrand(session.id, data);        break;
      case 'complete':
        setPublishing(true);
        await publishToVault(session.id);
        setPublished(true);
        setPublishing(false);
        return;
    }
    const next = STAGE_ORDER[STAGE_ORDER.indexOf(stage) + 1];
    if (next) setTimeout(() => scrollToStage(next), 400);
  }

  async function handleGoBack(stage: BuilderStage) {
    if (!session) return;
    Alert.alert(
      'Go Back?',
      'You\'ll need to redo this stage and everything after it.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Go Back', style: 'destructive', onPress: async () => {
          await goBackToStage(session.id, stage);
          setTimeout(() => scrollToStage(stage), 300);
        }},
      ]
    );
  }

  async function handleAbandon() {
    if (!session) return;
    Alert.alert(
      'Abandon This Build?',
      'Your progress will be archived. You can start a new build anytime.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Abandon', style: 'destructive', onPress: () => abandonSession(session.id) },
      ]
    );
  }

  if (!loaded) {
    return (
      <SafeAreaView style={bs.safe}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <SkeletonDashboard />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Empty state — no active session ────────────────────────────────────────
  if (!session) {
    return (
      <SafeAreaView style={bs.safe}>
        <AppHeader helpKey="launchpad" />
        {navigation.canGoBack() && (
          <TouchableOpacity style={bs.backBar} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Text style={bs.backTxt}>← Back</Text>
          </TouchableOpacity>
        )}

        <ScrollView style={{ flex: 1 }} contentContainerStyle={bs.emptyContent} showsVerticalScrollIndicator={false}>
          <LegacyBanner navigation={navigation} />
          {/* Hero icon orb */}
          <View style={bs.heroOrb}>
            <View style={bs.heroOrbInner}>
              <Text style={bs.heroOrbIcon}>◈</Text>
            </View>
            <Text style={bs.heroCaption}>YOUR PRODUCT PIPELINE</Text>
          </View>

          <View style={bs.stepsPreview}>
            {STAGE_ORDER.filter(s => s !== 'complete').map((s, i, arr) => (
              <View key={s} style={[bs.stepRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                <View style={[bs.stepNum, { backgroundColor: STAGE_ACCENT[s] + '20' }]}>
                  <Text style={[bs.stepNumTxt, { color: STAGE_ACCENT[s] }]}>{i + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={bs.stepLabel}>{STAGE_LABELS[s]}</Text>
                </View>
                <Text style={[bs.stepIcon, { color: STAGE_ACCENT[s] + '80' }]}>{STAGE_ICONS[s]}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={bs.startBtn} onPress={startNewSession} activeOpacity={0.85}>
            <Text style={bs.startBtnTxt}>Start New LaunchPad →</Text>
          </TouchableOpacity>

          {/* Product Blueprint card */}
          <TouchableOpacity
            style={bs.blueprintCard}
            onPress={() => navigation.navigate('ProductBlueprint')}
            activeOpacity={0.85}
          >
            <View style={bs.blueprintLeft}>
              <Text style={bs.blueprintIcon}>◈</Text>
              <View style={{ flex: 1 }}>
                <Text style={bs.blueprintLabel}>PRODUCT BLUEPRINT</Text>
                <Text style={bs.blueprintTitle}>The complete Siftly roadmap</Text>
                <Text style={bs.blueprintSub}>5 phases · From niche to launch</Text>
              </View>
            </View>
            <Text style={bs.blueprintArrow}>→</Text>
          </TouchableOpacity>

          {archivedSessions.length > 0 && (
            <View style={{ gap: 8 }}>
              <Text style={bs.archiveTitle}>Past builds</Text>
              {archivedSessions.slice(0, 3).map(s => (
                <View key={s.id} style={bs.archiveCard}>
                  <Text style={bs.archiveProduct} numberOfLines={1}>
                    {s.discovery?.product.title ?? 'Abandoned early'}
                  </Text>
                  <Text style={bs.archiveMeta}>
                    {s.status === 'complete' ? '✅ Complete' : '⬡ Abandoned'} · {new Date(s.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Active session — pipeline view ─────────────────────────────────────────

  const currentIdx = STAGE_ORDER.indexOf(session.currentStage);
  const progress   = currentIdx / (STAGE_ORDER.length - 1);

  return (
    <SafeAreaView style={bs.safe}>
      {navigation.canGoBack() && (
        <TouchableOpacity style={bs.backBar} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={bs.backTxt}>← Back</Text>
        </TouchableOpacity>
      )}
      <View style={bs.header}>
        <View style={bs.headerTop}>
          <Text style={bs.eyebrow}>LAUNCHPAD · STEP {currentIdx + 1}/{STAGE_ORDER.length}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <HelpButton featureKey="launchpad" size="sm" />
            <TouchableOpacity onPress={handleAbandon} style={bs.abandonBtn}>
              <Text style={bs.abandonTxt}>Abandon</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={bs.heroTitle}>{STAGE_LABELS[session.currentStage]}</Text>
        <View style={bs.progressTrack}>
          <View style={[bs.progressFill, { width: `${progress * 100}%` as any }]} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={bs.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <LegacyBanner navigation={navigation} />
        {STAGE_ORDER.map((stage, i) => (
          <StageCard
            key={stage}
            stage={stage}
            status={session.stages[stage]}
            session={session}
            isLast={i === STAGE_ORDER.length - 1}
            onComplete={(data) => handleComplete(stage, data)}
            onGoBack={session.stages[stage] === 'passed' || session.stages[stage] === 'soft_fail'
              ? () => handleGoBack(stage)
              : undefined}
            scrollRef={scrollRef}
            cardRef={cardRefs.current[stage] as React.RefObject<View | null>}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stage card styles ─────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  card: {
    backgroundColor: DS.bgCard, borderRadius: 16, borderWidth: 1.5, borderColor: DS.border,
    overflow: 'hidden',
  },
  cardPassed: { borderColor: DS.successText + '50', backgroundColor: DS.successBg },
  cardLocked: { opacity: 0.5 },

  header:   { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconTxt:  { fontSize: 18 },

  stageName:   { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  stageStatus: { fontSize: 11, fontWeight: '600', marginTop: 1 },

  summary:     { paddingHorizontal: 16, paddingBottom: 14, gap: 3 },
  summaryTxt:  { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  summaryMeta: { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  goBack:      { fontSize: 11, color: DS.accent, fontWeight: '700', marginTop: 6 },

  expandedContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 0 },
  activeContent:   { paddingHorizontal: 16, paddingBottom: 16 },
});

// ── Shared stage styles ───────────────────────────────────────────────────────

const stg = StyleSheet.create({
  eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase', color: DS.textMuted },

  searchBtn:    { width: 48, height: 48, backgroundColor: DS.accent, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  searchBtnTxt: { fontSize: 18, color: DS.bgCard, fontWeight: '700' },

  resultCard:    { borderRadius: 16, borderWidth: 1.5, borderColor: DS.border, backgroundColor: DS.bgCard, padding: 14, gap: 4 },
  resultCardSel: { borderColor: DS.accent },
  resultTitle:   { fontSize: 14, fontWeight: '700', color: DS.textPrimary, flex: 1, lineHeight: 20 },
  resultMeta:    { fontSize: 12, color: DS.textSecondary },
  resultBadge:   { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },

  verdictHero:   { borderRadius: 16, borderWidth: 1.5, padding: 16, gap: 6 },
  verdictWord:   { fontSize: 30, fontWeight: '900', letterSpacing: -0.8 },
  confBarTrack:  { height: 6, backgroundColor: DS.bgElevated, borderRadius: 3, overflow: 'hidden' },
  confBarFill:   { height: 6, borderRadius: 3 },
  confLabel:     { fontSize: 11, fontWeight: '700' },
  analysisSummary: { fontSize: 14, color: DS.textSecondary, lineHeight: 21 },
  reasonRow:     { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonTxt:     { fontSize: 13, color: DS.textPrimary, lineHeight: 20, flex: 1 },

  calcRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: DS.border },
  calcLabel: { fontSize: 10, fontWeight: '700', color: DS.textMuted, letterSpacing: 1 },
  calcValue: { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  calcBig:   { fontSize: 26, fontWeight: '900', letterSpacing: -0.8 },

  plRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  plLabel:   { fontSize: 12, color: DS.textSecondary, fontWeight: '600' },
  plValue:   { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  plDivider: { height: 1, backgroundColor: DS.border, marginVertical: 4 },

  brandAsset:      { backgroundColor: DS.bgElevated, borderRadius: 12, padding: 12, gap: 4 },
  brandAssetLabel: { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  brandAssetValue: { fontSize: 14, color: DS.textPrimary, lineHeight: 20 },
  brandNameBig:    { fontSize: 24, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  brandTagline:    { fontSize: 14, color: DS.textSecondary, fontStyle: 'italic', lineHeight: 20 },

  kwChip:    { backgroundColor: DS.bgElevated, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: DS.border },
  kwChipTxt: { fontSize: 11, fontWeight: '600', color: DS.textSecondary },

  summaryRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: DS.border },
  summaryLabel: { fontSize: 12, color: DS.textMuted, fontWeight: '600' },
  summaryValue: { fontSize: 13, fontWeight: '700', color: DS.textPrimary, flex: 1, textAlign: 'right' },

  missionTitle: { fontSize: 22, fontWeight: '900', color: DS.textPrimary, textAlign: 'center', letterSpacing: -0.6 },

  publishBtn:    { backgroundColor: DS.warningText, borderRadius: 14, paddingVertical: 18, alignItems: 'center', width: '100%' },
  publishBtnTxt: { fontSize: 16, fontWeight: '900', color: DS.bgCard, letterSpacing: -0.3 },
});

// ── Screen-level styles ───────────────────────────────────────────────────────

const bs = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  content: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
  backBar: {
    paddingHorizontal: DS.pagePadding,
    paddingVertical:   8,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  backTxt: { fontSize: 13, fontWeight: '700', color: DS.accent },

  header:          { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12, gap: 3, backgroundColor: DS.bgCard, borderBottomWidth: 1, borderBottomColor: DS.border },
  headerTop:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  eyebrow:         { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },
  heroTitle:       { fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6 },
  heroSub:         { fontSize: 13, color: DS.textSecondary, lineHeight: 18 },
  abandonBtn:      { paddingHorizontal: 10, paddingVertical: 4 },
  abandonTxt:      { fontSize: 12, fontWeight: '700', color: DS.textMuted },
  progressTrack:   { height: 4, backgroundColor: DS.bgElevated, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  progressFill:    { height: 4, backgroundColor: DS.accent, borderRadius: 2 },

  emptyContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60, alignItems: 'center', gap: 20 },

  heroOrb:        { alignItems: 'center', gap: 12 },
  heroOrbInner:   {
    width: 80, height: 80, borderRadius: 26,
    backgroundColor: DS.accentLight,
    borderWidth: 1.5, borderColor: DS.accent + '35',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14, shadowRadius: 16, elevation: 4,
  },
  heroOrbIcon:  { fontSize: 38, color: DS.accent },
  heroCaption:  { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2.5 },

  stepsPreview: { alignSelf: 'stretch', gap: 0, backgroundColor: DS.bgCard, borderRadius: 16, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  stepRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: DS.border },
  stepNum:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stepNumTxt:   { fontSize: 11, fontWeight: '900' },
  stepLabel:    { fontSize: 14, fontWeight: '600', color: DS.textPrimary },
  stepIcon:     { fontSize: 16 },

  startBtn:     { alignSelf: 'stretch', backgroundColor: DS.accent, borderRadius: 16, paddingVertical: 18, alignItems: 'center' },
  startBtnTxt:  { fontSize: 16, fontWeight: '900', color: DS.bgCard, letterSpacing: -0.3 },

  blueprintCard: {
    alignSelf:        'stretch',
    backgroundColor:  DS.bgCard,
    borderRadius:     DS.radiusCard,
    borderWidth:      1.5,
    borderColor:      DS.accent + '30',
    padding:          16,
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
  },
  blueprintLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  blueprintIcon:  { fontSize: 24, color: DS.accent },
  blueprintLabel: { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2, marginBottom: 2 },
  blueprintTitle: { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  blueprintSub:   { fontSize: 11, color: DS.textSecondary, marginTop: 1 },
  blueprintArrow: { fontSize: 18, color: DS.accent, fontWeight: '700' },

  archiveTitle:   { fontSize: 12, fontWeight: '700', color: DS.textMuted, letterSpacing: 1 },
  archiveCard:    { backgroundColor: DS.bgCard, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 4 },
  archiveProduct: { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  archiveMeta:    { fontSize: 11, color: DS.textMuted },
});
