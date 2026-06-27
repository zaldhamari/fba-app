/**
 * ProfitLabScreen — Multi-calculator Profit Lab
 *
 * 5 calculators accessed via a selector grid.
 * Only one workspace is shown at a time — no stacked scroll clutter.
 * Preserves the Siftly DS, card style, and all existing FBA logic.
 */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { api } from '../services/api';
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
  | 'ppc' | 'storage' | 'cashflow'
  | 'duties' | 'landed' | 'capital';

const CALCS: {
  id: CalcType; abbr: string; color: string; name: string; desc: string; badge?: string; summary: string;
}[] = [
  { id: 'fba',       abbr: 'P&L',  color: DS.accent, name: 'FBA Profit',      desc: 'Full unit economics',    badge: 'Start here', summary: 'Calculate your net profit, margin %, and ROI per unit after all Amazon fees. Use your landed cost as product cost — never the raw supplier quote.' },
  { id: 'landed',    abbr: 'LC',   color: '#0891B2', name: 'Landed Cost',      desc: 'True cost to warehouse',                     summary: 'Breaks down your true per-unit cost: supplier price + freight + duties + packaging. Run this first — the landed cost number flows into FBA Profit and Break-even.' },
  { id: 'capital',   abbr: '$$$',  color: DS.gold, name: 'Launch Capital',   desc: 'Total budget needed',    badge: 'New',        summary: 'Estimates your full launch budget: inventory × landed cost + 90-day PPC + photography + listing + Vine + shipping to FBA + buffer. Know your cash need before you commit.' },
  { id: 'breakeven', abbr: 'BE',   color: DS.successText, name: 'Break-even',       desc: 'Units to recover costs',                     summary: 'Shows how many units you need to sell to recover your total investment. Enter a conservative launch velocity — 30-50% of what the top competitor sells.' },
  { id: 'ppc',       abbr: 'PPC',  color: DS.warningText, name: 'PPC / ACoS',       desc: 'Ad spend calculator',   badge: 'Popular',    summary: 'Calculates your break-even ACoS and recommended launch ad budget. Run this before setting your PPC spend — enter the result into Launch Capital.' },
  { id: 'storage',   abbr: 'STR',  color: '#7C3AED', name: 'Storage Fees',     desc: 'FBA storage costs',                          summary: 'Calculates monthly and long-term FBA storage fees by unit size tier. Essential for Q4 planning — long-term fees spike dramatically after 365 days and destroy margins on slow-moving inventory.' },
  { id: 'cashflow',  abbr: 'CF',   color: '#0F766E', name: 'Cash Flow',        desc: 'Months to full ROI',                         summary: 'Projects your monthly cash position from launch to full ROI recovery. Shows when you turn cash-flow positive, how much capital is tied up each month, and flags if you need a restock before you break even.' },
  { id: 'duties',    abbr: 'TAX',  color: '#BE185D', name: 'Duties & VAT',     desc: 'Import tax estimate',                        summary: 'Estimates import duty and VAT by country and HS tariff code. Take the duty % result and enter it into Feasibility Check and Landed Cost.' },
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
  keyboard = 'decimal-pad', hint, needsInput,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: KeyboardTypeOptions; hint?: string;
  needsInput?: boolean;
}) {
  const prompt = needsInput && !value;
  return (
    <View style={[fi.wrap, prompt && fi.needsWrap]}>
      <InputField
        label={label}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={prompt ? DS.warning : DS.textMuted}
        keyboardType={keyboard}
        hint={prompt ? '⚑ Enter manually' : hint}
        containerStyle={{ flex: 1 }}
      />
    </View>
  );
}
const fi = StyleSheet.create({
  wrap:      { flex: 1, minWidth: 130 },
  needsWrap: {
    borderLeftWidth: 3,
    borderLeftColor: DS.warning,
    paddingLeft: 6,
    backgroundColor: DS.warning + '08',
    borderRadius: DS.radiusInput,
  },
});

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
  txt: { fontSize: 15, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.2 },
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

// ─── Calculator Selector — 2-column card grid ────────────────────────────────
// Each card has a consistent colored abbreviation block, name, and short desc.
// No emoji — abbreviations render identically on all platforms and OS versions.

