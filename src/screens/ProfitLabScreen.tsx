import React, { useState, useMemo, useCallback } from 'react';
import {
  ScrollView, StyleSheet, View, Text, TouchableOpacity,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppCard,
  SectionHeader,
  StatusBadge,
  InputField,
  PrimaryButton,
  SecondaryButton,
  DS,
} from '../components/ds';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CalcInputs {
  sellingPrice:  string;
  productCost:   string;
  freight:       string;
  fbaFees:       string;
  referralFee:   string;
  duties:        string;
  packaging:     string;
  unitsOrdered:  string;
}

// ── Default mock values (produces $7.84 net, 32% margin, 86% ROI) ─────────────

const DEFAULT_INPUTS: CalcInputs = {
  sellingPrice: '24.49',
  productCost:  '5.20',
  freight:      '2.10',
  fbaFees:      '4.50',
  referralFee:  '3.67',
  duties:       '0.73',
  packaging:    '0.45',
  unitsOrdered: '500',
};

// ── Live calculation ──────────────────────────────────────────────────────────

interface ComputedProfit {
  netProfit:   number;
  margin:      number;   // %
  roi:         number;   // %
  totalCost:   number;
  sellingPrice:number;
  isViable:    boolean;
  costRows: { label: string; value: string }[];
}

interface SavedCalculation {
  inputs:    CalcInputs;
  netProfit: number;
  margin:    number;
  roi:       number;
  savedAt:   string;
}

function computeFromInputs(inputs: CalcInputs): ComputedProfit {
  const p      = (k: keyof CalcInputs) => parseFloat(inputs[k]) || 0;
  const sell   = p('sellingPrice');
  const cogs   = p('productCost');
  const freight= p('freight');
  const fba    = p('fbaFees');
  const ref    = p('referralFee');
  const duties = p('duties');
  const pack   = p('packaging');

  const totalCost = cogs + freight + fba + ref + duties + pack;
  const netProfit = sell - totalCost;
  const margin    = sell > 0 ? (netProfit / sell) * 100 : 0;
  const investBase= cogs + freight + duties + pack;
  const roi       = investBase > 0 ? (netProfit / investBase) * 100 : 0;

  const fmt = (v: number) => `$${Math.abs(v).toFixed(2)}`;
  return {
    netProfit,
    margin,
    roi,
    totalCost,
    sellingPrice: sell,
    isViable: netProfit > 0 && margin >= 15,
    costRows: [
      { label: 'Product Cost',   value: fmt(cogs)    },
      { label: 'Freight',        value: fmt(freight) },
      { label: 'Amazon Fees',    value: fmt(fba)     },
      { label: 'Referral Fee',   value: fmt(ref)     },
      { label: 'Duties & Taxes', value: fmt(duties)  },
      { label: 'Packaging',      value: fmt(pack)    },
    ],
  };
}

// ── Profit summary card ───────────────────────────────────────────────────────

