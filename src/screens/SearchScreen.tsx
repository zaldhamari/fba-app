import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Modal, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow } from '../theme';
import ResearchScreen   from './ResearchScreen';
import SuppliersScreen  from './SuppliersScreen';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import {
  calculateShipping, buildQuoteEmail,
  ShippingInputs, ShippingResult, ShipOrigin, ShipMarket, Incoterms,
} from '../utils/shippingCalcs';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'search' | 'suppliers' | 'shipping';

// ─── Shipping Tab ─────────────────────────────────────────────────────────────

const ORIGINS:  { key: ShipOrigin; label: string }[] = [
  { key: 'CN', label: '🇨🇳 China' },
  { key: 'VN', label: '🇻🇳 Vietnam' },
  { key: 'IN', label: '🇮🇳 India' },
  { key: 'TR', label: '🇹🇷 Turkey' },
];
const MARKETS:  { key: ShipMarket; label: string }[] = [
  { key: 'US', label: '🇺🇸 US' },
  { key: 'UK', label: '🇬🇧 UK' },
  { key: 'DE', label: '🇩🇪 DE' },
  { key: 'CA', label: '🇨🇦 CA' },
];
const INCOTERMS: { key: Incoterms; label: string; desc: string }[] = [
  { key: 'FOB', label: 'FOB', desc: 'Seller loads at origin port' },
  { key: 'EXW', label: 'EXW', desc: 'You arrange all shipping (+$300)' },
  { key: 'DDP', label: 'DDP', desc: 'All-in, seller handles customs (+12%)' },
];

const SHIPPING_COUNT_KEY = 'fba_shipping_count_v1';

function NumInput({
  label, value, onChange, suffix, hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  suffix?: string; hint?: string;
}) {
  return (
    <View style={ni.wrap}>
      <Text style={ni.label}>{label}</Text>
      <View style={ni.row}>
        <TextInput
          style={[ni.input, suffix ? { flex: 1 } : {}]}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholderTextColor={colors.textMuted}
          placeholder="0"
        />
        {suffix ? <Text style={ni.suffix}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={ni.hint}>{hint}</Text> : null}
    </View>
  );
}

const ni = StyleSheet.create({
  wrap:   { flex: 1, gap: 4 },
  label:  { fontSize: 8, fontWeight: '800' as const, color: colors.textMuted, letterSpacing: 1.5 },
  hint:   { fontSize: 10, color: colors.textMuted, lineHeight: 14, marginTop: 2 },
  row:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 7,
    fontSize: 14, color: colors.textPrimary, backgroundColor: colors.bgElevated,
    minWidth: 50,
  },
  suffix: { fontSize: 12, color: colors.textMuted, fontWeight: '600' as const },
});

