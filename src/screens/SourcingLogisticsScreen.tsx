import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { DS } from '../components/ds';
import { InputField, PrimaryButton, AppCard } from '../components/ds';
import { api, Supplier } from '../services/api';
import { AppHeader } from '../components/AppHeader';
import { PipelineProgressBar } from '../components/PipelineProgressBar';
import { useCurrency } from '../context/CurrencyContext';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { usePipeline, PipelineReconInsights, PipelineSupplier } from '../context/PipelineContext';
import { computeSourcingStrategy, SourcingStrategyResult } from '../lib/sourcingStrategy';
import { useProductIntelligence } from '../hooks/useProductIntelligence';
import {
  roughROIPct, roughLandedCost, roiColor,
  confirmedMarginPct, confirmedROIPct, marginColor,
  buildCostModel,
  assignSupplierLabels,
  estimateStartupCapital,
} from '../lib/financialEngine';
import type { SupplierLabel } from '../lib/financialEngine';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import {
  deduplicateSuppliers, scoreSupplier, detectSupplierType, SmartSearchSummary,
} from '../lib/smartSearch';
import { supplierToDisplay } from './research/productHelpers';
import { SupplierDisplay, AnalyzeSupplierResult, OutreachEmail } from './research/types';
import {
  SupplierCard, CompareSuppliersModal, OutreachEmailCard,
} from './research/SupplierCards';
import {
  AnalyzeSupplierModal, RecentSearches, SmartSummaryCard,
} from './research/SharedComponents';
import { openURL } from './research/utils';
import { Toast } from '../components/Toast';
import { useToast } from '../hooks/useToast';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import { SupplyChainIntelligenceCard } from '../components/SupplyChainIntelligenceCard';
import { DecisionSimulationPanel } from '../components/DecisionSimulationPanel';
import { useDecisionSimulation } from '../hooks/useDecisionSimulation';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';

// ── Platform supplier stubs ───────────────────────────────────────────────────
// Injected as full SupplierDisplay items so they render as identical SupplierCards
// with View / Analyze / Compare / Lock In — price/MOQ are unknown until user visits.

const PLATFORM_DEFS = [
  { id: 'dhgate',      name: 'DHgate',         country: '🇨🇳', buildUrl: (q: string) => `https://www.dhgate.com/wholesale/search.do?searchkey=${q}` },
  { id: '1688',        name: '1688',            country: '🇨🇳', buildUrl: (q: string) => `https://s.1688.com/selloffer/offerlist.htm?keywords=${q}` },
  { id: 'globalsrc',   name: 'Global Sources',  country: '🌐', buildUrl: (q: string) => `https://www.globalsources.com/gsol/I/Products/?keywords=${q}` },
  { id: 'madeinchina', name: 'Made-in-China',   country: '🇨🇳', buildUrl: (q: string) => `https://www.made-in-china.com/products-search/hot-china-products/${q}.html` },
];

function buildPlatformSuppliers(productQuery: string): ScoredDisplay[] {
  const q = encodeURIComponent(productQuery.trim());
  return PLATFORM_DEFS.map(p => ({
    id:       `__platform_${p.id}`,
    name:     `${productQuery} suppliers`,
    platform: p.name,
    badge:    'External Platform',
    moq:      'Quote required',
    moqNum:   0,
    price:    'Visit for live prices',
    priceUSD: null,
    trust:    0,
    country:  p.country,
    url:      p.buildUrl(q),
    badges:   ['External Platform'],
    matchReason: 'Tap View to browse live listings — get a real price quote before locking in',
  }));
}