function ProfitSummaryCard({ computed }: { computed: ComputedProfit }) {
  const profitStr  = `${computed.netProfit < 0 ? '-' : ''}$${Math.abs(computed.netProfit).toFixed(2)}`;
  const marginStr  = `${computed.margin.toFixed(1)}%`;
  const roiStr     = `${computed.roi.toFixed(0)}%`;
  const badgeLabel = computed.netProfit <= 0 ? 'Loss' : computed.isViable ? 'Healthy Margin' : 'Thin Margin';
  const badgeVariant: 'success' | 'warning' | 'danger' =
    computed.netProfit <= 0 ? 'danger' : computed.isViable ? 'success' : 'warning';

  return (
    <AppCard style={ps.card}>
      {/* Hero metric */}
      <View style={ps.hero}>
        <View style={ps.heroLeft}>
          <Text style={ps.heroLabel}>Estimated Net Profit</Text>
          <Text style={[ps.heroValue, { color: computed.netProfit < 0 ? DS.danger : DS.accent }]}>
            {profitStr}
          </Text>
          <Text style={ps.heroUnit}>per unit</Text>
        </View>
        <StatusBadge label={badgeLabel} variant={badgeVariant} dot style={ps.badge} />
      </View>

      {/* Secondary metrics */}
      <View style={ps.metrics}>
        <View style={ps.metric}>
          <View style={[ps.metricIcon, { backgroundColor: DS.accentLight }]}>
            <Text style={[ps.metricGlyph, { color: DS.accent }]}>%</Text>
          </View>
          <Text style={[ps.metricValue, { color: computed.margin < 15 ? DS.warning : DS.accent }]}>
            {marginStr}
          </Text>
          <Text style={ps.metricLabel}>Margin</Text>
        </View>

        <View style={ps.divider} />

        <View style={ps.metric}>
          <View style={[ps.metricIcon, { backgroundColor: DS.indigoLight }]}>
            <Text style={[ps.metricGlyph, { color: DS.indigo }]}>↑</Text>
          </View>
          <Text style={[ps.metricValue, { color: computed.roi < 30 ? DS.warning : DS.indigo }]}>
            {roiStr}
          </Text>
          <Text style={ps.metricLabel}>ROI</Text>
        </View>

        <View style={ps.divider} />

        <View style={ps.metric}>
          <View style={[ps.metricIcon, { backgroundColor: DS.bgSubtle }]}>
            <Text style={ps.metricGlyph}>◈</Text>
          </View>
          <Text style={ps.metricValue}>${computed.sellingPrice.toFixed(2)}</Text>
          <Text style={ps.metricLabel}>Sell Price</Text>
        </View>

        <View style={ps.divider} />

        <View style={ps.metric}>
          <View style={[ps.metricIcon, { backgroundColor: DS.bgSubtle }]}>
            <Text style={ps.metricGlyph}>⊞</Text>
          </View>
          <Text style={ps.metricValue}>${computed.totalCost.toFixed(2)}</Text>
          <Text style={ps.metricLabel}>Total Cost</Text>
        </View>
      </View>
    </AppCard>
  );
}

const ps = StyleSheet.create({
  card:       { gap: 20 },
  hero: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            12,
  },
  heroLeft:   { gap: 2 },
  heroLabel: {
    fontSize:   11, fontWeight: '700', color: DS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },
  heroValue: {
    fontSize: 40, fontWeight: '900', color: DS.accent,
    letterSpacing: -1.5, lineHeight: 46,
  },
  heroUnit:   { fontSize: 12, color: DS.textMuted, fontWeight: '500', marginTop: -4 },
  badge:      { marginTop: 4 },
  metrics: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.bgSubtle, borderRadius: 16, padding: 16,
  },
  metric:     { flex: 1, alignItems: 'center', gap: 5 },
  metricIcon: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  metricGlyph: { fontSize: 13, fontWeight: '800', color: DS.textSecondary },
  metricValue: {
    fontSize: 15, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4,
  },
  metricLabel: {
    fontSize: 9, fontWeight: '600', color: DS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  divider: { width: 1, height: 32, backgroundColor: DS.border },
});

// ── Calculator inputs card ────────────────────────────────────────────────────

function CalculatorInputsCard({
  inputs,
  onChange,
}: {
  inputs: CalcInputs;
  onChange: (k: keyof CalcInputs, v: string) => void;
}) {
  const field = (
    key: keyof CalcInputs,
    label: string,
    icon: string,
    prefix: string = '$',
  ) => (
    <InputField
      key={key}
      label={label}
      value={inputs[key]}
      onChangeText={v => onChange(key, v)}
      leadingIcon={icon}
      hint={prefix === '$' ? 'Per unit' : undefined}
      keyboardType="decimal-pad"
      returnKeyType="next"
    />
  );

  return (
    <AppCard style={ci.card}>
      <View style={ci.header}>
        <View style={ci.headerIcon}>
          <Text style={ci.headerGlyph}>◈</Text>
        </View>
        <Text style={ci.headerTitle}>Calculator Inputs</Text>
      </View>

      <View style={ci.grid}>
        {field('sellingPrice', 'Selling Price',        '💰')}
        {field('productCost',  'Product Cost',         '🏭')}
        {field('freight',      'Freight / Shipping',   '🚢')}
        {field('fbaFees',      'Amazon FBA Fees',      '📦')}
        {field('referralFee',  'Referral Fee',         '✦')}
        {field('duties',       'Duties / Taxes',       '🏛')}
        {field('packaging',    'Packaging Cost',       '🎁')}

        <InputField
          label="Units Ordered"
          value={inputs.unitsOrdered}
          onChangeText={v => onChange('unitsOrdered', v)}
          leadingIcon="📊"
          hint="Total inventory order"
          keyboardType="number-pad"
          returnKeyType="done"
        />
      </View>
    </AppCard>
  );
}