function ShippingTab() {
  const { tier } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);
  const [calcCount, setCalcCount]     = useState(0);
  const [result, setResult]           = useState<ShippingResult | null>(null);
  const [showEmail, setShowEmail]     = useState(false);
  const [emailText, setEmailText]     = useState('');
  const [copied, setCopied]           = useState(false);

  // Form state
  const [units,           setUnits]           = useState('500');
  const [unitWt,          setUnitWt]          = useState('0.3');
  const [unitL,           setUnitL]           = useState('20');
  const [unitW,           setUnitW]           = useState('15');
  const [unitH,           setUnitH]           = useState('5');
  const [cartonUnits,     setCartonUnits]     = useState('50');
  const [cartonWt,        setCartonWt]        = useState('16');
  const [cartonL,         setCartonL]         = useState('60');
  const [cartonW,         setCartonW]         = useState('40');
  const [cartonH,         setCartonH]         = useState('35');
  const [productCost,     setProductCost]     = useState('4.50');
  const [sellingPrice,    setSellingPrice]    = useState('24.99');
  const [origin,          setOrigin]          = useState<ShipOrigin>('CN');
  const [market,          setMarket]          = useState<ShipMarket>('US');
  const [incoterms,       setIncoterms]       = useState<Incoterms>('FOB');
  const [duty,            setDuty]            = useState('5');
  const [tariff,          setTariff]          = useState('0');

  const p = (s: string) => parseFloat(s) || 0;

  async function onCalculate() {
    // Load usage count
    const raw = await AsyncStorage.getItem(SHIPPING_COUNT_KEY);
    const count = raw ? parseInt(raw, 10) : 0;

    if (tier === 'explorer' && count >= 1) {
      setShowPaywall(true);
      return;
    }

    const inputs: ShippingInputs = {
      units:          p(units),
      unitWeightKg:   p(unitWt),
      lengthCm:       p(unitL),
      widthCm:        p(unitW),
      heightCm:       p(unitH),
      cartonUnits:    p(cartonUnits),
      cartonWeightKg: p(cartonWt),
      cartonLengthCm: p(cartonL),
      cartonWidthCm:  p(cartonW),
      cartonHeightCm: p(cartonH),
      productCostUsd: p(productCost),
      sellingPriceUsd:p(sellingPrice),
      marketplace:    market,
      origin,
      incoterms,
      dutyPct:        p(duty),
      tariffPct:      p(tariff),
    };

    const res = calculateShipping(inputs);
    setResult(res);

    const newCount = count + 1;
    setCalcCount(newCount);
    await AsyncStorage.setItem(SHIPPING_COUNT_KEY, String(newCount));
  }

  function openEmail() {
    if (!result) return;
    const inputs: ShippingInputs = {
      units: p(units), unitWeightKg: p(unitWt),
      lengthCm: p(unitL), widthCm: p(unitW), heightCm: p(unitH),
      cartonUnits: p(cartonUnits), cartonWeightKg: p(cartonWt),
      cartonLengthCm: p(cartonL), cartonWidthCm: p(cartonW), cartonHeightCm: p(cartonH),
      productCostUsd: p(productCost), sellingPriceUsd: p(sellingPrice),
      marketplace: market, origin, incoterms,
      dutyPct: p(duty), tariffPct: p(tariff),
    };
    setEmailText(buildQuoteEmail(inputs, result));
    setShowEmail(true);
    setCopied(false);
  }

  const marginColor = (pct: number) => pct >= 25 ? colors.green : pct >= 10 ? colors.amber : colors.red;

  return (
    <ScrollView
      contentContainerStyle={fr.scroll}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="research" />

      {/* Email modal */}
      <Modal visible={showEmail} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEmail(false)}>
        <View style={fr.emailSheet}>
          <View style={fr.emailHeader}>
            <Text style={fr.emailTitle}>Quote Email Template</Text>
            <TouchableOpacity onPress={() => setShowEmail(false)}>
              <Text style={fr.emailClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={fr.emailBody}>{emailText}</Text>
          </ScrollView>
          <View style={fr.emailFooter}>
            <TouchableOpacity
              style={fr.copyBtn}
              onPress={() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            >
              <Text style={fr.copyBtnText}>{copied ? '✓ Copied' : 'Copy Email'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Cargo section ────────────────────────────────────── */}
      <Text style={fr.sectionLabel}>CARGO</Text>
      <View style={fr.card}>
        <View style={fr.row2}>
          <NumInput label="TOTAL UNITS" value={units} onChange={setUnits} />
          <NumInput label="UNIT WEIGHT" value={unitWt} onChange={setUnitWt} suffix="kg" />
        </View>
        <Text style={fr.subsectionLabel}>UNIT DIMENSIONS (cm)</Text>
        <View style={fr.row3}>
          <NumInput label="L" value={unitL} onChange={setUnitL} />
          <NumInput label="W" value={unitW} onChange={setUnitW} />
          <NumInput label="H" value={unitH} onChange={setUnitH} />
        </View>
        <Text style={fr.subsectionLabel}>CARTON</Text>
        <View style={fr.row2}>
          <NumInput label="UNITS/CARTON" value={cartonUnits} onChange={setCartonUnits} />
          <NumInput label="CARTON WEIGHT" value={cartonWt} onChange={setCartonWt} suffix="kg" />
        </View>
        <Text style={fr.subsectionLabel}>CARTON DIMENSIONS (cm)</Text>
        <View style={fr.row3}>
          <NumInput label="L" value={cartonL} onChange={setCartonL} />
          <NumInput label="W" value={cartonW} onChange={setCartonW} />
          <NumInput label="H" value={cartonH} onChange={setCartonH} />
        </View>
      </View>

      {/* ── Economics ────────────────────────────────────────── */}
      <Text style={fr.sectionLabel}>ECONOMICS</Text>
      <View style={fr.card}>
        <View style={fr.row2}>
          <NumInput label="COST/UNIT" value={productCost} onChange={setProductCost} suffix="$" hint="FOB price from supplier" />
          <NumInput label="SELL PRICE" value={sellingPrice} onChange={setSellingPrice} suffix="$" hint="Amazon listing price" />
        </View>
      </View>

      {/* ── Route ────────────────────────────────────────────── */}
      <Text style={fr.sectionLabel}>ROUTE</Text>
      <View style={fr.card}>
        <Text style={fr.chipLabel}>ORIGIN</Text>
        <View style={fr.chipRow}>
          {ORIGINS.map(o => (
            <TouchableOpacity key={o.key} style={[fr.chip, origin === o.key && fr.chipActive]} onPress={() => setOrigin(o.key)}>
              <Text style={[fr.chipText, origin === o.key && fr.chipTextActive]}>{o.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={[fr.chipLabel, { marginTop: spacing.sm }]}>DESTINATION MARKETPLACE</Text>
        <View style={fr.chipRow}>
          {MARKETS.map(m => (
            <TouchableOpacity key={m.key} style={[fr.chip, market === m.key && fr.chipActive]} onPress={() => setMarket(m.key)}>
              <Text style={[fr.chipText, market === m.key && fr.chipTextActive]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Trade Terms ──────────────────────────────────────── */}
      <Text style={fr.sectionLabel}>TRADE TERMS</Text>
      <View style={fr.card}>
        <Text style={fr.chipLabel}>INCOTERMS</Text>
        <View style={fr.chipRow}>
          {INCOTERMS.map(t => (
            <TouchableOpacity key={t.key} style={[fr.chip, incoterms === t.key && fr.chipActive]} onPress={() => setIncoterms(t.key)}>
              <Text style={[fr.chipText, incoterms === t.key && fr.chipTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {incoterms && (
          <Text style={ni.hint}>{INCOTERMS.find(t => t.key === incoterms)?.desc}</Text>
        )}
        <View style={[fr.row2, { marginTop: spacing.sm }]}>
          <NumInput label="IMPORT DUTY %" value={duty} onChange={setDuty} hint="Check trade.gov for your product" />
          <NumInput label="TARIFF %" value={tariff} onChange={setTariff} hint="Additional trade tariff if any" />
        </View>
      </View>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <TouchableOpacity style={fr.calcBtn} onPress={onCalculate} activeOpacity={0.85}>
        <Text style={fr.calcBtnText}>Calculate Shipping ⛵</Text>
      </TouchableOpacity>

      {tier === 'explorer' && (
        <Text style={fr.freeHint}>Explorer: 1 free calculation. Upgrade for unlimited.</Text>
      )}

      {/* ── Results ──────────────────────────────────────────── */}
      {result && (
        <>
          {/* Summary row */}
          <View style={fr.summaryRow}>
            <View style={fr.summaryItem}>
              <Text style={fr.summaryVal}>{result.cartons}</Text>
              <Text style={fr.summaryLabel}>CARTONS</Text>
            </View>
            <View style={fr.summaryDiv} />
            <View style={fr.summaryItem}>
              <Text style={fr.summaryVal}>{result.cbm.toFixed(2)}</Text>
              <Text style={fr.summaryLabel}>TOTAL CBM</Text>
            </View>
            <View style={fr.summaryDiv} />
            <View style={fr.summaryItem}>
              <Text style={fr.summaryVal}>{result.totalWeightKg.toFixed(0)} kg</Text>
              <Text style={fr.summaryLabel}>GROSS WT</Text>
            </View>
          </View>

          {/* Mode cards */}
          {result.modes.map(mode => (
            <View key={mode.mode} style={fr.modeCard}>
              <View style={fr.modeTop}>
                <Text style={fr.modeIcon}>{mode.icon}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={fr.modeLabel}>{mode.label}</Text>
                  <Text style={fr.modeTransit}>{mode.transitDays}</Text>
                </View>
                <View style={[fr.marginBadge, { backgroundColor: `${marginColor(mode.marginPct)}20` }]}>
                  <Text style={[fr.marginBadgeText, { color: marginColor(mode.marginPct) }]}>
                    {mode.marginPct.toFixed(0)}% margin
                  </Text>
                </View>
              </View>

              <View style={fr.modeStats}>
                <View style={fr.modeStat}>
                  <Text style={fr.modeStatVal}>${mode.totalShippingUsd.toFixed(0)}</Text>
                  <Text style={fr.modeStatLabel}>TOTAL FREIGHT</Text>
                </View>
                <View style={fr.modeStatDiv} />
                <View style={fr.modeStat}>
                  <Text style={fr.modeStatVal}>${mode.shippingPerUnit.toFixed(2)}</Text>
                  <Text style={fr.modeStatLabel}>FREIGHT/UNIT</Text>
                </View>
                <View style={fr.modeStatDiv} />
                <View style={fr.modeStat}>
                  <Text style={fr.modeStatVal}>${mode.landedCostPerUnit.toFixed(2)}</Text>
                  <Text style={fr.modeStatLabel}>LANDED/UNIT</Text>
                </View>
                <View style={fr.modeStatDiv} />
                <View style={fr.modeStat}>
                  <Text style={[fr.modeStatVal, { color: mode.profitPerUnit > 0 ? colors.green : colors.red }]}>
                    ${mode.profitPerUnit.toFixed(2)}
                  </Text>
                  <Text style={fr.modeStatLabel}>PROFIT/UNIT</Text>
                </View>
              </View>

              {/* Breakdown */}
              <View style={fr.breakdown}>
                {[
                  { label: 'Product cost', val: `$${parseFloat(productCost || '0').toFixed(2)}` },
                  { label: 'Freight/unit', val: `$${mode.shippingPerUnit.toFixed(2)}` },
                  { label: 'Duty/unit', val: `$${mode.dutyPerUnit.toFixed(2)}` },
                  { label: 'Tariff/unit', val: `$${mode.tariffPerUnit.toFixed(2)}` },
                  { label: 'FBA fees', val: `$${mode.fbaFeePerUnit.toFixed(2)}` },
                ].map(row => (
                  <View key={row.label} style={fr.breakdownRow}>
                    <Text style={fr.breakdownLabel}>{row.label}</Text>
                    <Text style={fr.breakdownVal}>{row.val}</Text>
                  </View>
                ))}
                {mode.cbm !== undefined && (
                  <View style={fr.breakdownRow}>
                    <Text style={fr.breakdownLabel}>Shipment CBM</Text>
                    <Text style={fr.breakdownVal}>{mode.cbm.toFixed(2)} m³</Text>
                  </View>
                )}
                {mode.chargeableKg !== undefined && (
                  <View style={fr.breakdownRow}>
                    <Text style={fr.breakdownLabel}>Chargeable weight</Text>
                    <Text style={fr.breakdownVal}>{mode.chargeableKg.toFixed(1)} kg</Text>
                  </View>
                )}
              </View>
            </View>
          ))}

          {/* Recommendation */}
          <View style={fr.recCard}>
            <Text style={fr.recLabel}>AI RECOMMENDATION</Text>
            <Text style={fr.recText}>{result.recommendation}</Text>
          </View>

          {/* Quote email */}
          <TouchableOpacity style={fr.emailBtn} onPress={openEmail} activeOpacity={0.85}>
            <Text style={fr.emailBtnText}>Generate Quote Email Template →</Text>
          </TouchableOpacity>
        </>
      )}
    </ScrollView>
  );
}

// ─── SearchScreen ─────────────────────────────────────────────────────────────

const SEARCH_TABS: { key: Tab; icon: string; label: string }[] = [
  { key: 'search',   icon: '◎', label: 'Amazon' },
  { key: 'suppliers',icon: '⬡', label: 'Suppliers' },
  { key: 'shipping', icon: '⛵', label: 'Freight' },
];

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('search');

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Inner tab bar */}
      <View style={s.seg}>
        {SEARCH_TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={[s.segTab, tab === t.key && s.segActive]}
            onPress={() => setTab(t.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.segText, tab === t.key && s.segTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content — kept mounted to preserve state */}
      <View style={{ flex: 1 }}>
        <View style={[{ flex: 1 }, tab !== 'search'    && { display: 'none' }]}>
          <ResearchScreen  edges={[]} />
        </View>
        <View style={[{ flex: 1 }, tab !== 'suppliers' && { display: 'none' }]}>
          <SuppliersScreen edges={[]} />
        </View>
        <View style={[{ flex: 1 }, tab !== 'shipping'  && { display: 'none' }]}>
          <ShippingTab />
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FF' },
  seg:         { flexDirection: 'row', marginHorizontal: spacing.md, marginTop: spacing.sm, marginBottom: spacing.sm, backgroundColor: '#E8EDF5', borderRadius: radius.lg, padding: 3, borderWidth: 1, borderColor: '#D0DAF0' },
  segTab:      { flex: 1, paddingVertical: spacing.sm + 2, alignItems: 'center', borderRadius: radius.md - 2 },
  segActive:   { backgroundColor: '#fff', ...shadow.sm },
  segText:     { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  segTextActive:{ color: '#0D1B4B', fontWeight: '800' },
});

// ─── Freight tab styles ───────────────────────────────────────────────────────

const fr = StyleSheet.create({
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: 120, paddingTop: spacing.md, gap: spacing.sm },

  sectionLabel: {
    fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 2,
    marginBottom: 4, marginTop: spacing.sm,
  },
  subsectionLabel: {
    fontSize: 8, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5,
    marginTop: spacing.sm, marginBottom: 4,
  },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border,
    padding: spacing.md, gap: 4,
  },
  row2: { flexDirection: 'row', gap: spacing.sm },
  row3: { flexDirection: 'row', gap: spacing.sm },

  chipLabel: { fontSize: 8, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 6 },
  chipRow:   { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs + 2 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
  },
  chipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  chipText:     { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  chipTextActive:{ color: '#fff' },

  calcBtn: {
    backgroundColor: '#0284C7', borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.xs,
  },
  calcBtnText: { fontSize: 16, fontWeight: '800', color: '#fff' },
  freeHint: { fontSize: 11, color: colors.textMuted, textAlign: 'center', marginTop: 4 },

  // Summary
  summaryRow: {
    flexDirection: 'row', backgroundColor: colors.bgCard,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  summaryItem:  { flex: 1, alignItems: 'center', gap: 3 },
  summaryDiv:   { width: 1, backgroundColor: colors.border },
  summaryVal:   { fontSize: 18, fontWeight: '900', color: colors.textPrimary, letterSpacing: -0.5 },
  summaryLabel: { fontSize: 8, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.5 },

  // Mode card
  modeCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border, overflow: 'hidden',
    marginTop: spacing.sm,
  },
  modeTop: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modeIcon:    { fontSize: 22 },
  modeLabel:   { fontSize: 15, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  modeTransit: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  marginBadge: {
    borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  marginBadgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.2 },

  modeStats: {
    flexDirection: 'row', paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modeStat:     { flex: 1, alignItems: 'center', gap: 3 },
  modeStatDiv:  { width: 1, backgroundColor: colors.border },
  modeStatVal:  { fontSize: 14, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.3 },
  modeStatLabel:{ fontSize: 7, fontWeight: '700', color: colors.textMuted, letterSpacing: 1.2 },

  breakdown:    { padding: spacing.md, gap: 5 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between' },
  breakdownLabel:{ fontSize: 12, color: colors.textSecondary },
  breakdownVal:  { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  // Recommendation
  recCard: {
    backgroundColor: '#EEF7FF', borderRadius: radius.lg,
    borderWidth: 1, borderColor: 'rgba(2,132,199,0.22)',
    padding: spacing.md, gap: spacing.xs, marginTop: spacing.sm,
  },
  recLabel: { fontSize: 8, fontWeight: '800', color: '#0284C7', letterSpacing: 2 },
  recText:  { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },

  // Email
  emailBtn: {
    borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingVertical: spacing.sm + 4, alignItems: 'center',
    backgroundColor: colors.bgCard, marginTop: spacing.sm,
  },
  emailBtnText: { fontSize: 13, fontWeight: '700', color: '#0284C7' },

  // Email modal
  emailSheet: { flex: 1, backgroundColor: colors.bg },
  emailHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  emailTitle: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
  emailClose: { fontSize: 20, color: colors.textMuted, fontWeight: '300' },
  emailBody:  { fontSize: 12, color: colors.textSecondary, lineHeight: 19, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  emailFooter:{ padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border },
  copyBtn:    { backgroundColor: '#0284C7', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  copyBtnText:{ fontSize: 15, fontWeight: '800', color: '#fff' },
});
