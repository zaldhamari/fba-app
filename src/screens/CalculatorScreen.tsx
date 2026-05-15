// ─── Feasibility Check Screen ─────────────────────────────────────────────────
// Standalone screen — navigated to from ProfitLab banner via stack navigator.
// Shows the full launch pipeline: financial summary, risk, capital, readiness,
// and the final GO / TEST / WAIT / NO-GO decision at the top.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  ScrollView, ActivityIndicator, Alert, KeyboardTypeOptions, Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import { DS } from '../components/ds';
import { HelpButton } from '../components/HelpModal';
import { useCurrency } from '../context/CurrencyContext';
import { useActiveProduct } from '../context/ActiveProductContext';
import { useSubscription } from '../hooks/useSubscription';
import { STORAGE_KEYS } from '../constants/storage';
import {
  FeasibilityProduct, FeasibilitySupplier, FeasibilityInputs,
  FeasibilityVerdict, computeFeasibility, FEASIBILITY_DEFAULTS,
} from '../lib/feasibility';
import {
  computeRiskAssessment, RiskAssessmentResult, RiskLevel, CATEGORY_LABELS,
} from '../lib/riskAssessment';
import {
  CapitalInputs, CapitalBreakdown, LaunchReadinessResult, LaunchDecisionResult,
  LaunchDecision, LaunchAdvisorSnapshot, defaultCapitalInputs, computeCapitalEstimate,
  computeLaunchReadiness, computeLaunchDecision,
} from '../lib/launchDecision';
import { ALL_IDS } from '../data/launchPhases';
import { useFeasibilityTags } from '../hooks/useFeasibilityTags';
import type { FeasibilityTagType } from '../types/feasibilityReport';

type NavProp = StackNavigationProp<RootStackParamList, 'FeasibilityCheck'>;

// ─── Color helpers ────────────────────────────────────────────────────────────

function riskLevelColor(level: RiskLevel): string {
  if (level === 'Low Risk')      return DS.successText;
  if (level === 'Moderate Risk') return DS.infoText;
  if (level === 'High Risk')     return DS.warningText;
  return DS.dangerText;
}
function riskLevelBg(level: RiskLevel): string {
  if (level === 'Low Risk')      return DS.successBg;
  if (level === 'Moderate Risk') return DS.infoBg;
  if (level === 'High Risk')     return DS.warningBg;
  return DS.dangerBg;
}
function decisionTextColor(d: LaunchDecision): string {
  if (d === 'GO')   return DS.successText;
  if (d === 'TEST') return DS.infoText;
  if (d === 'WAIT') return DS.warningText;
  return DS.dangerText;
}
function decisionBgColor(d: LaunchDecision): string {
  if (d === 'GO')   return DS.successBg;
  if (d === 'TEST') return DS.infoBg;
  if (d === 'WAIT') return DS.warningBg;
  return DS.dangerBg;
}
function decisionBorderColor(d: LaunchDecision): string {
  if (d === 'GO')   return DS.success;
  if (d === 'TEST') return DS.info;
  if (d === 'WAIT') return DS.warning;
  return DS.danger;
}
function verdictColor(v: FeasibilityVerdict): string {
  if (v === 'Excellent Opportunity') return DS.successText;
  if (v === 'Worth Testing')          return DS.warningText;
  if (v === 'High Risk')              return DS.warningText;
  return DS.dangerText;
}

// ─── Compact input field ──────────────────────────────────────────────────────

function FeasField({
  label, value, onChange, placeholder, keyboard = 'decimal-pad',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboard?: KeyboardTypeOptions;
}) {
  return (
    <View style={ff.wrap}>
      <Text style={ff.label}>{label}</Text>
      <TextInput
        style={ff.input}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={DS.textMuted}
        keyboardType={keyboard}
      />
    </View>
  );
}
const ff = StyleSheet.create({
  wrap:  { flex: 1 },
  label: { fontSize: 9, fontWeight: '700' as const, color: DS.textMuted, letterSpacing: 1.5, marginBottom: 6 },
  input: {
    borderWidth: 1.5, borderColor: DS.border, borderRadius: DS.radiusInput,
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 15, color: DS.textPrimary, backgroundColor: DS.bgCard,
  },
});

// ─── Shared sub-components ────────────────────────────────────────────────────