// ── Supplier URL resolver ─────────────────────────────────────────────────────
// Backend always returns alibaba.com URLs regardless of platform. Build the
// correct search URL based on the platform field when that happens.
function resolveSupplierUrl(platform: string, existingUrl: string | undefined, productQuery: string): string {
  const q = encodeURIComponent(productQuery || '');
  const p = (platform || '').toLowerCase();
  // If URL already points to the correct non-Alibaba platform, use it as-is
  if (existingUrl && !existingUrl.includes('alibaba.com')) return existingUrl;
  if (p.includes('dhgate'))                                return `https://www.dhgate.com/wholesale/search.do?searchkey=${q}`;
  if (p.includes('1688'))                                  return `https://s.1688.com/selloffer/offerlist.htm?keywords=${q}`;
  if (p.includes('global sources') || p.includes('globalsources')) return `https://www.globalsources.com/gsol/I/Products/?keywords=${q}`;
  if (p.includes('made-in-china') || p.includes('made in china'))  return `https://www.made-in-china.com/products-search/hot-china-products/${q}.html`;
  if (p.includes('indiamart'))                             return `https://www.indiamart.com/search.mp?ss=${q}`;
  // Default: Alibaba search for the product
  return existingUrl || `https://www.alibaba.com/trade/search?SearchText=${q}`;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type ScoredDisplay = SupplierDisplay & { grade?: string };
type SourcingTab   = 'suppliers' | 'freight' | 'overview';

// ── Recon specs panel ─────────────────────────────────────────────────────────

function buildSupplierQuestions(insights: PipelineReconInsights): string[] {
  const q: string[] = [];
  for (const c of insights.complaints.slice(0, 3))
    q.push(`Can you avoid this common complaint: "${c}"?`);
  for (const imp of insights.improvementSpecs.slice(0, 3))
    q.push(`Can you implement: "${imp}"?`);
  for (const opp of insights.opportunities.slice(0, 2))
    q.push(`Can you support: "${opp}"?`);
  return q;
}

function ReconSpecsCard({ insights }: { insights: PipelineReconInsights }) {
  const [expanded, setExpanded] = useState(false);
  const questions = buildSupplierQuestions(insights);
  if (questions.length === 0) return null;

  return (
    <AppCard style={rsc.card}>
      <TouchableOpacity style={rsc.header} onPress={() => setExpanded(e => !e)} activeOpacity={0.7}>
        <View style={rsc.iconWrap}><Text style={rsc.icon}>⬡</Text></View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={rsc.title}>Product Specs to Ask Suppliers About</Text>
          <Text style={rsc.sub}>
            {expanded ? `From Review Recon on "${insights.sourceKeyword}"` : `${questions.length} questions ready — tap to view`}
          </Text>
        </View>
        <Text style={rsc.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {!expanded && (
        <View style={rsc.row}>
          <View style={rsc.dot} />
          <Text style={rsc.question} numberOfLines={2}>{questions[0]}</Text>
        </View>
      )}

      {expanded && (
        <>
          <View style={rsc.rows}>
            {questions.map((q, i) => (
              <View key={i} style={rsc.row}>
                <View style={rsc.dot} />
                <Text style={rsc.question}>{q}</Text>
              </View>
            ))}
          </View>
          {insights.positioningAngles.length > 0 && (
            <View style={rsc.anglesWrap}>
              <Text style={rsc.anglesLabel}>BRIEF YOUR SUPPLIER WITH THESE ANGLES</Text>
              {insights.positioningAngles.slice(0, 2).map((a, i) => (
                <Text key={i} style={rsc.angle}>— {a}</Text>
              ))}
            </View>
          )}
        </>
      )}
    </AppCard>
  );
}

const rsc = StyleSheet.create({
  card:       { gap: 12, borderWidth: 1.5, borderColor: DS.indigo + '40', backgroundColor: DS.indigoLight },
  header:     { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap:   { width: 34, height: 34, borderRadius: 10, backgroundColor: DS.indigo + '18', alignItems: 'center', justifyContent: 'center' },
  icon:       { fontSize: 17, color: DS.indigo },
  title:      { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  sub:        { fontSize: 11, color: DS.textMuted },
  chevron:    { fontSize: 11, color: DS.indigo, marginTop: 2 },
  rows:       { gap: 8 },
  row:        { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot:        { width: 6, height: 6, borderRadius: 3, backgroundColor: DS.indigo, marginTop: 7, flexShrink: 0 },
  question:   { fontSize: 13, color: DS.textSecondary, lineHeight: 19, flex: 1 },
  anglesWrap: { gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: DS.indigo + '25' },
  anglesLabel:{ fontSize: 9, fontWeight: '800', color: DS.indigo, letterSpacing: 1.5 },
  angle:      { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ── Supplier risk signals ─────────────────────────────────────────────────────

interface SupplierRisk { label: string; detail: string }

function buildSupplierRiskSignals(
  q: PipelineSupplier,
  roi: number,
  hasFrt: boolean,
  confirmedFreightPerUnit: number | null,
  sellingPrice: number,
): SupplierRisk[] {
  const risks: SupplierRisk[] = [];

  if (q.moq >= 500) {
    risks.push({
      label:  'High MOQ',
      detail: `${q.moq.toLocaleString()} units minimum — launch capital requirement is elevated`,
    });
  } else if (q.moq >= 300) {
    risks.push({
      label:  'Moderate MOQ',
      detail: `${q.moq.toLocaleString()} units — verify cash flow before committing`,
    });
  }

  if (sellingPrice > 0 && roi < 20 && roi >= 0) {
    risks.push({
      label:  'Thin margin buffer',
      detail: 'Under 20% ROI — PPC spend or FBA fee changes could make this unprofitable',
    });
  }

  if (!hasFrt && sellingPrice > 0) {
    const roughFrt  = q.unitCost * 0.35;
    const worstFrt  = roughFrt * 1.18;
    const worstROI  = confirmedROIPct(sellingPrice, q.unitCost, worstFrt);
    if (worstROI < roi - 8) {
      risks.push({
        label:  'Freight sensitivity risk',
        detail: `+18% freight rise would cut ROI to ~${Math.max(0, worstROI).toFixed(0)}% — confirm with forwarder`,
      });
    }
  }

  if (q.leadTimeDays != null && q.leadTimeDays > 45) {
    risks.push({
      label:  'Long lead time',
      detail: `~${q.leadTimeDays} days — plan reorders 6+ weeks ahead to avoid stockouts`,
    });
  } else if (q.leadTimeDays != null && q.leadTimeDays > 30) {
    risks.push({
      label:  'Extended lead time',
      detail: `~${q.leadTimeDays} days — factor into inventory planning`,
    });
  }

  return risks.slice(0, 3);
}

// ── Supplier quote comparison card ────────────────────────────────────────────

const LABEL_CFG: Record<SupplierLabel, { icon: string; color: string; bg: string }> = {
  'Best Margin':    { icon: '💰', color: DS.success,   bg: DS.success  + '18' },
  'Lowest Risk':    { icon: '🛡',  color: DS.info,      bg: DS.info     + '18' },
  'Fastest Launch': { icon: '⚡', color: DS.warning,   bg: DS.warning  + '18' },
  'Budget Friendly':{ icon: '💡', color: DS.textSecondary, bg: DS.bgElevated },
};

function SupplierQuotesCard({
  quotes, sellingPrice, confirmedFreightPerUnit, onSelect, onRemove, onUpdate, selectedName,
}: {
  quotes:                  PipelineSupplier[];
  sellingPrice:            number | null;
  confirmedFreightPerUnit: number | null;
  onSelect:                (q: PipelineSupplier) => void;
  onRemove:                (name: string) => void;
  onUpdate:                (name: string, updates: Partial<PipelineSupplier>) => void;
  selectedName:            string | undefined;
}) {
  const [editingName, setEditingName] = useState<string | null>(null);
  const [draftCost,    setDraftCost]    = useState('');
  const [draftMoq,     setDraftMoq]     = useState('');
  const [draftLead,    setDraftLead]    = useState('');
  const [draftCountry, setDraftCountry] = useState('');
  const [draftNotes,   setDraftNotes]   = useState('');

  if (quotes.length === 0) return null;

  const price  = sellingPrice ?? 0;
  const hasFrt = confirmedFreightPerUnit != null && confirmedFreightPerUnit > 0;

  const labels = price > 0
    ? assignSupplierLabels(quotes, price)
    : quotes.map(() => 'Budget Friendly' as SupplierLabel);

  const landedArr = quotes.map(q =>
    hasFrt ? q.unitCost + confirmedFreightPerUnit! : roughLandedCost(q.unitCost),
  );
  const roisArr = quotes.map((q, i) =>
    price > 0 && q.unitCost > 0
      ? hasFrt
        ? confirmedROIPct(price, q.unitCost, confirmedFreightPerUnit!)
        : roughROIPct(price, q.unitCost)
      : 0,
  );
  const bestROI    = Math.max(...roisArr);
  const bestLanded = Math.min(...landedArr);

  function startEdit(q: PipelineSupplier) {
    setEditingName(q.name);
    setDraftCost(String(q.unitCost));
    setDraftMoq(String(q.moq));
    setDraftLead(q.leadTimeDays != null ? String(q.leadTimeDays) : '');
    setDraftCountry(q.country ?? '');
    setDraftNotes(q.notes ?? '');
  }

  function saveEdit(q: PipelineSupplier) {
    const updates: Partial<PipelineSupplier> = {};
    const newCost = parseFloat(draftCost);
    const newMoq  = parseInt(draftMoq, 10);
    const newLead = parseInt(draftLead, 10);
    if (!isNaN(newCost) && newCost > 0) updates.unitCost     = newCost;
    if (!isNaN(newMoq)  && newMoq  > 0) updates.moq          = newMoq;
    if (!isNaN(newLead) && newLead > 0) updates.leadTimeDays = newLead;
    if (draftCountry.trim())            updates.country       = draftCountry.trim();
    updates.notes = draftNotes.trim() || undefined;
    onUpdate(q.name, updates);
    setEditingName(null);
  }

  return (
    <AppCard style={sqc.card}>
      <View style={sqc.header}>
        <Text style={sqc.title}>Your Supplier Shortlist ({quotes.length}/5)</Text>
        <Text style={sqc.sub}>Select the supplier that fits your strategy</Text>
      </View>

      {/* Freight source indicator */}
      <View style={[sqc.freightBadge, hasFrt ? sqc.freightConfirmed : sqc.freightRough]}>
        <Text style={[sqc.freightTxt, { color: hasFrt ? DS.success : DS.warning }]}>
          {hasFrt
            ? `✓ Confirmed freight: $${confirmedFreightPerUnit!.toFixed(2)}/unit from cost model`
            : '~ Freight estimated (unit cost × 1.35) — run Freight Estimator for confirmed figures'}
        </Text>
      </View>

      {quotes.map((q, i) => {
        const isSelected = q.name === selectedName;
        const isEditing  = editingName === q.name;
        const land       = landedArr[i];
        const roi        = roisArr[i];
        const label      = labels[i];
        const lcfg       = LABEL_CFG[label];
        const roiDelta   = roi - bestROI;
        const landDelta  = land - bestLanded;
        const invest     = price > 0 ? q.unitCost * q.moq : null;

        return (
          <View key={i} style={[sqc.card2, isSelected && sqc.card2Selected]}>
            {/* Header */}
            <View style={sqc.cardHeader}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={sqc.supplierName} numberOfLines={1}>{q.name}</Text>
                <View style={sqc.platformRow}>
                  <Text style={sqc.platform}>{q.platform}</Text>
                  {q.country ? <Text style={sqc.country}>{q.country}</Text> : null}
                </View>
              </View>
              <View style={sqc.headerRight}>
                <View style={[sqc.labelBadge, { backgroundColor: lcfg.bg }]}>
                  <Text style={sqc.labelIcon}>{lcfg.icon}</Text>
                  <Text style={[sqc.labelTxt, { color: lcfg.color }]}>{label}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => isEditing ? setEditingName(null) : startEdit(q)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={sqc.editIcon}>{isEditing ? '✕' : '✎'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* View mode */}
            {!isEditing && (
              <>
                <View style={sqc.metricsRow}>
                  <View style={sqc.metric}>
                    <Text style={sqc.metricVal}>${q.unitCost.toFixed(2)}</Text>
                    <Text style={sqc.metricLbl}>Unit Cost</Text>
                  </View>
                  <View style={sqc.metric}>
                    <Text style={sqc.metricVal}>{q.moq.toLocaleString()}</Text>
                    <Text style={sqc.metricLbl}>MOQ</Text>
                  </View>
                  <View style={sqc.metric}>
                    <Text style={sqc.metricVal}>${land.toFixed(2)}</Text>
                    <Text style={sqc.metricLbl}>{hasFrt ? 'Landed ✓' : '~Landed'}</Text>
                  </View>
                  {price > 0 && (
                    <View style={sqc.metric}>
                      <Text style={[sqc.metricVal, { color: roiColor(roi) }]}>
                        ~{Math.max(0, roi).toFixed(0)}%
                      </Text>
                      <Text style={sqc.metricLbl}>{hasFrt ? 'ROI ✓' : '~ROI'}</Text>
                    </View>
                  )}
                </View>

                {(q.leadTimeDays != null || q.notes) && (
                  <View style={sqc.metaRow}>
                    {q.leadTimeDays != null && (
                      <View style={sqc.leadRow}>
                        <Text style={sqc.leadIcon}>⏱</Text>
                        <Text style={sqc.leadTxt}>~{q.leadTimeDays} days lead time</Text>
                      </View>
                    )}
                    {q.notes ? <Text style={sqc.notesTxt} numberOfLines={2}>{q.notes}</Text> : null}
                  </View>
                )}

                {/* Supplier risk signals */}
                {(() => {
                  const risks = buildSupplierRiskSignals(q, roi, hasFrt, confirmedFreightPerUnit, price);
                  if (risks.length === 0) return null;
                  return (
                    <View style={sqc.riskList}>
                      {risks.map((r, ri) => (
                        <View key={ri} style={sqc.riskRow}>
                          <Text style={sqc.riskIcon}>⚠</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={sqc.riskLabel}>{r.label}</Text>
                            <Text style={sqc.riskDetail}>{r.detail}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  );
                })()}

                {price > 0 && roiDelta < -1 && (
                  <View style={sqc.deltaRow}>
                    <Text style={sqc.deltaTxt}>
                      ▼ {Math.abs(roiDelta).toFixed(0)}% less ROI than best option
                      {landDelta > 0.01 ? ` · +$${landDelta.toFixed(2)}/unit landed vs. cheapest` : ''}
                      {invest != null ? ` · ~$${invest.toLocaleString()} inventory` : ''}
                    </Text>
                  </View>
                )}
                {price > 0 && roiDelta >= -1 && (
                  <View style={[sqc.deltaRow, { backgroundColor: DS.success + '12' }]}>
                    <Text style={[sqc.deltaTxt, { color: DS.success }]}>
                      ★ Best ROI in your comparison
                      {invest != null ? ` · ~$${invest.toLocaleString()} inventory` : ''}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Inline edit form */}
            {isEditing && (
              <View style={sqc.editForm}>
                <View style={sqc.editRow}>
                  <View style={sqc.editField}>
                    <Text style={sqc.editLabel}>Unit Cost ($)</Text>
                    <TextInput
                      style={sqc.editInput}
                      value={draftCost}
                      onChangeText={setDraftCost}
                      keyboardType="decimal-pad"
                      placeholder={String(q.unitCost)}
                      placeholderTextColor={DS.textMuted}
                    />
                  </View>
                  <View style={sqc.editField}>
                    <Text style={sqc.editLabel}>MOQ (units)</Text>
                    <TextInput
                      style={sqc.editInput}
                      value={draftMoq}
                      onChangeText={setDraftMoq}
                      keyboardType="number-pad"
                      placeholder={String(q.moq)}
                      placeholderTextColor={DS.textMuted}
                    />
                  </View>
                </View>
                <View style={sqc.editRow}>
                  <View style={sqc.editField}>
                    <Text style={sqc.editLabel}>Lead Time (days)</Text>
                    <TextInput
                      style={sqc.editInput}
                      value={draftLead}
                      onChangeText={setDraftLead}
                      keyboardType="number-pad"
                      placeholder="e.g. 30"
                      placeholderTextColor={DS.textMuted}
                    />
                  </View>
                  <View style={sqc.editField}>
                    <Text style={sqc.editLabel}>Country</Text>
                    <TextInput
                      style={sqc.editInput}
                      value={draftCountry}
                      onChangeText={setDraftCountry}
                      placeholder="e.g. 🇨🇳 China"
                      placeholderTextColor={DS.textMuted}
                    />
                  </View>
                </View>
                <View>
                  <Text style={sqc.editLabel}>Notes (optional)</Text>
                  <TextInput
                    style={[sqc.editInput, sqc.editInputNotes]}
                    value={draftNotes}
                    onChangeText={setDraftNotes}
                    placeholder="Negotiation points, quality notes…"
                    placeholderTextColor={DS.textMuted}
                    multiline
                  />
                </View>
                <TouchableOpacity style={sqc.editSaveBtn} onPress={() => saveEdit(q)} activeOpacity={0.85}>
                  <Text style={sqc.editSaveTxt}>Save Changes</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Select / remove */}
            <View style={sqc.actions}>
              {!isSelected ? (
                <TouchableOpacity style={sqc.selectBtn} onPress={() => onSelect(q)} activeOpacity={0.8}>
                  <Text style={sqc.selectTxt}>Lock In This Supplier</Text>
                </TouchableOpacity>
              ) : (
                <View style={sqc.activePill}>
                  <Text style={sqc.activeTxt}>✓ Locked In</Text>
                </View>
              )}
              <TouchableOpacity onPress={() => onRemove(q.name)} style={sqc.removeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={sqc.removeTxt}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}

      {quotes.length < 2 && (
        <Text style={sqc.hint}>Add a second supplier to unlock side-by-side comparison.</Text>
      )}

      <Text style={sqc.disclaimer}>
        {hasFrt
          ? 'ROI uses confirmed freight from cost model. FBA fees estimated by price tier — verify exact fees in Seller Central for oversize items.'
          : '~ROI and ~Landed use estimated freight (unit cost × 1.35). Confirm in Freight Estimator → Profit Lab for accurate figures. FBA fees estimated by price tier.'}
      </Text>
    </AppCard>
  );
}

const sqc = StyleSheet.create({
  card:         { gap: 12 },
  header:       { gap: 2 },
  title:        { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  sub:          { fontSize: 11, color: DS.textMuted },
  hint:         { fontSize: 11, color: DS.textMuted, textAlign: 'center', paddingVertical: 4, fontStyle: 'italic' },
  disclaimer:   { fontSize: 10, color: DS.textMuted, lineHeight: 14, fontStyle: 'italic', textAlign: 'center', paddingHorizontal: 4 },
  // Freight source badge
  freightBadge:     { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  freightConfirmed: { backgroundColor: DS.success + '12' },
  freightRough:     { backgroundColor: DS.warning + '12' },
  freightTxt:       { fontSize: 10, fontWeight: '600', lineHeight: 14 },
  // Per-supplier card
  card2:        { backgroundColor: DS.bgElevated, borderRadius: 14, padding: 12, gap: 10, borderWidth: 1, borderColor: DS.border },
  card2Selected:{ backgroundColor: DS.accent + '08', borderColor: DS.accent + '50', borderWidth: 1.5 },
  cardHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  supplierName: { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  platformRow:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  platform:     { fontSize: 10, color: DS.textMuted },
  country:      { fontSize: 10, color: DS.textMuted },
  headerRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  labelBadge:   { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  labelIcon:    { fontSize: 12 },
  labelTxt:     { fontSize: 10, fontWeight: '700' },
  editIcon:     { fontSize: 15, color: DS.textMuted, fontWeight: '700', paddingHorizontal: 4 },
  // Metrics
  metricsRow:   { flexDirection: 'row', gap: 6 },
  metric:       { flex: 1, alignItems: 'center', gap: 2, backgroundColor: DS.bgCard, borderRadius: 8, paddingVertical: 7 },
  metricVal:    { fontSize: 12, fontWeight: '800', color: DS.textPrimary },
  metricLbl:    { fontSize: 8, color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  // Meta row (lead time + notes)
  metaRow:      { gap: 4 },
  leadRow:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  leadIcon:     { fontSize: 10, color: DS.textMuted },
  leadTxt:      { fontSize: 10, color: DS.textMuted },
  notesTxt:     { fontSize: 10, color: DS.textMuted, lineHeight: 14, fontStyle: 'italic' },
  // Risk signals
  riskList:     { gap: 5 },
  riskRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: DS.warning + '10', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  riskIcon:     { fontSize: 9, color: DS.warning, marginTop: 2 },
  riskLabel:    { fontSize: 10, fontWeight: '700', color: DS.warning },
  riskDetail:   { fontSize: 9, color: DS.textSecondary, lineHeight: 13, marginTop: 1 },
  // Delta
  deltaRow:     { backgroundColor: DS.warning + '12', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  deltaTxt:     { fontSize: 10, fontWeight: '600', color: DS.warning },
  // Inline edit form
  editForm:     { gap: 10, paddingTop: 4 },
  editRow:      { flexDirection: 'row', gap: 8 },
  editField:    { flex: 1, gap: 4 },
  editLabel:    { fontSize: 9, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  editInput:    { backgroundColor: DS.bgCard, borderRadius: 8, borderWidth: 1, borderColor: DS.border, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: DS.textPrimary },
  editInputNotes:{ minHeight: 52, textAlignVertical: 'top' as const },
  editSaveBtn:  { backgroundColor: DS.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  editSaveTxt:  { fontSize: 12, fontWeight: '800', color: '#fff' },
  // Actions
  actions:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectBtn:    { flex: 1, backgroundColor: DS.accent, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  selectTxt:    { fontSize: 11, fontWeight: '800', color: '#fff' },
  activePill:   { flex: 1, backgroundColor: DS.success + '15', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: DS.success + '30' },
  activeTxt:    { fontSize: 11, fontWeight: '800', color: DS.success },
  removeBtn:    { padding: 4 },
  removeTxt:    { fontSize: 13, color: DS.textMuted, fontWeight: '700' },
});

// ── Internal segment control ──────────────────────────────────────────────────

const SEG_TABS = [
  { id: 'suppliers' as SourcingTab, icon: '⬡', label: 'Suppliers', color: DS.accent  },
  { id: 'freight'   as SourcingTab, icon: '✈', label: 'Freight',   color: DS.warning },
  { id: 'overview'  as SourcingTab, icon: '◉', label: 'Overview',  color: DS.success },
];

function SourcingSegment({ value, onChange }: { value: SourcingTab; onChange: (v: SourcingTab) => void }) {
  return (
    <View style={seg.wrap}>
      {SEG_TABS.map(t => {
        const active = value === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[seg.tab, active && { backgroundColor: t.color, borderColor: t.color }]}
            onPress={() => onChange(t.id)}
            activeOpacity={0.8}
          >
            <Text style={[seg.icon, active && seg.iconActive]}>{t.icon}</Text>
            <Text style={[seg.label, active && seg.labelActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap:       { flexDirection: 'row', gap: 8 },
  tab:        { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: DS.bgCard, borderRadius: 20, borderWidth: 1, borderColor: DS.border, paddingVertical: 9 },
  icon:       { fontSize: 13, color: DS.textSecondary },
  iconActive: { color: '#fff' },
  label:      { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  labelActive:{ color: '#fff' },
});

// ── Operational checklist ─────────────────────────────────────────────────────

interface CheckItem { label: string; done: boolean; hint?: string }

function OperationalChecklist({ items }: { items: CheckItem[] }) {
  const done  = items.filter(i => i.done).length;
  const total = items.length;
  const pct   = Math.round((done / total) * 100);
  return (
    <AppCard style={cl.card}>
      <View style={cl.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={cl.title}>Sourcing Checklist</Text>
          <Text style={cl.sub}>{done}/{total} complete · {pct}% ready to continue</Text>
        </View>
        <View style={[cl.badge, { backgroundColor: pct === 100 ? DS.success + '18' : DS.warning + '18' }]}>
          <Text style={[cl.badgeTxt, { color: pct === 100 ? DS.success : DS.warning }]}>{pct}%</Text>
        </View>
      </View>
      <View style={cl.track}><View style={[cl.fill, { width: `${pct}%` as any, backgroundColor: pct === 100 ? DS.success : DS.warning }]} /></View>
      <View style={cl.rows}>
        {items.map((item, i) => (
          <View key={i} style={cl.row}>
            <View style={[cl.check, item.done && cl.checkDone]}>
              <Text style={[cl.checkTxt, item.done && cl.checkTxtDone]}>{item.done ? '✓' : ''}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[cl.itemLabel, item.done && cl.itemDone]}>{item.label}</Text>
              {!item.done && item.hint && <Text style={cl.itemHint}>{item.hint}</Text>}
            </View>
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const cl = StyleSheet.create({
  card:        { gap: 14 },
  header:      { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title:       { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:         { fontSize: 11, color: DS.textMuted },
  badge:       { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  badgeTxt:    { fontSize: 13, fontWeight: '900', letterSpacing: -0.3 },
  track:       { height: 4, backgroundColor: DS.border, borderRadius: 2, overflow: 'hidden' },
  fill:        { height: 4, borderRadius: 2 },
  rows:        { gap: 10 },
  row:         { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  check:       { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: DS.bgSubtle, flexShrink: 0, marginTop: 1 },
  checkDone:   { backgroundColor: DS.success, borderColor: DS.success },
  checkTxt:    { fontSize: 11, fontWeight: '900', color: DS.textMuted },
  checkTxtDone:{ color: '#fff' },
  itemLabel:   { fontSize: 13, fontWeight: '600', color: DS.textPrimary },
  itemDone:    { color: DS.textMuted, textDecorationLine: 'line-through' },
  itemHint:    { fontSize: 11, color: DS.textMuted, marginTop: 2, lineHeight: 15 },
});

// ── Pipeline summary card ─────────────────────────────────────────────────────

interface FreightSummary {
  perUnit:    number;
  totalCost:  number;
  mode:       string;
  transitDays:number;
}

function PipelineSummaryCard({
  pipeline, freightSummary, onGoToFreight, onGoToCosts,
}: {
  pipeline: ReturnType<typeof usePipeline>;
  freightSummary: FreightSummary | null;
  onGoToFreight: () => void;
  onGoToCosts: () => void;
}) {
  const sup       = pipeline.selectedSupplier;
  const product   = pipeline.activeProduct?.title ?? pipeline.activeNiche?.keyword;
  const unitCost  = sup?.unitCost ?? 0;
  const moq       = sup?.moq ?? 0;
  const fPerUnit  = freightSummary?.perUnit ?? 0;
  const landed    = unitCost + fPerUnit;
  const investment= moq > 0 && landed > 0 ? moq * landed : null;

  const DataRow = ({ label, value, missing }: { label: string; value: string; missing?: boolean }) => (
    <View style={ps.dataRow}>
      <Text style={ps.dataLabel}>{label}</Text>
      <Text style={[ps.dataValue, missing && { color: DS.textMuted, fontStyle: 'italic' }]}>{value}</Text>
    </View>
  );

  return (
    <AppCard style={ps.card}>
      <View style={ps.header}>
        <Text style={ps.title}>Sourcing Summary</Text>
        <Text style={ps.sub}>Your product's sourcing cost picture</Text>
      </View>

      <View style={ps.rows}>
        <DataRow label="Product"    value={product ?? '—'}                                  missing={!product} />
        <DataRow label="Supplier"   value={sup ? sup.name.slice(0, 28) : '—'}               missing={!sup} />
        <DataRow label="Unit Cost"  value={sup ? `$${sup.unitCost.toFixed(2)}` : '—'}       missing={!sup} />
        <DataRow label="MOQ"        value={sup ? `${sup.moq.toLocaleString()} units` : '—'} missing={!sup} />
        <DataRow label="Freight/unit" value={fPerUnit > 0 ? `$${fPerUnit.toFixed(2)}` : '—'} missing={fPerUnit === 0} />
        {landed > 0 && (
          <View style={[ps.dataRow, ps.landedRow]}>
            <Text style={ps.landedLabel}>Landed Cost / Unit</Text>
            <Text style={ps.landedValue}>${landed.toFixed(2)}</Text>
          </View>
        )}
        {investment != null && (
          <View style={[ps.dataRow, ps.investRow]}>
            <Text style={ps.investLabel}>Total Investment (MOQ)</Text>
            <Text style={ps.investValue}>${investment.toLocaleString()}</Text>
          </View>
        )}
      </View>

      <View style={{ gap: 8 }}>
        {!freightSummary && (
          <TouchableOpacity style={ps.ctaBtn} onPress={onGoToFreight} activeOpacity={0.85}>
            <Text style={ps.ctaTxt}>✈  Estimate Freight Cost</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[ps.ctaBtn, ps.ctaBtnPrimary]} onPress={onGoToCosts} activeOpacity={0.85}>
          <Text style={[ps.ctaTxt, ps.ctaTxtPrimary]}>→  Calculate ROI in Profit Lab</Text>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
}

const ps = StyleSheet.create({
  card:       { gap: 14 },
  header:     { gap: 2 },
  title:      { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:        { fontSize: 11, color: DS.textMuted },
  rows:       { gap: 8 },
  dataRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dataLabel:  { fontSize: 13, color: DS.textSecondary, fontWeight: '500' },
  dataValue:  { fontSize: 13, fontWeight: '700', color: DS.textPrimary, maxWidth: '60%', textAlign: 'right' },
  landedRow:  { paddingTop: 8, borderTopWidth: 1, borderTopColor: DS.border },
  landedLabel:{ fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  landedValue:{ fontSize: 18, fontWeight: '900', color: DS.warning, letterSpacing: -0.5 },
  investRow:  { paddingTop: 4 },
  investLabel:{ fontSize: 11, color: DS.textMuted },
  investValue:{ fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  ctaBtn:     { borderRadius: DS.radiusButton, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: DS.accent + '44', backgroundColor: DS.accentLight },
  ctaBtnPrimary:{ backgroundColor: DS.accent, borderColor: DS.accent },
  ctaTxt:     { fontSize: 13, fontWeight: '800', color: DS.accent },
  ctaTxtPrimary:{ color: '#fff' },
});

// ── Sourcing Strategy Section ─────────────────────────────────────────────────

const DIFFICULTY_COLOR: Record<string, string> = {
  Beginner:     DS.success,
  Intermediate: DS.warning,
  Advanced:     DS.danger,
};

function PlatformCard({ rec, index }: { rec: SourcingStrategyResult['recommendedPlatforms'][0]; index: number }) {
  const diffColor = DIFFICULTY_COLOR[rec.difficulty] ?? DS.textMuted;
  return (
    <AppCard style={[ss.platformCard, index === 0 && ss.platformCardTop]}>
      <View style={ss.platformTop}>
        <View style={ss.platformLeft}>
          <Text style={ss.platformFlag}>{rec.platform.flag}</Text>
          <View style={{ gap: 1 }}>
            <Text style={ss.platformName}>{rec.platform.name}</Text>
            <Text style={ss.platformRegion}>{rec.platform.region}</Text>
          </View>
        </View>
        <View style={ss.platformBadges}>
          {rec.isLive ? (
            <View style={ss.liveBadge}>
              <View style={ss.liveDot} />
              <Text style={ss.liveTxt}>Live</Text>
            </View>
          ) : (
            <View style={ss.researchBadge}>
              <Text style={ss.researchTxt}>Research</Text>
            </View>
          )}
          <View style={[ss.diffBadge, { backgroundColor: diffColor + '18' }]}>
            <Text style={[ss.diffTxt, { color: diffColor }]}>{rec.difficulty}</Text>
          </View>
        </View>
      </View>
      <Text style={ss.platformWhy}>{rec.why}</Text>
      <View style={ss.platformMeta}>
        <View style={ss.metaItem}>
          <Text style={ss.metaLabel}>Margin Fit</Text>
          <Text style={[ss.metaValue, { color: rec.marginFit === 'Great' ? DS.success : rec.marginFit === 'Good' ? DS.warning : DS.textSecondary }]}>
            {rec.marginFit}
          </Text>
        </View>
        <View style={ss.metaDivider} />
        <View style={ss.metaItem}>
          <Text style={ss.metaLabel}>MOQ Risk</Text>
          <Text style={[ss.metaValue, { color: rec.platform.moqRisk === 'High' ? DS.danger : rec.platform.moqRisk === 'Medium' ? DS.warning : DS.success }]}>
            {rec.platform.moqRisk}
          </Text>
        </View>
        <View style={ss.metaDivider} />
        <View style={ss.metaItem}>
          <Text style={ss.metaLabel}>Comms</Text>
          <Text style={[ss.metaValue, { color: rec.platform.communicationDifficulty === 'Easy' ? DS.success : rec.platform.communicationDifficulty === 'Moderate' ? DS.warning : DS.danger }]}>
            {rec.platform.communicationDifficulty}
          </Text>
        </View>
      </View>
      {rec.platform.beginnerWarning && (
        <View style={ss.warningRow}>
          <Text style={ss.warningIcon}>⚠</Text>
          <Text style={ss.warningTxt}>{rec.platform.beginnerWarning}</Text>
        </View>
      )}
    </AppCard>
  );
}

function RegionRow({ region }: { region: SourcingStrategyResult['recommendedRegions'][0] }) {
  const tariffColor = region.tariffExposure === 'High' ? DS.danger : region.tariffExposure === 'Medium' ? DS.warning : DS.success;
  return (
    <View style={ss.regionRow}>
      <Text style={ss.regionFlag}>{region.flag}</Text>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={ss.regionName}>{region.name}</Text>
          {region.beginnerFriendly && (
            <View style={ss.beginnerTag}>
              <Text style={ss.beginnerTagTxt}>Beginner OK</Text>
            </View>
          )}
        </View>
        <Text style={ss.regionWhy}>{region.why}</Text>
      </View>
      <View style={ss.regionMeta}>
        <Text style={[ss.regionTariff, { color: tariffColor }]}>Tariff {region.tariffExposure}</Text>
        <Text style={ss.regionSpeed}>{region.shippingSpeed} ship</Text>
      </View>
    </View>
  );
}

async function addTaskToLaunchPlan(taskText: string, taskId: string): Promise<void> {
  try {
    const raw    = await AsyncStorage.getItem(STORAGE_KEYS.sourcingTasks);
    const tasks: { id: string; text: string }[] = raw ? JSON.parse(raw) : [];
    if (!tasks.find(t => t.id === taskId)) {
      tasks.push({ id: taskId, text: taskText });
      await AsyncStorage.setItem(STORAGE_KEYS.sourcingTasks, JSON.stringify(tasks));
    }
  } catch {}
}

function SourcingStrategySection({
  strategy,
  onSearchPress,
}: {
  strategy: SourcingStrategyResult;
  onSearchPress?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [taskAdded, setTaskAdded] = useState<string | null>(null);
  const diffColor = DIFFICULTY_COLOR[strategy.sourcingDifficulty] ?? DS.textMuted;

  async function handleAddToLaunchPlan(taskText: string, taskId: string) {
    await addTaskToLaunchPlan(taskText, taskId);
    setTaskAdded(taskId);
    setTimeout(() => setTaskAdded(null), 2500);
  }

  return (
    <View style={ss.wrapper}>
      <TouchableOpacity style={ss.headerRow} onPress={() => setExpanded(e => !e)} activeOpacity={0.8}>
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={ss.sectionTitle}>Sourcing Plan</Text>
            <View style={[ss.diffPill, { backgroundColor: diffColor + '18' }]}>
              <Text style={[ss.diffPillTxt, { color: diffColor }]}>{strategy.sourcingDifficulty}</Text>
            </View>
          </View>
          <Text style={ss.sectionSub}>{strategy.sourcingSummary}</Text>
        </View>
        <Text style={ss.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={ss.expandedContent}>
          <View style={ss.subSection}>
            <Text style={ss.subTitle}>Recommended Platforms</Text>
            <Text style={ss.subHint}>Based on your product type and freight profile</Text>
          </View>
          {strategy.recommendedPlatforms.map((rec, i) => (
            <View key={rec.platform.id}>
              <PlatformCard rec={rec} index={i} />
              {i === 0 && rec.platform.liveIntegration && onSearchPress && (
                <TouchableOpacity style={ss.ctaBtn} onPress={onSearchPress} activeOpacity={0.85}>
                  <Text style={ss.ctaBtnTxt}>Search {rec.platform.name} Suppliers Now →</Text>
                </TouchableOpacity>
              )}
              {i === 0 && !rec.platform.liveIntegration && (
                <TouchableOpacity
                  style={[ss.ctaBtn, ss.ctaBtnSecondary]}
                  onPress={() => handleAddToLaunchPlan(
                    `Research ${rec.platform.name} suppliers — ${rec.why.split('.')[0]}`,
                    `src_platform_${rec.platform.id}`,
                  )}
                  activeOpacity={0.85}
                >
                  <Text style={ss.ctaBtnSecondaryTxt}>
                    {taskAdded === `src_platform_${rec.platform.id}`
                      ? '✓ Added to Launch Plan'
                      : `Add "${rec.platform.name} research" to Launch Plan`}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          <View style={ss.subSection}>
            <Text style={ss.subTitle}>Recommended Regions</Text>
          </View>
          <AppCard style={ss.regionsCard}>
            {strategy.recommendedRegions.map((r, i) => (
              <View key={r.id}>
                <RegionRow region={r} />
                {i < strategy.recommendedRegions.length - 1 && <View style={ss.regionDivider} />}
              </View>
            ))}
          </AppCard>

          {strategy.beginnerNotes.length > 0 && (
            <AppCard style={ss.notesCard}>
              <Text style={ss.notesTitle}>Getting Started</Text>
              {strategy.beginnerNotes.map((n, i) => (
                <View key={i} style={ss.noteRow}>
                  <Text style={ss.noteIcon}>→</Text>
                  <Text style={ss.noteTxt}>{n}</Text>
                </View>
              ))}
            </AppCard>
          )}
        </View>
      )}
    </View>
  );
}

const ss = StyleSheet.create({
  wrapper:        { borderRadius: DS.radiusCard, overflow: 'hidden', borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgCard },
  headerRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: DS.cardPadding },
  sectionTitle:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sectionSub:     { fontSize: 11, color: DS.textMuted, lineHeight: 15 },
  chevron:        { fontSize: 11, color: DS.textMuted, marginTop: 4 },
  diffPill:       { paddingHorizontal: 7, paddingVertical: 2, borderRadius: DS.radiusBadge },
  diffPillTxt:    { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  expandedContent:{ paddingHorizontal: DS.cardPadding, paddingBottom: DS.cardPadding, gap: DS.cardGap },
  // Platform cards
  platformCard:   { gap: 10, borderWidth: 1, borderColor: DS.border },
  platformCardTop:{ borderWidth: 1.5, borderColor: DS.accent + '50', backgroundColor: DS.accentLight },
  platformTop:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  platformLeft:   { flexDirection: 'row', alignItems: 'center', gap: 9 },
  platformFlag:   { fontSize: 22 },
  platformName:   { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  platformRegion: { fontSize: 10, color: DS.textMuted },
  platformBadges: { flexDirection: 'row', gap: 5, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' },
  liveBadge:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: DS.success + '18', paddingHorizontal: 7, paddingVertical: 3, borderRadius: DS.radiusBadge },
  liveDot:        { width: 5, height: 5, borderRadius: 3, backgroundColor: DS.success },
  liveTxt:        { fontSize: 9, fontWeight: '800', color: DS.success },
  researchBadge:  { backgroundColor: DS.bgElevated, paddingHorizontal: 7, paddingVertical: 3, borderRadius: DS.radiusBadge, borderWidth: 1, borderColor: DS.border },
  researchTxt:    { fontSize: 9, fontWeight: '700', color: DS.textMuted },
  diffBadge:      { paddingHorizontal: 7, paddingVertical: 3, borderRadius: DS.radiusBadge },
  diffTxt:        { fontSize: 9, fontWeight: '800' },
  platformWhy:    { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  platformMeta:   { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: DS.radiusChip, padding: 8 },
  metaItem:       { flex: 1, alignItems: 'center', gap: 2 },
  metaLabel:      { fontSize: 9, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue:      { fontSize: 12, fontWeight: '800' },
  metaDivider:    { width: 1, backgroundColor: DS.border, marginVertical: 2 },
  warningRow:     { flexDirection: 'row', gap: 6, backgroundColor: DS.warning + '10', borderRadius: DS.radiusChip, padding: 8 },
  warningIcon:    { fontSize: 10, color: DS.warning },
  warningTxt:     { flex: 1, fontSize: 11, color: DS.textSecondary, lineHeight: 15 },
  // Sub-section headers
  subSection:     { gap: 2, paddingTop: 4 },
  subTitle:       { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  subHint:        { fontSize: 10, color: DS.textMuted },
  // Regions
  regionsCard:    { gap: 12 },
  regionRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  regionFlag:     { fontSize: 20, marginTop: 1 },
  regionName:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  regionWhy:      { fontSize: 11, color: DS.textSecondary, lineHeight: 15 },
  regionMeta:     { gap: 2, alignItems: 'flex-end' },
  regionTariff:   { fontSize: 10, fontWeight: '700' },
  regionSpeed:    { fontSize: 10, color: DS.textMuted },
  regionDivider:  { height: 1, backgroundColor: DS.border },
  beginnerTag:    { backgroundColor: DS.success + '18', paddingHorizontal: 6, paddingVertical: 1, borderRadius: DS.radiusBadge },
  beginnerTagTxt: { fontSize: 9, fontWeight: '700', color: DS.success },
  // Notes
  notesCard:           { gap: 8, borderWidth: 1.5, borderColor: DS.success + '40', backgroundColor: DS.success + '06' },
  notesTitle:          { fontSize: 12, fontWeight: '800', color: DS.success, letterSpacing: 0.5, textTransform: 'uppercase' },
  noteRow:             { flexDirection: 'row', gap: 7, alignItems: 'flex-start' },
  noteIcon:            { fontSize: 12, color: DS.success, marginTop: 1 },
  noteTxt:             { flex: 1, fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  // CTAs
  ctaBtn:              { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  ctaBtnTxt:           { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  ctaBtnSecondary:     { backgroundColor: DS.bgCard, borderWidth: 1.5, borderColor: DS.accent + '50' },
  ctaBtnSecondaryTxt:  { fontSize: 13, fontWeight: '700', color: DS.accent },
});


// ── Main screen ───────────────────────────────────────────────────────────────

export default function SourcingLogisticsScreen() {
  const { isOnline }    = useNetworkStatus();
  const { marketplace } = useCurrency();
  const pipeline        = usePipeline();
  const { profile }     = useSellerProfile();
  const isBeginnerSeller = !profile || profile.experience === 'beginner';
  const navigation      = useNavigation<any>();
  const prefilled       = useRef(false);
  const isMountedRef    = useRef(true);
  const { toastMsg, toastVisible, toastType, showToast, hideToast } = useToast();
  const { can, increment } = useSubscription();
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Internal tab ──────────────────────────────────────────────────────────
  const [tab, setTab] = useState<SourcingTab>('suppliers');

  // ── Supplier state ────────────────────────────────────────────────────────
  const [product,     setProduct]     = useState('');
  const [maxPrice,    setMaxPrice]    = useState('');
  const [maxMoq,      setMaxMoq]      = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState('');
  const [suppliers,   setSuppliers]   = useState<ScoredDisplay[]>([]);
  const [summary,     setSummary]     = useState<SmartSearchSummary | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [compareIds,   setCompareIds]   = useState<Set<string>>(new Set());
  const [showCompare,  setShowCompare]  = useState(false);
  const [analyzeModal,    setAnalyzeModal]    = useState(false);
  const [analyzeLoading,  setAnalyzeLoading]  = useState(false);
  const [analyzeResult,   setAnalyzeResult]   = useState<AnalyzeSupplierResult | null>(null);
  const [analyzeError,    setAnalyzeError]    = useState('');
  const [analyzeTargetId, setAnalyzeTargetId] = useState<string | null>(null);
  const [outreachEmail,     setOutreachEmail]     = useState<OutreachEmail | null>(null);
  const [outreachLoadingId, setOutreachLoadingId] = useState<string | null>(null);
  const [outreachError,     setOutreachError]     = useState('');

  // ── Freight state ─────────────────────────────────────────────────────────
  const [freightProduct,  setFreightProduct]  = useState('');
  const [freightUnits,    setFreightUnits]    = useState('200');
  const [freightWeightKg, setFreightWeightKg] = useState('0.5');
  const [freightLengthCm, setFreightLengthCm] = useState('20');
  const [freightWidthCm,  setFreightWidthCm]  = useState('15');
  const [freightHeightCm, setFreightHeightCm] = useState('10');
  const [freightLoading,  setFreightLoading]  = useState(false);
  const [freightError,    setFreightError]    = useState('');
  const [freightResult,   setFreightResult]   = useState<{
    product:        string;
    marketplace:    string;
    units:          number;
    total_weight_kg:number;
    total_cbm:      number;
    recommended:    string;
    fba_inbound_est:number;
    prep_cost:      number;
    modes: {
      air?:      { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string } | null;
      sea_lcl?:  { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string } | null;
      sea_fcl?:  { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string } | null;
      express?:  { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string } | null;
    };
  } | null>(null);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.recentSupplierSearches)
      .then(raw => { if (raw) try { setRecentSearches(JSON.parse(raw)); } catch {} })
      .catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    if (prefilled.current) return;
    const q = pipeline.activeProduct?.title ?? pipeline.activeNiche?.keyword;
    if (q) {
      if (!product) setProduct(q);
      if (!freightProduct) setFreightProduct(q);
      prefilled.current = true;
    }
  }, [pipeline.activeProduct, pipeline.activeNiche, product, freightProduct]));

  // ── Supplier handlers ─────────────────────────────────────────────────────

  async function runSupplierSearch(query: string) {
    setLoading(true); setError(''); setSuppliers([]); setSelectedId(null);
    setCompareIds(new Set()); setSummary(null); setOutreachEmail(null);
    try {
      const result = await api.searchSuppliersV2({
        product: query, marketplace,
        max_unit_price: maxPrice ? parseFloat(maxPrice) : undefined,
        max_moq:        maxMoq   ? parseInt(maxMoq)    : undefined,
      });
      if (!isMountedRef.current) return;
      const allRaw: Supplier[] = result.suppliers ?? [];
      if (allRaw.length === 0) throw new Error('No suppliers found. Try a different product name.');
      const { results: deduped, removed } = deduplicateSuppliers(allRaw);
      const scored = deduped
        .map((s, i) => {
          const sc = scoreSupplier(s, query); const disp = supplierToDisplay(s, i);
          return { ...disp, relevanceScore: sc.relevanceScore, opportunityScore: sc.opportunityScore, finalScore: sc.finalScore, badges: sc.badges, matchReason: sc.matchReason, _fs: sc.finalScore };
        })
        .sort((a, b) => (b._fs ?? 0) - (a._fs ?? 0)).slice(0, 15);
      const apiSuppliers: ScoredDisplay[] = scored.map(({ _fs: _, ...rest }) => rest);
      const finalSuppliers = [...apiSuppliers, ...buildPlatformSuppliers(query)];
      setSuppliers(finalSuppliers);
      setSummary({ originalQuery: query, expandedKeywords: [query], totalScanned: allRaw.length, duplicatesRemoved: removed, finalCount: finalSuppliers.length, topCategory: detectSupplierType(allRaw) });
    } catch (e: any) {
      if (isMountedRef.current) setError(e?.message ?? 'Search failed. Please try again.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }

  async function handleSearch() {
    const p = product.trim();
    if (!p) { Alert.alert('Enter a product to source'); return; }
    if (!can('suppliers')) { setShowPaywall(true); return; }
    await increment('suppliers');
    setRecentSearches(prev => {
      const next = [p, ...prev.filter(x => x !== p)].slice(0, 5);
      AsyncStorage.setItem(STORAGE_KEYS.recentSupplierSearches, JSON.stringify(next)).catch(() => {});
      return next;
    });
    await runSupplierSearch(p);
  }

  async function selectRecentSearch(q: string) {
    if (!can('suppliers')) { setShowPaywall(true); return; }
    await increment('suppliers');
    setProduct(q);
    await runSupplierSearch(q);
  }

  async function handleAnalyzeSupplier(item: ScoredDisplay) {
    setAnalyzeResult(null); setAnalyzeError(''); setAnalyzeTargetId(item.id);
    setAnalyzeModal(true); setAnalyzeLoading(true);
    try {
      const res = await api.scoreSupplier({ supplier_name: item.name, price_per_unit: item.priceUSD ?? 0, moq: item.moqNum, product_name: product.trim() || undefined });
      if (!isMountedRef.current) return;
      setAnalyzeResult({ total_score: res.total_score, grade: res.grade, confidence_label: res.confidence_label, strengths: res.strengths, risk_flags: res.risk_flags, recommendation: res.recommendation, negotiation_strategy: res.negotiation_strategy });
      setSuppliers(prev => prev.map(s => s.id === item.id ? { ...s, grade: res.grade, trust: res.total_score / 10, finalScore: res.total_score } : s));
    } catch (err: any) {
      if (isMountedRef.current) setAnalyzeError(err?.message ?? 'Analysis failed.');
    } finally { if (isMountedRef.current) setAnalyzeLoading(false); }
  }

  async function handleGenerateOutreach(item: ScoredDisplay) {
    setOutreachLoadingId(item.id); setOutreachError(''); setOutreachEmail(null);
    try {
      const result = await api.getSupplierEmail(product.trim() || item.name, 'Your Brand');
      if (!isMountedRef.current) return;
      setOutreachEmail({ ...result, supplierUrl: item.url, supplierName: item.name });
    } catch (err: any) { if (isMountedRef.current) setOutreachError(err?.message ?? 'Failed to generate email.'); }
    finally { if (isMountedRef.current) setOutreachLoadingId(null); }
  }

  function handleSelectSupplier(item: ScoredDisplay) {
    const alreadySelected = selectedId === item.id;
    if (alreadySelected) { setSelectedId(null); pipeline.setSelectedSupplier(null); return; }
    if (!item.priceUSD || item.priceUSD <= 0) {
      Alert.alert(
        'Quote Required',
        'This is a research-only platform directory. Visit the platform to get a real price and MOQ quote, then add a supplier manually.',
      );
      return;
    }
    setSelectedId(item.id);
    const quote: PipelineSupplier = {
      name:     item.name,
      platform: item.platform,
      unitCost: item.priceUSD,
      moq:      item.moqNum,
      url:      item.url,
      score:    item.finalScore ?? undefined,
      grade:    item.grade,
      country:  item.country,
    };
    pipeline.setSelectedSupplier(quote);
    pipeline.addSupplierQuote(quote);
    pipeline.trackPipelineEvent('supplier_selected', { name: item.name, grade: item.grade });
    showToast(`${item.name} locked in as supplier`);
  }

  function handleSelectQuote(q: PipelineSupplier) {
    pipeline.setSelectedSupplier(q);
    pipeline.setActiveSupplierId(q.name);
    pipeline.trackPipelineEvent('supplier_quote_selected', { name: q.name });
  }

  function toggleCompare(id: string) {
    setCompareIds(prev => { const next = new Set(prev); if (next.has(id)) { next.delete(id); } else if (next.size < 3) { next.add(id); } return next; });
  }

  // ── Freight handler ───────────────────────────────────────────────────────

  async function handleFreightSearch() {
    const name = freightProduct.trim();
    if (!name) return;
    setFreightLoading(true); setFreightError(''); setFreightResult(null);
    try {
      const result = await api.estimateFreight({
        product_name:       name,
        marketplace,
        units:              parseInt(freightUnits, 10)   || 200,
        weight_kg_per_unit: parseFloat(freightWeightKg) || 0.5,
        length_cm:          parseFloat(freightLengthCm) || 20,
        width_cm:           parseFloat(freightWidthCm)  || 15,
        height_cm:          parseFloat(freightHeightCm) || 10,
      });
      if (!isMountedRef.current) return;
      setFreightResult(result);
    } catch (err: any) {
      if (isMountedRef.current) setFreightError(err?.message ?? 'Freight estimate failed.');
    } finally { if (isMountedRef.current) setFreightLoading(false); }
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const compareItems = useMemo(() => suppliers.filter(s => compareIds.has(s.id)), [suppliers, compareIds]);

  const confirmedFreightPerUnit: number | null = useMemo(() =>
    pipeline.costModel?.freight != null && pipeline.costModel.freight > 0
      ? pipeline.costModel.freight
      : null,
  [pipeline.costModel]);

  const sourcingStrategy: SourcingStrategyResult = useMemo(() =>
    computeSourcingStrategy({
      product:                 pipeline.activeProduct,
      selectedSupplier:        pipeline.selectedSupplier,
      supplierQuotes:          pipeline.supplierQuotes,
      confirmedFreightPerUnit,
      weightKgEstimate:        parseFloat(freightWeightKg) || undefined,
      marketplace,
      isBeginnerSeller,
    }),
  [pipeline.activeProduct, pipeline.selectedSupplier, pipeline.supplierQuotes, confirmedFreightPerUnit, freightWeightKg, marketplace, isBeginnerSeller]);

  const lastSourcingKey = useRef('');
  useEffect(() => {
    const key = [
      sourcingStrategy.freightSensitivity,
      sourcingStrategy.freightStrategy,
      sourcingStrategy.sourcingDifficulty,
      sourcingStrategy.riskWarnings.join(','),
      sourcingStrategy.recommendedPlatforms.map(p => p.platform.id).join(','),
      pipeline.selectedSupplier?.platform ?? '',
    ].join('|');
    if (key === lastSourcingKey.current) return;
    lastSourcingKey.current = key;
    pipeline.setSourcingStrategy({
      recommendedPlatforms: sourcingStrategy.recommendedPlatforms.map(p => p.platform.id),
      recommendedRegions:   sourcingStrategy.recommendedRegions.map(r => r.id),
      freightSensitivity:   sourcingStrategy.freightSensitivity,
      freightStrategy:      sourcingStrategy.freightStrategy,
      sourcingDifficulty:   sourcingStrategy.sourcingDifficulty,
      sourcingWarnings:     sourcingStrategy.riskWarnings,
      selectedPlatform:     pipeline.selectedSupplier?.platform ?? null,
      updatedAt:            new Date().toISOString(),
    });
  }, [sourcingStrategy, pipeline.selectedSupplier?.platform]);

  const intelProfile = useProductIntelligence(confirmedFreightPerUnit);
  const decisionSim  = useDecisionSimulation(intelProfile, confirmedFreightPerUnit);

  const freightSummary: FreightSummary | null = useMemo(() => {
    if (!freightResult) return null;
    const modes = [freightResult.modes.sea_lcl, freightResult.modes.sea_fcl, freightResult.modes.air, freightResult.modes.express].filter(Boolean);
    const recommended = modes.find(m => m?.mode.toLowerCase().includes(freightResult.recommended.replace('_', ' ')));
    const best = recommended ?? modes[0];
    if (!best) return null;
    return { perUnit: best.cost_per_unit, totalCost: best.total_cost, mode: best.mode, transitDays: best.transit_days };
  }, [freightResult]);

  const checklistItems: CheckItem[] = [
    {
      label: 'Supplier selected',
      done:  !!pipeline.selectedSupplier,
      hint:  'Search for suppliers above and tap "Lock in This Supplier"',
    },
    {
      label: 'MOQ confirmed',
      done:  (pipeline.selectedSupplier?.moq ?? 0) > 0,
      hint:  'MOQ is shown on each supplier card',
    },
    {
      label: 'Freight estimated',
      done:  !!freightResult,
      hint:  'Switch to the Freight tab to estimate shipping cost',
    },
    {
      label: 'Recon insights available',
      done:  !!pipeline.reconInsights,
      hint:  'Run Review Recon in the Research tab first',
    },
    {
      label: 'Cost model saved',
      done:  !!pipeline.costModel,
      hint:  'Tap "Calculate ROI" below to build your profit model',
    },
  ];

  // ── Section renderers ─────────────────────────────────────────────────────

  function renderSuppliersSection() {
    return (
      <View style={{ gap: DS.sectionGap }}>
        {!pipeline.activeProduct && (
          <TouchableOpacity
            style={es.banner}
            onPress={() => navigation.navigate('Main', { screen: 'Research' })}
            activeOpacity={0.85}
          >
            <Text style={es.bannerIcon}>📦</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={es.bannerTitle}>No product selected yet</Text>
              <Text style={es.bannerSub}>Go to the Research tab to select a product and unlock full sourcing context.</Text>
            </View>
            <Text style={es.bannerChevron}>›</Text>
          </TouchableOpacity>
        )}
        <AppCard style={sc.searchCard}>
          <View style={sc.searchRow}>
            <InputField
              value={product}
              onChangeText={setProduct}
              placeholder={pipeline.activeProduct ? `Suppliers for: ${pipeline.activeProduct.title.slice(0, 30)}…` : 'e.g. bamboo cutting board…'}
              leadingIcon="⬡"
              containerStyle={sc.searchInput}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={sc.filterToggle} onPress={() => setShowFilters(f => !f)} activeOpacity={0.7}>
            <Text style={sc.filterToggleTxt}>{showFilters ? '▲ Hide filters' : '▼ Filters (price / MOQ)'}</Text>
          </TouchableOpacity>
          {showFilters && (
            <View style={sc.filterRow}>
              <View style={sc.filterField}>
                <InputField label="Max unit price $" value={maxPrice} onChangeText={setMaxPrice} placeholder="e.g. 8" keyboardType="decimal-pad" containerStyle={{ flex: undefined }} />
              </View>
              <View style={sc.filterField}>
                <InputField label="Max MOQ (units)" value={maxMoq} onChangeText={setMaxMoq} placeholder="e.g. 500" keyboardType="number-pad" containerStyle={{ flex: undefined }} />
              </View>
            </View>
          )}
          {product.trim().length > 0 && (
            <PrimaryButton label={!isOnline ? 'Offline' : loading ? 'Searching…' : 'Find Suppliers'} onPress={handleSearch} loading={loading} icon="⬡" size="sm" style={sc.searchBtn} disabled={!isOnline} />
          )}
        </AppCard>

        <RecentSearches items={recentSearches} accentColor={DS.accent} onSelect={selectRecentSearch} onClear={() => { setRecentSearches([]); AsyncStorage.removeItem(STORAGE_KEYS.recentSupplierSearches).catch(() => {}); }} />

        {pipeline.reconInsights && <ReconSpecsCard insights={pipeline.reconInsights} />}

        <SourcingStrategySection
          strategy={sourcingStrategy}
          onSearchPress={() => {
            if (pipeline.activeProduct?.title && !product) {
              setProduct(pipeline.activeProduct.title);
            }
          }}
        />

        {loading && <View style={sc.loadingWrap}><ActivityIndicator color={DS.accent} size="large" /><Text style={sc.loadingTxt}>Finding suppliers…</Text></View>}

        {!!error && (
          <AppCard padding={14} style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ color: DS.danger, fontSize: 13, textAlign: 'center' }}>{error}</Text>
            <TouchableOpacity style={sc.retryBtn} onPress={handleSearch} activeOpacity={0.8} disabled={!isOnline}>
              <Text style={sc.retryBtnTxt}>{!isOnline ? 'Offline' : 'Retry'}</Text>
            </TouchableOpacity>
          </AppCard>
        )}

        {!loading && suppliers.length > 0 && (
          <>
            {summary && <SmartSummaryCard summary={summary} />}
            <View style={sc.resultsHeader}>
              <Text style={sc.resultsCount}>{suppliers.length} suppliers · ranked by score</Text>
              <Text style={sc.resultsSub}>Analyze · Compare · Email · Lock In</Text>
            </View>
            {!pipeline.selectedSupplier && (
              <View style={sc.coachBanner}>
                <Text style={sc.coachIcon}>💡</Text>
                <Text style={sc.coachTxt}>
                  Most beginners prefer MOQ under 300 units to reduce launch capital risk. Always request samples before committing to bulk.
                </Text>
              </View>
            )}
            {suppliers.map(sup => (
              <SupplierCard key={sup.id} item={sup} grade={sup.grade} inCompare={compareIds.has(sup.id)} analyzeLoading={analyzeLoading && analyzeTargetId === sup.id} outreachLoading={outreachLoadingId === sup.id} onView={() => openURL(resolveSupplierUrl(sup.platform, sup.url, product))} onAnalyze={() => handleAnalyzeSupplier(sup)} onToggleCompare={() => toggleCompare(sup.id)} onOutreach={() => handleGenerateOutreach(sup)} onSelect={() => handleSelectSupplier(sup)} isSelected={selectedId === sup.id} />
            ))}
          </>
        )}

        {!!outreachError && (
          <AppCard padding={14} style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ color: DS.danger, fontSize: 13, textAlign: 'center' }}>{outreachError}</Text>
            <TouchableOpacity style={sc.retryBtn} onPress={() => { if (suppliers.length > 0) handleGenerateOutreach(suppliers[0]); }} activeOpacity={0.8} disabled={!isOnline}>
              <Text style={sc.retryBtnTxt}>{!isOnline ? 'Offline' : 'Retry Outreach'}</Text>
            </TouchableOpacity>
          </AppCard>
        )}
        {outreachEmail && <OutreachEmailCard email={outreachEmail} />}

        {!!pipeline.selectedSupplier && (
          <View style={sc.handoffCard}>
            <View style={sc.handoffTop}>
              <Text style={sc.handoffIcon}>✓</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={sc.handoffTitle}>Supplier locked in</Text>
                <Text style={sc.handoffSub}>{pipeline.selectedSupplier.name} · ~${pipeline.selectedSupplier.unitCost}/unit · MOQ {pipeline.selectedSupplier.moq}</Text>
              </View>
            </View>
            <View style={{ gap: 8 }}>
              {/* Financial preview from supplier data */}
              {pipeline.activeProduct?.price && pipeline.activeProduct.price > 0 && pipeline.selectedSupplier && (() => {
                const price = pipeline.activeProduct!.price;
                const unit  = pipeline.selectedSupplier.unitCost;
                const roi   = roughROIPct(price, unit);
                return (
                  <View style={sc.supplierFinRow}>
                    <View style={sc.supplierFinBlock}>
                      <Text style={sc.supplierFinLbl}>Unit Cost</Text>
                      <Text style={sc.supplierFinVal}>${unit.toFixed(2)}</Text>
                    </View>
                    <View style={sc.supplierFinBlock}>
                      <Text style={sc.supplierFinLbl}>Rough ROI</Text>
                      <Text style={[sc.supplierFinVal, { color: roiColor(roi) }]}>
                        ~{roi.toFixed(0)}%
                      </Text>
                    </View>
                    <View style={sc.supplierFinBlock}>
                      <Text style={sc.supplierFinLbl}>MOQ Investment</Text>
                      <Text style={sc.supplierFinVal}>${(unit * pipeline.selectedSupplier.moq).toLocaleString()}</Text>
                    </View>
                  </View>
                );
              })()}
              <TouchableOpacity style={sc.handoffBtnPrimary} onPress={() => setTab('freight')} activeOpacity={0.85}>
                <Text style={sc.handoffBtnPrimaryTxt}>✈  Estimate Freight & Landed Cost →</Text>
              </TouchableOpacity>
              <TouchableOpacity style={sc.handoffBtnSecondary} onPress={() => { pipeline.trackPipelineEvent('sourcing_handoff_profit', { name: pipeline.selectedSupplier?.name }); navigation.navigate('Profit'); }} activeOpacity={0.88}>
                <Text style={sc.handoffBtnSecondaryTxt}>Open Profit Lab</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Saved quotes comparison */}
        {pipeline.supplierQuotes.length > 0 && (
          <SupplierQuotesCard
            quotes={pipeline.supplierQuotes}
            sellingPrice={pipeline.activeProduct?.price ?? null}
            confirmedFreightPerUnit={
              pipeline.costModel?.freight != null && pipeline.costModel.freight > 0
                ? pipeline.costModel.freight
                : null
            }
            onSelect={handleSelectQuote}
            onRemove={name => pipeline.removeSupplierQuote(name)}
            onUpdate={(name, updates) => pipeline.updateSupplierQuote(name, updates)}
            selectedName={pipeline.activeSupplierId ?? pipeline.selectedSupplier?.name}
          />
        )}

        {!loading && suppliers.length === 0 && !error && (
          <View style={sc.emptyWrap}>
            <Text style={sc.emptyIcon}>⬡</Text>
            <Text style={sc.emptyTitle}>Find Your Supplier</Text>
            <Text style={sc.emptySub}>Search verified manufacturers above. We'll rank by score, let you compare, and save to your pipeline.</Text>
          </View>
        )}
      </View>
    );
  }

  function renderFreightSection() {
    const modes = freightResult
      ? [freightResult.modes.air, freightResult.modes.sea_lcl, freightResult.modes.sea_fcl, freightResult.modes.express].filter(Boolean)
      : [];

    return (
      <View style={{ gap: 16 }}>
        <Text style={fr.noSupplierSub}>
          Estimate your shipping cost per unit. To compare freight forwarders and request quotes, use Freight Forwarders in Profit.
        </Text>

        {pipeline.selectedSupplier ? (
          <View style={fr.supplierContext}>
            <Text style={fr.supplierContextLabel}>SHIPPING FOR LOCKED SUPPLIER</Text>
            <Text style={fr.supplierContextName}>{pipeline.selectedSupplier.name}</Text>
            <Text style={fr.supplierContextSub}>Unit cost ${pipeline.selectedSupplier.unitCost.toFixed(2)} · MOQ {pipeline.selectedSupplier.moq}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={fr.noSupplierBanner}
            onPress={() => setTab('suppliers')}
            activeOpacity={0.85}
          >
            <Text style={fr.noSupplierIcon}>⬡</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={fr.noSupplierTitle}>No supplier selected yet</Text>
              <Text style={fr.noSupplierSub}>
                Landed cost calculation is more accurate once you lock in a supplier. Tap to go back and select one — or estimate freight below without one.
              </Text>
            </View>
            <Text style={fr.noSupplierChevron}>›</Text>
          </TouchableOpacity>
        )}

        <AppCard padding={16} style={{ gap: 14 }}>
          <Text style={fr.sectionTitle}>📦 PRODUCT DETAILS</Text>
          <InputField label="Product name" value={freightProduct} onChangeText={setFreightProduct} placeholder="e.g. portable blender" containerStyle={{ flex: undefined }} />
          <View style={fr.row}>
            <View style={fr.halfField}><InputField label="Units to ship" value={freightUnits} onChangeText={setFreightUnits} placeholder="200" keyboardType="numeric" containerStyle={{ flex: undefined }} /></View>
            <View style={fr.halfField}><InputField label="Weight/unit (kg)" value={freightWeightKg} onChangeText={setFreightWeightKg} placeholder="0.5" keyboardType="numeric" containerStyle={{ flex: undefined }} /></View>
          </View>
          <Text style={fr.sectionTitle}>📐 DIMENSIONS PER UNIT (CM)</Text>
          <View style={fr.row}>
            <View style={fr.thirdField}><InputField label="Length" value={freightLengthCm} onChangeText={setFreightLengthCm} placeholder="20" keyboardType="numeric" containerStyle={{ flex: undefined }} /></View>
            <View style={fr.thirdField}><InputField label="Width" value={freightWidthCm} onChangeText={setFreightWidthCm} placeholder="15" keyboardType="numeric" containerStyle={{ flex: undefined }} /></View>
            <View style={fr.thirdField}><InputField label="Height" value={freightHeightCm} onChangeText={setFreightHeightCm} placeholder="10" keyboardType="numeric" containerStyle={{ flex: undefined }} /></View>
          </View>
          <PrimaryButton label={freightLoading ? 'Calculating...' : 'Estimate Freight →'} onPress={handleFreightSearch} loading={freightLoading} disabled={!freightProduct.trim() || freightLoading} icon="✈" style={{ backgroundColor: DS.warning, shadowColor: DS.warning }} />
        </AppCard>

        {!!freightError && (
          <AppCard padding={14} style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ color: DS.danger, fontSize: 13, textAlign: 'center' }}>{freightError}</Text>
            <TouchableOpacity style={sc.retryBtn} onPress={handleFreightSearch} activeOpacity={0.8} disabled={!isOnline}>
              <Text style={sc.retryBtnTxt}>{!isOnline ? 'Offline' : 'Retry'}</Text>
            </TouchableOpacity>
          </AppCard>
        )}

        {freightResult && (
          <View style={{ gap: 12 }}>
            <View style={fr.summaryCard}>
              <Text style={fr.summaryLabel}>SHIPMENT SUMMARY</Text>
              <Text style={fr.summaryTitle}>{freightResult.product}</Text>
              <Text style={fr.summarySub}>{freightResult.units.toLocaleString()} units · {freightResult.total_weight_kg} kg · {freightResult.total_cbm} CBM</Text>
            </View>

            {modes.map(m => {
              if (!m) return null;
              const isRec = m.mode.toLowerCase().includes(freightResult.recommended.replace('_', ' '));
              return (
                <AppCard key={m.mode} padding={16} style={[fr.modeCard, isRec && fr.modeCardRec]}>
                  {isRec && <View style={fr.recBadge}><Text style={fr.recBadgeTxt}>★ RECOMMENDED</Text></View>}
                  <View style={fr.modeHeader}>
                    <Text style={[fr.modeName, isRec && fr.modeNameRec]}>{m.mode}</Text>
                    <Text style={fr.modeTransit}>{m.transit_days} days</Text>
                  </View>
                  <View style={fr.modePriceRow}>
                    <View style={fr.modePriceBlock}>
                      <Text style={fr.modePriceLabel}>TOTAL COST</Text>
                      <Text style={[fr.modePrice, isRec && { color: DS.warning }]}>${m.total_cost.toLocaleString()}</Text>
                    </View>
                    <View style={fr.modePriceBlock}>
                      <Text style={fr.modePriceLabel}>PER UNIT</Text>
                      <Text style={[fr.modePrice, isRec && { color: DS.warning }]}>${m.cost_per_unit.toFixed(2)}</Text>
                    </View>
                    {pipeline.selectedSupplier && (
                      <View style={fr.modePriceBlock}>
                        <Text style={fr.modePriceLabel}>LANDED/UNIT</Text>
                        <Text style={[fr.modePrice, { color: DS.success }]}>${(pipeline.selectedSupplier.unitCost + m.cost_per_unit).toFixed(2)}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={fr.modeNotes}>{m.notes}</Text>
                </AppCard>
              );
            })}

            <AppCard padding={14} style={{ gap: 6 }}>
              <Text style={fr.sectionTitle}>ADDITIONAL COSTS</Text>
              <View style={fr.extraRow}><Text style={fr.extraLabel}>FBA Inbound Handling</Text><Text style={fr.extraValue}>${freightResult.fba_inbound_est.toFixed(2)}</Text></View>
              <View style={fr.extraRow}><Text style={fr.extraLabel}>China 3PL Prep / Labeling</Text><Text style={fr.extraValue}>${freightResult.prep_cost.toFixed(2)}</Text></View>
            </AppCard>

            {/* Landed cost summary */}
            {freightSummary && pipeline.selectedSupplier && (
              <AppCard style={fr.landedCard}>
                <Text style={fr.landedEye}>SOURCING COMPLETE — COST CONFIRMED</Text>
                <View style={fr.landedRow}>
                  <View style={fr.landedBlock}>
                    <Text style={fr.landedLbl}>Unit Cost</Text>
                    <Text style={fr.landedVal}>${pipeline.selectedSupplier.unitCost.toFixed(2)}</Text>
                  </View>
                  <Text style={fr.landedPlus}>+</Text>
                  <View style={fr.landedBlock}>
                    <Text style={fr.landedLbl}>Freight/Unit</Text>
                    <Text style={fr.landedVal}>${freightSummary.perUnit.toFixed(2)}</Text>
                  </View>
                  <Text style={fr.landedPlus}>=</Text>
                  <View style={[fr.landedBlock, fr.landedBlockHighlight]}>
                    <Text style={fr.landedLbl}>Landed Cost</Text>
                    <Text style={[fr.landedVal, fr.landedValHighlight]}>
                      ${(pipeline.selectedSupplier.unitCost + freightSummary.perUnit).toFixed(2)}
                    </Text>
                  </View>
                </View>
                {pipeline.activeProduct?.price && pipeline.activeProduct.price > 0 && (() => {
                  const price    = pipeline.activeProduct!.price;
                  const fPerUnit = freightSummary.perUnit;
                  const unitCost = pipeline.selectedSupplier.unitCost;
                  const wKg      = parseFloat(freightWeightKg) || 0.5;
                  const margin   = confirmedMarginPct(price, unitCost, fPerUnit, wKg);
                  const roi      = confirmedROIPct(price, unitCost, fPerUnit, wKg);
                  return (
                    <View style={fr.landedEstRow}>
                      <Text style={fr.landedEstLbl}>Margin Est.</Text>
                      <Text style={[fr.landedEstVal, { color: marginColor(margin) }]}>
                        ~{margin.toFixed(0)}%
                      </Text>
                      <Text style={[fr.landedEstLbl, { marginLeft: 16 }]}>ROI Est.</Text>
                      <Text style={[fr.landedEstVal, { color: roiColor(roi) }]}>
                        ~{roi.toFixed(0)}%
                      </Text>
                    </View>
                  );
                })()}
              </AppCard>
            )}

            {/* Save Freight to Pipeline */}
            {freightSummary && (
              <TouchableOpacity
                style={sc.handoffBtnSecondary}
                onPress={() => {
                  const modeRaw = freightSummary.mode.toLowerCase();
                  const selectedMode: 'sea' | 'air' | 'local' =
                    modeRaw.includes('air') || modeRaw.includes('express') ? 'air'
                    : modeRaw.includes('local') ? 'local'
                    : 'sea';
                  pipeline.setFreightEstimate({
                    selectedMode,
                    perUnitCost:            freightSummary.perUnit,
                    totalCost:              freightSummary.totalCost,
                    originCountry:          pipeline.selectedSupplier?.country ?? 'China',
                    destinationMarketplace: marketplace,
                    isConfirmed:            false,
                    updatedAt:              new Date().toISOString(),
                  });
                  pipeline.trackPipelineEvent('freight_estimate_saved', {
                    mode: selectedMode, perUnit: freightSummary.perUnit,
                  });
                }}
                activeOpacity={0.88}
              >
                <Text style={sc.handoffBtnSecondaryTxt}>Save Freight Estimate to Pipeline</Text>
              </TouchableOpacity>
            )}

            {/* Primary CTA: Brand Setup */}
            <TouchableOpacity
              style={sc.handoffBtnPrimary}
              onPress={() => {
                if (freightSummary && pipeline.selectedSupplier) {
                  const sup    = pipeline.selectedSupplier;
                  const price  = pipeline.activeProduct?.price ?? 0;
                  const units  = parseInt(freightUnits, 10) || 200;
                  const model  = buildCostModel(
                    price, sup.unitCost, freightSummary.perUnit,
                    units, freightResult?.prep_cost ?? 0,
                    parseFloat(freightWeightKg) || 0.5,
                  );
                  pipeline.setCostModel(model);
                  pipeline.setFreightEstimate({
                    selectedMode: (() => {
                      const m = freightSummary.mode.toLowerCase();
                      return m.includes('air') || m.includes('express') ? 'air'
                        : m.includes('local') ? 'local' : 'sea';
                    })(),
                    perUnitCost:            freightSummary.perUnit,
                    totalCost:              freightSummary.totalCost,
                    originCountry:          sup.country ?? 'China',
                    destinationMarketplace: marketplace,
                    isConfirmed:            true,
                    updatedAt:              new Date().toISOString(),
                  });
                  pipeline.trackPipelineEvent('cost_model_saved_from_freight', {
                    landed: model.totalCost, margin: model.marginPct, roi: model.roiPct,
                  });
                }
                navigation.navigate('BrandStudio' as any);
              }}
              activeOpacity={0.88}
            >
              <Text style={sc.handoffBtnPrimaryTxt}>▣  Save Cost Model & Continue to Brand Setup →</Text>
            </TouchableOpacity>
            <TouchableOpacity style={sc.handoffBtnSecondary} onPress={() => { pipeline.trackPipelineEvent('freight_handoff_profit', {}); navigation.navigate('Profit'); }} activeOpacity={0.88}>
              <Text style={sc.handoffBtnSecondaryTxt}>Open Profit Lab for detailed breakdown</Text>
            </TouchableOpacity>
          </View>
        )}

        {!freightResult && !freightLoading && (
          <AppCard padding={28} style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 36, textAlign: 'center' }}>✈️</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: DS.textPrimary, textAlign: 'center' }}>Freight Estimator</Text>
            <Text style={{ fontSize: 13, color: DS.textMuted, lineHeight: 20, textAlign: 'center' }}>Compare air, sea, and express shipping costs from China to FBA — and see landed cost per unit alongside supplier cost.</Text>
          </AppCard>
        )}
      </View>
    );
  }

  function renderOverviewSection() {
    const sup   = pipeline.selectedSupplier;
    const price = pipeline.activeProduct?.price ?? 0;
    const capital = sup && price > 0
      ? estimateStartupCapital(sup.unitCost, sup.moq, freightSummary?.perUnit ?? sup.unitCost * 0.35, price)
      : null;

    return (
      <View style={{ gap: DS.sectionGap }}>
        <PipelineSummaryCard
          pipeline={pipeline}
          freightSummary={freightSummary}
          onGoToFreight={() => setTab('freight')}
          onGoToCosts={() => { pipeline.trackPipelineEvent('sourcing_handoff_profit', {}); navigation.navigate('Profit'); }}
        />

        {/* Startup capital breakdown */}
        {capital && (
          <AppCard style={{ gap: 12 }}>
            <Text style={{ fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 }}>
              💼 Estimated Startup Capital
            </Text>
            <Text style={{ fontSize: 11, color: DS.textMuted }}>
              Rough total cash required to launch this product — verify with Profit Lab.
            </Text>
            {[
              { label: 'Inventory (unit cost × MOQ)',    value: capital.inventoryCost },
              { label: 'Estimated freight',              value: capital.freightCost },
              { label: 'Amazon fee buffer (½ first batch)', value: capital.amazonFeeBuffer },
              { label: 'PPC launch budget (~5% of rev)', value: capital.ppcBuffer },
              { label: 'Contingency (25% buffer)',       value: capital.contingency },
            ].map(r => (
              <View key={r.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: DS.border }}>
                <Text style={{ fontSize: 12, color: DS.textSecondary, flex: 1 }}>{r.label}</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: DS.textPrimary }}>${r.value.toLocaleString()}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 4 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: DS.textPrimary }}>Estimated Total</Text>
              <Text style={{ fontSize: 18, fontWeight: '900', color: DS.accent, letterSpacing: -0.5 }}>
                ~${capital.total.toLocaleString()}
              </Text>
            </View>
          </AppCard>
        )}

        {intelProfile && (
          <SupplyChainIntelligenceCard
            profile={intelProfile}
            onNavigate={tab => navigation.navigate('Main', { screen: tab } as any)}
          />
        )}
        {intelProfile && (
          <DecisionSimulationPanel sim={decisionSim} baseProfile={intelProfile} />
        )}
        <OperationalChecklist items={checklistItems} />
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
      <Toast message={toastMsg} visible={toastVisible} onHide={hideToast} type={toastType} />
      <AnalyzeSupplierModal visible={analyzeModal} loading={analyzeLoading} result={analyzeResult} error={analyzeError} onClose={() => setAnalyzeModal(false)} />

      <CompareSuppliersModal visible={showCompare} items={compareItems} onClose={() => setShowCompare(false)} />
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="Supplier sourcing" />

      <SafeAreaView edges={['top']} style={{ backgroundColor: DS.bgCanvas }}>
        <AppHeader helpKey="sourcing" />
        <OfflineBanner visible={!isOnline} />
        <PipelineProgressBar />
      </SafeAreaView>

      <View style={{ paddingHorizontal: DS.pagePadding, paddingTop: DS.sectionGap, paddingBottom: 12, gap: 4 }}>
        <Text style={{ fontSize: 9, fontWeight: '800', color: DS.warning, letterSpacing: 2.5, textTransform: 'uppercase' }}>SOURCING & LOGISTICS</Text>
        <Text style={{ fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6 }}>Can I manufacture this profitably?</Text>
      </View>

      <View style={{ paddingHorizontal: DS.pagePadding, paddingBottom: 14 }}>
        <SourcingSegment value={tab} onChange={setTab} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: DS.pagePadding, paddingBottom: 120, gap: DS.sectionGap }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        overScrollMode="never"
      >
        {tab === 'suppliers' && renderSuppliersSection()}
        {tab === 'freight'   && renderFreightSection()}
        {tab === 'overview'  && renderOverviewSection()}
      </ScrollView>

      {tab === 'suppliers' && compareIds.size >= 1 && (
        <View style={cfb.wrap} pointerEvents="box-none">
          {compareIds.size === 1 ? (
            <View style={cfb.pillPending}>
              <Text style={cfb.pillIcon}>⊞</Text>
              <Text style={cfb.pillTextPending}>1 selected — add 1 more to compare</Text>
              <TouchableOpacity onPress={() => setCompareIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={cfb.clearPending}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={cfb.pill} onPress={() => setShowCompare(true)} activeOpacity={0.88}>
              <Text style={cfb.pillIcon}>⊞</Text>
              <Text style={cfb.pillText}>Compare {compareIds.size} Suppliers</Text>
              <Text style={cfb.pillArrow}>→</Text>
              <TouchableOpacity style={cfb.clearBtn} onPress={() => setCompareIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={cfb.clearText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const es = StyleSheet.create({
  banner:        { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: DS.accentLight ?? '#EFF6FF', borderRadius: DS.radiusCard, padding: DS.cardPadding, borderWidth: 1, borderColor: DS.accent + '40' },
  bannerIcon:    { fontSize: 24 },
  bannerTitle:   { fontSize: 14, fontWeight: '700', color: DS.accent },
  bannerSub:     { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  bannerChevron: { fontSize: 20, color: DS.accent },
});

const sc = StyleSheet.create({
  searchCard:        { gap: 10 },
  searchRow:         { flexDirection: 'row', gap: 8 },
  searchInput:       { flex: 1 },
  searchBtn:         { marginTop: 4 },
  filterToggle:      { alignSelf: 'flex-start' },
  filterToggleTxt:   { fontSize: 11, color: DS.accent, fontWeight: '700' },
  filterRow:         { flexDirection: 'row', gap: 10 },
  filterField:       { flex: 1 },
  loadingWrap:       { alignItems: 'center', gap: 12, paddingVertical: 32 },
  loadingTxt:        { fontSize: 14, color: DS.textSecondary },
  resultsHeader:     { gap: 3 },
  resultsCount:      { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  resultsSub:        { fontSize: 11, color: DS.textMuted },
  coachBanner:       { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: DS.indigoLight, borderRadius: 10, borderWidth: 1, borderColor: DS.indigo + '30', paddingHorizontal: 12, paddingVertical: 9 },
  coachIcon:         { fontSize: 13, marginTop: 1 },
  coachTxt:          { flex: 1, fontSize: 11, color: DS.textSecondary, lineHeight: 15 },
  retryBtn:          { paddingHorizontal: 20, paddingVertical: 9, borderRadius: DS.radiusButton, backgroundColor: DS.accent },
  retryBtnTxt:       { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyWrap:         { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyIcon:         { fontSize: 40, color: DS.textMuted },
  emptyTitle:        { fontSize: 16, fontWeight: '900', color: DS.textPrimary },
  emptySub:          { fontSize: 13, color: DS.textSecondary, textAlign: 'center', lineHeight: 20, maxWidth: 300 },
  handoffCard:       { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1.5, borderColor: DS.success + '40', padding: DS.cardPadding, gap: 12 },
  handoffTop:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  handoffIcon:       { fontSize: 22, color: DS.success },
  handoffTitle:      { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  handoffSub:        { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  supplierFinRow:    { flexDirection: 'row' as const, gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: DS.border },
  supplierFinBlock:  { flex: 1, alignItems: 'center' as const, backgroundColor: DS.bgSubtle, borderRadius: 10, padding: 8, gap: 3 },
  supplierFinLbl:    { fontSize: 9, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  supplierFinVal:    { fontSize: 14, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  handoffBtn:            { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center' },
  handoffBtnPrimary:     { backgroundColor: DS.success, borderRadius: DS.radiusButton, paddingVertical: 14, alignItems: 'center', shadowColor: DS.success, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  handoffBtnPrimaryTxt:  { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  handoffBtnSecondary:    { borderRadius: DS.radiusButton, paddingVertical: 12, alignItems: 'center', borderWidth: 1.5, borderColor: DS.border, backgroundColor: DS.bgCard },
  handoffBtnSecondaryTxt: { fontSize: 13, fontWeight: '700', color: DS.textSecondary },
});

const fr = StyleSheet.create({
  supplierContext:     { backgroundColor: DS.success + '10', borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.success + '30', padding: 14, gap: 3 },
  supplierContextLabel:{ fontSize: 9, fontWeight: '800', color: DS.success, letterSpacing: 2 },
  supplierContextName: { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  supplierContextSub:  { fontSize: 12, color: DS.textMuted },
  noSupplierBanner:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: DS.warning + '12', borderRadius: DS.radiusCard, padding: 14, borderWidth: 1, borderColor: DS.warning + '40' },
  noSupplierIcon:      { fontSize: 22, color: DS.warning },
  noSupplierTitle:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  noSupplierSub:       { fontSize: 11, color: DS.textSecondary, lineHeight: 16 },
  noSupplierChevron:   { fontSize: 20, color: DS.warning },
  row:        { flexDirection: 'row' as const, gap: 10 },
  halfField:  { flex: 1 },
  thirdField: { flex: 1 },
  sectionTitle: { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' as const },
  summaryCard:  { backgroundColor: DS.warning + '15', borderRadius: 16, borderWidth: 1.5, borderColor: DS.warning + '40', padding: 16, gap: 4 },
  summaryLabel: { fontSize: 9, fontWeight: '800', color: DS.warning, letterSpacing: 2 },
  summaryTitle: { fontSize: 17, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },
  summarySub:   { fontSize: 12, color: DS.textSecondary },
  modeCard:    { gap: 10, borderWidth: 1.5, borderColor: DS.border },
  modeCardRec: { borderColor: DS.warning, backgroundColor: DS.warning + '08' },
  recBadge:    { alignSelf: 'flex-start' as const, backgroundColor: DS.warning, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  recBadgeTxt: { fontSize: 9, fontWeight: '900', color: '#fff', letterSpacing: 1.5 },
  modeHeader:  { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  modeName:    { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  modeNameRec: { color: DS.warning },
  modeTransit: { fontSize: 12, fontWeight: '700', color: DS.textMuted, backgroundColor: DS.bgSubtle, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  modePriceRow:   { flexDirection: 'row' as const, gap: 20 },
  modePriceBlock: { gap: 2 },
  modePriceLabel: { fontSize: 9, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  modePrice:   { fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  modeNotes:   { fontSize: 12, color: DS.textMuted, lineHeight: 17, fontStyle: 'italic' as const },
  extraRow:    { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  extraLabel:  { fontSize: 13, color: DS.textSecondary },
  extraValue:  { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  // Landed cost card
  landedCard:          { gap: 12, backgroundColor: DS.bgCard, borderWidth: 1.5, borderColor: DS.success + '40' },
  landedEye:           { fontSize: 9, fontWeight: '900', color: DS.success, letterSpacing: 1.5 },
  landedRow:           { flexDirection: 'row' as const, alignItems: 'center', gap: 6 },
  landedBlock:         { flex: 1, alignItems: 'center' as const, gap: 3 },
  landedBlockHighlight:{ backgroundColor: DS.success + '10', borderRadius: 10, padding: 8 },
  landedLbl:           { fontSize: 9, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  landedVal:           { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },
  landedValHighlight:  { color: DS.success, fontSize: 18 },
  landedPlus:          { fontSize: 14, fontWeight: '700', color: DS.textMuted },
  landedEstRow:        { flexDirection: 'row' as const, alignItems: 'center', gap: 6, paddingTop: 8, borderTopWidth: 1, borderTopColor: DS.border },
  landedEstLbl:        { fontSize: 11, color: DS.textMuted, fontWeight: '500' },
  landedEstVal:        { fontSize: 14, fontWeight: '800' },
});

const cfb = StyleSheet.create({
  wrap:           { position: 'absolute', bottom: 16, left: 16, right: 16, alignItems: 'center' },
  pill:           { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.accent, borderRadius: 28, paddingVertical: 13, paddingLeft: 18, paddingRight: 12, shadowColor: DS.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10 },
  pillPending:    { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.bgCard, borderRadius: 28, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, borderWidth: 1.5, borderColor: DS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  pillIcon:       { fontSize: 15 },
  pillText:       { flex: 1, fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  pillTextPending:{ flex: 1, fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  pillArrow:      { fontSize: 16, fontWeight: '800', color: '#fff' },
  clearBtn:       { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  clearText:      { fontSize: 12, color: '#fff', fontWeight: '700' },
  clearPending:   { fontSize: 14, color: DS.textMuted, fontWeight: '700' },
});