function CalcSelector({ active, onSelect }: { active: CalcType; onSelect: (id: CalcType) => void }) {
  const activeCalc = CALCS.find(c => c.id === active) ?? CALCS[0];

  return (
    <View style={sel.wrap}>
      {/* 2-column grid */}
      <View style={sel.grid}>
        {CALCS.map(c => {
          const isActive = c.id === active;
          return (
            <TouchableOpacity
              key={c.id}
              style={[sel.card, isActive && sel.cardActive]}
              onPress={() => onSelect(c.id)}
              activeOpacity={0.75}
            >
              {/* Icon block */}
              <View style={[sel.iconBlock, { backgroundColor: isActive ? DS.bgCard + '22' : c.color + '15' }]}>
                <Text style={[sel.abbr, { color: isActive ? DS.bgCard : c.color }]}>{c.abbr}</Text>
              </View>

              {/* Text */}
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[sel.name, isActive && sel.nameActive]} numberOfLines={1}>{c.name}</Text>
                <Text style={[sel.desc, isActive && sel.descActive]} numberOfLines={1}>{c.desc}</Text>
              </View>

              {/* Badge */}
              {c.badge && (
                <View style={[
                  sel.badge,
                  isActive && sel.badgeActive,
                  !isActive && c.badge === 'New'      && sel.badgeNew,
                  !isActive && c.badge === 'Popular'  && sel.badgePopular,
                  !isActive && c.badge === 'Start here' && sel.badgeStart,
                ]}>
                  <Text style={[
                    sel.badgeTxt,
                    isActive && sel.badgeTxtActive,
                    !isActive && c.badge === 'New'      && sel.badgeTxtNew,
                    !isActive && c.badge === 'Popular'  && sel.badgeTxtPopular,
                    !isActive && c.badge === 'Start here' && sel.badgeTxtStart,
                  ]}>{c.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Active calculator description */}
      <View style={[sel.descCard, { borderColor: activeCalc.color + '40', backgroundColor: activeCalc.color + '08' }]}>
        <View style={[sel.descDot, { backgroundColor: activeCalc.color }]} />
        <Text style={[sel.descText, { color: activeCalc.color }]}>{activeCalc.summary}</Text>
      </View>
    </View>
  );
}

const sel = StyleSheet.create({
  wrap:  { gap: 12 },
  grid:  { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 10 },

  card: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10,
    width: '47.5%' as any,
    backgroundColor: DS.bgCard,
    borderRadius: DS.radiusCard, borderWidth: 1.5, borderColor: DS.border,
    padding: 12,
  },
  cardActive: {
    backgroundColor: DS.accent, borderColor: DS.accent,
  },

  iconBlock: {
    width: 40, height: 40, borderRadius: 10,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    flexShrink: 0,
  },
  abbr: {
    fontSize: 11, fontWeight: '900', letterSpacing: 0.3,
  },

  name:        { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.1 },
  nameActive:  { color: DS.bgCard },
  desc:        { fontSize: 10, color: DS.textMuted, fontWeight: '500' },
  descActive:  { color: 'rgba(255,255,255,0.75)' },

  badge:        { position: 'absolute' as const, top: 6, right: 6, borderRadius: DS.radiusBadge, paddingHorizontal: 5, paddingVertical: 2, backgroundColor: DS.border },
  badgeActive:  { backgroundColor: 'rgba(255,255,255,0.25)' },
  badgeNew:     { backgroundColor: DS.successText + '20' },
  badgePopular: { backgroundColor: DS.warningText + '20' },
  badgeStart:   { backgroundColor: DS.accent + '15' },
  badgeTxt:     { fontSize: 8, fontWeight: '900', color: DS.textMuted, letterSpacing: 0.3 },
  badgeTxtActive:   { color: DS.bgCard },
  badgeTxtNew:      { color: DS.successText },
  badgeTxtPopular:  { color: DS.warningText },
  badgeTxtStart:    { color: DS.accent },

  descCard:  { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 8, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  descDot:   { width: 6, height: 6, borderRadius: 3, marginTop: 5, flexShrink: 0 },
  descText:  { flex: 1, fontSize: 12, lineHeight: 18, fontWeight: '500' },
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
  // Physical attributes — feed the real /calculate/fba rate schedule instead
  // of making the user guess a flat FBA-fee dollar amount. Pre-filled via AI
  // estimate when no measured data exists; always user-editable.
  weightLbs: string; length: string; width: string; height: string; category: string;
}
const FBA_DEFAULTS: FBAInputs = {
  sellingPrice: '', productCost: '', freight: '',
  fbaFees: '', referralFee: '', duties: '',
  packaging: '', unitsOrdered: '',
  weightLbs: '', length: '', width: '', height: '', category: 'all',
};

const FBA_CATEGORIES = [
  'all', 'electronics', 'home', 'kitchen', 'sports',
  'toys', 'beauty', 'clothing', 'tools', 'books',
];

interface FBASaved {
  inputs: FBAInputs; netProfit: number; margin: number; roi: number; savedAt: string;
  currency: CurrencyCode; marketplaceId: MarketplaceId; amazonMarketplace: string;
  productName?: string; hsCode?: string; asin?: string; confidenceScore?: number;
}

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

// ─── Pipeline Import ──────────────────────────────────────────────────────────
// One-tap import chip. No modal — fills fields instantly.
// After tap, empty fields that weren't filled show amber "⚑ Enter manually."

interface PipelineField {
  key:    string;
  label:  string;
  source: string;
  value:  string;
  apply:  () => void;
}

interface PipelineSection {
  title: string;
  icon:  string;
  fields: PipelineField[];
}

function ImportChip({
  sections,
  onImport,
}: {
  sections: PipelineSection[];
  onImport: (keys: Set<string>) => void;
}) {
  const [done, setDone] = useState(false);
  const allFields = useMemo(() => sections.flatMap(s => s.fields), [sections]);
  const prevCountRef = useRef(allFields.length);

  useEffect(() => {
    if (allFields.length !== prevCountRef.current) {
      setDone(false);
      prevCountRef.current = allFields.length;
    }
  }, [allFields.length]);

  if (allFields.length === 0) return null;

  function handleImport() {
    allFields.forEach(f => f.apply());
    onImport(new Set(allFields.map(f => f.key)));
    setDone(true);
  }

  const sourceIcons = [...new Set(sections.map(s => s.icon))].join('  ');
  const sourceTitles = sections.map(s => s.title.split(' ')[0]).join(' · ');

  return (
    <TouchableOpacity
      style={[ic.row, done && ic.rowDone]}
      onPress={handleImport}
      activeOpacity={0.8}
    >
      <Text style={[ic.icon, done && ic.iconDone]}>{done ? '✓' : '⬇'}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[ic.label, done && ic.labelDone]}>
          {done
            ? `${allFields.length} fields imported — tap to refresh`
            : `Import from pipeline  ·  ${allFields.length} field${allFields.length !== 1 ? 's' : ''}`}
        </Text>
        <Text style={ic.sub} numberOfLines={1}>
          {done
            ? 'Amber fields below still need manual input'
            : `${sourceIcons}  ${sourceTitles}`}
        </Text>
      </View>
      {!done && <Text style={ic.caret}>›</Text>}
    </TouchableOpacity>
  );
}

const ic = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: DS.accentLight,
    borderRadius: DS.radiusButton, borderWidth: 1.5, borderColor: DS.accent + '40',
    paddingHorizontal: 14, paddingVertical: 11,
  },
  rowDone:   { backgroundColor: DS.successBg, borderColor: DS.success + '40' },
  icon:      { fontSize: 16, color: DS.accent },
  iconDone:  { color: DS.success },
  label:     { fontSize: 13, fontWeight: '800', color: DS.accent, letterSpacing: -0.1 },
  labelDone: { color: DS.success },
  sub:       { fontSize: 11, color: DS.textMuted, marginTop: 1 },
  caret:     { fontSize: 18, color: DS.accent, fontWeight: '300' },
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
  const [importedKeys,      setImportedKeys]       = useState<Set<string>>(new Set());

  // Helper: returns true when import has run but this field had no pipeline data
  function needs(keys: string[]) {
    return importedKeys.size > 0 && !keys.some(k => importedKeys.has(k));
  }

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

  // ── Auto-populate weight/dimensions/category, then auto-calc real FBA fees ──
  // Goal: never make the user guess a flat "FBA fees" dollar figure. Pull
  // weight/dims from an AI estimate (no real Amazon/Alibaba product-detail API
  // is wired in that returns this), then call the real 2026 fee schedule.
  // Every value here stays user-editable — auto-fill only sets a field that's
  // still blank or still matches the last auto-filled value.
  const [physicalSource, setPhysicalSource] = useState<'estimated' | 'fallback' | 'user-entered' | null>(null);
  const [physicalLoading, setPhysicalLoading] = useState(false);
  const [feesAutoFilled, setFeesAutoFilled] = useState(false);
  const [feesOverridden, setFeesOverridden] = useState(false);
  const lastPhysicalTitle = useRef('');

  useEffect(() => {
    const title = productName.trim();
    if (!title) return;
    if (inputs.weightLbs !== '' && physicalSource !== 'estimated' && physicalSource !== 'fallback') return;
    // Debounce so we fire one AI call per pause-in-typing, not one per keystroke
    // (estimatePhysical is a real Claude call and consumes the backend's spend budget).
    let cancelled = false;
    const timer = setTimeout(() => {
      if (title === lastPhysicalTitle.current) return;
      lastPhysicalTitle.current = title;
      setPhysicalLoading(true);
      api.estimatePhysical({ title, price: n(inputs.sellingPrice) || undefined })
        .then(res => {
          if (cancelled) return;
          setInputs(prev => ({
            ...prev,
            weightLbs: res.weight_lbs.toFixed(2),
            length:    res.length.toFixed(1),
            width:     res.width.toFixed(1),
            height:    res.height.toFixed(1),
            category:  res.category || prev.category,
          }));
          setPhysicalSource(res.source === 'ai_estimate' ? 'estimated' : 'fallback');
        })
        .catch(() => {})
        .finally(() => { if (!cancelled) setPhysicalLoading(false); });
    }, 700);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productName]);

  useEffect(() => {
    const sell = n(inputs.sellingPrice);
    const cost = n(inputs.productCost);
    const wt   = n(inputs.weightLbs);
    const l = n(inputs.length), w = n(inputs.width), h = n(inputs.height);
    if (sell <= 0 || wt <= 0 || l <= 0 || w <= 0 || h <= 0) return;
    if (feesOverridden) return; // user took manual control — stop auto-recalculating over them
    let cancelled = false;
    const timer = setTimeout(() => {
      api.calculateFBA({
        product_name: productName.trim() || 'Product',
        selling_price: sell,
        supplier_cost: cost,
        weight_lbs: wt,
        dimensions: { length: l, width: w, height: h },
        category: inputs.category || 'all',
        quantity: Math.max(1, Math.round(n(inputs.unitsOrdered)) || 1),
      }).then(res => {
        if (cancelled) return;
        setInputs(prev => ({
          ...prev,
          fbaFees: res.fees.fulfillment_fee.toFixed(2),
          referralFee: res.fees.referral_fee.toFixed(2),
        }));
        setFeesAutoFilled(true);
      }).catch(() => {});
    }, 400);
    return () => { cancelled = true; clearTimeout(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputs.sellingPrice, inputs.productCost, inputs.weightLbs, inputs.length, inputs.width, inputs.height, inputs.category, inputs.unitsOrdered]);

  function setPhysical(k: 'weightLbs' | 'length' | 'width' | 'height', v: string) {
    setInputs(p => ({ ...p, [k]: v }));
    setPhysicalSource('user-entered');
  }
  function setCategory(v: string) {
    setInputs(p => ({ ...p, category: v }));
  }

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

  function set(k: keyof FBAInputs, v: string) {
    setInputs(p => ({ ...p, [k]: v }));
    if (k === 'fbaFees' || k === 'referralFee') setFeesOverridden(true);
  }

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

  // Build pipeline import sections
  const pipelineSections = useMemo<PipelineSection[]>(() => {
    const sections: PipelineSection[] = [];

    // ── Research (active product) ──────────────────────────────────────────
    const productFields: PipelineField[] = [];
    if (pipeline.activeProduct?.title)
      productFields.push({ key: 'product_name', label: 'Product name', source: 'Research', value: pipeline.activeProduct.title, apply: () => setProductName(pipeline.activeProduct!.title) });
    if (pipeline.activeProduct?.price)
      productFields.push({ key: 'selling_price', label: 'Selling price', source: 'Research', value: `${symbol}${pipeline.activeProduct.price.toFixed(2)}`, apply: () => setInputs(p => ({ ...p, sellingPrice: pipeline.activeProduct!.price.toFixed(2) })) });
    if (pipeline.activeProduct?.asin)
      productFields.push({ key: 'asin', label: 'ASIN', source: 'Research', value: pipeline.activeProduct.asin, apply: () => setLoadedAsin(pipeline.activeProduct!.asin!) });
    if (productFields.length > 0)
      sections.push({ title: 'Product (Research tab)', icon: '🔍', fields: productFields });

    // ── Sourcing — supplier ────────────────────────────────────────────────
    const supplierFields: PipelineField[] = [];
    if (pipeline.selectedSupplier?.unitCost)
      supplierFields.push({ key: 'product_cost', label: 'Supplier cost', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${symbol}${pipeline.selectedSupplier.unitCost.toFixed(2)}/unit`, apply: () => setInputs(p => ({ ...p, productCost: pipeline.selectedSupplier!.unitCost.toFixed(2) })) });
    if (pipeline.selectedSupplier?.moq)
      supplierFields.push({ key: 'units_ordered', label: 'Units to order (MOQ)', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${pipeline.selectedSupplier.moq.toLocaleString()} units`, apply: () => setInputs(p => ({ ...p, unitsOrdered: String(pipeline.selectedSupplier!.moq) })) });
    if (pipeline.selectedSupplier?.estimatedLandedCost)
      supplierFields.push({ key: 'landed_hint', label: 'Est. landed cost', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${symbol}${pipeline.selectedSupplier.estimatedLandedCost.toFixed(2)}/unit`, apply: () => setInputs(p => ({ ...p, productCost: pipeline.selectedSupplier!.estimatedLandedCost!.toFixed(2) })) });
    if (supplierFields.length > 0)
      sections.push({ title: 'Supplier (Sourcing tab)', icon: '⬡', fields: supplierFields });

    // ── Sourcing — freight ─────────────────────────────────────────────────
    const freightFields: PipelineField[] = [];
    if (pipeline.freightEstimate?.perUnitCost)
      freightFields.push({ key: 'freight', label: 'Freight per unit', source: `${pipeline.freightEstimate.selectedMode.toUpperCase()} estimate`, value: `${symbol}${pipeline.freightEstimate.perUnitCost.toFixed(2)}/unit`, apply: () => setInputs(p => ({ ...p, freight: pipeline.freightEstimate!.perUnitCost.toFixed(2) })) });
    if (freightFields.length > 0)
      sections.push({ title: 'Freight estimate', icon: '🚢', fields: freightFields });

    // ── Previous cost model ────────────────────────────────────────────────
    const costFields: PipelineField[] = [];
    if (pipeline.costModel?.fbaFee)
      costFields.push({ key: 'fba_fees', label: 'FBA fulfillment fee', source: 'Saved cost model', value: `${symbol}${pipeline.costModel.fbaFee.toFixed(2)}`, apply: () => setInputs(p => ({ ...p, fbaFees: pipeline.costModel!.fbaFee.toFixed(2) })) });
    if (pipeline.costModel?.referralFee)
      costFields.push({ key: 'referral_fee', label: 'Referral fee', source: 'Saved cost model', value: `${symbol}${pipeline.costModel.referralFee.toFixed(2)}`, apply: () => setInputs(p => ({ ...p, referralFee: pipeline.costModel!.referralFee.toFixed(2) })) });
    if (pipeline.costModel?.duties)
      costFields.push({ key: 'duties', label: 'Import duties', source: 'Saved cost model', value: `${symbol}${pipeline.costModel.duties.toFixed(2)}`, apply: () => setInputs(p => ({ ...p, duties: pipeline.costModel!.duties.toFixed(2) })) });
    if (pipeline.costModel?.packaging)
      costFields.push({ key: 'packaging', label: 'Packaging', source: 'Saved cost model', value: `${symbol}${pipeline.costModel.packaging.toFixed(2)}`, apply: () => setInputs(p => ({ ...p, packaging: pipeline.costModel!.packaging.toFixed(2) })) });
    if (costFields.length > 0)
      sections.push({ title: 'Previous cost model', icon: '💾', fields: costFields });

    // ── Niche context ──────────────────────────────────────────────────────
    const nicheFields: PipelineField[] = [];
    if (pipeline.activeNiche?.keyword)
      nicheFields.push({ key: 'niche', label: 'Target niche', source: 'Niche tab', value: pipeline.activeNiche.keyword, apply: () => setProductName(prev => prev.trim() ? prev : (pipeline.activeNiche!.keyword)) });
    if (nicheFields.length > 0)
      sections.push({ title: 'Niche context', icon: '🎯', fields: nicheFields });

    return sections;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.activeProduct, pipeline.selectedSupplier, pipeline.freightEstimate, pipeline.costModel, pipeline.activeNiche, symbol]);

  return (
    <View style={ws.wrap}>
      {/* Pipeline import — one tap, no modal */}
      <ImportChip sections={pipelineSections} onImport={setImportedKeys} />

      {/* Inputs */}
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Field label="Product name (optional)" value={productName} onChange={setProductName} placeholder="e.g. Yoga Mat Premium" keyboard="default" />
        <Field label="HS/HTS code (optional)" value={hsCode} onChange={setHsCode} placeholder="e.g. 9506.91" keyboard="default" hint="Verify with a customs broker — used for record-keeping only" />
        <Pair>
          <Field label={`Selling price (${symbol})`} value={inputs.sellingPrice} onChange={v => set('sellingPrice', v)} placeholder="24.99"
            needsInput={needs(['selling_price'])} />
          <Field label={`Supplier cost (${symbol})`} value={inputs.productCost} onChange={v => set('productCost', v)} placeholder="5.20"
            needsInput={needs(['product_cost', 'landed_hint'])} />
        </Pair>

        {/* Package weight & dimensions — drives the real FBA fee calc below */}
        <View style={ws.rowBetween}>
          <Text style={ws.chipLabel}>PACKAGE WEIGHT & SIZE</Text>
          {physicalSource && (
            <EstimateLabel type={physicalSource === 'user-entered' ? 'user-entered' : physicalSource === 'estimated' ? 'estimated' : 'directional'} />
          )}
          {physicalLoading && <Text style={ws.hint}>estimating…</Text>}
        </View>
        <Pair>
          <Field label="Weight (lbs)" value={inputs.weightLbs} onChange={v => setPhysical('weightLbs', v)} placeholder="1.20" />
          <Field label="Length (in)" value={inputs.length} onChange={v => setPhysical('length', v)} placeholder="10.0" />
        </Pair>
        <Pair>
          <Field label="Width (in)" value={inputs.width} onChange={v => setPhysical('width', v)} placeholder="8.0" />
          <Field label="Height (in)" value={inputs.height} onChange={v => setPhysical('height', v)} placeholder="4.0" />
        </Pair>
        <Text style={ws.chipLabel}>CATEGORY</Text>
        <View style={ws.chips}>
          {FBA_CATEGORIES.map(cat => (
            <TouchableOpacity key={cat} style={[ws.chip, inputs.category === cat && ws.chipActive]} onPress={() => setCategory(cat)}>
              <Text style={[ws.chipTxt, inputs.category === cat && ws.chipTxtActive]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {!physicalSource && !inputs.weightLbs && (
          <Text style={ws.hint}>Enter a product name above to auto-estimate weight & size — or fill these in yourself.</Text>
        )}
        {physicalSource === 'estimated' && (
          <Text style={ws.hint}>AI-estimated from the product name — not measured. Edit any field to correct it.</Text>
        )}

        <Pair>
          <Field label={`Freight / unit (${symbol})`} value={inputs.freight} onChange={v => set('freight', v)} placeholder="2.10"
            needsInput={needs(['freight'])} />
          <Field label={`FBA fees (${symbol})`} value={inputs.fbaFees} onChange={v => set('fbaFees', v)} placeholder="4.50"
            needsInput={needs(['fba_fees'])} />
        </Pair>
        {/* FBA Fee Helper */}
        <TouchableOpacity style={ws.helperLink} onPress={() => setShowFeeHelper(v => !v)} activeOpacity={0.7}>
          <Text style={ws.helperLinkTxt}>{showFeeHelper ? '▲' : '▼'} How are FBA fees calculated?</Text>
        </TouchableOpacity>
        {showFeeHelper && (
          <View style={ws.helperBox}>
            <Text style={ws.helperTitle}>
              {marketplace === 'US'
                ? 'Auto-calculated from weight & size above'
                : `Check ${profile.amazonMarketplace} Seller Central for fee schedules`}
            </Text>
            {marketplace === 'US' ? (
              <Text style={ws.disclaimer}>
                FBA fees and referral fee are calculated automatically using Amazon's current
                price-banded fee schedule (incl. the fuel & logistics surcharge) once weight and
                dimensions are filled in above. You can still type over either field manually —
                doing so stops the auto-calculation for this session.
              </Text>
            ) : (
              <Text style={ws.disclaimer}>Estimates only. Verify actual fees in Seller Central — fees change periodically and vary by category.</Text>
            )}
          </View>
        )}
        {feesAutoFilled && !feesOverridden && n(inputs.fbaFees) > 0 && (
          <View style={ws.rowBetween}>
            <Text style={ws.hint}>FBA fees & referral fee auto-calculated from weight/size/category</Text>
            <EstimateLabel type="estimated" />
          </View>
        )}
        {n(inputs.sellingPrice) > 0 && !feesAutoFilled && (
          <Text style={ws.hint}>
            Referral fee hint: 15% of {symbol}{n(inputs.sellingPrice).toFixed(2)} = {symbol}{(n(inputs.sellingPrice) * 0.15).toFixed(2)} (most categories)
          </Text>
        )}
        <Pair>
          <Field label={`Referral fee (${symbol})`} value={inputs.referralFee} onChange={v => set('referralFee', v)} placeholder="3.67"
            needsInput={needs(['referral_fee'])} />
          <Field label={`Import duties (${symbol})`} value={inputs.duties} onChange={v => set('duties', v)} placeholder="0.73" />
        </Pair>
        <Pair>
          <Field label={`Packaging (${symbol})`} value={inputs.packaging} onChange={v => set('packaging', v)} placeholder="0.45" />
          <Field label="Units ordered" value={inputs.unitsOrdered} onChange={v => set('unitsOrdered', v)} placeholder="500" keyboard="number-pad"
            needsInput={needs(['units_ordered'])} />
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
  const pipeline   = usePipeline();
  const [price,        setPrice]       = useState('');
  const [cpu,          setCpu]         = useState('');
  const [fees,         setFees]        = useState('');
  const [startup,      setStartup]     = useState('');
  const [fixed,        setFixed]       = useState('');
  const [sales,        setSales]       = useState('');
  const [show,         setShow]        = useState(false);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

  function needs(keys: string[]) {
    return importedKeys.size > 0 && !keys.some(k => importedKeys.has(k));
  }

  const p = n(price); const c = n(cpu); const f = n(fees);
  const s = n(startup); const fx = n(fixed); const sl = n(sales);
  const profitPU = p - c - f;
  const beUnits = profitPU > 0 ? Math.ceil(s / profitPU) : 0;
  const beFixed = profitPU > 0 ? Math.ceil(fx / profitPU) : 0;
  const monthlyNetProfit = sl * profitPU - fx;
  const months  = sl > 0 && profitPU > 0 && monthlyNetProfit > 0
    ? safe(s / monthlyNetProfit).toFixed(1) : null;
  const breakEvenBlocked = sl > 0 && profitPU > 0 && monthlyNetProfit <= 0;

  const pipelineSections = useMemo<PipelineSection[]>(() => {
    const secs: PipelineSection[] = [];
    const pf: PipelineField[] = [];
    if (pipeline.activeProduct?.price)
      pf.push({ key: 'price', label: 'Selling price', source: 'Research', value: `${symbol}${pipeline.activeProduct.price.toFixed(2)}`, apply: () => setPrice(pipeline.activeProduct!.price.toFixed(2)) });
    if (pf.length) secs.push({ title: 'Product', icon: '🔍', fields: pf });
    const sf: PipelineField[] = [];
    if (pipeline.selectedSupplier?.unitCost)
      sf.push({ key: 'cpu', label: 'Cost per unit', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${symbol}${pipeline.selectedSupplier.unitCost.toFixed(2)}`, apply: () => setCpu(pipeline.selectedSupplier!.unitCost.toFixed(2)) });
    if (sf.length) secs.push({ title: 'Supplier', icon: '⬡', fields: sf });
    const cm: PipelineField[] = [];
    if (pipeline.costModel?.fbaFee)
      cm.push({ key: 'fees', label: 'FBA fees', source: 'Cost model', value: `${symbol}${pipeline.costModel.fbaFee.toFixed(2)}`, apply: () => setFees(pipeline.costModel!.fbaFee.toFixed(2)) });
    if (pipeline.costModel?.totalInvestment)
      cm.push({ key: 'startup', label: 'Total investment (startup costs)', source: 'Cost model', value: `${symbol}${pipeline.costModel.totalInvestment.toFixed(0)}`, apply: () => setStartup(pipeline.costModel!.totalInvestment.toFixed(0)) });
    if (cm.length) secs.push({ title: 'Previous cost model', icon: '💾', fields: cm });
    return secs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.activeProduct, pipeline.selectedSupplier, pipeline.costModel, symbol]);

  return (
    <View style={ws.wrap}>
      <ImportChip sections={pipelineSections} onImport={setImportedKeys} />
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Text style={ws.hint}>Break even within 90 days = healthy FBA product.</Text>
        <Pair>
          <Field label={`Selling price (${symbol})`} value={price} onChange={setPrice} placeholder="29.99"
            needsInput={needs(['price'])} />
          <Field label={`Cost per unit (${symbol})`} value={cpu} onChange={setCpu} placeholder="5.00"
            needsInput={needs(['cpu'])} />
        </Pair>
        <Pair>
          <Field label={`FBA fees (${symbol})`} value={fees} onChange={setFees} placeholder="6.50"
            needsInput={needs(['fees'])} />
          <Field label={`Startup costs (${symbol})`} value={startup} onChange={setStartup} placeholder="3000"
            needsInput={needs(['startup'])} />
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
            ['Months to break even',            breakEvenBlocked ? 'Fixed costs exceed monthly profit' : months ? `${months} months` : 'Enter monthly sales'],
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
  const pipeline   = usePipeline();
  const [price,        setPrice]       = useState('');
  const [units,        setUnits]       = useState('');
  const [acos,         setAcos]        = useState('30');
  const [cpc,          setCpc]         = useState('0.75');
  const [show,         setShow]        = useState(false);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

  function needs(keys: string[]) {
    return importedKeys.size > 0 && !keys.some(k => importedKeys.has(k));
  }

  const p = n(price); const u = n(units);
  const acosN = n(acos) || 30; const cpcN = n(cpc) || 0.75;
  const dailyRev = p * u;
  const dailyBudget = dailyRev * (acosN / 100);
  const dailyClicks = cpcN > 0 ? dailyBudget / cpcN : 0;
  const acosColor = acosN <= 25 ? DS.accent : acosN <= 40 ? DS.warning : DS.danger;

  const pipelineSections = useMemo<PipelineSection[]>(() => {
    const pf: PipelineField[] = [];
    if (pipeline.activeProduct?.price)
      pf.push({ key: 'price', label: 'Selling price', source: 'Research', value: `${symbol}${pipeline.activeProduct.price.toFixed(2)}`, apply: () => setPrice(pipeline.activeProduct!.price.toFixed(2)) });
    if (pipeline.activeProduct?.salesEstHigh)
      pf.push({ key: 'units', label: 'Est. daily sales (optimistic)', source: 'Research', value: `${Math.round(pipeline.activeProduct.salesEstHigh / 30)} units/day`, apply: () => setUnits(String(Math.round(pipeline.activeProduct!.salesEstHigh! / 30))) });
    if (pipeline.activeProduct?.salesEstLow)
      pf.push({ key: 'units_low', label: 'Est. daily sales (conservative)', source: 'Research', value: `${Math.round(pipeline.activeProduct.salesEstLow / 30)} units/day (use this for safe planning)`, apply: () => setUnits(String(Math.round(pipeline.activeProduct!.salesEstLow! / 30))) });
    return pf.length ? [{ title: 'Product & Sales Estimates', icon: '🔍', fields: pf }] : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.activeProduct, symbol]);

  return (
    <View style={ws.wrap}>
      <ImportChip sections={pipelineSections} onImport={setImportedKeys} />
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Pair>
          <Field label={`Selling price (${symbol})`} value={price} onChange={setPrice} placeholder="29.99"
            needsInput={needs(['price'])} />
          <Field label="Target daily sales" value={units} onChange={setUnits} placeholder="10" keyboard="number-pad"
            needsInput={needs(['units', 'units_low'])} />
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
  doneTxt:     { fontSize: 15, fontWeight: '800', color: DS.bgCard },
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
// ─── 5. Storage Fees ─────────────────────────────────────────────────────────

function StorageFeesWorkspace() {
  const { symbol } = useCurrency();
  const pipeline = usePipeline();
  const [length,   setLength]   = useState('');
  const [width,    setWidth]    = useState('');
  const [height,   setHeight]   = useState('');
  const [weightLbs,setWeightLbs]= useState('');
  const [units,    setUnits]    = useState('');
  const [months,   setMonths]   = useState('3');
  const [q4,       setQ4]       = useState(false);
  const [show,     setShow]     = useState(false);
  const [importedKeys, setImportedKeys] = useState<Set<string>>(new Set());

  function needs(keys: string[]) {
    return importedKeys.size > 0 && !keys.some(k => importedKeys.has(k));
  }

  const l = n(length); const w = n(width); const h = n(height);
  const wt = n(weightLbs); const u = n(units); const mo = n(months) || 1;

  const dims = [l, w, h].filter(d => d > 0).sort((a, b) => b - a);
  const isOversize = dims[0] > 18 || dims[1] > 14 || dims[2] > 8 || wt > 20;
  const tier = isOversize ? 'Oversize' : 'Standard';

  const cubicFtPerUnit = l > 0 && w > 0 && h > 0 ? (l * w * h) / 1728 : 0;
  const totalCubicFt   = cubicFtPerUnit * u;

  // Amazon US 2024 monthly rates
  const monthlyRate     = isOversize ? (q4 ? 1.40 : 0.56) : (q4 ? 2.40 : 0.87);
  const monthlyFeeTotal = totalCubicFt * monthlyRate;
  const monthlyFeePerUnit = u > 0 ? monthlyFeeTotal / u : 0;
  const totalFeeForPeriod = monthlyFeeTotal * mo;

  // Long-term storage: 365+ days, $6.90/cu ft (min $0.15/unit)
  const ltFeePerUnit = cubicFtPerUnit > 0 ? Math.max(cubicFtPerUnit * 6.90, 0.15) : 0;
  const ltFeeTotal   = ltFeePerUnit * u;

  const pipelineSections = useMemo<PipelineSection[]>(() => {
    const sf: PipelineField[] = [];
    if (pipeline.selectedSupplier?.moq)
      sf.push({ key: 'units', label: 'Units ordered (MOQ)', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${pipeline.selectedSupplier.moq.toLocaleString()} units`, apply: () => setUnits(String(pipeline.selectedSupplier!.moq)) });
    else if (pipeline.costModel?.unitsOrdered)
      sf.push({ key: 'units', label: 'Units ordered', source: 'Cost model', value: `${pipeline.costModel.unitsOrdered.toLocaleString()} units`, apply: () => setUnits(String(pipeline.costModel!.unitsOrdered)) });
    return sf.length ? [{ title: 'Supplier', icon: '⬡', fields: sf }] : [];
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.selectedSupplier, pipeline.costModel]);

  return (
    <View style={ws.wrap}>
      <ImportChip sections={pipelineSections} onImport={setImportedKeys} />
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Text style={ws.hint}>Q4 rates (Oct–Dec) are roughly 3× higher — the single biggest surprise for first-time sellers.</Text>
        <Text style={ws.chipLabel}>UNIT DIMENSIONS</Text>
        <Pair>
          <Field label="Length (in)" value={length} onChange={setLength} placeholder="10.0" />
          <Field label="Width (in)"  value={width}  onChange={setWidth}  placeholder="8.0"  />
        </Pair>
        <Pair>
          <Field label="Height (in)"  value={height}    onChange={setHeight}    placeholder="4.0" />
          <Field label="Weight (lbs)" value={weightLbs} onChange={setWeightLbs} placeholder="1.2" />
        </Pair>
        <Pair>
          <Field label="Units in storage" value={units}  onChange={setUnits}  placeholder="500" keyboard="number-pad" needsInput={needs(['units'])} />
          <Field label="Months stored"    value={months} onChange={setMonths} placeholder="3"   keyboard="number-pad" />
        </Pair>
        <Text style={ws.chipLabel}>STORAGE PERIOD</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([false, true] as const).map(isQ4 => (
            <TouchableOpacity key={String(isQ4)} style={[ws.chip, q4 === isQ4 && ws.chipActive]} onPress={() => setQ4(isQ4)}>
              <Text style={[ws.chipTxt, q4 === isQ4 && ws.chipTxtActive]}>{isQ4 ? 'Q4 (Oct–Dec)' : 'Non-Q4 (Jan–Sep)'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <CalcBtn label="Calculate Storage Fees" onPress={() => setShow(true)} />
      </AppCard>

      {show && cubicFtPerUnit > 0 && u > 0 && (
        <AppCard style={{ gap: 12 }}>
          <Text style={ws.cardTitle}>Storage Estimate</Text>
          <AccuracyBadge level="planning" />
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={[ab.badge, { backgroundColor: isOversize ? DS.warningBg : DS.successBg }]}>
              <Text style={[ab.txt, { color: isOversize ? DS.warningText : DS.successText }]}>{tier} size</Text>
            </View>
            <Text style={ws.hint}>{cubicFtPerUnit.toFixed(4)} cu ft/unit</Text>
          </View>
          <View style={ws.heroRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ws.heroLabel}>Monthly / unit</Text>
              <Text style={[ws.heroValue, { color: DS.accent }]}>{symbol}{monthlyFeePerUnit.toFixed(4)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ws.heroLabel}>Monthly total</Text>
              <Text style={[ws.heroValue, { color: DS.textPrimary, fontSize: 22 }]}>{symbol}{monthlyFeeTotal.toFixed(2)}</Text>
            </View>
          </View>
          {[
            [`${mo.toFixed(0)}-month total`, `${symbol}${totalFeeForPeriod.toFixed(2)}`],
            [`Rate (${q4 ? 'Q4' : 'non-Q4'})`, `${symbol}${monthlyRate.toFixed(2)}/cu ft/mo`],
            ['Total cubic feet', `${totalCubicFt.toFixed(2)} cu ft`],
          ].map(([lb, v]) => <Row key={lb} label={lb} value={v} />)}
          {mo >= 10 && (
            <View style={[ws.helperBox, { borderColor: DS.danger + '40', backgroundColor: DS.dangerBg }]}>
              <Text style={[ws.helperTitle, { color: DS.dangerText }]}>⚠ Long-term storage risk</Text>
              <Text style={ws.disclaimer}>
                Units held 365+ days: {symbol}{ltFeePerUnit.toFixed(2)}/unit extra ({symbol}6.90/cu ft, min {symbol}0.15/unit).
                For {u.toLocaleString()} units that's an additional {symbol}{ltFeeTotal.toFixed(2)} — before monthly fees.
                Clear stock or create a removal order before 12 months.
              </Text>
            </View>
          )}
          <Text style={ws.hint}>Amazon US fee schedule (2024). Other marketplaces use different rates — check Seller Central.</Text>
        </AppCard>
      )}
    </View>
  );
}

// ─── 6. Cash Flow Timeline ───────────────────────────────────────────────────

function CashFlowWorkspace() {
  const { symbol } = useCurrency();
  const pipeline   = usePipeline();
  const [landedCost,     setLandedCost]     = useState('');
  const [units,          setUnits]          = useState('');
  const [netProfit,      setNetProfit]      = useState('');
  const [monthlySales,   setMonthlySales]   = useState('');
  const [launchCosts,    setLaunchCosts]    = useState('');
  const [ppcMonthly,     setPpcMonthly]     = useState('');
  const [storageMonthly, setStorageMonthly] = useState('');
  const [show,           setShow]           = useState(false);
  const [importedKeys,   setImportedKeys]   = useState<Set<string>>(new Set());

  function needs(keys: string[]) {
    return importedKeys.size > 0 && !keys.some(k => importedKeys.has(k));
  }

  const lc = n(landedCost); const u = n(units); const np = n(netProfit);
  const ms = n(monthlySales); const launch = n(launchCosts);
  const ppc = n(ppcMonthly); const store = n(storageMonthly);

  const initialInvestment = lc * u + launch;
  const monthlyIn  = ms * np;
  const monthlyOut = ppc + store;
  const monthlyCF  = monthlyIn - monthlyOut;

  interface CFRow { month: number; monthlyCF: number; cumulative: number; unitsLeft: number; }

  const timeline = useMemo<CFRow[]>(() => {
    if (initialInvestment <= 0 || ms <= 0 || np <= 0) return [];
    const rows: CFRow[] = [];
    let cumulative = -initialInvestment;
    let unitsLeft = u;
    for (let m = 1; m <= 24; m++) {
      const sold = Math.min(ms, unitsLeft);
      const cf   = sold * np - ppc - store;
      cumulative += cf;
      unitsLeft   = Math.max(0, unitsLeft - sold);
      rows.push({ month: m, monthlyCF: cf, cumulative, unitsLeft });
      if (cumulative >= 0) break;
      if (unitsLeft === 0 && cumulative < 0) break;
    }
    return rows;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialInvestment, u, ms, np, ppc, store]);

  const roiMonth          = timeline.find(r => r.cumulative >= 0)?.month ?? null;
  const cashPosiMonth     = timeline.find(r => r.monthlyCF > 0)?.month ?? null;
  const peakOutlay        = initialInvestment > 0 ? initialInvestment : 0;

  const pipelineSections = useMemo<PipelineSection[]>(() => {
    const secs: PipelineSection[] = [];

    const sf: PipelineField[] = [];
    if (pipeline.selectedSupplier?.estimatedLandedCost)
      sf.push({ key: 'landed_cost', label: 'Est. landed cost/unit', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${symbol}${pipeline.selectedSupplier.estimatedLandedCost.toFixed(2)}`, apply: () => setLandedCost(pipeline.selectedSupplier!.estimatedLandedCost!.toFixed(2)) });
    else if (pipeline.selectedSupplier?.unitCost)
      sf.push({ key: 'landed_cost', label: 'Supplier cost/unit', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${symbol}${pipeline.selectedSupplier.unitCost.toFixed(2)}`, apply: () => setLandedCost(pipeline.selectedSupplier!.unitCost.toFixed(2)) });
    if (pipeline.selectedSupplier?.moq)
      sf.push({ key: 'units', label: 'Units ordered (MOQ)', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${pipeline.selectedSupplier.moq.toLocaleString()} units`, apply: () => setUnits(String(pipeline.selectedSupplier!.moq)) });
    if (sf.length) secs.push({ title: 'Supplier', icon: '⬡', fields: sf });

    const cm: PipelineField[] = [];
    if (pipeline.costModel?.netProfit)
      cm.push({ key: 'net_profit', label: 'Net profit/unit', source: 'FBA Profit calc', value: `${symbol}${pipeline.costModel.netProfit.toFixed(2)}`, apply: () => setNetProfit(pipeline.costModel!.netProfit.toFixed(2)) });
    if (!pipeline.selectedSupplier?.moq && pipeline.costModel?.unitsOrdered)
      cm.push({ key: 'units', label: 'Units ordered', source: 'Cost model', value: `${pipeline.costModel.unitsOrdered.toLocaleString()} units`, apply: () => setUnits(String(pipeline.costModel!.unitsOrdered)) });
    if (cm.length) secs.push({ title: 'Cost Model', icon: '◈', fields: cm });

    const pf: PipelineField[] = [];
    if (pipeline.activeProduct?.salesEstLow)
      pf.push({ key: 'monthly_sales', label: 'Est. monthly sales (conservative)', source: 'Research', value: `${pipeline.activeProduct.salesEstLow.toLocaleString()} units/mo`, apply: () => setMonthlySales(String(pipeline.activeProduct!.salesEstLow)) });
    if (pf.length) secs.push({ title: 'Research', icon: '◎', fields: pf });

    return secs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.selectedSupplier, pipeline.costModel, pipeline.activeProduct, symbol]);

  return (
    <View style={ws.wrap}>
      <ImportChip sections={pipelineSections} onImport={setImportedKeys} />
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Text style={ws.hint}>Not just when you break even in units — but when real cash returns to your account after every cost.</Text>
        <Pair>
          <Field label={`Landed cost/unit (${symbol})`} value={landedCost}   onChange={setLandedCost}   placeholder="7.20" needsInput={needs(['landed_cost'])} />
          <Field label="Units ordered"                   value={units}        onChange={setUnits}        placeholder="500"  keyboard="number-pad" needsInput={needs(['units'])} />
        </Pair>
        <Pair>
          <Field label={`Net profit/unit (${symbol})`}   value={netProfit}    onChange={setNetProfit}    placeholder="8.50" hint="From FBA Profit calc" needsInput={needs(['net_profit'])} />
          <Field label="Monthly sales (units)"           value={monthlySales} onChange={setMonthlySales} placeholder="150"  keyboard="number-pad" needsInput={needs(['monthly_sales'])} />
        </Pair>
        <Pair>
          <Field label={`Launch costs (${symbol})`}      value={launchCosts}    onChange={setLaunchCosts}    placeholder="2000" hint="Photography, listing, Vine…" />
          <Field label={`Monthly PPC (${symbol})`}       value={ppcMonthly}     onChange={setPpcMonthly}     placeholder="500" />
        </Pair>
        <Field label={`Monthly storage fees (${symbol})`} value={storageMonthly} onChange={setStorageMonthly} placeholder="50" hint="From Storage Fees calculator" />
        <CalcBtn label="Project Cash Flow" onPress={() => setShow(true)} />
      </AppCard>

      {show && initialInvestment > 0 && ms > 0 && np > 0 && (
        <AppCard style={{ gap: 12 }}>
          <Text style={ws.cardTitle}>Cash Flow Projection</Text>
          <AccuracyBadge level="planning" />
          <View style={ws.heroRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ws.heroLabel}>Initial outlay</Text>
              <Text style={[ws.heroValue, { color: DS.danger, fontSize: 22 }]}>{symbol}{initialInvestment.toFixed(0)}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={ws.heroLabel}>Full ROI by</Text>
              <Text style={[ws.heroValue, { color: roiMonth ? DS.success : DS.warning, fontSize: 22 }]}>
                {roiMonth ? `Month ${roiMonth}` : '> 24 mo'}
              </Text>
            </View>
          </View>
          {[
            ['Monthly cash flow',  monthlyCF >= 0 ? `+${symbol}${monthlyCF.toFixed(0)}` : `-${symbol}${Math.abs(monthlyCF).toFixed(0)}`],
            ['Cash-flow positive', cashPosiMonth ? `Month ${cashPosiMonth}` : 'Not at this velocity'],
            ['Peak cash at risk',  `${symbol}${peakOutlay.toFixed(0)}`],
          ].map(([lb, v]) => <Row key={lb} label={lb} value={v} />)}

          {timeline.length > 0 && (
            <View style={{ gap: 0 }}>
              <Text style={[ws.chipLabel, { marginTop: 4 }]}>MONTH-BY-MONTH</Text>
              <View style={[cfw.row, { borderBottomWidth: 1.5, borderBottomColor: DS.border }]}>
                {['Mo', 'Cash in', 'Cumulative', 'Stock left'].map(h => (
                  <Text key={h} style={[cfw.col, cfw.hdr]}>{h}</Text>
                ))}
              </View>
              {timeline.map(row => {
                const positive = row.cumulative >= 0;
                return (
                  <View key={row.month} style={[cfw.row, positive && { backgroundColor: DS.successBg }]}>
                    <Text style={[cfw.col, cfw.cell]}>{row.month}</Text>
                    <Text style={[cfw.col, cfw.cell, { color: row.monthlyCF >= 0 ? DS.success : DS.danger }]}>
                      {row.monthlyCF >= 0 ? '+' : ''}{symbol}{Math.abs(row.monthlyCF).toFixed(0)}
                    </Text>
                    <Text style={[cfw.col, cfw.cell, { color: positive ? DS.success : DS.danger, fontWeight: '700' }]}>
                      {positive ? '+' : ''}{symbol}{Math.abs(row.cumulative).toFixed(0)}
                    </Text>
                    <Text style={[cfw.col, cfw.cell]}>{row.unitsLeft.toLocaleString()}</Text>
                  </View>
                );
              })}
            </View>
          )}
          <Text style={ws.hint}>Constant velocity assumed. Real launches accelerate slowly in months 1-2 — your actual ROI timeline may be slightly longer.</Text>
        </AppCard>
      )}
    </View>
  );
}

const cfw = StyleSheet.create({
  row:  { flexDirection: 'row' as const, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: DS.border },
  col:  { flex: 1, fontSize: 11 },
  hdr:  { fontWeight: '800', color: DS.textMuted, letterSpacing: 0.3 },
  cell: { color: DS.textSecondary },
});

// ─── (old FreightWorkspace — removed, use Sourcing tab instead) ───────────────
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
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },

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
  toggleCheck:   { fontSize: 12, fontWeight: '900', color: DS.bgCard },
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
  loadBtnTxt:   { fontSize: 14, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.2 },
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
  mailBtnTxt: { fontSize: 14, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.2 },
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
  selectBtnTxtSaved: { color: DS.bgCard },

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
  compareSelectedTxt: { fontSize: 14, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.2 },

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
  segTxtActive:  { color: DS.bgCard, fontWeight: '800' },
  segCheck:      { fontSize: 10, color: DS.bgCard, fontWeight: '900' },
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
  searchBtnTxt: { fontSize: 15, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.2 },
});

// ─── 6. Landed Cost Breakdown ────────────────────────────────────────────────

function LandedCostWorkspace() {
  const { symbol } = useCurrency();
  const pipeline   = usePipeline();
  const [supplierCost, setSupplierCost]  = useState('');
  const [freight,      setFreight]       = useState('');
  const [dutyPct,      setDutyPct]       = useState('');
  const [packaging,    setPackaging]     = useState('');
  const [prep,         setPrep]          = useState('');
  const [moq,          setMoq]           = useState('');
  const [show,         setShow]          = useState(false);
  const [importedKeys, setImportedKeys]  = useState<Set<string>>(new Set());

  function needs(keys: string[]) {
    return importedKeys.size > 0 && !keys.some(k => importedKeys.has(k));
  }

  const sc  = n(supplierCost);
  const fr  = n(freight);
  const dp  = n(dutyPct);
  const pkg = n(packaging);
  const prp = n(prep);
  const qty = n(moq) || 1;

  const dutyAmt   = sc * (dp / 100);
  const landed    = sc + fr + dutyAmt + pkg + prp;
  const totalInv  = landed * qty;

  const pipelineSections = useMemo<PipelineSection[]>(() => {
    const secs: PipelineSection[] = [];
    const sf: PipelineField[] = [];
    if (pipeline.selectedSupplier?.unitCost)
      sf.push({ key: 'supplier_cost', label: 'Supplier cost', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${symbol}${pipeline.selectedSupplier.unitCost.toFixed(2)}/unit`, apply: () => setSupplierCost(pipeline.selectedSupplier!.unitCost.toFixed(2)) });
    if (pipeline.selectedSupplier?.moq)
      sf.push({ key: 'moq', label: 'Order quantity (MOQ)', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${pipeline.selectedSupplier.moq.toLocaleString()} units`, apply: () => setMoq(String(pipeline.selectedSupplier!.moq)) });
    if (sf.length) secs.push({ title: 'Supplier', icon: '⬡', fields: sf });
    const ff: PipelineField[] = [];
    if (pipeline.freightEstimate?.perUnitCost)
      ff.push({ key: 'freight', label: 'Freight per unit', source: `${pipeline.freightEstimate.selectedMode.toUpperCase()} estimate`, value: `${symbol}${pipeline.freightEstimate.perUnitCost.toFixed(2)}/unit`, apply: () => setFreight(pipeline.freightEstimate!.perUnitCost.toFixed(2)) });
    if (ff.length) secs.push({ title: 'Freight', icon: '🚢', fields: ff });
    return secs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.selectedSupplier, pipeline.freightEstimate, symbol]);

  const breakdown = landed > 0 ? [
    { label: 'Supplier cost',  amt: sc,      pct: sc / landed * 100 },
    { label: 'Freight',        amt: fr,      pct: fr / landed * 100 },
    { label: 'Import duties',  amt: dutyAmt, pct: dutyAmt / landed * 100 },
    { label: 'Packaging',      amt: pkg,     pct: pkg / landed * 100 },
    { label: 'Prep / labels',  amt: prp,     pct: prp / landed * 100 },
  ].filter(b => b.amt > 0) : [];

  const barColors = [DS.accent, DS.info, DS.warning, DS.success, DS.textMuted];

  return (
    <View style={ws.wrap}>
      <ImportChip sections={pipelineSections} onImport={setImportedKeys} />
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Text style={ws.hint}>Landed cost = what you actually pay per unit, including everything to get it to the FBA warehouse.</Text>
        <Pair>
          <Field label={`Supplier cost (${symbol})`} value={supplierCost} onChange={setSupplierCost} placeholder="4.50"
            needsInput={needs(['supplier_cost'])} />
          <Field label={`Freight / unit (${symbol})`} value={freight} onChange={setFreight} placeholder="2.10"
            needsInput={needs(['freight'])} />
        </Pair>
        <Pair>
          <Field label="Import duty (%)" value={dutyPct} onChange={setDutyPct} placeholder="6.5" />
          <Field label={`Packaging (${symbol})`} value={packaging} onChange={setPackaging} placeholder="0.45" />
        </Pair>
        <Pair>
          <Field label={`Prep / labels (${symbol})`} value={prep} onChange={setPrep} placeholder="0.30" />
          <Field label="Units ordered" value={moq} onChange={setMoq} placeholder="500" keyboard="number-pad"
            needsInput={needs(['moq'])} />
        </Pair>
        <CalcBtn label="Calculate Landed Cost" onPress={() => setShow(true)} />
      </AppCard>

      {show && sc > 0 && (
        <AppCard style={{ gap: 12 }}>
          <Text style={ws.cardTitle}>Landed Cost</Text>
          <AccuracyBadge level="exact" />

          {/* Hero */}
          <View style={lc.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={lc.heroLbl}>Per Unit</Text>
              <Text style={lc.heroVal}>{symbol}{landed.toFixed(2)}</Text>
            </View>
            {qty > 1 && (
              <View style={{ flex: 1 }}>
                <Text style={lc.heroLbl}>Total Investment ({qty.toLocaleString()} units)</Text>
                <Text style={[lc.heroVal, { color: DS.textPrimary }]}>{symbol}{totalInv.toFixed(0)}</Text>
              </View>
            )}
          </View>

          {/* Cost breakdown bars */}
          {breakdown.length > 1 && (
            <View style={{ gap: 8 }}>
              <Text style={ws.chipLabel}>COST BREAKDOWN</Text>
              {breakdown.map((b, i) => (
                <View key={b.label} style={{ gap: 3 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={lc.barLabel}>{b.label}</Text>
                    <Text style={lc.barPct}>{symbol}{b.amt.toFixed(2)} · {b.pct.toFixed(0)}%</Text>
                  </View>
                  <View style={lc.barTrack}>
                    <View style={[lc.barFill, { width: `${b.pct}%` as any, backgroundColor: barColors[i % barColors.length] }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Max price to hit targets */}
          <View style={{ gap: 4 }}>
            <Text style={ws.chipLabel}>MINIMUM SELLING PRICE TO HIT TARGET MARGIN</Text>
            {[
              { label: '20% margin (FBA floor)', mult: 1 / 0.80 },
              { label: '25% margin (comfortable)', mult: 1 / 0.75 },
              { label: '30% margin (strong)', mult: 1 / 0.70 },
            ].map(t => {
              const totalCosts = landed + n(String(0)); // FBA fees unknown here
              const minPrice = landed / (1 - (t.mult === 1/0.80 ? 0.20 : t.mult === 1/0.75 ? 0.25 : 0.30));
              return (
                <Row key={t.label} label={t.label} value={`${symbol}${minPrice.toFixed(2)} min`} />
              );
            })}
          </View>
          <Text style={ws.hint}>These don't include Amazon FBA fees or referral fee — add those in FBA Profit for your true minimum.</Text>
        </AppCard>
      )}
    </View>
  );
}

const lc = StyleSheet.create({
  heroRow:  { flexDirection: 'row', gap: 16 },
  heroLbl:  { fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.4 },
  heroVal:  { fontSize: 28, fontWeight: '900', color: DS.accent, letterSpacing: -0.5 },
  barLabel: { fontSize: 12, color: DS.textSecondary, fontWeight: '600' },
  barPct:   { fontSize: 12, color: DS.textMuted },
  barTrack: { height: 7, backgroundColor: DS.border, borderRadius: 4, overflow: 'hidden' },
  barFill:  { height: 7, borderRadius: 4 },
});

// ─── 7. Launch Capital Estimator ─────────────────────────────────────────────

function CapitalEstimatorWorkspace() {
  const { symbol } = useCurrency();
  const pipeline   = usePipeline();

  const [landedCost,    setLandedCost]    = useState('');
  const [units,         setUnits]         = useState('');
  const [ppcBudget,     setPpcBudget]     = useState('');
  const [photography,   setPhotography]   = useState('400');
  const [listingDesign, setListingDesign] = useState('300');
  const [samples,       setSamples]       = useState('100');
  const [vineUnits,     setVineUnits]     = useState('30');
  const [miscBuffer,    setMiscBuffer]    = useState('10');
  const [show,          setShow]          = useState(false);
  const [importedKeys,  setImportedKeys]  = useState<Set<string>>(new Set());

  function needs(keys: string[]) {
    return importedKeys.size > 0 && !keys.some(k => importedKeys.has(k));
  }

  const lc_  = n(landedCost);
  const qty  = n(units);
  const ppc  = n(ppcBudget);
  const photo= n(photography);
  const list = n(listingDesign);
  const samp = n(samples);
  const vine = n(vineUnits) * 200; // $200/unit is Amazon Vine enrollment fee
  const misc = n(miscBuffer);

  const inventory    = lc_ * qty;
  const launchFixed  = photo + list + samp + vine;
  const subTotal     = inventory + ppc + launchFixed;
  const bufferAmt    = subTotal * (misc / 100);
  const totalCapital = subTotal + bufferAmt;
  const perUnit      = qty > 0 ? totalCapital / qty : 0;

  const pipelineSections = useMemo<PipelineSection[]>(() => {
    const secs: PipelineSection[] = [];
    const cm: PipelineField[] = [];
    if (pipeline.costModel?.unitCost && pipeline.costModel?.freight) {
      const est = pipeline.costModel.unitCost + pipeline.costModel.freight + (pipeline.costModel.duties ?? 0) + (pipeline.costModel.packaging ?? 0);
      cm.push({ key: 'landed', label: 'Landed cost per unit', source: 'Saved cost model', value: `${symbol}${est.toFixed(2)}/unit`, apply: () => setLandedCost(est.toFixed(2)) });
    }
    if (cm.length) secs.push({ title: 'From cost model', icon: '💾', fields: cm });
    const sf: PipelineField[] = [];
    if (pipeline.selectedSupplier?.moq)
      sf.push({ key: 'units', label: 'Units to order (MOQ)', source: pipeline.selectedSupplier.platform ?? 'Sourcing', value: `${pipeline.selectedSupplier.moq.toLocaleString()} units`, apply: () => setUnits(String(pipeline.selectedSupplier!.moq)) });
    if (sf.length) secs.push({ title: 'Supplier', icon: '⬡', fields: sf });
    const pf: PipelineField[] = [];
    if (pipeline.activeProduct?.salesEstHigh && pipeline.activeProduct?.price) {
      const monthly30day = Math.round(pipeline.activeProduct.salesEstHigh / 30 * pipeline.activeProduct.price * 0.30);
      pf.push({ key: 'ppc', label: '30-day PPC budget (30% ACoS estimate)', source: 'Research sales estimate', value: `${symbol}${monthly30day}`, apply: () => setPpcBudget(String(monthly30day)) });
    }
    if (pf.length) secs.push({ title: 'Sales & PPC estimate', icon: '📣', fields: pf });
    return secs;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pipeline.costModel, pipeline.selectedSupplier, pipeline.activeProduct, symbol]);

  const lineItems = show && totalCapital > 0 ? [
    { label: 'Inventory',           amt: inventory,   note: `${qty.toLocaleString()} units × ${symbol}${lc_.toFixed(2)}` },
    { label: '90-day PPC budget',   amt: ppc,         note: 'Paid search launch spend' },
    { label: 'Product photography', amt: photo,       note: 'Main + lifestyle + infographic shots' },
    { label: 'Listing creation',    amt: list,        note: 'Copywriting + A+ content' },
    { label: 'Samples',             amt: samp,        note: 'Pre-order QC + personal testing' },
    { label: `Amazon Vine (${n(vineUnits).toFixed(0)} units)`, amt: vine, note: '$200/unit enrollment fee' },
    { label: `Buffer (${misc}%)`,   amt: bufferAmt,   note: 'Unexpected costs, returns, storage' },
  ].filter(l => l.amt > 0) : [];

  return (
    <View style={ws.wrap}>
      <ImportChip sections={pipelineSections} onImport={setImportedKeys} />
      <AppCard style={{ gap: 12 }}>
        <Text style={ws.cardTitle}>Inputs</Text>
        <Text style={ws.hint}>Map your full launch spend before committing — inventory is usually only 60-70% of what new sellers actually need.</Text>
        <Pair>
          <Field label={`Landed cost/unit (${symbol})`} value={landedCost} onChange={setLandedCost} placeholder="7.20" hint="From Landed Cost calculator"
            needsInput={needs(['landed'])} />
          <Field label="Units to order" value={units} onChange={setUnits} placeholder="500" keyboard="number-pad"
            needsInput={needs(['units'])} />
        </Pair>
        <Field label={`90-day PPC budget (${symbol})`} value={ppcBudget} onChange={setPpcBudget} placeholder="1500" hint="Use PPC calculator for a precise number"
          needsInput={needs(['ppc'])} />
        <Pair>
          <Field label={`Photography (${symbol})`} value={photography} onChange={setPhotography} placeholder="400" />
          <Field label={`Listing / A+ (${symbol})`} value={listingDesign} onChange={setListingDesign} placeholder="300" />
        </Pair>
        <Pair>
          <Field label={`Samples (${symbol})`} value={samples} onChange={setSamples} placeholder="100" />
          <Field label="Vine units (# units)" value={vineUnits} onChange={setVineUnits} placeholder="30" keyboard="number-pad" hint="$200/unit Amazon fee" />
        </Pair>
        <Field label="Contingency buffer (%)" value={miscBuffer} onChange={setMiscBuffer} placeholder="10" hint="Covers returns, extra storage, surprises" />
        <CalcBtn label="Calculate Launch Capital" onPress={() => setShow(true)} />
      </AppCard>

      {show && totalCapital > 0 && (
        <AppCard style={{ gap: 12 }}>
          <Text style={ws.cardTitle}>Launch Capital Required</Text>
          <AccuracyBadge level="planning" />

          <View style={cap.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={lc.heroLbl}>Total Capital</Text>
              <Text style={cap.heroVal}>{symbol}{totalCapital.toFixed(0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={lc.heroLbl}>Capital Per Unit</Text>
              <Text style={[cap.heroVal, { fontSize: 22, color: DS.textPrimary }]}>{symbol}{perUnit.toFixed(2)}</Text>
            </View>
          </View>

          {lineItems.map(l => (
            <View key={l.label} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={cap.lineLabel}>{l.label}</Text>
                <Text style={cap.lineAmt}>{symbol}{l.amt.toFixed(0)}</Text>
              </View>
              <Text style={cap.lineNote}>{l.note}</Text>
            </View>
          ))}
          <View style={cap.divider} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={cap.totalLabel}>Total launch capital</Text>
            <Text style={cap.totalAmt}>{symbol}{totalCapital.toFixed(0)}</Text>
          </View>
          <Text style={ws.hint}>Keep 20-30% more in reserve post-launch for restocking before your first payout cycle clears.</Text>
        </AppCard>
      )}
    </View>
  );
}

const cap = StyleSheet.create({
  heroRow:    { flexDirection: 'row', gap: 16 },
  heroVal:    { fontSize: 28, fontWeight: '900', color: DS.accent, letterSpacing: -0.5 },
  lineLabel:  { fontSize: 13, color: DS.textSecondary, flex: 1 },
  lineAmt:    { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  lineNote:   { fontSize: 11, color: DS.textMuted },
  divider:    { height: 1, backgroundColor: DS.border },
  totalLabel: { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  totalAmt:   { fontSize: 14, fontWeight: '900', color: DS.accent },
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
    fba:       'calc_fba',
    landed:    'calc_fba',
    capital:   'calc_fba',
    breakeven: 'calc_breakeven',
    ppc:       'calc_ppc',
    storage:   'calc_fba',
    cashflow:  'calc_fba',
    duties:    'calc_duties',
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
        {calcType === 'landed'    && <LandedCostWorkspace />}
        {calcType === 'capital'   && <CapitalEstimatorWorkspace />}
        {calcType === 'breakeven' && <BreakevenWorkspace />}
        {calcType === 'ppc'       && <PPCWorkspace />}
        {calcType === 'storage'   && <StorageFeesWorkspace />}
        {calcType === 'cashflow'  && <CashFlowWorkspace />}
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
  ctaTxt: { fontSize: 13, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.2 },
});
