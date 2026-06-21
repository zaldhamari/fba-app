/**
 * ProfitLabScreen — Multi-calculator Profit Lab
 *
 * 5 calculators accessed via a selector grid.
 * Only one workspace is shown at a time — no stacked scroll clutter.
 * Preserves the Siftly DS, card style, and all existing FBA logic.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  ScrollView, StyleSheet, View, Text, Modal,
  TouchableOpacity, TextInput, Linking, Alert,
  KeyboardTypeOptions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParseJSON } from '../utils/safeJSON';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppCard, SectionHeader, StatusBadge,
  InputField, PrimaryButton, SecondaryButton, DS,
} from '../components/ds';
import { STORAGE_KEYS } from '../constants/storage';
import { useCurrency } from '../context/CurrencyContext';
import { usePipeline } from '../context/PipelineContext';
import type { CurrencyCode, MarketplaceId } from '../context/CurrencyContext';
import { useActiveProduct } from '../context/ActiveProductContext';
import { HelpButton } from '../components/HelpModal';
import { AppHeader } from '../components/AppHeader';
import type { FeatureKey } from '../lib/featureHelp';
import { getMarketplaceProfile, getDutyRates } from '../constants/marketplaceProfiles';
import FeasibilityHeart from '../components/FeasibilityHeart';
import { EstimateLabel } from '../components/EstimateLabel';
import { useVault } from '../hooks/useVault';
import type { VaultEntry } from '../types/vault';
import { searchFreightCompanies } from '../lib/freightSearch';
import type { FreightCompanyResult, FreightPriority, FreightSearchResult, SavedFreightSelection } from '../lib/freightSearch';
import type { ShipOrigin, ShipMarket, ShipMode } from '../utils/shippingCalcs';
import { validateFinancialInputs, computeUnitEconomics } from '../lib/financialEngine';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import { useProductIntelligence } from '../hooks/useProductIntelligence';
import { useDecisionSimulation } from '../hooks/useDecisionSimulation';
import { DecisionSimulationPanel } from '../components/DecisionSimulationPanel';

// ─── Calculator registry ──────────────────────────────────────────────────────

type CalcType =
  | 'fba' | 'breakeven'
  | 'ppc' | 'freight' | 'duties';

const CALCS: {
  id: CalcType; icon: string; name: string; desc: string; badge?: string; summary: string;
}[] = [
  { id: 'fba',      icon: '🏆', name: 'FBA Profit',   desc: 'Full P&L',        badge: 'Default',   summary: 'Calculate your net profit, margin %, and ROI per unit after all Amazon fees. Use your landed cost as product cost — never the raw supplier quote.' },
  { id: 'breakeven',icon: '⚖️', name: 'Break-even',   desc: 'Units to profit',                     summary: 'Shows how many units you need to sell to recover your total investment. Enter a conservative launch velocity — 30-50% of what the top competitor sells.' },
  { id: 'ppc',      icon: '📣', name: 'PPC / ACoS',   desc: 'Ad budget calc',  badge: 'Popular',   summary: 'Calculates your break-even ACoS and recommended launch ad budget. Run this before setting your PPC spend — enter the result into Capital Estimator.' },
  { id: 'freight',  icon: '🚢', name: 'Freight Forwarders', desc: 'Compare & get quotes',          summary: 'Compares sea, air, and express shipping costs per unit and per shipment, then connects you with freight forwarders to request real quotes. For a quick shipping cost estimate, use the Freight tab in Sourcing.' },
  { id: 'duties',   icon: '🌐', name: 'Duties',       desc: 'Import taxes',                        summary: 'Estimates import duty and VAT by country and HS tariff code. Take the duty % result and enter it into Feasibility Check and Landed Cost.' },
];

// ─── Shared helpers ───────────────────────────────────────────────────────────

function n(s: string): number { const v = parseFloat(s); return isFinite(v) ? v : 0; }
function safe(v: number): number { return isFinite(v) ? v : 0; }

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={r.row}>
      <Text style={r.label}>{label}</Text>
      <Text style={[r.value, highlight && { color: DS.accent, fontWeight: '800' }]}>{value}</Text>
    </View>
  );
}
const r = StyleSheet.create({
  row:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: DS.border },
  label: { fontSize: 13, color: DS.textSecondary, flex: 1 },
  value: { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
});

function Field({
  label, value, onChange, placeholder,
  keyboard = 'decimal-pad', hint,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: KeyboardTypeOptions; hint?: string;
}) {
  return (
    <InputField
      label={label}
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={DS.textMuted}
      keyboardType={keyboard}
      hint={hint}
      containerStyle={fi.wrap}
    />
  );
}
const fi = StyleSheet.create({ wrap: { flex: 1, minWidth: 130 } });

function Pair({ children }: { children: React.ReactNode }) {
  return <View style={pair.row}>{children}</View>;
}
const pair = StyleSheet.create({ row: { flexDirection: 'row', gap: 10 } });

function CalcBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={cb.btn} onPress={onPress} activeOpacity={0.85}>
      <Text style={cb.txt}>{label}</Text>
    </TouchableOpacity>
  );
}
const cb = StyleSheet.create({
  btn: {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  txt: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});

// ─── Accuracy Badge ───────────────────────────────────────────────────────────

type AccuracyLevel = 'exact' | 'planning' | 'verify';

function AccuracyBadge({ level }: { level: AccuracyLevel }) {
  const cfg: Record<AccuracyLevel, { label: string; bg: string; color: string }> = {
    exact:    { label: '✓ Exact Math',         bg: DS.successBg,  color: DS.successText },
    planning: { label: '~ Planning Estimate',   bg: DS.warningBg,  color: DS.warningText },
    verify:   { label: '⚠ Needs Verification', bg: DS.dangerBg,   color: DS.dangerText  },
  };
  const c = cfg[level];
  return (
    <View style={[ab.badge, { backgroundColor: c.bg }]}>
      <Text style={[ab.txt, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}
const ab = StyleSheet.create({
  badge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  txt:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});

// ─── Confidence Bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ score }: { score: number }) {
  const color = score >= 67 ? DS.success : score >= 34 ? DS.warning : DS.danger;
  const label = score >= 67 ? 'High Confidence' : score >= 34 ? 'Moderate Confidence' : 'Low Confidence';
  return (
    <View style={cob.wrap}>
      <View style={cob.labelRow}>
        <Text style={cob.label}>{label}</Text>
        <Text style={[cob.pct, { color }]}>{score}%</Text>
      </View>
      <View style={cob.track}>
        <View style={[cob.fill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={cob.sub}>Based on inputs provided</Text>
    </View>
  );
}
const cob = StyleSheet.create({
  wrap:     { gap: 4 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between' },
  label:    { fontSize: 11, fontWeight: '600', color: DS.textSecondary },
  pct:      { fontSize: 11, fontWeight: '800' },
  track:    { height: 5, backgroundColor: DS.border, borderRadius: 3, overflow: 'hidden' },
  fill:     { height: 5, borderRadius: 3 },
  sub:      { fontSize: 10, color: DS.textMuted },
});

// ─── Verification Checklist ───────────────────────────────────────────────────

// ─── Scenario Config ──────────────────────────────────────────────────────────

type Scenario = 'conservative' | 'expected' | 'optimistic';

const SCENARIO_CFG: Record<Scenario, { label: string; freightMult: number; dutyMult: number }> = {
  conservative: { label: 'Conservative', freightMult: 1.20, dutyMult: 1.15 },
  expected:     { label: 'Expected',     freightMult: 1.00, dutyMult: 1.00 },
  optimistic:   { label: 'Optimistic',   freightMult: 0.90, dutyMult: 0.90 },
};

// ─── Calculator Selector ──────────────────────────────────────────────────────

function CalcSelector({ active, onSelect }: { active: CalcType; onSelect: (id: CalcType) => void }) {
  const [expanded, setExpanded] = useState(active !== 'fba');
  const activeCalcInfo = CALCS.find(c => c.id === active) ?? CALCS[0];
  const otherCalcs = CALCS.filter(c => c.id !== active);

  if (expanded) {
    return (
      <View style={sel.expandedWrap}>
        <Text style={sel.expandedTitle}>Calculators</Text>
        <Text style={sel.expandedSub}>Select a workspace</Text>

        <TouchableOpacity style={sel.featuredTile} onPress={() => setExpanded(false)} activeOpacity={0.85}>
          {activeCalcInfo.badge && (
            <View style={[sel.featBadge, activeCalcInfo.badge === 'Popular' && sel.featBadgeAmber]}>
              <Text style={sel.featBadgeTxt}>{activeCalcInfo.badge.toUpperCase()}</Text>
            </View>
          )}
          <Text style={sel.featIcon}>{activeCalcInfo.icon}</Text>
          <Text style={sel.featName}>{activeCalcInfo.name}</Text>
          <Text style={sel.featDesc}>{activeCalcInfo.desc}</Text>
        </TouchableOpacity>

        <View style={sel.grid}>
          {otherCalcs.map(c => (
            <TouchableOpacity
              key={c.id}
              style={sel.tile}
              onPress={() => { onSelect(c.id); setExpanded(false); }}
              activeOpacity={0.8}
            >
              {c.badge && (
                <View style={[sel.tileBadge, c.badge === 'Popular' && sel.tileBadgeAmber]}>
                  <Text style={[sel.tileBadgeTxt, c.badge === 'Popular' && sel.tileBadgeTxtAmber]}>
                    {c.badge.toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={sel.tileIcon}>{c.icon}</Text>
              <Text style={sel.tileName}>{c.name}</Text>
              <Text style={sel.tileDesc}>{c.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={sel.doneBtn} onPress={() => setExpanded(false)} activeOpacity={0.85}>
          <Text style={sel.doneTxt}>Done ▲</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AppCard style={sel.card}>
      <TouchableOpacity style={sel.headerRow} onPress={() => setExpanded(true)} activeOpacity={0.75}>
        <Text style={sel.activeIcon}>{activeCalcInfo.icon}</Text>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={sel.heading}>{activeCalcInfo.name}</Text>
          <Text style={sel.activeSub}>{activeCalcInfo.desc}</Text>
        </View>
        <Text style={sel.switchLink}>Switch ▼</Text>
      </TouchableOpacity>
      <Text style={sel.descLine}>{activeCalcInfo.summary}</Text>
    </AppCard>
  );
}
const sel = StyleSheet.create({
  card:           { gap: 8 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  activeIcon:     { fontSize: 26 },
  heading:        { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  activeSub:      { fontSize: 12, color: DS.textMuted },
  switchLink:     { fontSize: 13, fontWeight: '700', color: DS.accent },
  descLine:       { fontSize: 12, color: DS.textMuted, fontStyle: 'italic' as const, lineHeight: 17 },
  expandedWrap:   { gap: 14, paddingBottom: 8 },
  expandedTitle:  { fontSize: 26, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6, textAlign: 'center' as const },
  expandedSub:    { fontSize: 14, color: DS.textMuted, textAlign: 'center' as const, marginTop: -8 },
  featuredTile:   { borderWidth: 2, borderColor: DS.accent, borderRadius: 20, backgroundColor: DS.accentLight, padding: 20, alignItems: 'center' as const, gap: 6 },
  featBadge:      { position: 'absolute' as const, top: 12, right: 12, backgroundColor: DS.accent, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4 },
  featBadgeAmber: { backgroundColor: DS.warning },
  featBadgeTxt:   { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  featIcon:       { fontSize: 40 },
  featName:       { fontSize: 18, fontWeight: '800', color: DS.accent, letterSpacing: -0.3 },
  featDesc:       { fontSize: 13, color: DS.textMuted },
  grid:           { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47%', flex: 1, minHeight: 110,
    borderWidth: 1.5, borderColor: DS.border,
    borderRadius: 18, padding: 14,
    alignItems: 'center' as const, gap: 4,
    backgroundColor: DS.bgCard,
  },
  tileBadge:      { backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3 },
  tileBadgeAmber: { backgroundColor: DS.warning + '20' },
  tileBadgeTxt:   { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 0.5 },
  tileBadgeTxtAmber: { color: DS.warning },
  tileIcon:       { fontSize: 30, marginBottom: 2 },
  tileName:       { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2, textAlign: 'center' as const },
  tileDesc:       { fontSize: 11, color: DS.textMuted, textAlign: 'center' as const },
  doneBtn:        { backgroundColor: DS.accent, borderRadius: 28, paddingVertical: 14, paddingHorizontal: 36, alignSelf: 'center' as const, marginTop: 4 },
  doneTxt:        { fontSize: 15, fontWeight: '800', color: '#fff' },
});

// ─── Pipeline action buttons (cost model + launch decision) ──────────────────

function PipelineActions({
  onSaveCostModel,
  costModelSaved,
}: {
  onSaveCostModel: () => void;
  costModelSaved: boolean;
}) {
  const navigation = useNavigation<any>();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onSaveCostModel();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <View style={pa.wrap}>
      <TouchableOpacity
        style={[pa.btn, pa.btnSave, costModelSaved && pa.btnSaved]}
        onPress={handleSave}
        activeOpacity={0.85}
      >
        <Text style={[pa.btnTxt, costModelSaved && pa.btnSavedTxt]}>
          {saved ? '✓ Cost Model Saved' : costModelSaved ? '✓ Update Cost Model' : '◉ Save Cost Model to Pipeline'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[pa.btn, pa.btnBrand]}
        onPress={() => navigation.navigate('BrandStudio' as any)}
        activeOpacity={0.85}
      >
        <Text style={pa.btnBrandTxt}>Continue to Brand Studio →</Text>
      </TouchableOpacity>
    </View>
  );
}

const pa = StyleSheet.create({
  wrap:         { gap: 8 },
  btn:          { borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center', borderWidth: 1 },
  btnSave:      { borderColor: DS.accent + '50', backgroundColor: DS.accentLight },
  btnSaved:     { borderColor: DS.success + '50', backgroundColor: DS.success + '10' },
  btnTxt:       { fontSize: 13, fontWeight: '800', color: DS.accent },
  btnSavedTxt:  { color: DS.success },
  btnBrand:     { backgroundColor: DS.bgCard, borderColor: DS.border },
  btnBrandTxt:  { fontSize: 13, fontWeight: '800', color: DS.textPrimary },
});

// ─── 1. FBA Profitability ─────────────────────────────────────────────────────

interface FBAInputs {
  sellingPrice: string; productCost: string; freight: string;
  fbaFees: string; referralFee: string; duties: string;
  packaging: string; unitsOrdered: string;
}
const FBA_DEFAULTS: FBAInputs = {
  sellingPrice: '', productCost: '', freight: '',
  fbaFees: '', referralFee: '', duties: '',
  packaging: '', unitsOrdered: '',
};

interface FBASaved {
  inputs: FBAInputs; netProfit: number; margin: number; roi: number; savedAt: string;
  currency: CurrencyCode; marketplaceId: MarketplaceId; amazonMarketplace: string;
  productName?: string; hsCode?: string; asin?: string; confidenceScore?: number;
}

const US_FEE_TIERS = [
  { tier: 'Small standard (≤ 1 lb)',   range: '$3.22 – $4.18' },
  { tier: 'Large standard (1–2 lbs)', range: '$5.25 – $6.33' },
  { tier: 'Large standard (2–3 lbs)', range: '$6.33 – $7.17' },
  { tier: 'Large standard (3+ lbs)', range: '$7.17 + $0.16/lb extra' },
  { tier: 'Oversize (small)',          range: '$9.73+' },
];

// Thin adapter — FBAWorkspace stores raw user input as strings; the actual
// profit/margin/ROI formula lives in financialEngine.computeUnitEconomics so
// Profit Lab and Sourcing never disagree.
function computeFBA(i: FBAInputs) {
  return computeUnitEconomics({
    sellingPrice: n(i.sellingPrice),
    productCost:  n(i.productCost),
    freight:      n(i.freight),
    fbaFees:      n(i.fbaFees),
    referralFee:  n(i.referralFee),
    duties:       n(i.duties),
    packaging:    n(i.packaging),
  });
}

function opportunityBg(opp: string): string {
  if (opp === 'Good') return DS.successBg;
  if (opp === 'Moderate') return DS.warningBg;
  return DS.dangerBg;
}
function opportunityFg(opp: string): string {
  if (opp === 'Good') return DS.successText;
  if (opp === 'Moderate') return DS.warningText;
  return DS.dangerText;
}

// ─── Advisor verdict ──────────────────────────────────────────────────────────
// Turns the computed P&L into a plain-English decision + the single best move
// (a taste of the reverse-calculator: the unit cost needed to hit a 30% margin).
// Additive — sits above Profit Health; the detailed sections below are unchanged.

function AdvisorVerdict({ c, productCost, fmtLocal }: {
  c: ReturnType<typeof computeFBA>;
  productCost: number;
  fmtLocal: (v: number) => string;
}) {
  const sell = c.sellingPrice;
  if (sell <= 0) return null;

  const tier =
    c.netProfit <= 0 ? 'loss' :
    c.margin < 15    ? 'thin' :
    c.margin < 25    ? 'workable' : 'strong';
  const color =
    tier === 'loss' || tier === 'thin' ? DS.danger :
    tier === 'workable'                ? DS.warning : DS.success;
  const headline =
    tier === 'loss'     ? 'Not viable — you lose money on every unit'        :
    tier === 'thin'     ? `Thin — ${c.margin.toFixed(0)}% margin is below the 20% FBA floor` :
    tier === 'workable' ? `Workable — ${c.margin.toFixed(0)}% margin, test before you scale` :
                          `Strong — ${c.margin.toFixed(0)}% margin, ${c.roi.toFixed(0)}% ROI`;

  const drivers = c.costAmounts.filter(x => x.label !== 'Total costs' && x.amount > 0);
  const top = drivers.length ? drivers.reduce((a, b) => (b.amount > a.amount ? b : a)) : null;

  const TARGET = 0.30;
  const otherCosts = c.totalCost - productCost;
  const neededCost = sell * (1 - TARGET) - otherCosts;
  const move =
    c.margin >= 30   ? 'Margins are healthy — lock in your supplier price.' :
    neededCost > 0   ? `Negotiate unit cost down to ${fmtLocal(neededCost)} to reach a 30% margin.` :
                       'Even free product won’t hit 30% here — raise the price or cut other costs.';

  return (
    <AppCard style={{ gap: 10, borderColor: color + '55', borderWidth: 1.5 }}>
      <View style={av.row}>
        <View style={[av.dot, { backgroundColor: color }]} />
        <Text style={[av.headline, { color }]}>{headline}</Text>
      </View>
      {top && (
        <Text style={av.line}>
          <Text style={av.k}>Biggest cost: </Text>{top.label} ({fmtLocal(top.amount)}/unit)
        </Text>
      )}
      <Text style={av.line}><Text style={av.k}>Your best move: </Text>{move}</Text>
    </AppCard>
  );
}

const av = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot:      { width: 8, height: 8, borderRadius: 4 },
  headline: { flex: 1, fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  line:     { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  k:        { fontWeight: '700', color: DS.textPrimary },
});

function FBAWorkspace({
  onSave, onUnsave, saveLoading, saveSuccess, saveError, latestEntry, activeProductPrice, activeProductName,
}: {
  onSave: (netProfit: number, margin: number, roi: number, inputs: FBAInputs, currency: CurrencyCode, marketplaceId: MarketplaceId, productName: string, hsCode: string, asin: string, confidenceScore: number) => void;
  onUnsave: () => void;
  saveLoading: boolean; saveSuccess: boolean; saveError: string;
  latestEntry: VaultEntry | null;
  activeProductPrice: number | null;
  activeProductName: string;
}) {
  const { fmtLocal, symbol, currency, marketplace } = useCurrency();
  const pipeline = usePipeline();
  const profile = getMarketplaceProfile(marketplace);
  const [inputs,            setInputs]            = useState<FBAInputs>(FBA_DEFAULTS);
  const [committed,         setCommitted]          = useState<FBAInputs>(FBA_DEFAULTS);
  const [productName,       setProductName]        = useState('');
  const [hsCode,            setHsCode]             = useState('');
  const [loadedAsin,        setLoadedAsin]         = useState('');
  const [autofillDone,      setAutofillDone]       = useState(false);
  const [scenario,          setScenario]           = useState<Scenario>('expected');
  const [showFeeHelper,     setShowFeeHelper]      = useState(false);
  const [showStressTest,    setShowStressTest]     = useState(false);

  // Restore last saved calculation so tapping "Open in Profit Lab" from home isn't blank.
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.savedCalculations).then(raw => {
      if (!raw) return;
      try {
        const list: FBASaved[] = JSON.parse(raw);
        if (list.length === 0) return;
        const last = list[list.length - 1];
        setInputs(last.inputs);
        setCommitted(last.inputs);
        if (last.productName) setProductName(last.productName);
        if (last.hsCode)      setHsCode(last.hsCode);
        if (last.asin)        setLoadedAsin(last.asin);
        setAutofillDone(true); // blocks vault pre-fill below
      } catch { /* ignore corrupt data */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pre-fill selling price from vault when no saved calculation exists.
  // Runs whenever latestEntry changes (vault loads async after mount).
  useEffect(() => {
    if (!latestEntry || autofillDone) return;
    AsyncStorage.getItem(STORAGE_KEYS.savedCalculations).then(raw => {
      if (autofillDone) return; // effect 1 may have completed while we waited
      if (raw) {
        try {
          const list: FBASaved[] = JSON.parse(raw);
          if (list.length > 0) return; // saved calc takes priority
        } catch { /* fall through */ }
      }
      const vaultPrice = latestEntry.product.price ?? latestEntry.analysis?.metrics.price ?? null;
      if (vaultPrice == null) return;
      // Use functional updates so we only fill if inputs are still at defaults
      setInputs(prev => {
        if (prev.sellingPrice !== '' && prev.sellingPrice !== FBA_DEFAULTS.sellingPrice) return prev;
        return { ...prev, sellingPrice: vaultPrice.toFixed(2) };
      });
      setProductName(prev => prev.trim() ? prev : (latestEntry.product.title ?? ''));
      setLoadedAsin(latestEntry.asin);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestEntry]);

  // Pre-fill from active product (Research → Feasibility flow) when vault has nothing.
  // Lower priority: only fills if selling price is still at default and vault didn't fill it.
  useEffect(() => {
    if (!activeProductPrice || latestEntry || autofillDone) return;
    AsyncStorage.getItem(STORAGE_KEYS.savedCalculations).then(raw => {
      if (autofillDone) return; // effect 1 may have completed while we waited
      if (raw) {
        try {
          const list: FBASaved[] = JSON.parse(raw);
          if (list.length > 0) return;
        } catch { /* fall through */ }
      }
      setInputs(prev => {
        if (prev.sellingPrice !== '' && prev.sellingPrice !== FBA_DEFAULTS.sellingPrice) return prev;
        return { ...prev, sellingPrice: activeProductPrice.toFixed(2) };
      });
      if (activeProductName) setProductName(prev => prev.trim() ? prev : activeProductName);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProductPrice, activeProductName]);

  // Pre-fill supplier cost from pipeline when no saved calculation exists.
  // Persists a fingerprint so restart never overwrites manual edits.
  const AUTOFILL_KEY = 'siftly_profitlab_autofill_v1';
  useEffect(() => {
    if (!pipeline.selectedSupplier || autofillDone) return;
    const supplierKey = `${pipeline.selectedSupplier.name}:${pipeline.selectedSupplier.unitCost}`;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.savedCalculations),
      AsyncStorage.getItem(AUTOFILL_KEY),
    ]).then(([raw, storedKey]) => {
      // Skip if already autofilled for this exact supplier in a previous session
      if (storedKey === supplierKey) { setAutofillDone(true); return; }
      if (raw) {
        try {
          const list: FBASaved[] = JSON.parse(raw);
          if (list.length > 0) { setAutofillDone(true); return; }
        } catch { /* fall through */ }
      }
      const cost = pipeline.selectedSupplier?.unitCost;
      if (cost && cost > 0) {
        setInputs(prev => prev.productCost !== '' ? prev : { ...prev, productCost: cost.toFixed(2) });
      }
      if (pipeline.activeProduct?.title) {
        setProductName(prev => prev.trim() ? prev : (pipeline.activeProduct?.title ?? ''));
      }
      if (pipeline.activeProduct?.price) {
        setInputs(prev => prev.sellingPrice !== '' ? prev : { ...prev, sellingPrice: (pipeline.activeProduct?.price ?? 0).toFixed(2) });
      }
      const freightPerUnit = pipeline.freightEstimate?.perUnitCost;
      if (freightPerUnit && freightPerUnit > 0) {
        setInputs(prev => prev.freight !== '' ? prev : { ...prev, freight: freightPerUnit.toFixed(2) });
      }
      // Persist fingerprint so restart skips re-fill for this supplier
      AsyncStorage.setItem(AUTOFILL_KEY, supplierKey).catch(() => {});
      setAutofillDone(true);
    }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.selectedSupplier, pipeline.activeProduct, autofillDone]);

  const c  = useMemo(() => computeFBA(committed), [committed]);
  const sc = useMemo(() => {
    const cfg = SCENARIO_CFG[scenario];
    const adjusted: FBAInputs = {
      ...committed,
      freight: (n(committed.freight) * cfg.freightMult).toFixed(2),
      duties:  (n(committed.duties)  * cfg.dutyMult).toFixed(2),
    };
    return computeFBA(adjusted);
  }, [committed, scenario]);

  const allScenarios = useMemo(() => (Object.keys(SCENARIO_CFG) as Scenario[]).map(s => {
    const cfg = SCENARIO_CFG[s];
    const adj: FBAInputs = {
      ...committed,
      freight: (n(committed.freight) * cfg.freightMult).toFixed(2),
      duties:  (n(committed.duties)  * cfg.dutyMult).toFixed(2),
    };
    return { label: SCENARIO_CFG[s].label, ...computeFBA(adj) };
  }), [committed]);

  const sensitivity = useMemo(() => {
    const price   = n(committed.sellingPrice);
    const freight = n(committed.freight);
    const duties  = n(committed.duties);
    function delta(overrides: Partial<FBAInputs>) {
      const r = computeFBA({ ...committed, ...overrides });
      return { profit: r.netProfit - c.netProfit, margin: r.margin - c.margin };
    }
    return [
      { label: 'Price +10%',   ...delta({ sellingPrice: (price   * 1.10).toFixed(2) }) },
      { label: 'Price −10%',   ...delta({ sellingPrice: (price   * 0.90).toFixed(2) }) },
      { label: 'Freight +20%', ...delta({ freight:      (freight * 1.20).toFixed(2) }) },
      { label: 'Freight −20%', ...delta({ freight:      (freight * 0.80).toFixed(2) }) },
      { label: 'Duties +20%',  ...delta({ duties:       (duties  * 1.20).toFixed(2) }) },
    ];
  }, [committed, c]);

  const confidence = useMemo(() => {
    let score = 5;
    if (n(committed.productCost)  > 0) score += 20;
    if (n(committed.freight)      > 0) score += 15;
    if (n(committed.fbaFees)      > 0) score += 15;
    if (n(committed.referralFee)  > 0) score += 15;
    if (n(committed.duties)       > 0) score += 10;
    if (n(committed.unitsOrdered) > 0) score += 10;
    if (productName.trim()        !== '') score += 10;
    return score;
  }, [committed, productName]);

  const badgeV: 'success'|'warning'|'danger' = sc.netProfit <= 0 ? 'danger' : sc.isViable ? 'success' : 'warning';

  const inputWarnings = useMemo(() => {
    const sell = n(inputs.sellingPrice);
    const cost = n(inputs.productCost);
    const freight = n(inputs.freight);
    const warnings: string[] = [];
    if (sell > 0 && cost > 0 && cost / sell > 0.6)
      warnings.push(`Supplier cost is ${Math.round((cost / sell) * 100)}% of selling price — leaves little room after fees`);
    if (sell > 0 && sell < 15)
      warnings.push('Selling prices under $15 are high-risk on FBA — fees become disproportionately large');
    if (sell > 0 && cost > 0 && freight === 0)
      warnings.push('No freight cost entered — add it for an accurate margin (typically $1–$3/unit)');
    return warnings;
  }, [inputs]);

  function set(k: keyof FBAInputs, v: string) { setInputs(p => ({ ...p, [k]: v })); }

  function handleLoad() {
    if (!latestEntry) return;
    const vaultPrice = latestEntry.product.price ?? latestEntry.analysis?.metrics.price ?? null;
    if (!productName.trim()) setProductName(latestEntry.product.title);
    if (vaultPrice !== null &&
        (inputs.sellingPrice === '' || inputs.sellingPrice === FBA_DEFAULTS.sellingPrice)) {
      setInputs(prev => ({ ...prev, sellingPrice: vaultPrice.toFixed(2) }));
    }
    setLoadedAsin(latestEntry.asin);
    setAutofillDone(true);
  }

  const vaultPrice = latestEntry
    ? (latestEntry.product.price ?? latestEntry.analysis?.metrics.price ?? null)
    : null;

  return (
    <View style={ws.wrap}>
      {/* Inputs */}
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Field label="Product name (optional)" value={productName} onChange={setProductName} placeholder="e.g. Yoga Mat Premium" keyboard="default" />
        <Field label="HS/HTS code (optional)" value={hsCode} onChange={setHsCode} placeholder="e.g. 9506.91" keyboard="default" hint="Verify with a customs broker — used for record-keeping only" />
        <Pair>
          <Field label={`Selling price (${symbol})`} value={inputs.sellingPrice} onChange={v => set('sellingPrice', v)} placeholder="24.99" />
          <Field label={`Supplier cost (${symbol})`} value={inputs.productCost} onChange={v => set('productCost', v)} placeholder="5.20" />
        </Pair>
        <Pair>
          <Field label={`Freight / unit (${symbol})`} value={inputs.freight} onChange={v => set('freight', v)} placeholder="2.10" />
          <Field label={`FBA fees (${symbol})`} value={inputs.fbaFees} onChange={v => set('fbaFees', v)} placeholder="4.50" />
        </Pair>
        {/* FBA Fee Helper */}
        <TouchableOpacity style={ws.helperLink} onPress={() => setShowFeeHelper(v => !v)} activeOpacity={0.7}>
          <Text style={ws.helperLinkTxt}>{showFeeHelper ? '▲' : '▼'} Need FBA fee estimates?</Text>
        </TouchableOpacity>
        {showFeeHelper && (
          <View style={ws.helperBox}>
            <Text style={ws.helperTitle}>
              {marketplace === 'US'
                ? 'US FBA Fee Ranges (2025 approx.)'
                : `Check ${profile.amazonMarketplace} Seller Central for fee schedules`}
            </Text>
            {marketplace === 'US' && US_FEE_TIERS.map(t => (
              <View key={t.tier} style={ws.helperRow}>
                <Text style={ws.helperLabel}>{t.tier}</Text>
                <Text style={ws.helperValue}>{t.range}</Text>
              </View>
            ))}
            <Text style={ws.disclaimer}>Estimates only. Verify actual fees in Seller Central — fees change periodically and vary by category.</Text>
          </View>
        )}
        {n(inputs.sellingPrice) > 0 && (
          <Text style={ws.hint}>
            Referral fee hint: 15% of {symbol}{n(inputs.sellingPrice).toFixed(2)} = {symbol}{(n(inputs.sellingPrice) * 0.15).toFixed(2)} (most categories)
          </Text>
        )}
        <Pair>
          <Field label={`Referral fee (${symbol})`} value={inputs.referralFee} onChange={v => set('referralFee', v)} placeholder="3.67" />
          <Field label={`Import duties (${symbol})`} value={inputs.duties} onChange={v => set('duties', v)} placeholder="0.73" />
        </Pair>
        <Pair>
          <Field label={`Packaging (${symbol})`} value={inputs.packaging} onChange={v => set('packaging', v)} placeholder="0.45" />
          <Field label="Units ordered" value={inputs.unitsOrdered} onChange={v => set('unitsOrdered', v)} placeholder="500" keyboard="number-pad" />
        </Pair>
        <Text style={ws.chipLabel}>SCENARIO</Text>
        <View style={ws.chips}>
          {(Object.keys(SCENARIO_CFG) as Scenario[]).map(s => (
            <TouchableOpacity key={s} style={[ws.chip, scenario === s && ws.chipActive]} onPress={() => setScenario(s)}>
              <Text style={[ws.chipTxt, scenario === s && ws.chipTxtActive]}>{SCENARIO_CFG[s].label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <CalcBtn label="Recalculate Profit" onPress={() => setCommitted({ ...inputs })} />
      </AppCard>

      {/* Input warnings */}
      {inputWarnings.length > 0 && (
        <View style={ws.warnBox}>
          {inputWarnings.map((w, i) => (
            <View key={i} style={ws.warnRow}>
              <Text style={ws.warnIcon}>⚠</Text>
              <Text style={ws.warnTxt}>{w}</Text>
            </View>
          ))}
        </View>
      )}


      {/* Results card — green top bar + 3 metrics + breakdown */}
      <AppCard style={{ gap: 0, overflow: 'hidden' }}>
        {/* Green accent bar */}
        <View style={{ height: 4, backgroundColor: sc.netProfit < 0 ? DS.danger : DS.success, marginHorizontal: -20, marginTop: -20, marginBottom: 16 }} />

        {/* 3 metric row */}
        <View style={ws.metricsRow}>
          <View style={ws.metricBlock}>
            <Text style={ws.metricLblTop}>Net Profit</Text>
            <Text style={[ws.metricBig, { color: sc.netProfit < 0 ? DS.danger : DS.success }]}>
              {sc.netProfit < 0 ? '-' : ''}{fmtLocal(Math.abs(sc.netProfit))}
            </Text>
            <Text style={ws.metricUnit}>/unit</Text>
          </View>
          <View style={ws.metDiv} />
          <View style={ws.metricBlock}>
            <Text style={ws.metricLblTop}>Margin</Text>
            <Text style={[ws.metricBig, { color: sc.margin < 15 ? DS.danger : sc.margin < 25 ? DS.warning : DS.success }]}>
              {sc.margin.toFixed(0)}%
            </Text>
          </View>
          <View style={ws.metDiv} />
          <View style={ws.metricBlock}>
            <Text style={ws.metricLblTop}>ROI</Text>
            <Text style={[ws.metricBig, { color: sc.roi < 30 ? DS.warning : DS.success }]}>
              {sc.roi.toFixed(0)}%
            </Text>
          </View>
        </View>

        {scenario !== 'expected' && (
          <Text style={[ws.hint, { marginBottom: 8 }]}>
            {SCENARIO_CFG[scenario].label}: freight ×{SCENARIO_CFG[scenario].freightMult.toFixed(2)}, duties ×{SCENARIO_CFG[scenario].dutyMult.toFixed(2)}
          </Text>
        )}

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: DS.border, marginHorizontal: -20, marginBottom: 12 }} />

        {/* Breakdown rows */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
          <Text style={ws.bkLabel}>Revenue</Text>
          <Text style={[ws.bkVal, { color: DS.textPrimary }]}>{fmtLocal(sc.sellingPrice)}</Text>
        </View>
        {c.costAmounts.filter(row => row.label !== 'Total costs' && row.amount > 0).map(row => (
          <View key={row.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: DS.border }}>
            <Text style={ws.bkLabel}>{row.label}</Text>
            <Text style={[ws.bkVal, { color: DS.danger }]}>-{fmtLocal(row.amount)}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: DS.border }}>
          <Text style={[ws.bkLabel, { fontWeight: '800', color: DS.textPrimary }]}>Net</Text>
          <Text style={[ws.bkVal, { color: sc.netProfit < 0 ? DS.danger : DS.success, fontWeight: '900' }]}>
            {sc.netProfit < 0 ? '-' : ''}{fmtLocal(Math.abs(sc.netProfit))}
          </Text>
        </View>

        {n(committed.freight) === 0 && <EstimateLabel type="estimated" />}
        <AccuracyBadge level="planning" />

        {/* Save to History link */}
        <TouchableOpacity
          style={{ alignSelf: 'flex-end', marginTop: 4 }}
          onPress={() => saveSuccess
            ? onUnsave()
            : onSave(sc.netProfit, sc.margin, sc.roi, committed, currency, marketplace, productName, hsCode, loadedAsin, confidence)
          }
          disabled={saveLoading}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 12, color: saveSuccess ? DS.success : DS.accent, fontWeight: '700' }}>
            {saveLoading ? 'Saving…' : saveSuccess ? '✓ Saved' : 'Save to History'}
          </Text>
        </TouchableOpacity>
      </AppCard>

      {/* Advisor verdict */}
      <AdvisorVerdict c={sc} productCost={n(committed.productCost)} fmtLocal={fmtLocal} />

      {/* Confidence + stress test */}
      <AppCard style={{ gap: 8 }}>
        <ConfidenceBar score={confidence} />
        <TouchableOpacity style={ws.collapseRow} onPress={() => setShowStressTest(v => !v)} activeOpacity={0.7}>
          <Text style={ws.collapseTitle}>Stress Test</Text>
          <Text style={ws.collapseChev}>{showStressTest ? '▲' : '▼'}</Text>
        </TouchableOpacity>

        {showStressTest && (
          <View style={{ gap: 16 }}>
            <View style={{ gap: 4 }}>
              <Text style={ws.subTitle}>Scenario Comparison</Text>
              <View style={ws.tableRow}>
                <Text style={[ws.tableCell, ws.tableLblCell, ws.tableHdr]}></Text>
                {allScenarios.map(s => (
                  <Text key={s.label} style={[ws.tableCell, ws.tableHdr]}>{s.label}</Text>
                ))}
              </View>
              {([
                { label: 'Net Profit', vals: allScenarios.map(s => fmtLocal(s.netProfit)) },
                { label: 'Margin',     vals: allScenarios.map(s => `${s.margin.toFixed(1)}%`) },
                { label: 'ROI',        vals: allScenarios.map(s => `${s.roi.toFixed(0)}%`) },
                { label: 'Total Cost', vals: allScenarios.map(s => fmtLocal(s.totalCost)) },
              ] as const).map(row => (
                <View key={row.label} style={ws.tableRow}>
                  <Text style={[ws.tableCell, ws.tableLblCell]}>{row.label}</Text>
                  {row.vals.map((v, i) => (
                    <Text key={i} style={[ws.tableCell, i === 1 && { fontWeight: '800', color: DS.textPrimary }]}>{v}</Text>
                  ))}
                </View>
              ))}
              <Text style={ws.disclaimer}>Planning simulation. Conservative: +20% freight, +15% duties. Optimistic: −10% each.</Text>
            </View>

            <View style={{ gap: 4 }}>
              <Text style={ws.subTitle}>Sensitivity Analysis</Text>
              <View style={ws.tableRow}>
                <Text style={[ws.tableCell, ws.tableLblCell, ws.tableHdr]}>Change</Text>
                <Text style={[ws.tableCell, ws.tableHdr]}>Profit Δ</Text>
                <Text style={[ws.tableCell, ws.tableHdr]}>Margin Δ</Text>
              </View>
              {sensitivity.map(row => (
                <View key={row.label} style={ws.tableRow}>
                  <Text style={[ws.tableCell, ws.tableLblCell]}>{row.label}</Text>
                  <Text style={[ws.tableCell, { color: row.profit >= 0 ? DS.success : DS.danger, fontWeight: '700' }]}>
                    {row.profit >= 0 ? '+' : ''}{fmtLocal(row.profit)}
                  </Text>
                  <Text style={[ws.tableCell, { color: row.margin >= 0 ? DS.success : DS.danger, fontWeight: '700' }]}>
                    {row.margin >= 0 ? '+' : ''}{row.margin.toFixed(1)}%
                  </Text>
                </View>
              ))}
              <Text style={ws.disclaimer}>Planning simulation only. Results may differ from actual market conditions.</Text>
            </View>
          </View>
        )}
      </AppCard>

      {/* Save errors / disclaimer */}
      <View style={{ gap: 4 }}>
        {saveError !== '' && (
          <View style={[ws.banner, { backgroundColor: DS.dangerBg }]}>
            <Text style={[ws.bannerTxt, { color: DS.danger }]}>{saveError}</Text>
          </View>
        )}
        <Text style={ws.disclaimer}>{profile.marketplaceDisclaimer}</Text>
        {saveSuccess && (
          <FeasibilityHeart
            type="calculation"
            label={`${productName || 'Calculation'} — ${sc.netProfit >= 0 ? '+' : ''}${sc.netProfit.toFixed(2)} profit, ${sc.margin.toFixed(0)}% margin`}
            data={{ netProfit: sc.netProfit, margin: sc.margin, roi: sc.roi, sellingPrice: n(committed.sellingPrice), supplierCost: n(committed.productCost), currency, marketplace }}
          />
        )}
      </View>

      {/* Pipeline actions */}
      {n(committed.sellingPrice) > 0 && (
        <PipelineActions
          onSaveCostModel={() => {
            const sell    = n(committed.sellingPrice);
            const cost    = n(committed.productCost);
            const freight = n(committed.freight);
            const moq     = n(committed.unitsOrdered);
            const validation = validateFinancialInputs(sell, cost, freight);
            if (!validation.valid) {
              Alert.alert('Fix Before Saving', validation.errors.join('\n'));
              return;
            }
            pipeline.setCostModel({
              sellingPrice:    sell,
              unitCost:        cost,
              freight,
              fbaFee:          n(committed.fbaFees),
              referralFee:     n(committed.referralFee),
              duties:          n(committed.duties),
              packaging:       n(committed.packaging),
              netProfit:       sc.netProfit,
              marginPct:       sc.margin,
              roiPct:          sc.roi,
              totalCost:       sc.totalCost,
              unitsOrdered:    moq,
              totalInvestment: moq > 0 ? (cost + freight + n(committed.duties) + n(committed.packaging)) * moq : 0,
              savedAt:         new Date().toISOString(),
            });
            pipeline.trackPipelineEvent('cost_model_saved', { margin: sc.margin.toFixed(1), roi: sc.roi.toFixed(0) });
          }}
          costModelSaved={!!pipeline.costModel}
        />
      )}

      {/* Load Saved Product */}
      <AppCard style={{ gap: 10 }}>
        <Text style={ws.cardTitle}>Load Saved Product</Text>
        {latestEntry ? (
          <>
            <View style={lp.productRow}>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={lp.productTitle} numberOfLines={2}>{latestEntry.product.title}</Text>
                {vaultPrice !== null && (
                  <Text style={lp.productPrice}>
                    Listed price: {latestEntry.currency} {vaultPrice.toFixed(2)}
                  </Text>
                )}
                {latestEntry.analysis?.verdict ? (
                  <Text style={lp.verdict}>
                    AI: {latestEntry.analysis.verdict} · {latestEntry.analysis.confidence}% confidence
                  </Text>
                ) : null}
              </View>
              <View style={[lp.badge, { backgroundColor: opportunityBg(latestEntry.product.opportunity) }]}>
                <Text style={[lp.badgeTxt, { color: opportunityFg(latestEntry.product.opportunity) }]}>
                  {latestEntry.product.opportunity}
                </Text>
              </View>
            </View>
            {autofillDone ? (
              <View style={{ gap: 6 }}>
                <View style={ws.banner}>
                  <Text style={ws.bannerTxt}>✓  Product data loaded into Profit Lab</Text>
                </View>
                <TouchableOpacity
                  style={ws.refreshBtn}
                  onPress={() => setAutofillDone(false)}
                  activeOpacity={0.8}
                >
                  <Text style={ws.refreshBtnTxt}>↺  Refresh from pipeline</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={lp.loadBtn} onPress={handleLoad} activeOpacity={0.85}>
                <Text style={lp.loadBtnTxt}>Load Into Calculator</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={{ gap: 6 }}>
            <Text style={ws.hint}>No saved products available.</Text>
            <Text style={[ws.hint, { color: DS.accent, fontWeight: '600' }]}>
              Research a product first — then load it here.
            </Text>
          </View>
        )}
      </AppCard>

    </View>
  );
}

// ─── 2. Break-even ────────────────────────────────────────────────────────────

function BreakevenWorkspace() {
  const { symbol } = useCurrency();
  const [price,    setPrice]   = useState('');
  const [cpu,      setCpu]     = useState('');
  const [fees,     setFees]    = useState('');
  const [startup,  setStartup] = useState('');
  const [fixed,    setFixed]   = useState('');
  const [sales,    setSales]   = useState('');
  const [show,     setShow]    = useState(false);

  const p = n(price); const c = n(cpu); const f = n(fees);
  const s = n(startup); const fx = n(fixed); const sl = n(sales);
  const profitPU = p - c - f;
  const beUnits = profitPU > 0 ? Math.ceil(s / profitPU) : 0;
  const beFixed = profitPU > 0 ? Math.ceil(fx / profitPU) : 0;
  const months  = sl > 0 && profitPU > 0
    ? safe(s / (sl * profitPU - fx)).toFixed(1) : null;

  return (
    <View style={ws.wrap}>
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Text style={ws.hint}>Break even within 90 days = healthy FBA product.</Text>
        <Pair>
          <Field label={`Selling price (${symbol})`} value={price} onChange={setPrice} placeholder="29.99" />
          <Field label={`Cost per unit (${symbol})`} value={cpu} onChange={setCpu} placeholder="5.00" />
        </Pair>
        <Pair>
          <Field label={`FBA fees (${symbol})`} value={fees} onChange={setFees} placeholder="6.50" />
          <Field label={`Startup costs (${symbol})`} value={startup} onChange={setStartup} placeholder="3000" />
        </Pair>
        <Pair>
          <Field label={`Monthly fixed (${symbol})`} value={fixed} onChange={setFixed} placeholder="500" />
          <Field label="Est. monthly sales" value={sales} onChange={setSales} placeholder="200" keyboard="number-pad" />
        </Pair>
        <CalcBtn label="Calculate Break-even" onPress={() => setShow(true)} />
      </AppCard>

      {show && p > 0 && c > 0 && (
        <AppCard style={{ gap: 10 }}>
          <Text style={ws.cardTitle}>Results</Text>
          <AccuracyBadge level="exact" />
          <View style={ws.heroRow}>
            <View style={{ gap: 2 }}>
              <Text style={ws.heroLabel}>Profit Per Unit</Text>
              <Text style={[ws.heroValue, { color: profitPU > 0 ? DS.success : DS.danger }]}>
                {symbol}{profitPU.toFixed(2)}
              </Text>
              <Text style={ws.heroUnit}>ROI: {c > 0 ? ((profitPU/c)*100).toFixed(0) : 0}%  ·  Margin: {p > 0 ? ((profitPU/p)*100).toFixed(0) : 0}%</Text>
            </View>
          </View>
          {[
            ['Units to recover startup',        beUnits > 0 ? `${beUnits} units` : 'N/A'],
            ['Units/mo to cover fixed costs',   beFixed > 0 ? `${beFixed} units` : 'N/A'],
            ['Months to break even',            months ? `${months} months` : 'Enter monthly sales'],
            ['Revenue at break-even',           beUnits > 0 ? `${symbol}${(beUnits * p).toFixed(0)}` : 'N/A'],
          ].map(([l, v]) => <Row key={l} label={l} value={v} />)}
        </AppCard>
      )}
    </View>
  );
}

// ─── 3. PPC / ACoS ───────────────────────────────────────────────────────────

function PPCWorkspace() {
  const { symbol } = useCurrency();
  const [price, setPrice] = useState('');
  const [units, setUnits] = useState('');
  const [acos,  setAcos]  = useState('30');
  const [cpc,   setCpc]   = useState('0.75');
  const [show,  setShow]  = useState(false);

  const p = n(price); const u = n(units);
  const acosN = n(acos) || 30; const cpcN = n(cpc) || 0.75;
  const dailyRev = p * u;
  const dailyBudget = dailyRev * (acosN / 100);
  const dailyClicks = cpcN > 0 ? dailyBudget / cpcN : 0;
  const acosColor = acosN <= 25 ? DS.accent : acosN <= 40 ? DS.warning : DS.danger;

  return (
    <View style={ws.wrap}>
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Pair>
          <Field label={`Selling price (${symbol})`} value={price} onChange={setPrice} placeholder="29.99" />
          <Field label="Target daily sales" value={units} onChange={setUnits} placeholder="10" keyboard="number-pad" />
        </Pair>
        <Pair>
          <Field label="Target ACoS (%)" value={acos} onChange={setAcos} placeholder="30" />
          <Field label={`Avg CPC (${symbol})`} value={cpc} onChange={setCpc} placeholder="0.75" />
        </Pair>
        <View style={ws.acosHint}>
          <Text style={[ws.acosHintTxt, { color: acosColor }]}>
            ACoS {acosN}% — {acosN <= 25 ? 'Excellent' : acosN <= 40 ? 'Moderate' : 'High spend'}
          </Text>
        </View>
        <CalcBtn label="Calculate PPC Budget" onPress={() => setShow(true)} />
      </AppCard>

      {show && p > 0 && u > 0 && (
        <AppCard style={{ gap: 10 }}>
          <Text style={ws.cardTitle}>Results</Text>
          <AccuracyBadge level="exact" />
          <View style={ws.heroRow}>
            <View style={{ gap: 2 }}>
              <Text style={ws.heroLabel}>Daily Ad Budget</Text>
              <Text style={[ws.heroValue, { color: DS.accent }]}>{symbol}{dailyBudget.toFixed(2)}</Text>
              <Text style={ws.heroUnit}>to sell {u} units/day at {acosN}% ACoS</Text>
            </View>
          </View>
          {[
            ['Daily revenue target',    `${symbol}${dailyRev.toFixed(2)}`],
            ['Daily ad spend',          `${symbol}${dailyBudget.toFixed(2)}`],
            ['Monthly ad spend',        `${symbol}${(dailyBudget * 30).toFixed(0)}`],
            ['Est. clicks / day',       `${dailyClicks.toFixed(0)}`],
            ['Est. impressions / day',  `${(dailyClicks / 0.03).toFixed(0)}`],
            ['Suggested max CPC bid',   `${symbol}${cpcN.toFixed(2)}`],
          ].map(([l, v]) => <Row key={l} label={l} value={v} />)}
        </AppCard>
      )}
    </View>
  );
}

// ─── 4. Freight ───────────────────────────────────────────────────────────────

// ── Freight comparison modal ──────────────────────────────────────────────────

const COMPARE_METRICS: {
  label: string;
  key: keyof Pick<FreightCompanyResult, 'mode' | 'totalCostUsd' | 'costPerUnit' | 'transitDays' | 'serviceScore' | 'score'>;
  format: (v: any) => string;
}[] = [
  { label: 'Mode',         key: 'mode',         format: v => (v as string).toUpperCase() },
  { label: 'Est. Total',   key: 'totalCostUsd',  format: v => `$${(v as number).toFixed(0)}` },
  { label: 'Per Unit',     key: 'costPerUnit',   format: v => `$${(v as number).toFixed(2)}` },
  { label: 'Transit',      key: 'transitDays',   format: v => v as string },
  { label: 'Service ★',   key: 'serviceScore',  format: v => (v as number).toFixed(1) },
  { label: 'Score',        key: 'score',         format: v => `${v as number}/100` },
];

interface FreightCompareModalProps {
  visible:    boolean;
  onClose:    () => void;
  companies:  FreightCompanyResult[];
  bestCostId: string;
  bestSpeedId:string;
  bestBalId:  string;
}

function FreightCompareModal({
  visible, onClose, companies, bestCostId, bestSpeedId, bestBalId,
}: FreightCompareModalProps) {
  const COL_W = 110;
  const LABEL_W = 90;

  function bestFor(id: string): string {
    if (id === bestCostId && id === bestSpeedId) return 'Best All';
    if (id === bestCostId)  return 'Cheapest';
    if (id === bestSpeedId) return 'Fastest';
    if (id === bestBalId)   return 'Top Score';
    return '—';
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={cmp.safe}>
        {/* Header */}
        <View style={cmp.header}>
          <Text style={cmp.title}>Comparing {companies.length} Companies</Text>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
            activeOpacity={0.7}
          >
            <Text style={cmp.closeBtn}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={cmp.body} showsVerticalScrollIndicator={false}>
          <AccuracyBadge level="planning" />

          {/* Scrollable table */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
            <View>
              {/* Company name header row */}
              <View style={cmp.row}>
                <View style={[cmp.labelCell, { width: LABEL_W }]}>
                  <Text style={cmp.metricLabel}>Company</Text>
                </View>
                {companies.map(r => (
                  <View key={r.company.id} style={[cmp.dataCell, { width: COL_W }]}>
                    <Text style={cmp.companyHdr} numberOfLines={2}>{r.company.name}</Text>
                    {r.company.badge && (
                      <View style={cmp.badgePill}>
                        <Text style={cmp.badgePillTxt}>{r.company.badge}</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>

              {/* Metric rows */}
              {COMPARE_METRICS.map((m, mi) => (
                <View key={m.key} style={[cmp.row, mi % 2 === 1 && cmp.rowAlt]}>
                  <View style={[cmp.labelCell, { width: LABEL_W }]}>
                    <Text style={cmp.metricLabel}>{m.label}</Text>
                  </View>
                  {companies.map(r => {
                    const raw = r[m.key];
                    const val = m.format(raw);
                    const isBest =
                      (m.key === 'totalCostUsd' && r.company.id === bestCostId) ||
                      (m.key === 'costPerUnit'  && r.company.id === bestCostId) ||
                      (m.key === 'transitDays'  && r.company.id === bestSpeedId) ||
                      (m.key === 'score'        && r.company.id === bestBalId);
                    return (
                      <View key={r.company.id} style={[cmp.dataCell, { width: COL_W }]}>
                        <Text style={[cmp.dataVal, isBest && cmp.dataValBest]}>{val}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}

              {/* Best For row */}
              <View style={[cmp.row, cmp.rowAlt]}>
                <View style={[cmp.labelCell, { width: LABEL_W }]}>
                  <Text style={cmp.metricLabel}>Best For</Text>
                </View>
                {companies.map(r => {
                  const label = bestFor(r.company.id);
                  return (
                    <View key={r.company.id} style={[cmp.dataCell, { width: COL_W }]}>
                      <Text style={[cmp.dataVal, label !== '—' && cmp.dataValBest]}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          </ScrollView>

          <Text style={cmp.disclaimer}>
            All figures are estimated — based on curated multipliers, not live freight API data. Always get a real quote before committing to a shipment.
          </Text>
        </ScrollView>

        <View style={cmp.footer}>
          <TouchableOpacity style={cmp.doneBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={cmp.doneTxt}>Done</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const cmp = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: DS.bgCanvas },
  header:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: DS.border, backgroundColor: DS.bgCard },
  title:       { fontSize: 17, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },
  closeBtn:    { fontSize: 20, color: DS.textMuted, fontWeight: '300' },
  body:        { padding: 20, gap: 0, paddingBottom: 16 },
  footer:      { padding: 20, borderTopWidth: 1, borderTopColor: DS.border, backgroundColor: DS.bgCard },
  doneBtn:     { backgroundColor: DS.accent, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  doneTxt:     { fontSize: 15, fontWeight: '800', color: '#fff' },
  disclaimer:  { fontSize: 11, color: DS.textMuted, lineHeight: 16, fontStyle: 'italic', marginTop: 16 },

  row:         { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: DS.border },
  rowAlt:      { backgroundColor: DS.bgSubtle },
  labelCell:   { paddingVertical: 10, paddingHorizontal: 8, justifyContent: 'center' },
  dataCell:    { paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  companyHdr:  { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2, textAlign: 'center' },
  dataVal:     { fontSize: 12, fontWeight: '600', color: DS.textSecondary, textAlign: 'center' },
  dataValBest: { color: DS.accent, fontWeight: '800' },
  badgePill:   { backgroundColor: DS.accentLight, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginTop: 3 },
  badgePillTxt:{ fontSize: 8, fontWeight: '800', color: DS.accent, textAlign: 'center' },
});

const FREIGHT_ORIGIN_OPTS: { id: ShipOrigin; label: string }[] = [
  { id: 'CN', label: 'China'   },
  { id: 'VN', label: 'Vietnam' },
  { id: 'IN', label: 'India'   },
  { id: 'TR', label: 'Turkey'  },
];
function FreightWorkspace() {
  const { fmt, marketplace } = useCurrency();
  const profile = getMarketplaceProfile(marketplace);

  // Basic estimator
  const [weight,  setWeight]  = useState('');
  const [qty,     setQty]     = useState('');
  const [show,    setShow]    = useState(false);

  // Shared shipment details (used by search + quote)
  const [rfqName, setRfqName] = useState('');
  const [rfqL,    setRfqL]    = useState('');
  const [rfqW,    setRfqW]    = useState('');
  const [rfqH,    setRfqH]    = useState('');

  // Quote modal
  const [quoteModalVisible, setQuoteModalVisible] = useState(false);
  const [quoteModalCompany, setQuoteModalCompany] = useState<FreightCompanyResult | null>(null);
  const [quoteModalText,    setQuoteModalText]    = useState('');

  // Company search
  const [origin,       setOrigin]       = useState<ShipOrigin>('CN');
  const [cartonWtKg,   setCartonWtKg]   = useState('');
  const [cartonUnitV,  setCartonUnitV]  = useState('');
  const [prefMode,     setPrefMode]     = useState<ShipMode>('sea');
  const [priority,     setPriority]     = useState<FreightPriority>('balanced');
  const [searchResult, setSearchResult] = useState<FreightSearchResult | null>(null);
  const [savedSel,     setSavedSel]     = useState<SavedFreightSelection | null>(null);

  // Compare
  const [compareIds,    setCompareIds]    = useState<Set<string>>(new Set());
  const [showCompare,   setShowCompare]   = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.freightSelection)
      .then(v => { if (v) { const p = safeParseJSON<typeof savedSel>(v); if (p) setSavedSel(p as any); } })
      .catch(() => {});
  }, []);

  const wt = n(weight); const q = n(qty);
  const totalKg = wt * q * 0.453592;
  const methods = [
    { name: 'Sea Freight (LCL)', days: '25–35 days', rateKg: profile.freightRateProfile.sea,     icon: '🚢' },
    { name: 'Air Freight',       days: '5–7 days',   rateKg: profile.freightRateProfile.air,     icon: '✈️' },
    { name: 'Express Courier',   days: '3–5 days',   rateKg: profile.freightRateProfile.express, icon: '⚡' },
  ];

  const ORIGIN_LABEL: Record<ShipOrigin, string> = {
    CN: 'China', VN: 'Vietnam', IN: 'India', TR: 'Turkey',
  };

  function handleSearch() {
    if (wt <= 0 || q <= 0) return;
    const unitWeightKg = wt * 0.453592;
    const VALID_MARKETS: ShipMarket[] = ['US', 'UK', 'DE', 'CA'];
    const mkt: ShipMarket = VALID_MARKETS.includes(marketplace as ShipMarket)
      ? marketplace as ShipMarket : 'US';
    const results = searchFreightCompanies({
      units:          q,
      unitWeightKg,
      cartonLengthCm: n(rfqL) || 40,
      cartonWidthCm:  n(rfqW) || 30,
      cartonHeightCm: n(rfqH) || 25,
      cartonWeightKg: n(cartonWtKg) || unitWeightKg * (n(cartonUnitV) || 10),
      cartonUnits:    n(cartonUnitV) || 10,
      origin,
      marketplace:    mkt,
      preferredMode:  prefMode,
      priority,
    });
    setSearchResult(results);
    setCompareIds(new Set());
  }

  async function saveSelection(r: FreightCompanyResult) {
    const sel: SavedFreightSelection = {
      companyName:  r.company.name,
      mode:         r.mode,
      totalCostUsd: r.totalCostUsd,
      costPerUnit:  r.costPerUnit,
      transitDays:  r.transitDays,
      savedAt:      new Date().toISOString(),
    };
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.freightSelection, JSON.stringify(sel));
      setSavedSel(sel);
    } catch {}
  }

  async function clearSaved() {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.freightSelection);
      setSavedSel(null);
    } catch {}
  }

  function toggleCompare(id: string) {
    setCompareIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 4) {
        next.add(id);
      } else {
        Alert.alert('Maximum 4', 'You can compare up to 4 companies at once. Remove one first.');
      }
      return next;
    });
  }

  async function handleOpenWebsite(url: string) {
    try {
      const ok = await Linking.canOpenURL(url);
      if (ok) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot open link', 'Your device cannot open this URL.');
      }
    } catch {
      Alert.alert('Error', 'Unable to open the website. Please try again.');
    }
  }

  function openQuoteModal(r: FreightCompanyResult) {
    const hasDims = n(rfqL) > 0 && n(rfqW) > 0 && n(rfqH) > 0;
    const cbm     = hasDims ? (n(rfqL) * n(rfqW) * n(rfqH)) / 1_000_000 : 0;
    const body = [
      'Hello,',
      '',
      'I am requesting a freight quote for the following shipment:',
      '',
      `Product:          ${rfqName.trim() || 'Amazon FBA product'}`,
      `Origin:           ${ORIGIN_LABEL[origin]}`,
      `Destination:      ${profile.countryLabel} (Amazon FBA warehouse)`,
      `Quantity:         ${q} units`,
      `Unit weight:      ${(wt * 0.453592).toFixed(2)} kg (${wt} lbs)`,
      `Total weight:     ${totalKg.toFixed(1)} kg`,
      ...(hasDims ? [
        `Carton dims:      ${rfqL} × ${rfqW} × ${rfqH} cm`,
        `Estimated CBM:    ${cbm.toFixed(4)} CBM`,
      ] : []),
      '',
      `Preferred mode:   ${r.mode.toUpperCase()}`,
      `App estimate:     $${r.totalCostUsd.toFixed(0)} total / $${r.costPerUnit.toFixed(2)} per unit`,
      `                  (estimated via Siftly — not a guaranteed rate)`,
      '',
      `Incoterms:        FOB`,
      '',
      'Please provide:',
      '  • Total freight cost',
      '  • Cost per kg or CBM',
      '  • Estimated transit time',
      '  • All-in landed price if possible',
      '',
      'Thank you',
    ].join('\n');
    setQuoteModalText(body);
    setQuoteModalCompany(r);
    setQuoteModalVisible(true);
  }

  function sendQuoteEmail() {
    if (!quoteModalCompany) return;
    const subject  = encodeURIComponent(`Freight Quote Request — ${quoteModalCompany.mode.toUpperCase()} — ${rfqName.trim() || 'Amazon FBA Shipment'}`);
    const body     = encodeURIComponent(quoteModalText);
    const email    = quoteModalCompany.company.quoteEmail ?? '';
    const url      = `mailto:${email}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Cannot open Mail', 'Make sure a mail app is set up on your device.');
    });
  }

  // Build compare list from current results
  const compareList = searchResult
    ? searchResult.results.filter(r => compareIds.has(r.company.id))
    : [];

  return (
    <View style={ws.wrap}>
      {/* Compare modal */}
      {searchResult && (
        <FreightCompareModal
          visible={showCompare}
          onClose={() => setShowCompare(false)}
          companies={compareList}
          bestCostId={searchResult.bestCost.company.id}
          bestSpeedId={searchResult.bestSpeed.company.id}
          bestBalId={searchResult.bestBalance.company.id}
        />
      )}

      {/* Quote modal */}
      <Modal
        visible={quoteModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setQuoteModalVisible(false)}
      >
        <SafeAreaView style={cmp.safe}>
          <View style={cmp.header}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={cmp.title}>
                {quoteModalCompany?.company.name ?? 'Quote Request'}
              </Text>
              <Text style={{ fontSize: 11, color: DS.textMuted }}>
                {quoteModalCompany
                  ? `${quoteModalCompany.mode.toUpperCase()} · Est. $${quoteModalCompany.totalCostUsd.toFixed(0)} total · $${quoteModalCompany.costPerUnit.toFixed(2)}/unit`
                  : ''}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setQuoteModalVisible(false)}
              hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              activeOpacity={0.7}
            >
              <Text style={cmp.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 16 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[ws.hint, { marginBottom: 4 }]}>
              Edit the draft below then tap "Open in Mail App" to send.
              {quoteModalCompany?.company.quoteEmail
                ? ` Pre-addressed to ${quoteModalCompany.company.quoteEmail}.`
                : ' No direct email — leave the "To" field blank or paste the address from their website.'}
            </Text>
            <TextInput
              style={rfq.textArea}
              multiline
              value={quoteModalText}
              onChangeText={setQuoteModalText}
              scrollEnabled={false}
              textAlignVertical="top"
            />
            <Text style={ws.disclaimer}>
              Rates shown are estimated via Siftly — not a guaranteed price. Always confirm final rates with the forwarder before committing.
            </Text>
          </ScrollView>

          <View style={[cmp.footer, { gap: 10 }]}>
            <TouchableOpacity
              style={cmp.doneBtn}
              onPress={sendQuoteEmail}
              activeOpacity={0.85}
            >
              <Text style={cmp.doneTxt}>✉  Open in Mail App</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={fc2.quoteBtn}
              onPress={() => {
                setQuoteModalVisible(false);
                if (quoteModalCompany) handleOpenWebsite(quoteModalCompany.company.website);
              }}
              activeOpacity={0.85}
            >
              <Text style={fc2.quoteBtnTxt}>🌐  Open Website Instead</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Saved selection banner */}
      {savedSel && (
        <AppCard style={fc2.savedBanner}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={fc2.savedLabel}>SELECTED FORWARDER</Text>
            <Text style={fc2.savedName}>{savedSel.companyName}</Text>
            <Text style={fc2.savedMeta}>
              {savedSel.mode.toUpperCase()} · {savedSel.transitDays} · ${savedSel.costPerUnit.toFixed(2)}/unit
            </Text>
          </View>
          <TouchableOpacity
            onPress={clearSaved} activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={fc2.savedClear}>✕</Text>
          </TouchableOpacity>
        </AppCard>
      )}

      {/* Basic rate estimator */}
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Pair>
          <Field label="Unit weight (lbs)" value={weight} onChange={setWeight} placeholder="0.5" />
          <Field label="Quantity (units)" value={qty} onChange={setQty} placeholder="500" keyboard="number-pad" />
        </Pair>
        {wt > 0 && q > 0 && (
          <Text style={ws.hint}>Shipment: {totalKg.toFixed(1)} kg ({(wt*q).toFixed(1)} lbs)</Text>
        )}
        <CalcBtn label="Estimate Freight" onPress={() => setShow(true)} />
      </AppCard>

      {show && totalKg > 0 && (
        <AppCard style={{ gap: 10 }}>
          <Text style={ws.cardTitle}>{q} units — China → {profile.countryLabel}</Text>
          <AccuracyBadge level="planning" />
          {methods.map(m => {
            const total   = totalKg * m.rateKg;
            const perUnit = q > 0 ? total / q : 0;
            return (
              <View key={m.name} style={ws.freightCard}>
                <View style={ws.freightTop}>
                  <Text style={{ fontSize: 20 }}>{m.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={ws.freightName}>{m.name}</Text>
                    <Text style={ws.freightDays}>{m.days}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={ws.freightTotal}>{fmt(total, 0)}</Text>
                    <Text style={ws.freightPer}>{fmt(perUnit)}/unit</Text>
                  </View>
                </View>
              </View>
            );
          })}
          <Text style={ws.disclaimer}>Planning estimate — request a real freight quote before ordering. Actual rates vary by carrier, volume, and destination.</Text>
        </AppCard>
      )}

      {/* Compare Freight Companies */}
      <AppCard style={{ gap: 0, overflow: 'hidden' }}>

        {/* Card header */}
        <View style={fsc.header}>
          <View style={{ flex: 1, gap: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={fsc.headerTitle}>Compare Freight Companies</Text>
              <View style={fc2.estBadge}><Text style={fc2.estBadgeTxt}>ESTIMATED</Text></View>
            </View>
            <Text style={fsc.headerSub}>
              8 real forwarders ranked by cost, speed & service — estimates only, no live API.
            </Text>
          </View>
        </View>

        {/* Section: Origin */}
        <View style={fsc.section}>
          <View style={fsc.sectionLabelRow}>
            <Text style={fsc.sectionIcon}>📍</Text>
            <Text style={fsc.sectionLabel}>Origin Country</Text>
          </View>
          <View style={fsc.segRow}>
            {FREIGHT_ORIGIN_OPTS.map(o => {
              const active = origin === o.id;
              return (
                <TouchableOpacity
                  key={o.id}
                  style={[fsc.segBtn, active && fsc.segBtnActive]}
                  onPress={() => setOrigin(o.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[fsc.segTxt, active && fsc.segTxtActive]}>{o.label}</Text>
                  {active && <Text style={fsc.segCheck}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={fsc.divider} />

        {/* Section: Shipping Mode */}
        <View style={fsc.section}>
          <View style={fsc.sectionLabelRow}>
            <Text style={fsc.sectionIcon}>🚢</Text>
            <Text style={fsc.sectionLabel}>Shipping Mode</Text>
          </View>
          <View style={fsc.segRow}>
            {[
              { id: 'sea'     as ShipMode, label: 'Sea',     icon: '🚢' },
              { id: 'air'     as ShipMode, label: 'Air',     icon: '✈️' },
              { id: 'express' as ShipMode, label: 'Express', icon: '⚡' },
            ].map(m => {
              const active = prefMode === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[fsc.segBtn, active && fsc.segBtnActive, { flex: 1 }]}
                  onPress={() => setPrefMode(m.id)}
                  activeOpacity={0.75}
                >
                  <Text style={fsc.segModeIcon}>{m.icon}</Text>
                  <Text style={[fsc.segTxt, active && fsc.segTxtActive]}>{m.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={fsc.divider} />

        {/* Section: Priority */}
        <View style={fsc.section}>
          <View style={fsc.sectionLabelRow}>
            <Text style={fsc.sectionIcon}>🎯</Text>
            <Text style={fsc.sectionLabel}>What matters most?</Text>
          </View>
          <View style={fsc.segRow}>
            {[
              { id: 'cost'     as FreightPriority, label: 'Cheapest', icon: '💰' },
              { id: 'speed'    as FreightPriority, label: 'Fastest',  icon: '⚡' },
              { id: 'balanced' as FreightPriority, label: 'Balanced', icon: '⚖️' },
            ].map(p => {
              const active = priority === p.id;
              return (
                <TouchableOpacity
                  key={p.id}
                  style={[fsc.segBtn, active && fsc.segBtnActive, { flex: 1 }]}
                  onPress={() => setPriority(p.id)}
                  activeOpacity={0.75}
                >
                  <Text style={fsc.segModeIcon}>{p.icon}</Text>
                  <Text style={[fsc.segTxt, active && fsc.segTxtActive]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={fsc.divider} />

        {/* Section: Shipment details */}
        <View style={fsc.section}>
          <View style={fsc.sectionLabelRow}>
            <Text style={fsc.sectionIcon}>📦</Text>
            <Text style={fsc.sectionLabel}>Shipment Details</Text>
            <Text style={fsc.sectionOptional}>optional — improves accuracy & quote</Text>
          </View>

          <Field
            label="Product name"
            value={rfqName}
            onChange={setRfqName}
            placeholder="e.g. Yoga Mat Premium"
            keyboard="default"
          />

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
            <View style={{ flex: 1 }}><Field label="Length (cm)" value={rfqL} onChange={setRfqL} placeholder="40" /></View>
            <View style={{ flex: 1 }}><Field label="Width (cm)"  value={rfqW} onChange={setRfqW} placeholder="30" /></View>
            <View style={{ flex: 1 }}><Field label="Height (cm)" value={rfqH} onChange={setRfqH} placeholder="25" /></View>
          </View>

          <Pair>
            <Field label="Carton weight (kg)" value={cartonWtKg} onChange={setCartonWtKg} placeholder="5.0" />
            <Field label="Units per carton"   value={cartonUnitV} onChange={setCartonUnitV} placeholder="10" keyboard="number-pad" />
          </Pair>

          {n(rfqL) > 0 && n(rfqW) > 0 && n(rfqH) > 0 && (
            <View style={fsc.cbmPill}>
              <Text style={fsc.cbmTxt}>
                CBM per carton: {((n(rfqL) * n(rfqW) * n(rfqH)) / 1_000_000).toFixed(4)} m³
              </Text>
            </View>
          )}
        </View>

        {/* Search button */}
        <View style={fsc.searchBtnWrap}>
          <TouchableOpacity
            style={[fsc.searchBtn, !(wt > 0 && q > 0) && fsc.searchBtnDisabled]}
            onPress={() => { if (wt > 0 && q > 0) handleSearch(); }}
            activeOpacity={0.85}
          >
            <Text style={[fsc.searchBtnTxt, !(wt > 0 && q > 0) && { color: DS.textMuted }]}>
              {wt > 0 && q > 0 ? '🔍  Search Companies' : 'Enter weight & qty above first'}
            </Text>
          </TouchableOpacity>
        </View>

      </AppCard>

      {/* Company results */}
      {searchResult && (
        <AppCard style={{ gap: 12 }}>
          {/* Header + Compare Selected button */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={[ws.cardTitle, { flex: 1 }]}>
              Results — {searchResult.results.length} companies
            </Text>
            {compareIds.size >= 1 && (
              <Text style={fc2.compareCount}>{compareIds.size} selected</Text>
            )}
          </View>

          <AccuracyBadge level="planning" />

          {compareIds.size >= 2 && (
            <TouchableOpacity
              style={fc2.compareSelectedBtn}
              onPress={() => setShowCompare(true)}
              activeOpacity={0.85}
            >
              <Text style={fc2.compareSelectedTxt}>
                ⊞  Compare {compareIds.size} Selected →
              </Text>
            </TouchableOpacity>
          )}

          <View style={fc2.bestRow}>
            <View style={fc2.bestPill}>
              <Text style={fc2.bestPillLabel}>CHEAPEST</Text>
              <Text style={fc2.bestPillName} numberOfLines={1}>{searchResult.bestCost.company.name}</Text>
              <Text style={fc2.bestPillVal}>${searchResult.bestCost.costPerUnit.toFixed(2)}/unit</Text>
            </View>
            <View style={fc2.bestPill}>
              <Text style={fc2.bestPillLabel}>FASTEST</Text>
              <Text style={fc2.bestPillName} numberOfLines={1}>{searchResult.bestSpeed.company.name}</Text>
              <Text style={fc2.bestPillVal}>{searchResult.bestSpeed.transitDays}</Text>
            </View>
            <View style={fc2.bestPill}>
              <Text style={fc2.bestPillLabel}>TOP SCORE</Text>
              <Text style={fc2.bestPillName} numberOfLines={1}>{searchResult.bestBalance.company.name}</Text>
              <Text style={fc2.bestPillVal}>{searchResult.bestBalance.score}/100</Text>
            </View>
          </View>

          {searchResult.results.map(r => {
            const isSaved    = savedSel?.companyName === r.company.name && savedSel?.mode === r.mode;
            const isCompared = compareIds.has(r.company.id);
            return (
              <View key={r.company.id} style={[fc2.companyCard, isSaved && fc2.companyCardSaved, isCompared && fc2.companyCardCompare]}>
                {/* Card header */}
                <View style={fc2.companyTop}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <Text style={fc2.rank}>#{r.rank}</Text>
                      <Text style={fc2.companyName}>{r.company.name}</Text>
                      {r.company.badge && (
                        <View style={fc2.badge}>
                          <Text style={fc2.badgeTxt}>{r.company.badge}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={fc2.specialization} numberOfLines={1}>{r.company.specialization}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 1 }}>
                    <Text style={fc2.scoreNum}>{r.score}</Text>
                    <Text style={fc2.scoreLbl}>score</Text>
                  </View>
                </View>

                {/* Score bar */}
                <View style={fc2.scoreTrack}>
                  <View style={[fc2.scoreFill, { width: `${r.score}%` as any }]} />
                </View>

                {/* Metric pills */}
                <View style={fc2.companyMeta}>
                  <View style={fc2.metaPill}>
                    <Text style={fc2.metaLabel}>TOTAL</Text>
                    <Text style={fc2.metaVal}>${r.totalCostUsd.toFixed(0)}</Text>
                  </View>
                  <View style={fc2.metaPill}>
                    <Text style={fc2.metaLabel}>PER UNIT</Text>
                    <Text style={fc2.metaVal}>${r.costPerUnit.toFixed(2)}</Text>
                  </View>
                  <View style={fc2.metaPill}>
                    <Text style={fc2.metaLabel}>TRANSIT</Text>
                    <Text style={fc2.metaVal}>{r.transitDays}</Text>
                  </View>
                  <View style={fc2.metaPill}>
                    <Text style={fc2.metaLabel}>SERVICE</Text>
                    <Text style={fc2.metaVal}>★ {r.serviceScore.toFixed(1)}</Text>
                  </View>
                </View>

                {/* Action row 1: Compare + Website */}
                <View style={fc2.actionRow}>
                  <TouchableOpacity
                    style={[fc2.actionBtn, isCompared && fc2.actionBtnActive]}
                    onPress={() => toggleCompare(r.company.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={[fc2.actionBtnTxt, isCompared && fc2.actionBtnTxtActive]}>
                      {isCompared ? '✓ Added' : '⊞ Compare'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={fc2.actionBtn}
                    onPress={() => handleOpenWebsite(r.company.website)}
                    activeOpacity={0.8}
                  >
                    <Text style={fc2.actionBtnTxt}>🌐 Website</Text>
                  </TouchableOpacity>
                </View>

                {/* Action row 2: Request Quote */}
                <TouchableOpacity
                  style={fc2.quoteBtn}
                  onPress={() => openQuoteModal(r)}
                  activeOpacity={0.8}
                >
                  <Text style={fc2.quoteBtnTxt}>✉  Request Quote</Text>
                </TouchableOpacity>

                {/* Select This Forwarder */}
                <TouchableOpacity
                  style={[fc2.selectBtn, isSaved && fc2.selectBtnSaved]}
                  onPress={() => isSaved ? clearSaved() : saveSelection(r)}
                  activeOpacity={0.8}
                >
                  <Text style={[fc2.selectBtnTxt, isSaved && fc2.selectBtnTxtSaved]}>
                    {isSaved ? '✓ Selected — Tap to Remove' : 'Select This Forwarder'}
                  </Text>
                </TouchableOpacity>
                {isSaved && (
                  <FeasibilityHeart
                    type="freight"
                    label={`${r.company.name} — $${r.costPerUnit.toFixed(2)}/unit, ${r.transitDays}`}
                    data={{ companyName: r.company.name, mode: r.mode, costPerUnit: r.costPerUnit, transitDays: r.transitDays, totalCostUsd: r.totalCostUsd, score: r.score }}
                  />
                )}
              </View>
            );
          })}

          {compareIds.size >= 2 && (
            <TouchableOpacity
              style={fc2.compareSelectedBtn}
              onPress={() => setShowCompare(true)}
              activeOpacity={0.85}
            >
              <Text style={fc2.compareSelectedTxt}>
                ⊞  Compare {compareIds.size} Selected →
              </Text>
            </TouchableOpacity>
          )}

          <Text style={ws.disclaimer}>
            Estimated rates only — based on curated multipliers, not live API data. Company list is real but scores and costs are indicative. Always get quotes directly from 2–3 forwarders before committing to a shipment.
          </Text>
        </AppCard>
      )}

    </View>
  );
}

// ─── 5. Duties & Taxes ───────────────────────────────────────────────────────

function DutiesWorkspace() {
  const { symbol, marketplace } = useCurrency();
  const profile    = getMarketplaceProfile(marketplace);
  const dutyRates  = getDutyRates(marketplace);
  const [fob,        setFob]        = useState('');
  const [qty,        setQty]        = useState('');
  const [di,         setDi]         = useState(0);
  const [hsCode,      setHsCode]      = useState('');
  const [includeVat,  setIncludeVat]  = useState(false);
  const [showHsHelper,setShowHsHelper]= useState(false);
  const [show,        setShow]        = useState(false);

  const fobV = n(fob); const q = n(qty);
  const rate = dutyRates[di]?.rate ?? 0;
  const dutyPerUnit = fobV * rate;
  const totalDuty = dutyPerUnit * q;
  const vatRate = profile.vatRate ?? 0;
  const vatPerUnit = includeVat && profile.vatRate !== null ? (fobV + dutyPerUnit) * vatRate : 0;
  const landedPerUnit = fobV + dutyPerUnit + vatPerUnit;
  const hasHsCode = hsCode.trim() !== '';

  return (
    <View style={ws.wrap}>
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Pair>
          <Field label={`FOB price / unit (${symbol})`} value={fob} onChange={setFob} placeholder="5.00" />
          <Field label="Order quantity" value={qty} onChange={setQty} placeholder="500" keyboard="number-pad" />
        </Pair>
        <Field
          label="HS code (optional)"
          value={hsCode}
          onChange={setHsCode}
          placeholder="e.g. 9506.91"
          keyboard="default"
          hint="Verify with a customs broker — do not rely on this app for official classification"
        />
        <TouchableOpacity style={ws.helperLink} onPress={() => setShowHsHelper(v => !v)} activeOpacity={0.7}>
          <Text style={ws.helperLinkTxt}>{showHsHelper ? '▲' : '▼'} Where do I find HS codes?</Text>
        </TouchableOpacity>
        {showHsHelper && (
          <View style={ws.helperBox}>
            <Text style={ws.helperTitle}>HS / HTS Code Resources</Text>
            {[
              marketplace === 'US' ? '• USITC HTS database — hts.usitc.gov' : null,
              marketplace === 'UK' ? '• UK Global Tariff — trade-tariff.service.gov.uk' : null,
              (marketplace === 'DE') ? '• EU TARIC — taxation_customs.ec.europa.eu' : null,
              '• World Customs Organization — wcoomd.org',
              '• Ask your customs broker — they classify for you.',
            ].filter(Boolean).map(tip => (
              <Text key={tip!} style={ws.helperLabel}>{tip}</Text>
            ))}
            <Text style={ws.disclaimer}>
              HS/HTS classification is a legal determination. Always verify with a licensed customs broker before importing.
            </Text>
          </View>
        )}
        <Text style={ws.chipLabel}>PRODUCT CATEGORY — {profile.importDutyLabel.toUpperCase()}</Text>
        <View style={ws.chips}>
          {dutyRates.map((d, i) => (
            <TouchableOpacity key={i} style={[ws.chip, di === i && ws.chipActive]} onPress={() => setDi(i)}>
              <Text style={[ws.chipTxt, di === i && ws.chipTxtActive]}>{d.label} {(d.rate*100).toFixed(0)}%</Text>
            </TouchableOpacity>
          ))}
        </View>
        {profile.vatRate !== null ? (
          <TouchableOpacity style={ws.toggleRow} onPress={() => setIncludeVat(v => !v)} activeOpacity={0.7}>
            <View style={[ws.toggleBox, includeVat && ws.toggleBoxActive]}>
              {includeVat && <Text style={ws.toggleCheck}>✓</Text>}
            </View>
            <Text style={ws.toggleTxt}>Include {profile.taxLabel} ({(profile.vatRate * 100).toFixed(0)}%)</Text>
          </TouchableOpacity>
        ) : (
          <Text style={ws.hint}>{profile.taxLabel}</Text>
        )}
        <CalcBtn label="Calculate Duties" onPress={() => setShow(true)} />
      </AppCard>

      {show && fobV > 0 && (
        <AppCard style={{ gap: 10 }}>
          <Text style={ws.cardTitle}>Results</Text>
          <AccuracyBadge level={hasHsCode ? 'planning' : 'verify'} />
          {!hasHsCode && (
            <Text style={ws.hint}>Add an HS code for more accurate duty estimates</Text>
          )}
          <View style={ws.heroRow}>
            <View style={{ gap: 2 }}>
              <Text style={ws.heroLabel}>Duty Per Unit</Text>
              <Text style={[ws.heroValue, { color: DS.warning }]}>{symbol}{dutyPerUnit.toFixed(2)}</Text>
              <Text style={ws.heroUnit}>{(rate*100).toFixed(0)}% on FOB value — {profile.importDutyLabel}</Text>
            </View>
          </View>
          {[
            ['Category',        `${dutyRates[di]?.label ?? ''}`],
            ['Duty rate',       `${(rate*100).toFixed(0)}%`],
            ['Duty per unit',   `${symbol}${dutyPerUnit.toFixed(2)}`],
            includeVat && vatPerUnit > 0 ? [`${profile.taxLabel}`, `${symbol}${vatPerUnit.toFixed(2)}`] : null,
            ['Landed per unit', `${symbol}${landedPerUnit.toFixed(2)}`],
            q > 0 ? ['Total duty bill', `${symbol}${totalDuty.toFixed(0)}`] : null,
          ].filter(Boolean).map(([l, v]: any) => <Row key={l} label={l} value={v} />)}
          <Text style={ws.disclaimer}>{profile.dutyDisclaimer}</Text>
        </AppCard>
      )}
    </View>
  );
}

// ─── Workspace styles (shared) ────────────────────────────────────────────────

const ws = StyleSheet.create({
  wrap: { gap: 12 },

  heroRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  heroLabel:  { fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  heroValue:  { fontSize: 36, fontWeight: '900', letterSpacing: -1.2, lineHeight: 42 },
  heroUnit:   { fontSize: 12, color: DS.textMuted, marginTop: -4 },

  metrics:       { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 14, padding: 14 },
  metric:        { flex: 1, alignItems: 'center', gap: 3 },
  metricVal:     { fontSize: 14, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },
  metricLbl:     { fontSize: 9, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  metDiv:        { width: 1, height: 28, backgroundColor: DS.border },
  metricsRow:    { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  metricBlock:   { flex: 1, alignItems: 'center', gap: 2 },
  metricLblTop:  { fontSize: 10, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  metricBig:     { fontSize: 28, fontWeight: '900', letterSpacing: -0.8, lineHeight: 34 },
  metricUnit:    { fontSize: 11, color: DS.textMuted },
  bkLabel:       { fontSize: 13, color: DS.textSecondary, flex: 1 },
  bkVal:         { fontSize: 13, fontWeight: '700' },

  cardTitle:  { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  hint:       { fontSize: 12, color: DS.textMuted, lineHeight: 17 },
  disclaimer: { fontSize: 11, color: DS.textMuted, lineHeight: 16, fontStyle: 'italic' },

  warnBox:    { backgroundColor: DS.warningBg, borderRadius: 12, borderWidth: 1, borderColor: DS.warning + '50', padding: 12, gap: 8 },
  warnRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  warnIcon:   { fontSize: 12, color: DS.warningText, marginTop: 1 },
  warnTxt:    { flex: 1, fontSize: 12, color: DS.warningText, lineHeight: 17 },

  chipLabel:  { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5 },
  chips:      { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: DS.border,
    borderRadius: 20, backgroundColor: DS.bgSubtle,
  },
  chipActive: { backgroundColor: DS.accentLight, borderColor: DS.accent },
  chipTxt:    { fontSize: 11, fontWeight: '600', color: DS.textSecondary },
  chipTxtActive: { color: DS.accent, fontWeight: '700' },

  acosHint:   { backgroundColor: DS.bgSubtle, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  acosHintTxt:{ fontSize: 13, fontWeight: '700' },

  banner:          { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.accentLight, borderRadius: 10, padding: 12 },
  bannerTxt:       { fontSize: 13, fontWeight: '600', color: DS.accentDark },
  refreshBtn:      { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgElevated },
  refreshBtnTxt:   { fontSize: 11, fontWeight: '700', color: DS.textSecondary },

  freightCard: {
    borderWidth: 1, borderColor: DS.border, borderRadius: 14,
    padding: 12, gap: 4,
  },
  freightTop:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  freightName: { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  freightDays: { fontSize: 11, color: DS.textMuted },
  freightTotal:{ fontSize: 15, fontWeight: '800', color: DS.textPrimary, textAlign: 'right' },
  freightPer:  { fontSize: 11, color: DS.textMuted, textAlign: 'right' },

  toggleRow:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleBox:     { width: 20, height: 20, borderWidth: 1.5, borderColor: DS.border, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: DS.bgSubtle },
  toggleBoxActive: { backgroundColor: DS.accent, borderColor: DS.accent },
  toggleCheck:   { fontSize: 12, fontWeight: '900', color: '#fff' },
  toggleTxt:     { fontSize: 13, fontWeight: '600', color: DS.textSecondary, flex: 1 },

  // Collapsible section headers
  collapseRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  collapseTitle: { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  collapseChev:  { fontSize: 11, fontWeight: '700', color: DS.textMuted },
  subTitle:      { fontSize: 12, fontWeight: '800', color: DS.textSecondary, letterSpacing: -0.1 },

  // Compact data tables (scenario / sensitivity)
  tableRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: DS.border },
  tableCell:     { flex: 1, fontSize: 11, fontWeight: '600', color: DS.textSecondary, textAlign: 'right' },
  tableLblCell:  { flex: 1.6, fontSize: 11, fontWeight: '600', color: DS.textSecondary, textAlign: 'left' },
  tableHdr:      { fontSize: 9, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Helper accordion (fee helper / HS helper)
  helperLink:    { paddingVertical: 4 },
  helperLinkTxt: { fontSize: 12, fontWeight: '600', color: DS.accent },
  helperBox:     { backgroundColor: DS.bgSubtle, borderRadius: 10, padding: 10, gap: 6 },
  helperTitle:   { fontSize: 12, fontWeight: '800', color: DS.textPrimary },
  helperRow:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  helperLabel:   { fontSize: 11, color: DS.textSecondary, flex: 1 },
  helperValue:   { fontSize: 11, fontWeight: '700', color: DS.textPrimary },
});

// Load Product card styles
const lp = StyleSheet.create({
  productRow:   { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  productTitle: { fontSize: 13, fontWeight: '700', color: DS.textPrimary, lineHeight: 18 },
  productPrice: { fontSize: 11, color: DS.textSecondary },
  verdict:      { fontSize: 10, color: DS.textMuted, fontStyle: 'italic' },
  badge:        { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, flexShrink: 0 },
  badgeTxt:     { fontSize: 10, fontWeight: '800' },
  loadBtn:      { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 12, alignItems: 'center' },
  loadBtnTxt:   { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});

// RFQ styles
const rfq = StyleSheet.create({
  textArea: {
    borderWidth: 1, borderColor: DS.border, borderRadius: 10,
    padding: 10, fontSize: 12, color: DS.textPrimary,
    backgroundColor: DS.bgSubtle, fontFamily: 'monospace',
    minHeight: 220,
  },
  mailBtn: {
    backgroundColor: DS.info, borderRadius: DS.radiusButton,
    paddingVertical: 12, alignItems: 'center',
  },
  mailBtnTxt: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});

// Freight Company Search styles
const fc2 = StyleSheet.create({
  savedBanner: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: DS.accentLight,
    borderColor: DS.accent + '40', borderWidth: 1,
    gap: 10,
  },
  savedLabel: { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  savedName:  { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  savedMeta:  { fontSize: 11, color: DS.textSecondary },
  savedClear: { fontSize: 18, color: DS.textMuted, fontWeight: '300', paddingTop: 2 },

  bestRow: { flexDirection: 'row', gap: 6 },
  bestPill: {
    flex: 1, backgroundColor: DS.bgSubtle,
    borderRadius: 12, borderWidth: 1, borderColor: DS.border,
    padding: 8, gap: 2,
  },
  bestPillLabel: { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5 },
  bestPillName:  { fontSize: 11, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  bestPillVal:   { fontSize: 11, fontWeight: '700', color: DS.accent },

  companyCard: {
    borderWidth: 1.5, borderColor: DS.border,
    borderRadius: 16, padding: 12, gap: 8,
    backgroundColor: DS.bgSubtle,
  },
  companyCardSaved: {
    borderColor: DS.accent,
    backgroundColor: DS.accentLight,
  },
  companyTop:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  rank:           { fontSize: 11, fontWeight: '800', color: DS.textMuted },
  companyName:    { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  specialization: { fontSize: 10, color: DS.textMuted },
  badge: {
    backgroundColor: DS.accentLight, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  badgeTxt: { fontSize: 9, fontWeight: '800', color: DS.accent },
  scoreNum:  { fontSize: 22, fontWeight: '900', color: DS.accent, letterSpacing: -0.5 },
  scoreLbl:  { fontSize: 9, fontWeight: '600', color: DS.textMuted },

  scoreTrack: { height: 4, backgroundColor: DS.border, borderRadius: 2, overflow: 'hidden' },
  scoreFill:  { height: 4, borderRadius: 2, backgroundColor: DS.accent },

  companyMeta: { flexDirection: 'row', gap: 6 },
  metaPill: {
    flex: 1, backgroundColor: DS.bgCanvas,
    borderRadius: 8, padding: 6, gap: 2,
    alignItems: 'center',
  },
  metaLabel: { fontSize: 8, fontWeight: '700', color: DS.textMuted, letterSpacing: 1 },
  metaVal:   { fontSize: 11, fontWeight: '800', color: DS.textPrimary },

  selectBtn: {
    backgroundColor: DS.accentLight, borderRadius: DS.radiusButton,
    borderWidth: 1, borderColor: DS.accent + '40',
    paddingVertical: 10, alignItems: 'center',
  },
  selectBtnSaved: {
    backgroundColor: DS.accent, borderColor: DS.accent,
  },
  selectBtnTxt:      { fontSize: 13, fontWeight: '700', color: DS.accent },
  selectBtnTxtSaved: { color: '#fff' },

  estBadge:    { backgroundColor: DS.warningBg, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  estBadgeTxt: { fontSize: 8, fontWeight: '800', color: DS.warningText, letterSpacing: 1.5 },

  companyCardCompare: {
    borderColor: DS.warning,
    backgroundColor: DS.warningBg,
  },
  compareCount: { fontSize: 11, fontWeight: '700', color: DS.accent },

  compareSelectedBtn: {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 12, alignItems: 'center',
  },
  compareSelectedTxt: { fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  actionRow:      { flexDirection: 'row', gap: 8 },
  actionBtn: {
    flex: 1, borderWidth: 1, borderColor: DS.border,
    borderRadius: 10, paddingVertical: 8,
    alignItems: 'center', backgroundColor: DS.bgCanvas,
  },
  actionBtnActive: {
    backgroundColor: DS.warningBg, borderColor: DS.warning,
  },
  actionBtnTxt:       { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  actionBtnTxtActive: { color: DS.warningText, fontWeight: '800' },

  quoteBtn: {
    borderWidth: 1, borderColor: DS.accent + '50',
    borderRadius: 10, paddingVertical: 9,
    alignItems: 'center', backgroundColor: DS.accentLight,
  },
  quoteBtnTxt: { fontSize: 13, fontWeight: '700', color: DS.accent },
});

// Freight search card styles
const fsc = StyleSheet.create({
  header: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14,
    borderBottomWidth: 1, borderBottomColor: DS.border,
    backgroundColor: DS.bgCard,
  },
  headerTitle: { fontSize: 15, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  headerSub:   { fontSize: 11, color: DS.textMuted, lineHeight: 16 },

  section:    { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  divider:    { height: 1, backgroundColor: DS.border, marginHorizontal: 0 },

  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionIcon:     { fontSize: 14 },
  sectionLabel:    { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.1 },
  sectionOptional: { fontSize: 10, color: DS.textMuted, fontStyle: 'italic', marginLeft: 2 },

  segRow: { flexDirection: 'row', gap: 6 },
  segBtn: {
    flex: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 4,
    paddingVertical: 10, paddingHorizontal: 6,
    borderRadius: 12, borderWidth: 1.5, borderColor: DS.border,
    backgroundColor: DS.bgSubtle,
  },
  segBtnActive: {
    backgroundColor: DS.accent, borderColor: DS.accent,
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 3,
  },
  segTxt:        { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  segTxtActive:  { color: '#fff', fontWeight: '800' },
  segCheck:      { fontSize: 10, color: '#fff', fontWeight: '900' },
  segModeIcon:   { fontSize: 14 },

  cbmPill: {
    backgroundColor: DS.accentLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  cbmTxt: { fontSize: 11, fontWeight: '600', color: DS.accent },

  searchBtnWrap: { padding: 16, paddingTop: 0 },
  searchBtn: {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 15, alignItems: 'center',
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  searchBtnDisabled: {
    backgroundColor: DS.bgSubtle, shadowOpacity: 0,
    elevation: 0, borderWidth: 1, borderColor: DS.border,
  },
  searchBtnTxt: { fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

function SavedHistoryCard({ item }: { item: FBASaved }) {
  const isLegacy = !item.currency;
  const daysOld  = Math.floor((Date.now() - new Date(item.savedAt).getTime()) / 86_400_000);
  const timeAgo  = daysOld === 0 ? 'today' : daysOld === 1 ? '1d ago' : `${daysOld}d ago`;
  const isStale  = daysOld > 45;
  return (
    <View style={hist.card}>
      <View style={hist.row}>
        <Text style={hist.cardName} numberOfLines={1}>{item.productName ?? 'Untitled calculation'}</Text>
        {!isLegacy && (
          <Text style={hist.rightMeta} numberOfLines={1}>
            {item.margin.toFixed(0)}% · {item.roi.toFixed(0)}% · {timeAgo}
          </Text>
        )}
      </View>
      {isStale && (
        <Text style={hist.staleTxt}>⚠ {daysOld}d old — re-verify fees</Text>
      )}
    </View>
  );
}
const hist = StyleSheet.create({
  card:      { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: DS.border },
  row:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardName:  { fontSize: 14, fontWeight: '700', color: DS.textPrimary, flex: 1 },
  rightMeta: { fontSize: 12, color: DS.textMuted, fontWeight: '500', flexShrink: 0 },
  staleTxt:  { fontSize: 10, color: DS.warning, fontWeight: '600', marginTop: 3 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:     { fontSize: 13, fontWeight: '800', color: DS.textPrimary },
  clearAll:  { fontSize: 11, fontWeight: '700', color: DS.textMuted },
});

type NavProp = StackNavigationProp<RootStackParamList, 'Main'>;

export default function ProfitLabScreen() {
  const { isOnline } = useNetworkStatus();
  const navigation = useNavigation<NavProp>();
  const [calcType,    setCalcType]    = useState<CalcType>('fba');
  const [saveLoading,  setSaveLoading]  = useState(false);
  const [saveSuccess,  setSaveSuccess]  = useState(false);
  const [saveError,    setSaveError]    = useState('');
  const [lastSavedAt,  setLastSavedAt]  = useState<string | null>(null);
  const [savedCalcs,  setSavedCalcs]  = useState<FBASaved[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  const { entries: vaultEntries } = useVault();
  const latestEntry = vaultEntries[0] ?? null;
  const { activeProduct } = useActiveProduct();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.savedCalculations)
      .then(raw => { if (raw) { const p = safeParseJSON<FBASaved[]>(raw); if (p) setSavedCalcs(p); } })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (saveSuccess) {
      AsyncStorage.getItem(STORAGE_KEYS.savedCalculations)
        .then(raw => { if (raw) { const p = safeParseJSON<FBASaved[]>(raw); if (p) setSavedCalcs(p); } })
        .catch(() => {});
    }
  }, [saveSuccess]);

  const handleSaveFBA = useCallback(async (
    netProfit: number, margin: number, roi: number, inputs: FBAInputs,
    currency: CurrencyCode, marketplaceId: MarketplaceId,
    productName: string, hsCode: string, asin: string, confidenceScore: number,
  ) => {
    setSaveLoading(true); setSaveSuccess(false); setSaveError('');
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.savedCalculations);
      const existing = raw ? JSON.parse(raw) : [];
      const profile = getMarketplaceProfile(marketplaceId);
      const savedAt = new Date().toISOString();
      const entry: FBASaved = {
        inputs, netProfit, margin, roi, savedAt,
        currency, marketplaceId, amazonMarketplace: profile.amazonMarketplace,
        confidenceScore,
        ...(productName.trim() !== '' && { productName: productName.trim() }),
        ...(hsCode.trim()      !== '' && { hsCode:      hsCode.trim()      }),
        ...(asin.trim()        !== '' && { asin:        asin.trim()        }),
      };
      await AsyncStorage.setItem(
        STORAGE_KEYS.savedCalculations,
        JSON.stringify([entry, ...existing].slice(0, 50)),
      );
      pipeline.setCostModel({
        sellingPrice:    n(inputs.sellingPrice),
        unitCost:        n(inputs.productCost),
        freight:         n(inputs.freight),
        fbaFee:          n(inputs.fbaFees),
        referralFee:     n(inputs.referralFee),
        duties:          n(inputs.duties),
        packaging:       n(inputs.packaging),
        netProfit,
        marginPct:       margin,
        roiPct:          roi,
        totalCost:       n(inputs.productCost) + n(inputs.freight) + n(inputs.fbaFees) + n(inputs.referralFee) + n(inputs.duties) + n(inputs.packaging),
        unitsOrdered:    n(inputs.unitsOrdered),
        totalInvestment: (n(inputs.productCost) + n(inputs.freight) + n(inputs.duties) + n(inputs.packaging)) * n(inputs.unitsOrdered),
        savedAt,
      });
      setSaveSuccess(true);
      setLastSavedAt(savedAt);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save. Try again.');
    } finally {
      setSaveLoading(false);
    }
  }, []);

  const handleUnsaveFBA = useCallback(async () => {
    if (!lastSavedAt) return;
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.savedCalculations);
      const existing: FBASaved[] = raw ? JSON.parse(raw) : [];
      const updated = existing.filter(e => e.savedAt !== lastSavedAt);
      await AsyncStorage.setItem(STORAGE_KEYS.savedCalculations, JSON.stringify(updated));
      setSavedCalcs(updated);
      setSaveSuccess(false);
      setLastSavedAt(null);
    } catch { /* silent */ }
  }, [lastSavedAt]);

  function handleSelect(id: CalcType) {
    setCalcType(id);
    setSaveSuccess(false);
    setSaveError('');
  }

  const activeCalc = CALCS.find(c => c.id === calcType)!;
  const { toastMsg, toastVisible, toastType, showToast, hideToast } = useToast();
  const pipeline     = usePipeline();
  const intelProfile = useProductIntelligence();
  const decisionSim  = useDecisionSimulation(intelProfile);
  const prevCostModelSavedAt = React.useRef<string | null>(null);
  useEffect(() => {
    const savedAt = pipeline.costModel?.savedAt ?? null;
    if (savedAt && savedAt !== prevCostModelSavedAt.current) {
      prevCostModelSavedAt.current = savedAt;
      showToast('Cost model saved to pipeline');
    }
  }, [pipeline.costModel?.savedAt]);

  const CALC_HELP: Record<CalcType, FeatureKey> = {
    fba:      'calc_fba',
    breakeven:'calc_breakeven',
    ppc:      'calc_ppc',
    freight:  'calc_freight',
    duties:   'calc_duties',
  };

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Toast message={toastMsg} visible={toastVisible} onHide={hideToast} type={toastType} />
      <AppHeader helpKey={CALC_HELP[calcType]} />
      <OfflineBanner visible={!isOnline} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Calculator selector */}
        <CalcSelector active={calcType} onSelect={handleSelect} />

        {/* Calculator description */}
        <View style={s.calcDesc}>
          <Text style={s.calcDescText}>{activeCalc.summary}</Text>
        </View>

        {/* Active workspace */}
        {calcType === 'fba' && (
          <FBAWorkspace
            onSave={handleSaveFBA}
            onUnsave={handleUnsaveFBA}
            saveLoading={saveLoading}
            saveSuccess={saveSuccess}
            saveError={saveError}
            latestEntry={latestEntry}
            activeProductPrice={activeProduct?.price ?? null}
            activeProductName={activeProduct?.name ?? ''}
          />
        )}
        {calcType === 'breakeven' && <BreakevenWorkspace />}
        {calcType === 'ppc'       && <PPCWorkspace />}
        {calcType === 'freight'   && <FreightWorkspace />}
        {calcType === 'duties'    && <DutiesWorkspace />}

        {/* Decision simulator — what-if analysis on financials */}
        {intelProfile && (
          <DecisionSimulationPanel sim={decisionSim} baseProfile={intelProfile} />
        )}

        {/* Recent Calculations (FBA only) */}
        {calcType === 'fba' && savedCalcs.length > 0 && (
          <AppCard style={{ gap: 8 }}>
            <View style={hist.headerRow}>
              <TouchableOpacity onPress={() => setShowHistory(v => !v)} activeOpacity={0.7} style={{ flex: 1 }}>
                <Text style={hist.title}>Recent Calculations ({savedCalcs.length})</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  await AsyncStorage.removeItem(STORAGE_KEYS.savedCalculations);
                  setSavedCalcs([]);
                }}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={hist.clearAll}>Clear All</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowHistory(v => !v)} activeOpacity={0.7} style={{ marginLeft: 10 }}>
                <Text style={ws.collapseChev}>{showHistory ? '▲' : '▼'}</Text>
              </TouchableOpacity>
            </View>
            {showHistory && savedCalcs.map((item, i) => (
              <SavedHistoryCard key={`${item.savedAt}-${i}`} item={item} />
            ))}
          </AppCard>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Screen styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: DS.bgCanvas },
  calcDesc:  { backgroundColor: DS.accentLight, borderRadius: 12, borderWidth: 1, borderColor: DS.accent + '30', paddingHorizontal: 14, paddingVertical: 10 },
  calcDescText: { fontSize: 13, color: DS.accent, lineHeight: 20, fontWeight: '500' },
  scroll:    { flex: 1 },
  content:   {
    paddingHorizontal: DS.pagePadding,
    paddingTop: DS.sectionGap,
    paddingBottom: 80,
    gap: DS.sectionGap,
  },
});

const fc = StyleSheet.create({
  banner: {
    backgroundColor: DS.accentLight,
    borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.accent + '30',
    padding: 18,
  },
  left:   { gap: 6 },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  label:  { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  title:  { fontSize: 17, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  sub:    { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  cta:    { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start', marginTop: 4 },
  ctaTxt: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});