function ScreenHeader({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.header}>
      <TouchableOpacity
        onPress={onBack}
        style={s.backBtn}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        activeOpacity={0.7}
      >
        <Text style={s.backArrow}>←</Text>
        <Text style={s.backLabel}>Calculate</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle}>Feasibility Check</Text>
      <HelpButton featureKey="feasibility" size="sm" />
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CalculatorScreen() {
  const navigation = useNavigation<NavProp>();
  const { fmt, marketplace } = useCurrency();
  const { can } = useSubscription();
  const { activeProduct, setActiveProduct, refreshActiveProduct } = useActiveProduct();

  const [savedProduct,         setSavedProduct]         = useState<FeasibilityProduct | null>(null);
  const [savedSupplier,        setSavedSupplier]        = useState<FeasibilitySupplier | null>(null);
  const [weightLbs,            setWeightLbs]            = useState(String(FEASIBILITY_DEFAULTS.weightLbs));
  const [shipping,             setShipping]             = useState(String(FEASIBILITY_DEFAULTS.shippingPerUnit));
  const [customsPct,           setCustomsPct]           = useState(String(FEASIBILITY_DEFAULTS.customsPct));
  const [packagingStr,         setPackagingStr]         = useState('0.30');
  const [samplesStr,           setSamplesStr]           = useState('150');
  const [ppcStr,               setPpcStr]               = useState('');
  const [capitalTouched,       setCapitalTouched]       = useState(false);
  const [checklistPct,         setChecklistPct]         = useState<number | null>(null);
  const [loadingStorage,       setLoadingStorage]       = useState(true);
  const [saveMsg,              setSaveMsg]              = useState('');
  const [isFeasSaved,          setIsFeasSaved]          = useState(false);
  const [feasibilityReviewed,  setFeasibilityReviewed]  = useState(false);

  const isLocked = !can('feasibility');
  const { tags } = useFeasibilityTags();

  // Keep savedProduct in sync with context (cross-tab updates land here)
  useEffect(() => { setSavedProduct(activeProduct); }, [activeProduct]);

  // Re-read active product when the screen is focused (e.g. user came back from Research)
  useFocusEffect(useCallback(() => { refreshActiveProduct(); }, [refreshActiveProduct]));

  useEffect(() => {
    async function load() {
      try {
        const [ps, ss, cl] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.feasibilityProduct),
          AsyncStorage.getItem(STORAGE_KEYS.feasibilitySupplier),
          AsyncStorage.getItem(STORAGE_KEYS.launchChecklist),
        ]);
        const product  = ps ? (JSON.parse(ps) as FeasibilityProduct)  : null;
        const supplier = ss ? (JSON.parse(ss) as FeasibilitySupplier) : null;
        setSavedProduct(product);
        setSavedSupplier(supplier);
        const defaults = defaultCapitalInputs(product, supplier);
        setPpcStr(String(defaults.ppcBudget));
        if (product && supplier) {
          const saved = await AsyncStorage.getItem(STORAGE_KEYS.savedFeasibility);
          if (saved) {
            const list: any[] = JSON.parse(saved);
            setIsFeasSaved(list.some(e => e.product?.id === product.id && e.supplier?.name === supplier.name));
          }
        }
        if (cl) {
          try {
            const doneIds: string[] = JSON.parse(cl);
            if (Array.isArray(doneIds) && ALL_IDS.length > 0) {
              setChecklistPct(Math.round((doneIds.length / ALL_IDS.length) * 100));
            }
          } catch { /* ignore malformed */ }
        }
      } catch { /* ignore */ }
      finally { setLoadingStorage(false); }
    }
    load();
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────────

  const wt = parseFloat(weightLbs);
  const sp = parseFloat(shipping);
  const cp = parseFloat(customsPct);
  const inputs: FeasibilityInputs = {
    weightLbs:       isNaN(wt) ? FEASIBILITY_DEFAULTS.weightLbs      : wt,
    shippingPerUnit: isNaN(sp) ? FEASIBILITY_DEFAULTS.shippingPerUnit : sp,
    customsPct:      isNaN(cp) ? FEASIBILITY_DEFAULTS.customsPct      : cp,
  };

  const hasData = savedProduct != null && savedSupplier != null;

  const result = hasData
    ? computeFeasibility(savedProduct!, savedSupplier!, inputs, marketplace)
    : null;

  const riskResult: RiskAssessmentResult | null = (result && savedProduct && savedSupplier)
    ? computeRiskAssessment(savedProduct, savedSupplier, inputs, result)
    : null;

  const _pkg = parseFloat(packagingStr);
  const _smp = parseFloat(samplesStr);
  const _ppc = parseFloat(ppcStr);
  const capitalInputs: CapitalInputs = {
    packagingPerUnit: isNaN(_pkg) ? 0.30 : _pkg,
    samplesUSD:       isNaN(_smp) ? 150  : _smp,
    ppcBudget:        isNaN(_ppc) ? defaultCapitalInputs(savedProduct, savedSupplier).ppcBudget : _ppc,
  };

  const capitalBreakdown: CapitalBreakdown | null = (result && savedSupplier)
    ? computeCapitalEstimate(savedSupplier, inputs, result, capitalInputs)
    : null;

  const readinessResult: LaunchReadinessResult = computeLaunchReadiness(
    savedProduct, savedSupplier, result, riskResult, capitalTouched, checklistPct, feasibilityReviewed,
  );

  const decisionResult: LaunchDecisionResult | null = (result && riskResult)
    ? computeLaunchDecision(result, riskResult, readinessResult)
    : null;

  // Persist snapshot so the home screen can show the verdict without re-running.
  // Guard: skip during initial storage load (avoids stale writes on mount),
  // and clear snapshot when product is removed so home screen doesn't show stale data.
  useEffect(() => {
    if (loadingStorage) return;
    if (!result || !decisionResult || !riskResult || !savedProduct) {
      if (!savedProduct) AsyncStorage.removeItem(STORAGE_KEYS.launchAdvisorSnapshot).catch(() => {});
      return;
    }
    const snapshot: LaunchAdvisorSnapshot = {
      decision:     decisionResult,
      readiness:    readinessResult,
      riskScore:    riskResult.overallRiskScore,
      riskLevel:    riskResult.riskLevel,
      productTitle: savedProduct.name,
      computedAt:   new Date().toISOString(),
    };
    AsyncStorage.setItem(STORAGE_KEYS.launchAdvisorSnapshot, JSON.stringify(snapshot)).catch(() => {});
  }, [loadingStorage, result, decisionResult, riskResult, readinessResult, savedProduct]);

  // ── Actions ─────────────────────────────────────────────────────────────────

  async function clearProduct() {
    setActiveProduct(null);
    setSavedProduct(null);
    setFeasibilityReviewed(false);
  }
  async function clearSupplier() {
    await AsyncStorage.removeItem(STORAGE_KEYS.feasibilitySupplier);
    setSavedSupplier(null);
    setFeasibilityReviewed(false);
  }
  async function saveFeasibilityCheck() {
    if (!result || !savedProduct || !savedSupplier) return;
    try {
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.savedFeasibility);
      const list: any[] = existing ? JSON.parse(existing) : [];
      if (isFeasSaved) {
        const filtered = list.filter(e => !(e.product?.id === savedProduct.id && e.supplier?.name === savedSupplier.name));
        await AsyncStorage.setItem(STORAGE_KEYS.savedFeasibility, JSON.stringify(filtered));
        setIsFeasSaved(false);
        setSaveMsg('Removed');
        setTimeout(() => setSaveMsg(''), 2000);
      } else {
        list.unshift({ product: savedProduct, supplier: savedSupplier, result, savedAt: new Date().toISOString() });
        await AsyncStorage.setItem(STORAGE_KEYS.savedFeasibility, JSON.stringify(list.slice(0, 20)));
        setIsFeasSaved(true);
        setSaveMsg('Saved!');
        setTimeout(() => setSaveMsg(''), 2500);
      }
    } catch {
      Alert.alert('Error', 'Could not update the saved feasibility check. Please try again.');
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (loadingStorage) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScreenHeader onBack={() => navigation.goBack()} />
        <View style={s.center}><ActivityIndicator size="large" color={DS.indigo} /></View>
      </SafeAreaView>
    );
  }

  // ── Locked ───────────────────────────────────────────────────────────────────

  if (isLocked) {
    return (
      <SafeAreaView style={s.safe} edges={['top']}>
        <ScreenHeader onBack={() => navigation.goBack()} />
        <View style={s.lockedWrap}>
          <Text style={s.lockedIcon}>🔒</Text>
          <Text style={s.lockedTitle}>Builder+ Required</Text>
          <Text style={s.lockedBody}>
            Product Feasibility Check combines your saved Amazon product and supplier into a full financial analysis — margin, ROI, break-even, and a verdict.{'\n\n'}Upgrade to Builder or Operator to unlock.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScreenHeader onBack={() => navigation.goBack()} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >

        {/* ─── Hero: Launch Decision ──────────────────────────────────── */}
        {decisionResult ? (
          <View style={[c.decisionHero, { borderColor: decisionBorderColor(decisionResult.decision) }]}>
            <View style={c.heroTopRow}>
              <Text style={c.heroEyebrow}>LAUNCH DECISION</Text>
              <HelpButton featureKey="go_no_go" size="sm" />
            </View>
            <View style={c.decisionBadgeRow}>
              <View style={[c.decisionBadge, { backgroundColor: decisionBgColor(decisionResult.decision) }]}>
                <Text style={[c.decisionBadgeTxt, { color: decisionTextColor(decisionResult.decision) }]}>
                  {decisionResult.decision}
                </Text>
              </View>
              <View style={[c.confidenceBadge, { backgroundColor: decisionBgColor(decisionResult.decision) }]}>
                <Text style={[c.confidenceTxt, { color: decisionTextColor(decisionResult.decision) }]}>
                  {decisionResult.confidence} confidence
                </Text>
              </View>
            </View>
            <Text style={c.decisionSummary}>{decisionResult.summary}</Text>
            {decisionResult.reasons.map((r, i) => (
              <View key={i} style={c.reasonRow}>
                <Text style={[c.reasonDot, { color: decisionTextColor(decisionResult.decision) }]}>·</Text>
                <Text style={c.reasonTxt}>{r}</Text>
              </View>
            ))}
            <TouchableOpacity
              style={c.shareBtn}
              activeOpacity={0.75}
              onPress={() => {
                const lines = [
                  `Siftly Feasibility Check — ${decisionResult.decision}`,
                  savedProduct ? `Product: ${savedProduct.name}` : '',
                  savedSupplier ? `Supplier: ${savedSupplier.name}` : '',
                  '',
                  decisionResult.summary,
                  '',
                  ...decisionResult.reasons.map(r => `• ${r}`),
                  '',
                  result ? [
                    `Margin: ${result.marginPct.toFixed(1)}%`,
                    `Profit/unit: $${result.profitPerUnit.toFixed(2)}`,
                    `ROI: ${result.roiPct.toFixed(1)}%`,
                    capitalBreakdown ? `Total launch capital: $${capitalBreakdown.totalLaunchCapital.toLocaleString()}` : '',
                  ].filter(Boolean).join('  ·  ') : '',
                  `Readiness: ${readinessResult.score}%  ·  Confidence: ${decisionResult.confidence}`,
                ].filter(Boolean).join('\n');
                Share.share({ message: lines }).catch(() => {});
              }}
            >
              <Text style={c.shareBtnTxt}>↑ Share This Report</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={c.setupCard}>
            <Text style={c.setupEyebrow}>FEASIBILITY CHECK</Text>
            <Text style={c.setupTitle}>
              Combine Amazon product data, supplier costs, risk, capital, and launch readiness into one decision.
            </Text>
            <View style={c.setupSteps}>
              <Text style={c.setupStep}>{savedProduct ? '✓ ' : '1.  '}Save an Amazon product from Research</Text>
              <Text style={c.setupStep}>{savedSupplier ? '✓ ' : '2.  '}Attach a supplier from Suppliers</Text>
              <Text style={[c.setupStep, { color: DS.textMuted }]}>3.  Return here to see your full analysis</Text>
            </View>
          </View>
        )}

        {/* ─── Amazon Product ─────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>AMAZON PRODUCT</Text>
          {savedProduct ? (
            <View style={c.summaryCard}>
              <Text style={c.summaryName} numberOfLines={2}>{savedProduct.name}</Text>
              <View style={c.chips}>
                {savedProduct.price != null && (
                  <View style={c.chip}>
                    <Text style={c.chipVal}>{fmt(savedProduct.price)}</Text>
                    <Text style={c.chipLbl}>Price</Text>
                  </View>
                )}
                <View style={c.chip}>
                  <Text style={[c.chipVal, {
                    color: savedProduct.competition === 'Low' ? DS.successText
                      : savedProduct.competition === 'High' ? DS.dangerText : DS.warningText,
                  }]}>{savedProduct.competition}</Text>
                  <Text style={c.chipLbl}>Competition</Text>
                </View>
                {savedProduct.reviewCount != null && (
                  <View style={c.chip}>
                    <Text style={c.chipVal}>{savedProduct.reviewCount.toLocaleString()}</Text>
                    <Text style={c.chipLbl}>Reviews</Text>
                  </View>
                )}
              </View>
              <View style={c.clearRow}>
                <TouchableOpacity style={c.clearBtn} onPress={clearProduct} activeOpacity={0.8}>
                  <Text style={c.clearTxt}>✕  Clear Product</Text>
                </TouchableOpacity>
                <Text style={c.savedAt}>Saved {new Date(savedProduct.savedAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ) : (
            <View style={c.emptyCard}>
              <Text style={c.emptyIcon}>◎</Text>
              <Text style={c.emptyTitle}>No product saved</Text>
              <Text style={c.emptyBody}>Find a product in Research → Market Search, then tap "Save for Feasibility Check".</Text>
              <TouchableOpacity
                style={c.navBtn}
                onPress={() => (navigation as any).navigate('Main', { screen: 'Search' })}
                activeOpacity={0.85}
              >
                <Text style={c.navBtnTxt}>Go to Product Research</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ─── Supplier ───────────────────────────────────────────────── */}
        <View style={s.section}>
          <Text style={s.sectionLabel}>SUPPLIER</Text>
          {savedSupplier ? (
            <View style={c.summaryCard}>
              <Text style={c.summaryName} numberOfLines={1}>{savedSupplier.name}</Text>
              <View style={c.chips}>
                <View style={c.chip}>
                  <Text style={c.chipVal}>{savedSupplier.platform}</Text>
                  <Text style={c.chipLbl}>Platform</Text>
                </View>
                {savedSupplier.priceUSD != null && (
                  <View style={c.chip}>
                    <Text style={c.chipVal}>{fmt(savedSupplier.priceUSD)}/unit</Text>
                    <Text style={c.chipLbl}>Unit Cost</Text>
                  </View>
                )}
                <View style={c.chip}>
                  <Text style={c.chipVal}>{savedSupplier.moqDisplay}</Text>
                  <Text style={c.chipLbl}>MOQ</Text>
                </View>
              </View>
              <View style={c.clearRow}>
                <TouchableOpacity style={c.clearBtn} onPress={clearSupplier} activeOpacity={0.8}>
                  <Text style={c.clearTxt}>✕  Clear Supplier</Text>
                </TouchableOpacity>
                <Text style={c.savedAt}>Saved {new Date(savedSupplier.savedAt).toLocaleDateString()}</Text>
              </View>
            </View>
          ) : (
            <View style={c.emptyCard}>
              <Text style={c.emptyIcon}>🏭</Text>
              <Text style={c.emptyTitle}>No supplier attached</Text>
              <Text style={c.emptyBody}>Find a supplier in Research → Suppliers, then tap "Attach to Feasibility Check".</Text>
              <TouchableOpacity
                style={c.navBtn}
                onPress={() => (navigation as any).navigate('Main', { screen: 'Search' })}
                activeOpacity={0.85}
              >
                <Text style={c.navBtnTxt}>Go to Supplier Search</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* ── Below sections only when BOTH product AND supplier are saved ── */}
        {hasData && (
          <>
            {/* ─── Adjustable Inputs ────────────────────────────────── */}
            <View style={s.section}>
              <Text style={s.sectionLabel}>ADJUSTABLE INPUTS</Text>
              <View style={c.inputsCard}>
                <View style={s.row}>
                  <FeasField label="UNIT WEIGHT (LBS)" value={weightLbs} onChange={setWeightLbs} placeholder="0.5" />
                  <FeasField label="SHIPPING / UNIT ($)" value={shipping} onChange={setShipping} placeholder="1.50" />
                </View>
                <FeasField label="CUSTOMS / IMPORT DUTY (%)" value={customsPct} onChange={setCustomsPct} placeholder="0" />
              </View>
            </View>

            {/* ─── Financial Summary ────────────────────────────────── */}
            {result && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>FINANCIAL SUMMARY</Text>
                <View style={[c.heroCard, { borderColor: result.profitPerUnit >= 0 ? DS.success : DS.danger }]}>
                  <Text style={c.heroLabel}>PROFIT PER UNIT</Text>
                  <Text style={[c.heroNum, { color: result.profitPerUnit >= 0 ? DS.successText : DS.dangerText }]}>
                    {fmt(result.profitPerUnit)}
                  </Text>
                  <View style={c.heroStats}>
                    <View style={c.heroStat}>
                      <Text style={c.heroStatVal}>{result.marginPct.toFixed(1)}%</Text>
                      <Text style={c.heroStatLbl}>Margin</Text>
                    </View>
                    <View style={c.heroDivider} />
                    <View style={c.heroStat}>
                      <Text style={c.heroStatVal}>{result.roiPct.toFixed(1)}%</Text>
                      <Text style={c.heroStatLbl}>ROI</Text>
                    </View>
                    <View style={c.heroDivider} />
                    <View style={c.heroStat}>
                      <Text style={c.heroStatVal}>{result.breakEvenUnits.toLocaleString()}</Text>
                      <Text style={c.heroStatLbl}>Break-even</Text>
                    </View>
                  </View>
                </View>

                <View style={c.tableCard}>
                  {([
                    ['Amazon Selling Price',  fmt(result.sellingPrice),          false],
                    ['Supplier Unit Cost',   `-${fmt(result.unitCost)}`,          true ],
                    ['Shipping / Unit',      `-${fmt(result.shippingPerUnit)}`,   true ],
                    ['Customs Duty',         `-${fmt(result.customsDuty)}`,       true ],
                    ['Landed Cost',           fmt(result.landedCost),             false],
                    ['Referral Fee (15%)',   `-${fmt(result.referralFee)}`,       true ],
                    ['FBA Fee (est.)',        `-${fmt(result.fbaFee)}`,           true ],
                  ] as [string, string, boolean][]).map(([label, val, muted]) => (
                    <View key={label} style={c.tableRow}>
                      <Text style={c.tableLabel}>{label}</Text>
                      <Text style={[c.tableVal, muted && { color: DS.textMuted }]}>{val}</Text>
                    </View>
                  ))}
                  <View style={[c.tableRow, { borderBottomWidth: 0 }]}>
                    <Text style={[c.tableLabel, { fontWeight: '700', color: DS.textPrimary }]}>Profit / Unit</Text>
                    <Text style={[c.tableVal, { color: result.profitPerUnit >= 0 ? DS.successText : DS.dangerText }]}>
                      {fmt(result.profitPerUnit)}
                    </Text>
                  </View>
                </View>

                <View style={c.investCard}>
                  {([
                    ['MOQ',                         `${result.moq.toLocaleString()} units`,             DS.textPrimary],
                    ['Initial Investment (at MOQ)',   fmt(result.initialInvestment, 0),                DS.warningText],
                    ['Units to Break Even',           `${result.breakEvenUnits.toLocaleString()} units`, DS.textPrimary],
                  ] as [string, string, string][]).map(([label, val, clr], i, arr) => (
                    <View key={label} style={[c.investRow, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
                      <Text style={c.investLabel}>{label}</Text>
                      <Text style={[c.investVal, { color: clr }]}>{val}</Text>
                    </View>
                  ))}
                </View>

                <Text style={s.note}>
                  ⓘ FBA fee is estimated from weight ({inputs.weightLbs} lbs). For exact fees, use the FBA Profit calculator in Profit Lab.
                </Text>
              </View>
            )}

            {/* ─── Verdict ──────────────────────────────────────────── */}
            {result && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>VERDICT</Text>
                <View style={[c.verdictCard, { borderColor: verdictColor(result.verdict) }]}>
                  <Text style={[c.verdictLabel, { color: verdictColor(result.verdict) }]}>
                    {result.verdict.toUpperCase()}
                  </Text>
                  <Text style={c.verdictReason}>{result.verdictReason}</Text>
                  {result.hasMissingData && (
                    <View style={c.missingWrap}>
                      <Text style={c.missingTitle}>Missing data — results are estimates only:</Text>
                      {result.missingFields.map(f => (
                        <Text key={f} style={c.missingItem}>· {f}</Text>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            )}

            {/* ─── Risk Assessment ──────────────────────────────────── */}
            {riskResult && (
              <View style={s.section}>
                <View style={s.labelRow}>
                  <Text style={s.sectionLabel}>RISK ASSESSMENT</Text>
                  <HelpButton featureKey="risk_assessment" size="sm" />
                </View>

                <View style={c.riskCard}>
                  <View style={c.riskScoreRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={c.riskScoreNum}>{riskResult.overallRiskScore}</Text>
                      <Text style={c.riskScoreSub}>out of 100</Text>
                    </View>
                    <View style={[c.riskBadge, { backgroundColor: riskLevelBg(riskResult.riskLevel) }]}>
                      <Text style={[c.riskBadgeTxt, { color: riskLevelColor(riskResult.riskLevel) }]}>
                        {riskResult.riskLevel.toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  <View style={c.gauge}>
                    <View style={[c.gaugeFill, {
                      width: `${riskResult.overallRiskScore}%` as any,
                      backgroundColor: riskLevelColor(riskResult.riskLevel),
                    }]} />
                  </View>
                  <View style={c.catBars}>
                    {(Object.keys(CATEGORY_LABELS) as (keyof typeof CATEGORY_LABELS)[]).map(key => {
                      const score = riskResult.scores[key];
                      const barColor = score >= 70 ? DS.dangerText : score >= 45 ? DS.warningText
                        : score >= 25 ? DS.infoText : DS.successText;
                      return (
                        <View key={key} style={c.catBarRow}>
                          <Text style={c.catBarLabel}>{CATEGORY_LABELS[key]}</Text>
                          <View style={c.catBarTrack}>
                            <View style={[c.catBarFill, { width: `${score}%` as any, backgroundColor: barColor }]} />
                          </View>
                          <Text style={c.catBarVal}>{score}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>

                {riskResult.topRiskFactors.length > 0 && (
                  <View style={[c.factorsCard, { marginTop: 10 }]}>
                    {riskResult.topRiskFactors.map((factor, i) => (
                      <View key={i} style={[c.factorRow, i < riskResult.topRiskFactors.length - 1 && c.factorBorder]}>
                        <View style={[c.severityDot, {
                          backgroundColor: factor.severity === 'high' ? DS.dangerText
                            : factor.severity === 'medium' ? DS.warningText : DS.infoText,
                        }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={c.factorDesc}>{factor.description}</Text>
                          <Text style={c.factorMit}>→ {factor.mitigation}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <View style={c.decisionNoteCard}>
                  <Text style={c.decisionNoteIcon}>◎</Text>
                  <Text style={c.decisionNoteText}>{riskResult.decisionNote}</Text>
                </View>
              </View>
            )}

            {/* ─── Minimum Launch Capital ───────────────────────────── */}
            {result && savedSupplier && (
              <View style={s.section}>
                <View style={s.labelRow}>
                  <Text style={s.sectionLabel}>MINIMUM LAUNCH CAPITAL</Text>
                  <HelpButton featureKey="capital_estimator" size="sm" />
                </View>

                <View style={c.inputsCard}>
                  <View style={s.row}>
                    <FeasField
                      label="PACKAGING / UNIT ($)"
                      value={packagingStr}
                      onChange={v => { setPackagingStr(v); setCapitalTouched(true); }}
                      placeholder="0.30"
                    />
                    <FeasField
                      label="SAMPLE ORDER ($)"
                      value={samplesStr}
                      onChange={v => { setSamplesStr(v); setCapitalTouched(true); }}
                      placeholder="150"
                    />
                  </View>
                  <FeasField
                    label="LAUNCH PPC / MARKETING ($)"
                    value={ppcStr}
                    onChange={v => { setPpcStr(v); setCapitalTouched(true); }}
                    placeholder="500"
                  />
                </View>

                {capitalBreakdown && (
                  <View style={[c.tableCard, { marginTop: 10 }]}>
                    <View style={[c.tableRow, { backgroundColor: DS.bgSubtle }]}>
                      <Text style={[c.tableLabel, { fontSize: 10, color: DS.textMuted }]}>
                        Based on MOQ of {savedSupplier.moqNum || 100} units ({savedSupplier.moqDisplay})
                      </Text>
                    </View>
                    {([
                      ['Inventory (unit cost × MOQ)',  capitalBreakdown.inventoryCost, false],
                      ['Shipping (freight × MOQ)',      capitalBreakdown.shippingCost,  false],
                      ['Customs / Duties',              capitalBreakdown.customsDuties, false],
                      ['Packaging / Labelling',         capitalBreakdown.packagingCost, false],
                      ['Sample order',                  capitalBreakdown.samplesOrder,  false],
                      ['Launch PPC / Marketing',        capitalBreakdown.ppcMarketing,  false],
                      ['Contingency Reserve (10%)',      capitalBreakdown.contingency,   true ],
                    ] as [string, number, boolean][]).map(([label, val, muted]) => (
                      <View key={label} style={c.tableRow}>
                        <Text style={[c.tableLabel, muted && { color: DS.textMuted }]}>{label}</Text>
                        <Text style={[c.tableVal, muted && { color: DS.textMuted }]}>{fmt(val)}</Text>
                      </View>
                    ))}
                    <View style={[c.tableRow, { borderBottomWidth: 0, backgroundColor: DS.bgElevated }]}>
                      <Text style={[c.tableLabel, { fontWeight: '800', color: DS.textPrimary }]}>Total Launch Capital</Text>
                      <Text style={[c.tableVal, { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 }]}>
                        {fmt(capitalBreakdown.totalLaunchCapital)}
                      </Text>
                    </View>
                  </View>
                )}

                <Text style={s.note}>Packaging and PPC are estimates — adjust above to match your actual costs.</Text>
              </View>
            )}

            {/* ─── Launch Readiness ─────────────────────────────────── */}
            <View style={s.section}>
              <View style={s.labelRow}>
                <Text style={s.sectionLabel}>LAUNCH READINESS</Text>
                <HelpButton featureKey="launch_readiness" size="sm" />
              </View>
              <View style={c.readinessCard}>
                <View style={c.readinessScoreRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={c.readinessScore}>{readinessResult.score}</Text>
                    <Text style={c.readinessScoreSub}>out of 100</Text>
                  </View>
                  <View style={[c.readinessBadge, {
                    backgroundColor: readinessResult.score >= 65 ? DS.successBg
                      : readinessResult.score >= 35 ? DS.warningBg : DS.dangerBg,
                  }]}>
                    <Text style={[c.readinessBadgeTxt, {
                      color: readinessResult.score >= 65 ? DS.successText
                        : readinessResult.score >= 35 ? DS.warningText : DS.dangerText,
                    }]}>
                      {readinessResult.score >= 65 ? 'READY' : readinessResult.score >= 35 ? 'IN PROGRESS' : 'NOT READY'}
                    </Text>
                  </View>
                </View>
                <View style={c.gauge}>
                  <View style={[c.gaugeFill, {
                    width: `${readinessResult.score}%` as any,
                    backgroundColor: readinessResult.score >= 65 ? DS.successText
                      : readinessResult.score >= 35 ? DS.warningText : DS.dangerText,
                  }]} />
                </View>
                <View style={c.readinessItems}>
                  {readinessResult.items.map((item, i) => (
                    <View key={i} style={c.readinessItem}>
                      <Text style={[c.readinessDot, { color: item.done ? DS.successText : DS.textMuted }]}>
                        {item.done ? '✓' : '○'}
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[c.readinessLabel, !item.done && { color: DS.textMuted }]}>
                          {item.label}
                        </Text>
                        {!item.done && item.action && (
                          <Text style={c.readinessAction}>{item.action}</Text>
                        )}
                      </View>
                      <Text style={c.readinessPts}>+{item.points}</Text>
                    </View>
                  ))}
                </View>

                {result && !result.hasMissingData && !feasibilityReviewed && (
                  <TouchableOpacity
                    style={c.reviewedBtn}
                    onPress={() => setFeasibilityReviewed(true)}
                    activeOpacity={0.82}
                  >
                    <Text style={c.reviewedBtnTxt}>✓  Mark Feasibility as Reviewed  (+20 pts)</Text>
                  </TouchableOpacity>
                )}

                {checklistPct != null && (
                  <View style={c.checklistRow}>
                    <Text style={c.checklistLabel}>Launch plan</Text>
                    <Text style={c.checklistVal}>{checklistPct}% complete</Text>
                  </View>
                )}
              </View>
            </View>

            {/* ─── Assumptions ──────────────────────────────────────── */}
            {result && (
              <View style={s.section}>
                <Text style={s.sectionLabel}>ASSUMPTIONS</Text>
                <View style={c.assumeCard}>
                  {([
                    ['Referral fee',  '15% of selling price (Amazon standard)'],
                    ['FBA fee',       `${fmt(result.fbaFee)} — estimated from ${inputs.weightLbs} lbs. Verify in Seller Central for exact sizing.`],
                    ['Shipping',      `${fmt(inputs.shippingPerUnit)}/unit — your input (typical sea freight: $1–$3)`],
                    ['Customs',       inputs.customsPct > 0
                      ? `${inputs.customsPct}% of unit cost — your input`
                      : 'Not included (0%) — update if your category has import duties'],
                    ['Storage fees',  'Not included — use FBA Profit calculator for a full estimate'],
                  ] as [string, string][]).map(([label, note]) => (
                    <View key={label} style={c.assumeRow}>
                      <Text style={c.assumeLabel}>{label}</Text>
                      <Text style={c.assumeNote}>{note}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ─── Save Button ──────────────────────────────────────── */}
            {result && (
              <View style={s.section}>
                <TouchableOpacity
                  style={[c.saveBtn, isFeasSaved && c.saveBtnSaved]}
                  onPress={saveFeasibilityCheck}
                  activeOpacity={0.85}
                >
                  <Text style={[c.saveBtnTxt, isFeasSaved && c.saveBtnTxtSaved]}>
                    {saveMsg || (isFeasSaved ? '✕  Unsave Feasibility Check' : '✦  Save Feasibility Check')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.launchPadBtn}
                  onPress={() => (navigation as any).navigate('Main', { screen: 'LaunchPad' })}
                  activeOpacity={0.85}
                >
                  <Text style={s.launchPadBtnTxt}>Take to LaunchPad  →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Screen styles ────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgCanvas },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: DS.pagePadding, paddingVertical: 12,
    backgroundColor: DS.bgCard, borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  backBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backArrow:   { fontSize: 18, color: DS.indigo, fontWeight: '700' as const },
  backLabel:   { fontSize: 13, color: DS.indigo, fontWeight: '600' as const },
  headerTitle: {
    flex: 1, fontSize: 15, fontWeight: '800' as const,
    color: DS.textPrimary, textAlign: 'center' as const, letterSpacing: -0.3,
  },

  center:     { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  lockedWrap: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, padding: 32, gap: 16 },
  lockedIcon:  { fontSize: 36 },
  lockedTitle: { fontSize: 20, fontWeight: '800' as const, color: DS.textPrimary, textAlign: 'center' as const },
  lockedBody:  { fontSize: 14, color: DS.textSecondary, textAlign: 'center' as const, lineHeight: 22 },

  scroll:  { flex: 1 },
  content: { paddingTop: DS.sectionGap, paddingBottom: 80, gap: DS.sectionGap },

  section:      { paddingHorizontal: DS.pagePadding, gap: 10 },
  sectionLabel: { fontSize: 9, fontWeight: '700' as const, color: DS.textMuted, letterSpacing: 1.5 },
  labelRow:     { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const },

  row:  { flexDirection: 'row' as const, gap: 10 },
  note: { fontSize: 11, color: DS.textMuted, lineHeight: 16 },

  launchPadBtn: {
    backgroundColor: DS.indigo,
    borderRadius: DS.radiusButton,
    paddingVertical: 14,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  launchPadBtnTxt: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#fff',
    letterSpacing: 0.2,
  },
});

// ─── Card styles ──────────────────────────────────────────────────────────────

const c = StyleSheet.create({
  // Hero decision card (top of screen)
  decisionHero:    { marginHorizontal: DS.pagePadding, borderRadius: DS.radiusCard, borderWidth: 2, padding: 20, gap: 12, backgroundColor: DS.bgCard },
  heroTopRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroEyebrow:     { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  decisionBadgeRow:{ flexDirection: 'row', alignItems: 'center', gap: 10 },
  decisionBadge:   { borderRadius: DS.radiusChip, paddingHorizontal: 16, paddingVertical: 8 },
  decisionBadgeTxt:{ fontSize: 28, fontWeight: '900', letterSpacing: 1 },
  confidenceBadge: { borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4 },
  confidenceTxt:   { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  decisionSummary: { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  reasonRow:       { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  reasonDot:       { fontSize: 18, fontWeight: '900', lineHeight: 20 },
  reasonTxt:       { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  shareBtn:        { borderRadius: 10, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgSubtle, paddingVertical: 9, alignItems: 'center', marginTop: 4 },
  shareBtnTxt:     { fontSize: 12, fontWeight: '700', color: DS.textSecondary },

  // Setup card (shown when no decision yet)
  setupCard:   { marginHorizontal: DS.pagePadding, backgroundColor: DS.indigoLight, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.indigo + '30', padding: 20, gap: 10 },
  setupEyebrow:{ fontSize: 9, fontWeight: '800', color: DS.indigo, letterSpacing: 2 },
  setupTitle:  { fontSize: 14, fontWeight: '600', color: DS.textPrimary, lineHeight: 20 },
  setupSteps:  { gap: 5 },
  setupStep:   { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },

  // Summary cards (product / supplier)
  summaryCard: { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 16, gap: 12 },
  summaryName: { fontSize: 14, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 20 },
  chips:       { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip:        { backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 60 },
  chipVal:     { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  chipLbl:     { fontSize: 8, fontWeight: '600', color: DS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 2 },
  clearRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: DS.border, paddingTop: 10, marginTop: 2 },
  clearBtn:    { backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: DS.border },
  clearTxt:    { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  savedAt:     { fontSize: 10, color: DS.textMuted },

  // Empty states with navigation buttons
  emptyCard:  { backgroundColor: DS.bgElevated, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 24, alignItems: 'center', gap: 8 },
  emptyIcon:  { fontSize: 28 },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  emptyBody:  { fontSize: 12, color: DS.textSecondary, textAlign: 'center', lineHeight: 18 },
  navBtn:     { backgroundColor: DS.indigo, borderRadius: DS.radiusButton, paddingHorizontal: 20, paddingVertical: 10, marginTop: 4 },
  navBtnTxt:  { fontSize: 13, fontWeight: '700', color: '#fff' },

  // Adjustable inputs container
  inputsCard: { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 16, gap: 12 },

  // Profit hero card
  heroCard:    { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1.5, padding: 20, alignItems: 'center', gap: 10 },
  heroLabel:   { fontSize: 9, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  heroNum:     { fontSize: 44, fontWeight: '800', letterSpacing: -2 },
  heroStats:   { flexDirection: 'row', width: '100%', backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip },
  heroStat:    { flex: 1, alignItems: 'center', paddingVertical: 10 },
  heroStatVal: { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.5 },
  heroStatLbl: { fontSize: 8, fontWeight: '600', color: DS.textMuted, letterSpacing: 1, marginTop: 2 },
  heroDivider: { width: 1, backgroundColor: DS.border },

  // Investment card
  investCard:  { backgroundColor: DS.bgCard, borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.border, overflow: 'hidden', marginTop: 8 },
  investRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: DS.border },
  investLabel: { fontSize: 13, color: DS.textSecondary, flex: 1 },
  investVal:   { fontSize: 13, fontWeight: '700', color: DS.textPrimary },

  // Generic table card
  tableCard:  { backgroundColor: DS.bgCard, borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  tableRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: DS.border },
  tableLabel: { fontSize: 13, color: DS.textSecondary, flex: 1 },
  tableVal:   { fontSize: 13, fontWeight: '700', color: DS.textPrimary },

  // Verdict card
  verdictCard:  { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 2, padding: 20, gap: 10 },
  verdictLabel: { fontSize: 18, fontWeight: '900', letterSpacing: -0.3 },
  verdictReason:{ fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  missingWrap:  { backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, padding: 12, gap: 4, marginTop: 4 },
  missingTitle: { fontSize: 11, fontWeight: '700', color: DS.textMuted },
  missingItem:  { fontSize: 11, color: DS.textSecondary },

  // Risk card
  riskCard:     { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 16, gap: 14 },
  riskScoreRow: { flexDirection: 'row', alignItems: 'center' },
  riskScoreNum: { fontSize: 48, fontWeight: '900', color: DS.textPrimary, letterSpacing: -2, lineHeight: 52 },
  riskScoreSub: { fontSize: 10, color: DS.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  riskBadge:    { borderRadius: DS.radiusBadge, paddingHorizontal: 12, paddingVertical: 5 },
  riskBadgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  gauge:        { height: 8, backgroundColor: DS.bgElevated, borderRadius: DS.radiusBadge, overflow: 'hidden' },
  gaugeFill:    { height: 8, borderRadius: DS.radiusBadge },
  catBars:      { gap: 10 },
  catBarRow:    { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catBarLabel:  { fontSize: 11, color: DS.textSecondary, width: 110 },
  catBarTrack:  { flex: 1, height: 5, backgroundColor: DS.bgElevated, borderRadius: DS.radiusBadge, overflow: 'hidden' },
  catBarFill:   { height: 5, borderRadius: DS.radiusBadge },
  catBarVal:    { fontSize: 11, fontWeight: '700', color: DS.textMuted, width: 24, textAlign: 'right' },

  // Risk factors list
  factorsCard: { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  factorRow:   { flexDirection: 'row', gap: 10, padding: 14, alignItems: 'flex-start' },
  factorBorder:{ borderBottomWidth: 1, borderBottomColor: DS.border },
  severityDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5, flexShrink: 0 },
  factorDesc:  { fontSize: 13, fontWeight: '600', color: DS.textPrimary, lineHeight: 19 },
  factorMit:   { fontSize: 11, color: DS.textSecondary, lineHeight: 17, marginTop: 2 },

  // Decision impact note
  decisionNoteCard: { backgroundColor: DS.indigoLight, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.indigo + '30', padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginTop: 10 },
  decisionNoteIcon: { fontSize: 16, color: DS.indigo, marginTop: 1 },
  decisionNoteText: { flex: 1, fontSize: 13, color: DS.textPrimary, lineHeight: 20 },

  // Launch Readiness
  readinessCard:     { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 16, gap: 14 },
  readinessScoreRow: { flexDirection: 'row', alignItems: 'center' },
  readinessScore:    { fontSize: 48, fontWeight: '900', color: DS.textPrimary, letterSpacing: -2, lineHeight: 52 },
  readinessScoreSub: { fontSize: 10, color: DS.textMuted, fontWeight: '600', letterSpacing: 0.5 },
  readinessBadge:    { borderRadius: DS.radiusBadge, paddingHorizontal: 12, paddingVertical: 5 },
  readinessBadgeTxt: { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  readinessItems:    { gap: 10 },
  readinessItem:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  readinessDot:      { fontSize: 14, fontWeight: '800', width: 16, lineHeight: 20 },
  readinessLabel:    { fontSize: 13, color: DS.textPrimary, lineHeight: 19 },
  readinessAction:   { fontSize: 11, color: DS.textSecondary, lineHeight: 16, marginTop: 2 },
  readinessPts:      { fontSize: 10, fontWeight: '700', color: DS.textMuted, width: 24, textAlign: 'right', lineHeight: 20 },
  reviewedBtn:       { backgroundColor: DS.successBg, borderRadius: DS.radiusButton, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: DS.success, marginTop: 4 },
  reviewedBtnTxt:    { fontSize: 13, fontWeight: '700', color: DS.successText },
  checklistRow:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: DS.border },
  checklistLabel:    { fontSize: 11, color: DS.textMuted, fontWeight: '600' },
  checklistVal:      { fontSize: 11, fontWeight: '700', color: DS.textSecondary },

  // Assumptions
  assumeCard: { backgroundColor: DS.bgElevated, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 16, gap: 12 },
  assumeRow:  { gap: 2 },
  assumeLabel:{ fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  assumeNote: { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },

  // Save button
  saveBtn:        { backgroundColor: DS.indigo, borderRadius: DS.radiusButton, paddingVertical: 16, alignItems: 'center' },
  saveBtnSaved:   { backgroundColor: DS.bgSubtle, borderWidth: 1.5, borderColor: DS.border },
  saveBtnTxt:     { fontSize: 16, fontWeight: '800', color: '#fff' },
  saveBtnTxtSaved:{ color: DS.textSecondary },
});