const ci = StyleSheet.create({
  card: { gap: 20 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: '#F5F0FF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerGlyph: { fontSize: 16, color: '#7C3AED' },
  headerTitle: {
    fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4,
  },
  grid: { gap: DS.cardGap },
});

// ── Cost breakdown card ───────────────────────────────────────────────────────

function CostBreakdownCard({ computed }: { computed: ComputedProfit }) {
  const profitStr = `${computed.netProfit < 0 ? '-' : ''}$${Math.abs(computed.netProfit).toFixed(2)}`;

  return (
    <AppCard style={cb.card}>
      <View style={cb.header}>
        <View style={cb.headerIcon}>
          <Text style={cb.headerGlyph}>⊞</Text>
        </View>
        <Text style={cb.headerTitle}>Cost Breakdown</Text>
      </View>

      <View style={cb.rows}>
        {computed.costRows.map((row, i) => (
          <View key={i} style={[cb.row, i < computed.costRows.length - 1 && cb.rowBorder]}>
            <Text style={cb.rowLabel}>{row.label}</Text>
            <Text style={cb.rowValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      {/* Total section */}
      <View style={cb.totalSection}>
        <View style={cb.totalRow}>
          <Text style={cb.totalLabel}>Total Landed Cost</Text>
          <Text style={cb.totalValue}>${computed.totalCost.toFixed(2)}</Text>
        </View>
        <View style={cb.totalDivider} />
        <View style={cb.totalRow}>
          <View>
            <Text style={cb.profitLabel}>Net Profit / Unit</Text>
            <Text style={cb.profitSub}>After all deductions</Text>
          </View>
          <Text style={[cb.profitValue, { color: computed.netProfit < 0 ? DS.danger : DS.accent }]}>
            {profitStr}
          </Text>
        </View>
      </View>
    </AppCard>
  );
}

const cb = StyleSheet.create({
  card: { gap: 18 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: DS.indigoLight,
    alignItems: 'center', justifyContent: 'center',
  },
  headerGlyph: { fontSize: 16, color: DS.indigo },
  headerTitle: { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4 },
  rows:       { gap: 0 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 11,
  },
  rowBorder:  { borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  rowLabel:   { fontSize: 14, color: DS.textSecondary, fontWeight: '500' },
  rowValue:   { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  totalSection: {
    backgroundColor: DS.bgSubtle, borderRadius: 16, padding: 16, gap: 10,
  },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  totalValue: { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  totalDivider: { height: 1, backgroundColor: DS.border },
  profitLabel:  { fontSize: 14, fontWeight: '800', color: DS.accent },
  profitSub:    { fontSize: 11, color: DS.textMuted, marginTop: 1 },
  profitValue:  { fontSize: 24, fontWeight: '900', color: DS.accent, letterSpacing: -0.8 },
});

// ── Freight comparison card ───────────────────────────────────────────────────

interface FreightOption {
  mode:     string;
  icon:     string;
  cost:     string;
  days:     string;
  bestFor:  string;
  recommended: boolean;
}

const FREIGHT_OPTIONS: FreightOption[] = [
  {
    mode:        'Air Freight',
    icon:        '✈',
    cost:        '$2.80/kg',
    days:        '7–14 days',
    bestFor:     'Urgent restocks & small parcels',
    recommended: false,
  },
  {
    mode:        'Sea Freight',
    icon:        '🚢',
    cost:        '$0.40/kg',
    days:        '30–45 days',
    bestFor:     'Large bulk orders',
    recommended: true,
  },
];

const FreightComparisonCard = React.memo(function FreightComparisonCard() {
  const [selected, setSelected] = useState<string>('Sea Freight');

  return (
    <AppCard style={fc.card}>
      <View style={fc.header}>
        <View style={fc.headerIcon}>
          <Text style={fc.headerGlyph}>🚢</Text>
        </View>
        <Text style={fc.headerTitle}>Freight Comparison</Text>
      </View>

      <View style={fc.options}>
        {FREIGHT_OPTIONS.map(opt => {
          const active = selected === opt.mode;
          return (
            <TouchableOpacity
              key={opt.mode}
              style={[fc.option, active && fc.optionActive]}
              onPress={() => setSelected(opt.mode)}
              activeOpacity={0.8}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
            >
              <View style={fc.optionTop}>
                <View style={fc.optionLeft}>
                  <Text style={fc.optionIcon}>{opt.icon}</Text>
                  <View>
                    <Text style={[fc.optionMode, active && fc.optionModeActive]}>
                      {opt.mode}
                    </Text>
                    <Text style={fc.optionBestFor}>{opt.bestFor}</Text>
                  </View>
                </View>
                {opt.recommended && (
                  <StatusBadge label="Recommended" variant="success" />
                )}
              </View>

              <View style={fc.optionStats}>
                <View style={fc.stat}>
                  <Text style={[fc.statValue, active && { color: DS.accent }]}>
                    {opt.cost}
                  </Text>
                  <Text style={fc.statLabel}>Est. Cost</Text>
                </View>
                <View style={fc.statDivider} />
                <View style={fc.stat}>
                  <Text style={[fc.statValue, active && { color: DS.accent }]}>
                    {opt.days}
                  </Text>
                  <Text style={fc.statLabel}>Delivery</Text>
                </View>
              </View>

              {active && (
                <View style={fc.selectedDot} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </AppCard>
  );
});

const fc = StyleSheet.create({
  card: { gap: 18 },
  header:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: {
    width: 32, height: 32, borderRadius: 10, backgroundColor: '#EFF8FF',
    alignItems: 'center', justifyContent: 'center',
  },
  headerGlyph: { fontSize: 16 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4 },
  options:    { gap: 10 },
  option: {
    borderWidth: 1.5, borderColor: DS.border, borderRadius: 18,
    padding: 16, gap: 12, position: 'relative', overflow: 'hidden',
  },
  optionActive: {
    borderColor: DS.accent,
    backgroundColor: '#F0FDF8',
  },
  optionTop:   { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  optionLeft:  { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flex: 1 },
  optionIcon:  { fontSize: 22, marginTop: 1 },
  optionMode:  { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  optionModeActive: { color: DS.accentDark },
  optionBestFor: { fontSize: 11, color: DS.textMuted, marginTop: 2 },
  optionStats: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 12,
  },
  stat:        { flex: 1, alignItems: 'center', gap: 2 },
  statValue:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  statLabel: {
    fontSize: 9, fontWeight: '600', color: DS.textMuted,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  statDivider: { width: 1, height: 24, backgroundColor: DS.border },
  selectedDot: {
    position: 'absolute', top: 12, right: 12,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: DS.accent,
  },
});

// ── Profit health indicators ──────────────────────────────────────────────────

function ProfitHealthCard({ computed }: { computed: ComputedProfit }) {
  const marginV: 'success'|'warning'|'danger' = computed.margin >= 30 ? 'success' : computed.margin >= 15 ? 'warning' : 'danger';
  const roiV:    'success'|'warning'|'danger' = computed.roi    >= 50 ? 'success' : computed.roi    >= 20 ? 'warning' : 'danger';
  const riskV:   'success'|'warning'|'danger' = computed.isViable ? 'success' : 'warning';

  const indicators = [
    { label: 'Margin', value: computed.margin >= 30 ? 'Good' : computed.margin >= 15 ? 'Fair' : 'Low',     variant: marginV, icon: '↑' },
    { label: 'ROI',    value: computed.roi    >= 50 ? 'Strong' : computed.roi >= 20 ? 'Fair' : 'Low',      variant: roiV,    icon: '✦' },
    { label: 'Risk',   value: computed.isViable ? 'Low' : 'Medium',                                        variant: riskV,   icon: '⚠' },
  ] as const;

  return (
    <AppCard padding={16} style={ph.card}>
      <Text style={ph.title}>Profit Health</Text>
      <View style={ph.row}>
        {indicators.map(h => (
          <View key={h.label} style={ph.item}>
            <View style={[ph.iconWrap, { backgroundColor: h.variant === 'success' ? DS.accentLight : h.variant === 'warning' ? DS.warningBg : DS.dangerBg }]}>
              <Text style={[ph.icon, { color: h.variant === 'success' ? DS.accent : h.variant === 'warning' ? DS.warning : DS.danger }]}>
                {h.icon}
              </Text>
            </View>
            <StatusBadge label={h.value} variant={h.variant} uppercase style={ph.badge} />
            <Text style={ph.itemLabel}>{h.label}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const ph = StyleSheet.create({
  card:     { gap: 14 },
  title: {
    fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3,
  },
  row:      { flexDirection: 'row', justifyContent: 'space-around' },
  item:     { alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  icon:      { fontSize: 20, fontWeight: '800' },
  badge:     { alignSelf: 'center' },
  itemLabel: { fontSize: 11, fontWeight: '600', color: DS.textMuted },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfitLabScreen() {
  const [inputs,    setInputs]    = useState<CalcInputs>(DEFAULT_INPUTS);
  const [committed, setCommitted] = useState<CalcInputs>(DEFAULT_INPUTS);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError,   setSaveError]   = useState('');

  function handleChange(key: keyof CalcInputs, value: string) {
    setInputs(prev => ({ ...prev, [key]: value }));
  }

  const computed = useMemo(() => computeFromInputs(committed), [committed]);

  function handleRecalculate() {
    setCommitted({ ...inputs });
    setSaveSuccess(false);
  }

  const handleSaveCalculation = useCallback(async () => {
    setSaveLoading(true);
    setSaveSuccess(false);
    setSaveError('');
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.savedCalculations);
      const existing: SavedCalculation[] = raw ? JSON.parse(raw) : [];
      const entry: SavedCalculation = {
        inputs:    committed,
        netProfit: computed.netProfit,
        margin:    computed.margin,
        roi:       computed.roi,
        savedAt:   new Date().toISOString(),
      };
      const next = [entry, ...existing].slice(0, 50);
      await AsyncStorage.setItem(STORAGE_KEYS.savedCalculations, JSON.stringify(next));
      setSaveSuccess(true);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save. Please try again.');
    } finally {
      setSaveLoading(false);
    }
  }, [committed, computed]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* ── Pinned header ─────────────────────────────────── */}
      <View style={s.header}>
        <Text style={s.eyebrow}>PROFIT LAB</Text>
        <Text style={s.heroTitle}>Calculate Real Profit</Text>
        <Text style={s.heroSub}>
          Estimate Amazon fees, freight, duties, and margins before you buy inventory.
        </Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Profit summary */}
        <ProfitSummaryCard computed={computed} />

        {/* Inputs */}
        <SectionHeader
          title="Calculator Inputs"
          subtitle="Edit values then tap Recalculate"
          style={s.sectionHead}
        />
        <CalculatorInputsCard inputs={inputs} onChange={handleChange} />

        {/* Cost breakdown */}
        <SectionHeader
          title="Cost Breakdown"
          style={s.sectionHead}
        />
        <CostBreakdownCard computed={computed} />

        {/* Freight */}
        <SectionHeader
          title="Freight Options"
          subtitle="Select your shipping method"
          style={s.sectionHead}
        />
        <FreightComparisonCard />

        {/* Health */}
        <SectionHeader
          title="Profit Health"
          style={s.sectionHead}
        />
        <ProfitHealthCard computed={computed} />

        {/* Actions */}
        <View style={s.actions}>
          {saveSuccess && (
            <View style={s.saveBanner}>
              <Text style={s.saveBannerIcon}>✓</Text>
              <Text style={s.saveBannerText}>Calculation saved</Text>
            </View>
          )}
          {saveError !== '' && (
            <View style={[s.saveBanner, s.saveBannerError]}>
              <Text style={s.saveBannerText}>{saveError}</Text>
            </View>
          )}
          <PrimaryButton
            label="Recalculate Profit"
            onPress={handleRecalculate}
            icon="◈"
          />
          <SecondaryButton
            label={saveLoading ? 'Saving...' : saveSuccess ? 'Saved ✓' : 'Save Calculation'}
            onPress={handleSaveCalculation}
            icon="✦"
            disabled={saveLoading}
            loading={saveLoading}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgCanvas },

  header: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        16,
    paddingBottom:     14,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    gap:               3,
  },
  eyebrow: {
    fontSize: 9, fontWeight: '800', color: '#7C3AED',
    letterSpacing: 2.5,
  },
  heroTitle: {
    fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7,
  },
  heroSub: {
    fontSize: 13, color: DS.textSecondary, lineHeight: 18,
  },

  scroll:  { flex: 1 },
  content: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        DS.sectionGap,
    paddingBottom:     80,
    gap:               DS.sectionGap,
  },
  sectionHead: { marginBottom: -8 },
  actions:     { gap: 10, paddingTop: 4 },

  saveBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: DS.accentLight, borderRadius: 10, padding: 12,
  },
  saveBannerError: { backgroundColor: DS.dangerBg },
  saveBannerIcon:  { fontSize: 14, color: DS.accent, fontWeight: '800' },
  saveBannerText:  { fontSize: 13, color: DS.accentDark, fontWeight: '600', flex: 1 },
});
