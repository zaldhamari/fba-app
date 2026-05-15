import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ScrollView, StyleSheet, View, Text, Modal,
  TouchableOpacity, ActivityIndicator, Linking, Image, Alert,
  TextInput, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  AppCard,
  SectionHeader,
  StatusBadge,
  InputField,
  PrimaryButton,
  SecondaryButton,
  GhostButton,
  DS,
} from '../components/ds';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import { useSellerProfile } from '../hooks/useSellerProfile';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { api, Product, Supplier, TrendData } from '../services/api';
import { useSubscription, SAVE_LIMITS } from '../hooks/useSubscription';
import { useVault } from '../hooks/useVault';
import PaywallModal from '../components/PaywallModal';
import { HelpButton } from '../components/HelpModal';
import FeasibilityHeart from '../components/FeasibilityHeart';
import { SkeletonProductCard } from '../components/ds/LoadingSkeleton';
import { useCurrency } from '../context/CurrencyContext';
import { useActiveProduct } from '../context/ActiveProductContext';
import { CurrencySelector } from '../components/CurrencySelector';
import {
  expandProductKeywords,
  buildSupplierQueries,
  deduplicateProducts,
  deduplicateSuppliers,
  scoreProduct,
  scoreSupplier,
  detectCategory,
  detectSupplierType,
  buildEmptySuggestion,
  SmartSearchSummary,
} from '../lib/smartSearch';
import {
  FeasibilityProduct,
  FeasibilitySupplier,
} from '../lib/feasibility';

// ── Nav types ─────────────────────────────────────────────────────────────────

import type { TabParamList } from '../navigation/tabTypes';
type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  StackNavigationProp<RootStackParamList>
>;

// ── URL opener ────────────────────────────────────────────────────────────────

async function openURL(url: string | undefined | null) {
  if (!url) { Alert.alert('Link unavailable', 'No URL was provided.'); return; }
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) { await Linking.openURL(url); }
    else { Alert.alert('Cannot open link', 'Your device cannot open this URL.'); }
  } catch { Alert.alert('Error', 'Unable to open this link.'); }
}

// ── Display types ─────────────────────────────────────────────────────────────

type Mode = 'market' | 'lookup' | 'suppliers' | 'freight';

interface ProductDisplay {
  id: string;
  name: string;
  price: number | null;
  rating: number | null;
  image: string;
  revenue: string;
  revenueUSD: number | null;
  reviews: string;
  reviewCount: number | null;
  competition: 'Low' | 'Medium' | 'High';
  badge: 'Promising' | 'Moderate' | 'Saturated';
  url?: string;
  // Smart search scores
  relevanceScore?:    number;
  opportunityScore?:  number;
  finalScore?:        number;
  badges?:            string[];
  matchReason?:       string;
}

interface SupplierDisplay {
  id: string;
  name: string;
  platform: string;
  badge: string;
  moq: string;
  moqNum: number;
  price: string;
  priceUSD: number | null;
  priceMin?: number | null;
  priceMax?: number | null;
  wideRange?: boolean;
  // Smart search scores
  relevanceScore?:    number;
  opportunityScore?:  number;
  finalScore?:        number;
  badges?:            string[];
  matchReason?:       string;
  trust: number;
  country: string;
  url?: string;
}

interface KeywordMetric { label: string; value: string; icon: string; color: string; bg: string; }

interface EnrichedKeyword {
  phrase:       string;
  seoScore:     number;
  searchVolume: string;
  trend:        'Rising' | 'Stable' | 'Declining';
  keywordType:  'Head Term' | 'Long-tail' | 'Backend' | 'PPC Candidate';
  usageHint:    'Title candidate' | 'Bullet candidate' | 'Backend keyword' | 'PPC test candidate';
  sourceQuery:  string;
  savedAt?:     string;
}

interface AnalyzeProductResult {
  verdict: 'LAUNCH' | 'TEST' | 'AVOID';
  confidence: number;
  summary: string;
  reasons: string[];
  risk: string;
  next_step: string;
}

interface AnalyzeSupplierResult {
  total_score: number;
  grade: string;
  confidence_label: string;
  strengths: string[];
  risk_flags: string[];
  recommendation: string;
  negotiation_strategy: { opening_offer: string; target_price: string; moq_ask: string; leverage_points: string[] };
}

interface OutreachEmail { subject: string; body: string; tips: string[]; }

// ── Static mocks (pre-search) ─────────────────────────────────────────────────

const MOCK_KEYWORD_METRICS: KeywordMetric[] = [
  { label: 'Search Volume', value: '—', icon: '◎', color: DS.textMuted, bg: DS.bgSubtle },
  { label: 'Trend Score',   value: '—', icon: '↗', color: DS.textMuted, bg: DS.bgSubtle },
  { label: 'Trend',         value: '—', icon: '↗', color: DS.textMuted, bg: DS.bgSubtle },
  { label: 'SEO Score',     value: '—', icon: '✦', color: DS.textMuted, bg: DS.bgSubtle },
];

const MOCK_RELATED_KEYWORDS: EnrichedKeyword[] = [];

const MOCK_PRODUCTS: ProductDisplay[] = [];

const MOCK_SUPPLIERS: SupplierDisplay[] = [];

// ── Data converters ───────────────────────────────────────────────────────────

function productToDisplay(p: Product): ProductDisplay {
  const comp: ProductDisplay['competition'] =
    p.competition === 'High' ? 'High' : p.competition === 'Low' ? 'Low' : 'Medium';
  const badge: ProductDisplay['badge'] =
    p.opportunity === 'Good' ? 'Promising' : p.opportunity === 'Saturated' ? 'Saturated' : 'Moderate';
  const revenueUSD = p.price && p.review_count
    ? Math.round(p.price * p.review_count * 0.05)
    : null;
  return {
    id:          p.asin,
    name:        p.title,
    price:       p.price,
    rating:      p.rating,
    image:       p.image ?? '',
    revenue:     revenueUSD != null ? `~$${revenueUSD.toLocaleString()}/mo` : 'N/A',
    revenueUSD,
    reviews:     p.review_count != null ? `${p.review_count.toLocaleString()} reviews` : 'N/A',
    reviewCount: p.review_count,
    competition: comp,
    badge,
    url:         p.url || undefined,
  };
}

function supplierToDisplay(s: Supplier, idx: number): SupplierDisplay {
  const hasRange = s.price_range.min != null && s.price_range.max != null;
  const max  = hasRange ? s.price_range.max! : null;
  const min  = hasRange ? s.price_range.min! : null;
  const avg  = hasRange ? (min! + max!) / 2 : null;
  // Use the high end of the range as our working price — conservative default protects the user
  const conservativePrice = max ?? avg;
  const trust = conservativePrice != null ? Math.min(9.9, Math.max(6.0, 10 - conservativePrice * 0.3)) : 8.0;
  const moqNum = parseInt(String(s.moq).replace(/\D/g, ''), 10) || 0;
  const wideRange = hasRange && (max! - min!) > min! * 0.5; // range > 50% of min = wide
  return {
    id:            String(idx),
    name:          s.title,
    platform:      s.supplier || 'Alibaba',
    badge:         'Verified',
    moq:           `${s.moq} units`,
    moqNum,
    price:         wideRange ? `$${min!.toFixed(2)}–$${max!.toFixed(2)}` : s.price_display,
    priceUSD:      conservativePrice,
    priceMin:      min,
    priceMax:      max,
    wideRange,
    trust:         Math.round(trust * 10) / 10,
    country:       '🇨🇳',
    url:           s.url || undefined,
  };
}

function displayToProduct(p: ProductDisplay): Product {
  return {
    title:        p.name,
    price:        p.price,
    rating:       p.rating,
    review_count: p.reviewCount,
    asin:         p.id,
    image:        p.image,
    competition:  p.competition as Product['competition'],
    opportunity:  p.badge === 'Promising' ? 'Good' : p.badge === 'Saturated' ? 'Saturated' : 'Moderate',
    url:          p.url ?? '',
  };
}

function trendsToMetrics(kw: string, trends: TrendData, totalFound: number, seoScore: number): KeywordMetric[] {
  const trendLabel = trends.trend_direction === 'Rising'   ? 'Rising ↑'
    : trends.trend_direction === 'Declining' ? 'Declining ↓' : 'Stable →';
  const trendColor = trends.trend_direction === 'Rising'   ? DS.accent
    : trends.trend_direction === 'Declining' ? DS.danger    : DS.textSecondary;
  const trendBg    = trends.trend_direction === 'Rising'   ? DS.accentLight
    : trends.trend_direction === 'Declining' ? DS.dangerBg  : DS.bgSubtle;
  return [
    { label: 'Search Volume', value: totalFound > 0 ? totalFound.toLocaleString() : '—',                    icon: '◎', color: DS.info,   bg: DS.infoBg },
    { label: 'Trend Score',   value: trends.interest_score != null ? `${trends.interest_score}/100` : '—',  icon: '↗', color: trendColor, bg: trendBg  },
    { label: 'Trend',         value: trendLabel,                                                             icon: '↗', color: trendColor, bg: trendBg  },
    { label: 'SEO Score',     value: `${seoScore}/10`,                                                       icon: '✦', color: DS.indigo,  bg: DS.indigoLight },
  ];
}

// ── Keyword enrichment ────────────────────────────────────────────────────────

function enrichKeywords(
  kwRes: {
    keywords:   { keyword: string; competition: string; type: string }[];
    head_terms: string[];
    long_tail:  string[];
    total_found: number;
    seo_score:  number;
    top_ppc:    string[];
  },
  trend:       TrendData,
  sourceQuery: string,
): EnrichedKeyword[] {
  const ppcSet  = new Set(kwRes.top_ppc.map(k => k.toLowerCase()));
  const headSet = new Set(kwRes.head_terms.map(k => k.toLowerCase()));
  const trendDir: 'Rising' | 'Stable' | 'Declining' =
    trend.trend_direction === 'Rising'   ? 'Rising'
    : trend.trend_direction === 'Declining' ? 'Declining'
    : 'Stable';

  const raw: { keyword: string; competition: string; type: string }[] =
    kwRes.keywords.length > 0
      ? kwRes.keywords
      : [
          ...kwRes.head_terms.map(k => ({ keyword: k, competition: 'Medium', type: 'head_term' })),
          ...kwRes.long_tail.map(k =>  ({ keyword: k, competition: 'Low',    type: 'long_tail' })),
        ];

  return raw.slice(0, 10).map((k, idx) => {
    const lower    = k.keyword.toLowerCase();
    const isPPC    = ppcSet.has(lower);
    const isHead   = headSet.has(lower) || k.type === 'head_term';
    const wordCount = lower.split(/\s+/).length;

    let keywordType: EnrichedKeyword['keywordType'];
    if (isPPC)           keywordType = 'PPC Candidate';
    else if (isHead || wordCount <= 2) keywordType = 'Head Term';
    else if (wordCount >= 4)           keywordType = 'Long-tail';
    else                               keywordType = 'Long-tail';

    const positionPenalty = idx * 0.4;
    const typeBonus       = isHead ? 0.5 : isPPC ? 0.3 : 0;
    const seoScore        = Math.round(
      Math.min(10, Math.max(3, kwRes.seo_score - positionPenalty + typeBonus)) * 10,
    ) / 10;

    let usageHint: EnrichedKeyword['usageHint'];
    if (keywordType === 'PPC Candidate') usageHint = 'PPC test candidate';
    else if (idx === 0 || (isHead && idx < 3)) usageHint = 'Title candidate';
    else if (idx < 6) usageHint = 'Bullet candidate';
    else              usageHint = 'Backend keyword';

    const volEstimate = kwRes.total_found > 0
      ? Math.round(kwRes.total_found * Math.pow(0.7, idx))
      : 0;
    const searchVolume = volEstimate > 0 ? `est. ${volEstimate.toLocaleString()}` : '—';

    return { phrase: k.keyword, seoScore, searchVolume, trend: trendDir, keywordType, usageHint, sourceQuery };
  });
}

function csvEscape(val: string | number | undefined): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildKeywordCSV(keywords: EnrichedKeyword[]): string {
  const header = ['keyword', 'seoScore', 'searchVolume', 'trend', 'keywordType', 'usageHint', 'sourceQuery', 'savedAt'];
  const rows = keywords.map(k => [
    csvEscape(k.phrase),
    csvEscape(k.seoScore),
    csvEscape(k.searchVolume),
    csvEscape(k.trend),
    csvEscape(k.keywordType),
    csvEscape(k.usageHint),
    csvEscape(k.sourceQuery),
    csvEscape(k.savedAt ?? ''),
  ].join(','));
  return [header.join(','), ...rows].join('\n');
}

// ── Input type detection ──────────────────────────────────────────────────────

function isASIN(input: string): boolean {
  return /^[A-Z0-9]{10}$/.test(input.trim().toUpperCase());
}

function isAmazonProductURL(input: string): boolean {
  return /amazon\.(com|co\.uk|de|ca|co\.jp|com\.au|in|fr|es|it)/i.test(input) &&
    (/\/dp\/[A-Z0-9]{10}/i.test(input) || /\/gp\/product\/[A-Z0-9]{10}/i.test(input));
}

function isLikelyBroadKeyword(input: string): boolean {
  const t = input.trim();
  return !isASIN(t) && !isAmazonProductURL(t);
}

function hasEnoughDataForCompare(p: ProductDisplay): boolean {
  const isMock = p.id === '1' || p.id === '2' || p.id === '3';
  if (isMock) return false;
  return !!p.name && (p.price != null || p.reviewCount != null);
}

// ── Recent searches component ─────────────────────────────────────────────────

function RecentSearches({
  items,
  accentColor,
  onSelect,
  onClear,
}: {
  items:       string[];
  accentColor: string;
  onSelect:    (q: string) => void;
  onClear:     () => void;
}) {
  if (items.length === 0) return null;
  return (
    <View style={recent.wrap}>
      <View style={recent.header}>
        <Text style={recent.heading}>Recent</Text>
        <TouchableOpacity onPress={onClear} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={recent.clear}>Clear</Text>
        </TouchableOpacity>
      </View>
      <View style={recent.chips}>
        {items.map((q, i) => (
          <TouchableOpacity key={i} style={[recent.chip, { borderColor: accentColor + '33' }]} onPress={() => onSelect(q)} activeOpacity={0.75}>
            <Text style={[recent.icon, { color: accentColor }]}>↺</Text>
            <Text style={recent.text} numberOfLines={1}>{q}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const recent = StyleSheet.create({
  wrap:    { gap: 8 },
  header:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 11, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  clear:   { fontSize: 11, fontWeight: '700', color: DS.textMuted },
  chips:   { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: DS.bgCard, borderRadius: DS.radiusBadge,
    borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7,
  },
  icon:    { fontSize: 11 },
  text:    { fontSize: 12, fontWeight: '600', color: DS.textSecondary, maxWidth: 180 },
});

// ── Mode segmented control (3 tabs) ──────────────────────────────────────────

const MODE_TABS: { id: Mode; label: string; color: string }[] = [
  { id: 'market',    label: 'Amazon',    color: DS.info    },
  { id: 'lookup',    label: 'Analyst',   color: DS.indigo  },
  { id: 'suppliers', label: 'Suppliers', color: DS.accent  },
  { id: 'freight',   label: 'Freight',   color: DS.warning },
];

function ModeSegment({ value, onChange }: { value: Mode; onChange: (v: Mode) => void }) {
  return (
    <View style={seg.wrap}>
      {MODE_TABS.map(t => {
        const active = value === t.id;
        return (
          <TouchableOpacity
            key={t.id}
            style={[seg.tab, active && { backgroundColor: t.color, borderColor: t.color }]}
            onPress={() => onChange(t.id)}
            activeOpacity={0.8}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
          >
            <Text style={[seg.label, active && seg.labelActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const seg = StyleSheet.create({
  wrap:        { flexDirection: 'row', gap: 8 },
  tab: {
    flex: 1, alignItems: 'center',
    backgroundColor: DS.bgCard, borderRadius: 20, borderWidth: 1, borderColor: DS.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  label:       { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  labelActive: { color: '#fff' },
});

// ── Mode description strip ────────────────────────────────────────────────────

const MODE_DESC: Record<Mode, string> = {
  market:    'Search any keyword to discover product opportunities ranked by demand and competition.',
  lookup:    'Search any product to find its flaws — AI reads the reviews so you can source an improved version to resell.',
  suppliers: 'Find matching suppliers on Alibaba, DHgate, and 1688. Select a product in Market first for better results.',
  freight:   'Estimate shipping costs from China to your FBA warehouse. Select units, weight, and dimensions to compare air vs sea.',
};

function ModeDescStrip({ mode }: { mode: Mode }) {
  const color = MODE_TABS.find(t => t.id === mode)!.color;
  return (
    <View style={[mds.wrap, { borderColor: color + '30', backgroundColor: color + '10' }]}>
      <Text style={[mds.text, { color }]}>{MODE_DESC[mode]}</Text>
    </View>
  );
}
const mds = StyleSheet.create({
  wrap: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  text: { fontSize: 12, fontWeight: '500', lineHeight: 18 },
});

// ── Utility sub-components ────────────────────────────────────────────────────

function InfoTip({ text }: { text: string }) {
  return (
    <View style={tip.wrap}>
      <Text style={tip.icon}>ℹ</Text>
      <Text style={tip.text}>{text}</Text>
    </View>
  );
}
const tip = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: DS.indigoLight, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  icon: { fontSize: 10, color: DS.indigo },
  text: { fontSize: 10, fontWeight: '600', color: DS.indigo },
});

function StarRating({ rating }: { rating: number }) {
  const full = Math.min(5, Math.round(rating));
  return (
    <View style={star.row}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Text key={i} style={[star.s, { color: i < full ? DS.warning : DS.border }]}>★</Text>
      ))}
      <Text style={star.num}>{rating.toFixed(1)}</Text>
    </View>
  );
}
const star = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  s:   { fontSize: 11, fontWeight: '700', color: DS.warning },
  num: { fontSize: 10, color: DS.textMuted, marginLeft: 3, fontWeight: '600' },
});

// ── Keyword metrics card ──────────────────────────────────────────────────────

function KeywordMetricsCard({ keyword, metrics }: { keyword: string; metrics: KeywordMetric[] }) {
  return (
    <AppCard style={km.card}>
      <View style={km.header}>
        <Text style={km.title}>Keyword Analysis</Text>
        <InfoTip text={keyword || 'your search'} />
      </View>
      <View style={km.grid}>
        {metrics.map(m => (
          <View key={m.label} style={[km.tile, { backgroundColor: m.bg }]}>
            <Text style={[km.tileIcon, { color: m.color }]}>{m.icon}</Text>
            <Text style={[km.tileValue, { color: m.color }]}>{m.value}</Text>
            <Text style={km.tileLabel}>{m.label}</Text>
          </View>
        ))}
      </View>
    </AppCard>
  );
}
const km = StyleSheet.create({
  card:       { gap: 16 },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:      { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile:       { width: '47%', borderRadius: 16, padding: 14, alignItems: 'center', gap: 4 },
  tileIcon:   { fontSize: 20, fontWeight: '700' },
  tileValue:  { fontSize: 18, fontWeight: '900', letterSpacing: -0.5 },
  tileLabel:  { fontSize: 10, fontWeight: '600', color: DS.textSecondary, textAlign: 'center' },
});

// ── Market summary card (aggregates — ONLY shown in Market mode) ───────────────

function MarketSummaryCard({
  products, keyword,
}: {
  products: ProductDisplay[];
  keyword: string;
}) {
  const { fmt } = useCurrency();
  const prices    = products.filter(p => p.price != null).map(p => p.price as number);
  const revUSD    = products.filter(p => p.revenueUSD != null).map(p => p.revenueUSD as number);
  const avgPrice  = prices.length  ? prices.reduce((a, b) => a + b, 0) / prices.length  : null;
  const avgRev    = revUSD.length   ? revUSD.reduce((a, b) => a + b, 0)  / revUSD.length  : null;
  const reviews   = products.map(p => p.reviewCount ?? 0);
  const avgReview = reviews.length  ? Math.round(reviews.reduce((a, b) => a + b, 0) / reviews.length) : null;
  const compCounts: Record<string, number> = {};
  products.forEach(p => { compCounts[p.competition] = (compCounts[p.competition] ?? 0) + 1; });
  const topComp = Object.entries(compCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  return (
    <AppCard style={ms.card}>
      <View style={ms.header}>
        <Text style={ms.title}>Market Summary</Text>
        <InfoTip text={keyword || 'all results'} />
      </View>
      <Text style={ms.note}>Aggregated from {products.length} products · not product-specific</Text>
      <View style={ms.grid}>
        <View style={ms.tile}>
          <Text style={ms.val}>{avgPrice != null ? fmt(avgPrice) : '—'}</Text>
          <Text style={ms.lbl}>Avg Price</Text>
        </View>
        <View style={[ms.tile, { borderLeftWidth: 1, borderLeftColor: DS.border }]}>
          <Text style={ms.val}>{avgRev != null ? `${fmt(avgRev, 0)}/mo` : '—'}</Text>
          <Text style={ms.lbl}>Avg Revenue</Text>
        </View>
        <View style={[ms.tile, { borderLeftWidth: 1, borderLeftColor: DS.border }]}>
          <Text style={ms.val}>{avgReview != null ? avgReview.toLocaleString() : '—'}</Text>
          <Text style={ms.lbl}>Avg Reviews</Text>
        </View>
        <View style={[ms.tile, { borderLeftWidth: 1, borderLeftColor: DS.border }]}>
          <Text style={[ms.val, { color: topComp === 'Low' ? DS.accent : topComp === 'High' ? DS.danger : DS.warning }]}>{topComp}</Text>
          <Text style={ms.lbl}>Competition</Text>
        </View>
      </View>
    </AppCard>
  );
}
const ms = StyleSheet.create({
  card:   { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title:  { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  note:   { fontSize: 10, color: DS.textMuted, fontStyle: 'italic' },
  grid:   { flexDirection: 'row', backgroundColor: DS.bgSubtle, borderRadius: 14, overflow: 'hidden' },
  tile:   { flex: 1, alignItems: 'center', padding: 12, gap: 3 },
  val:    { fontSize: 13, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.3 },
  lbl:    { fontSize: 9, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
});

// ── SEO Keywords panel ────────────────────────────────────────────────────────

const KW_TYPE_STYLE: Record<EnrichedKeyword['keywordType'], { color: string; bg: string }> = {
  'Head Term':      { color: DS.info,   bg: DS.infoBg      },
  'Long-tail':      { color: DS.indigo, bg: DS.indigoLight },
  'Backend':        { color: DS.textMuted, bg: DS.bgSubtle },
  'PPC Candidate':  { color: DS.warning,  bg: DS.warningBg },
};

const HINT_COLOR: Record<EnrichedKeyword['usageHint'], string> = {
  'Title candidate':    DS.accent,
  'Bullet candidate':   DS.indigo,
  'Backend keyword':    DS.textMuted,
  'PPC test candidate': DS.warning,
};

function KeywordRow({
  kw, isSaved, onToggle,
}: {
  kw:       EnrichedKeyword;
  isSaved:  boolean;
  onToggle: () => void;
}) {
  const ts = KW_TYPE_STYLE[kw.keywordType];
  const scoreColor = kw.seoScore >= 7 ? DS.accent : kw.seoScore >= 5 ? DS.indigo : DS.textMuted;
  return (
    <View style={kr.row}>
      <View style={kr.left}>
        <View style={kr.topLine}>
          <Text style={kr.phrase} numberOfLines={1}>{kw.phrase}</Text>
          <View style={[kr.typeBadge, { backgroundColor: ts.bg }]}>
            <Text style={[kr.typeText, { color: ts.color }]}>{kw.keywordType}</Text>
          </View>
        </View>
        <View style={kr.meta}>
          <Text style={[kr.hint, { color: HINT_COLOR[kw.usageHint] }]}>{kw.usageHint}</Text>
          <Text style={kr.dot}>·</Text>
          <Text style={[kr.score, { color: scoreColor }]}>{kw.seoScore}/10</Text>
          <Text style={kr.dot}>·</Text>
          <Text style={kr.vol}>{kw.searchVolume}</Text>
          <Text style={kr.dot}>·</Text>
          <Text style={[kr.trend, {
            color: kw.trend === 'Rising' ? DS.accent : kw.trend === 'Declining' ? DS.danger : DS.textMuted,
          }]}>
            {kw.trend === 'Rising' ? '↑ Rising' : kw.trend === 'Declining' ? '↓ Declining' : '→ Stable'}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[kr.saveBtn, isSaved && kr.saveBtnActive]}
        activeOpacity={0.7}
      >
        <Text style={[kr.saveBtnTxt, isSaved && kr.saveBtnTxtActive]}>{isSaved ? '★' : '☆'}</Text>
      </TouchableOpacity>
    </View>
  );
}
const kr = StyleSheet.create({
  row:            { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  left:           { flex: 1, gap: 3 },
  topLine:        { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  phrase:         { fontSize: 13, fontWeight: '700', color: DS.textPrimary, flexShrink: 1 },
  typeBadge:      { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  typeText:       { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  meta:           { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4 },
  hint:           { fontSize: 10, fontWeight: '600' },
  dot:            { fontSize: 10, color: DS.borderLight },
  score:          { fontSize: 10, fontWeight: '700' },
  vol:            { fontSize: 10, color: DS.textMuted },
  trend:          { fontSize: 10, fontWeight: '600' },
  saveBtn:        { width: 30, height: 30, borderRadius: 15, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  saveBtnActive:  { backgroundColor: DS.warningBg, borderColor: DS.warning },
  saveBtnTxt:     { fontSize: 13, color: DS.textMuted },
  saveBtnTxtActive: { color: DS.warning },
});

function SEOKeywordsPanel({
  keywords,
  savedKWs,
  onSave,
  onUnsave,
  sourceQuery,
}: {
  keywords:    EnrichedKeyword[];
  savedKWs:    EnrichedKeyword[];
  onSave:      (kw: EnrichedKeyword) => void;
  onUnsave:    (phrase: string) => void;
  sourceQuery?: string;
}) {
  const [exporting, setExporting] = useState(false);
  const savedSet = useMemo(
    () => new Set(savedKWs.map(k => k.phrase.toLowerCase())),
    [savedKWs],
  );

  const handleExport = async () => {
    const all = keywords.length > 0 ? keywords : savedKWs;
    if (all.length === 0) { Alert.alert('Nothing to export', 'Run a market search first.'); return; }
    setExporting(true);
    try {
      const csv  = buildKeywordCSV(all);
      const uri  = `${FileSystem.cacheDirectory ?? ''}siftly_keywords.csv`;
      await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      const ok   = await Sharing.isAvailableAsync();
      if (!ok) { Alert.alert('Sharing unavailable', 'Try on a real device.'); return; }
      await Sharing.shareAsync(uri, {
        mimeType: 'text/csv',
        UTI:      'public.comma-separated-values-text',
        dialogTitle: 'Export SEO Keywords',
      });
    } catch (err: any) {
      Alert.alert('Export failed', err?.message ?? 'Could not export CSV.');
    } finally {
      setExporting(false);
    }
  };

  const savedOnly = savedKWs.filter(k => !keywords.some(kw => kw.phrase.toLowerCase() === k.phrase.toLowerCase()));

  return (
    <AppCard style={sk.card}>
      {/* Header */}
      <View style={sk.header}>
        <Text style={sk.title}>SEO Keywords</Text>
        <TouchableOpacity onPress={handleExport} disabled={exporting} style={sk.exportBtn} activeOpacity={0.75}>
          <Text style={sk.exportTxt}>{exporting ? 'Exporting…' : '↑ Export CSV'}</Text>
        </TouchableOpacity>
      </View>
      <Text style={sk.est}>Scores are estimated · tap ☆ to save · {keywords.length} keyword{keywords.length !== 1 ? 's' : ''}</Text>
      {keywords.length > 0 && (
        <FeasibilityHeart
          type="keywords"
          label={`${sourceQuery ?? 'Keywords'} — ${keywords.length} keywords, top: ${keywords.slice(0, 3).map(k => k.phrase).join(', ')}`}
          data={{ keywords: keywords.map(k => ({ phrase: k.phrase, seoScore: k.seoScore, keywordType: k.keywordType })), total: keywords.length, sourceQuery }}
        />
      )}

      {/* Current result rows */}
      {keywords.length === 0 && savedKWs.length === 0 && (
        <Text style={sk.empty}>Search a keyword in Market mode to see SEO suggestions.</Text>
      )}
      {keywords.map(kw => (
        <KeywordRow
          key={kw.phrase}
          kw={kw}
          isSaved={savedSet.has(kw.phrase.toLowerCase())}
          onToggle={() =>
            savedSet.has(kw.phrase.toLowerCase()) ? onUnsave(kw.phrase) : onSave(kw)
          }
        />
      ))}

      {/* Saved-only rows (not in current results) */}
      {savedOnly.length > 0 && (
        <>
          <View style={sk.divider} />
          <Text style={sk.savedHead}>Saved ({savedKWs.length})</Text>
          {savedOnly.map(kw => (
            <KeywordRow key={kw.phrase} kw={kw} isSaved onToggle={() => onUnsave(kw.phrase)} />
          ))}
        </>
      )}
      {savedOnly.length === 0 && savedKWs.length > 0 && keywords.length > 0 && (
        <Text style={sk.savedNote}>{savedKWs.length} saved keyword{savedKWs.length !== 1 ? 's' : ''} visible above ★</Text>
      )}
    </AppCard>
  );
}
const sk = StyleSheet.create({
  card:      { gap: 4 },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  title:     { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  exportBtn: { backgroundColor: DS.indigoLight, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: DS.indigo + '30' },
  exportTxt: { fontSize: 11, fontWeight: '700', color: DS.indigo },
  est:       { fontSize: 10, color: DS.textMuted, fontStyle: 'italic', marginBottom: 4 },
  empty:     { fontSize: 13, color: DS.textMuted, textAlign: 'center', paddingVertical: 16 },
  divider:   { height: 1, backgroundColor: DS.border, marginVertical: 10 },
  savedHead: { fontSize: 11, fontWeight: '800', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 4 },
  savedNote: { fontSize: 10, color: DS.textMuted, fontStyle: 'italic', textAlign: 'center', paddingTop: 4 },
});

// ── Smart Search Summary Card ─────────────────────────────────────────────────

function SmartSummaryCard({ summary }: { summary: SmartSearchSummary }) {
  const [expanded, setExpanded] = useState(false);
  const kwPreview = summary.expandedKeywords.slice(0, 3).join(', ');
  const kwExtra   = summary.expandedKeywords.length - 3;
  return (
    <AppCard padding={14} radius={18} style={ss.card}>
      <TouchableOpacity
        style={ss.row}
        onPress={() => setExpanded(p => !p)}
        activeOpacity={0.8}
      >
        <View style={ss.iconWrap}>
          <Text style={ss.icon}>⊛</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={ss.headline}>
            Smart Search — {summary.expandedKeywords.length} keywords · {summary.totalScanned} scanned · {summary.finalCount} ranked
          </Text>
          {summary.duplicatesRemoved > 0 && (
            <Text style={ss.sub}>{summary.duplicatesRemoved} duplicates removed · {summary.topCategory}</Text>
          )}
        </View>
        <Text style={ss.chevron}>{expanded ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {expanded && (
        <View style={ss.details}>
          <View style={ss.detailRow}>
            <Text style={ss.detailLabel}>Original query</Text>
            <Text style={ss.detailVal}>"{summary.originalQuery}"</Text>
          </View>
          <View style={ss.detailRow}>
            <Text style={ss.detailLabel}>Keywords used</Text>
            <Text style={ss.detailVal} numberOfLines={2}>
              {kwPreview}{kwExtra > 0 ? ` +${kwExtra} more` : ''}
            </Text>
          </View>
          <View style={ss.detailRow}>
            <Text style={ss.detailLabel}>Category</Text>
            <Text style={ss.detailVal}>{summary.topCategory}</Text>
          </View>
        </View>
      )}
    </AppCard>
  );
}
const ss = StyleSheet.create({
  card:        { gap: 0 },
  row:         { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap:    { width: 30, height: 30, borderRadius: 10, backgroundColor: DS.indigoLight, alignItems: 'center', justifyContent: 'center' },
  icon:        { fontSize: 14, color: DS.indigo },
  headline:    { fontSize: 12, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 17 },
  sub:         { fontSize: 10, color: DS.textMuted, marginTop: 2 },
  chevron:     { fontSize: 9, color: DS.textMuted },
  details:     { marginTop: 12, gap: 8, borderTopWidth: 1, borderTopColor: DS.borderLight, paddingTop: 12 },
  detailRow:   { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  detailLabel: { fontSize: 10, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, flexShrink: 0 },
  detailVal:   { fontSize: 11, fontWeight: '600', color: DS.textSecondary, textAlign: 'right', flex: 1 },
});

// ── Smart score badge strip ───────────────────────────────────────────────────

const BADGE_STYLE: Record<string, { bg: string; color: string }> = {
  'Smart Pick':             { bg: DS.indigoLight,   color: DS.indigo    },
  'Low Competition':        { bg: DS.accentLight,   color: DS.accentDark },
  'High Demand':            { bg: DS.warningBg,     color: DS.warningText },
  'Quick Win':              { bg: '#ECFDF5',        color: '#047857'    },
  'Well Rated':             { bg: DS.goldLight,     color: DS.gold      },
  'Low MOQ':                { bg: DS.accentLight,   color: DS.accentDark },
  'Great Price':            { bg: DS.accentLight,   color: DS.accentDark },
  'Verified':               { bg: '#EFF6FF',        color: '#1D4ED8'    },
  'Private Label Friendly': { bg: '#F5F3FF',        color: '#6D28D9'    },
};

function SmartBadgeStrip({ badges, finalScore }: { badges?: string[]; finalScore?: number }) {
  if (!badges || badges.length === 0) return null;
  return (
    <View style={sbs.row}>
      {badges.slice(0, 3).map(b => {
        const style = BADGE_STYLE[b] ?? { bg: DS.bgSubtle, color: DS.textMuted };
        return (
          <View key={b} style={[sbs.badge, { backgroundColor: style.bg }]}>
            <Text style={[sbs.badgeTxt, { color: style.color }]}>{b}</Text>
          </View>
        );
      })}
      {finalScore != null && (
        <View style={sbs.scorePill}>
          <Text style={sbs.scoreTxt}>Score {finalScore}</Text>
        </View>
      )}
    </View>
  );
}
const sbs = StyleSheet.create({
  row:      { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  badge:    { borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3 },
  badgeTxt: { fontSize: 9, fontWeight: '800', letterSpacing: 0.3 },
  scorePill:{ backgroundColor: DS.bgSubtle, borderRadius: DS.radiusBadge, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: DS.border },
  scoreTxt: { fontSize: 9, fontWeight: '700', color: DS.textMuted },
});

// ── Product image + info shared layout helper ─────────────────────────────────

function ProductTopRow({ item }: { item: ProductDisplay }) {
  const { fmt } = useCurrency();
  const badgeVariant: 'success' | 'warning' | 'neutral' =
    item.badge === 'Promising' ? 'success' : item.badge === 'Saturated' ? 'neutral' : 'warning';
  const compColor = item.competition === 'Low' ? DS.successText : item.competition === 'High' ? DS.danger : DS.warning;
  const compBg    = item.competition === 'Low' ? DS.successBg   : item.competition === 'High' ? DS.dangerBg : DS.warningBg;
  return (
    <View style={ptr.row}>
      <View style={ptr.imgBox}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={ptr.img} resizeMode="contain" />
        ) : (
          <Text style={ptr.placeholder}>🛒</Text>
        )}
      </View>
      <View style={ptr.info}>
        <Text style={ptr.name} numberOfLines={2}>{item.name}</Text>
        <View style={ptr.badges}>
          <StatusBadge label={item.badge} variant={badgeVariant} dot />
          <View style={[ptr.compBadge, { backgroundColor: compBg }]}>
            <Text style={[ptr.compText, { color: compColor }]}>{item.competition} Comp</Text>
          </View>
          <Text style={ptr.estNote}>AI est.</Text>
        </View>
        {item.price != null
          ? <Text style={ptr.price}>{fmt(item.price)}</Text>
          : <Text style={ptr.priceNA}>Price unavailable</Text>}
        {item.rating != null && <StarRating rating={item.rating} />}
      </View>
    </View>
  );
}
const ptr = StyleSheet.create({
  row:         { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  imgBox:      { width: 68, height: 68, borderRadius: 14, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  img:         { width: 66, height: 66, borderRadius: 13 },
  placeholder: { fontSize: 26 },
  info:        { flex: 1, gap: 5 },
  name:        { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 19 },
  badges:      { flexDirection: 'row', gap: 5, flexWrap: 'wrap', alignItems: 'center' },
  compBadge:   { borderRadius: DS.radiusBadge, paddingHorizontal: 7, paddingVertical: 2 },
  compText:    { fontSize: 10, fontWeight: '700' },
  estNote:     { fontSize: 9, color: DS.textMuted, fontStyle: 'italic' },
  price:       { fontSize: 15, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.4 },
  priceNA:     { fontSize: 11, color: DS.textMuted, fontStyle: 'italic' },
});

// ── Product stats row ─────────────────────────────────────────────────────────

function ProductStatsRow({ item }: { item: ProductDisplay }) {
  const { fmt } = useCurrency();
  const revenueDisplay = item.revenueUSD != null ? `${fmt(item.revenueUSD, 0)}/mo` : item.revenue;
  const isMockId = item.id === '1' || item.id === '2' || item.id === '3';
  return (
    <View style={psr.wrap}>
      <View style={psr.stat}>
        <Text style={psr.val}>{item.reviews !== 'N/A' ? item.reviews : 'Reviews unavailable'}</Text>
        <Text style={psr.lbl}>Reviews</Text>
      </View>
      <View style={psr.div} />
      <View style={psr.stat}>
        <Text style={psr.val}>{revenueDisplay}</Text>
        <Text style={psr.lbl}>Est. Revenue</Text>
      </View>
      {!isMockId && (
        <>
          <View style={psr.div} />
          <View style={psr.stat}>
            <Text style={psr.val} numberOfLines={1}>{item.id}</Text>
            <Text style={psr.lbl}>ASIN</Text>
          </View>
        </>
      )}
    </View>
  );
}
const psr = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 11 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  val:  { fontSize: 11, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  lbl:  { fontSize: 8, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  div:  { width: 1, height: 26, backgroundColor: DS.border },
});

// ── Ask AI Panel ──────────────────────────────────────────────────────────────

function AskAIPanel({
  question, answer, loading, error, onChangeQuestion, onSubmit,
}: {
  question: string;
  answer: string;
  loading: boolean;
  error: string;
  onChangeQuestion: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <AppCard padding={16} radius={18} style={aai.card}>
      <Text style={aai.eyebrow}>ASK AI ADVISOR</Text>
      <Text style={aai.title}>Ask anything about this product or market</Text>
      <View style={aai.inputRow}>
        <TextInput
          style={aai.input}
          placeholder="e.g. Is this product worth launching in 2026?"
          placeholderTextColor={DS.textMuted}
          value={question}
          onChangeText={onChangeQuestion}
          returnKeyType="send"
          onSubmitEditing={onSubmit}
          multiline={false}
        />
        <TouchableOpacity
          style={[aai.sendBtn, (!question.trim() || loading) && aai.sendBtnDisabled]}
          onPress={onSubmit}
          disabled={!question.trim() || loading}
          activeOpacity={0.8}
        >
          {loading
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={aai.sendTxt}>↑</Text>}
        </TouchableOpacity>
      </View>
      {!!error && <Text style={aai.error}>{error}</Text>}
      {!!answer && (
        <View style={aai.answerBox}>
          <Text style={aai.answerTxt}>{answer}</Text>
        </View>
      )}
    </AppCard>
  );
}
const aai = StyleSheet.create({
  card:             { gap: 10 },
  eyebrow:          { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  title:            { fontSize: 14, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.3 },
  inputRow:         { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input:            { flex: 1, backgroundColor: DS.bgSubtle, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: DS.textPrimary, borderWidth: 1, borderColor: DS.border },
  sendBtn:          { backgroundColor: DS.accent, borderRadius: 12, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:  { opacity: 0.4 },
  sendTxt:          { fontSize: 18, fontWeight: '700', color: '#fff' },
  error:            { fontSize: 12, color: DS.danger },
  answerBox:        { backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: DS.border },
  answerTxt:        { fontSize: 13, color: DS.textPrimary, lineHeight: 20 },
});

// ── Product card — Market mode ────────────────────────────────────────────────

function ProductMarketCard({
  item, onSelect, isSelected, onSaveForFeasibility, isFeasSaved,
  inCompare, canCompare, onToggleCompare, onAnalyze, analyzeLoading,
}: {
  item: ProductDisplay;
  onSelect: () => void;
  isSelected: boolean;
  onSaveForFeasibility?: () => void;
  isFeasSaved?: boolean;
  inCompare?: boolean;
  canCompare?: boolean;
  onToggleCompare?: () => void;
  onAnalyze?: () => void;
  analyzeLoading?: boolean;
}) {
  const { fmt } = useCurrency();
  const hasLink = !!item.url;

  const oppLabel = item.badge === 'Promising' ? 'LAUNCH' : item.badge === 'Saturated' ? 'AVOID' : 'TEST';
  const oppColor = item.badge === 'Promising' ? DS.successText : item.badge === 'Saturated' ? DS.dangerText : DS.warningText;
  const oppBg    = item.badge === 'Promising' ? DS.successBg   : item.badge === 'Saturated' ? DS.dangerBg  : DS.warningBg;
  const compColor = item.competition === 'Low' ? DS.successText : item.competition === 'High' ? DS.dangerText : DS.warningText;
  const compBg    = item.competition === 'Low' ? DS.successBg   : item.competition === 'High' ? DS.dangerBg  : DS.warningBg;

  return (
    <AppCard padding={14} radius={18} style={[pmc.card, isSelected && pmc.cardSelected]}>

      {/* ── Header ─── */}
      <View style={pmc.header}>
        <View style={pmc.imgBox}>
          {item.image
            ? <Image source={{ uri: item.image }} style={pmc.img} resizeMode="contain" />
            : <Text style={pmc.imgPlaceholder}>🛒</Text>}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={pmc.productName} numberOfLines={2}>{item.name}</Text>
          <View style={pmc.badgesRow}>
            <View style={[pmc.oppPill, { backgroundColor: oppBg }]}>
              <Text style={[pmc.oppTxt, { color: oppColor }]}>{oppLabel}</Text>
            </View>
            <View style={[pmc.compPill, { backgroundColor: compBg }]}>
              <Text style={[pmc.compTxt, { color: compColor }]}>{item.competition} Comp</Text>
            </View>
          </View>
        </View>
      </View>

      {/* ── Stats row ─── */}
      <View style={pmc.stats}>
        <View style={pmc.stat}>
          <Text style={[pmc.statVal, { color: DS.accent }]}>
            {item.price != null ? fmt(item.price) : '—'}
          </Text>
          <Text style={pmc.statLbl}>Price</Text>
        </View>
        <View style={pmc.div} />
        <View style={pmc.stat}>
          <Text style={pmc.statVal}>
            {item.rating != null ? `${item.rating.toFixed(1)} ★` : '—'}
          </Text>
          <Text style={pmc.statLbl}>Rating</Text>
        </View>
        <View style={pmc.div} />
        <View style={pmc.stat}>
          <Text style={pmc.statVal}>
            {item.reviewCount != null ? item.reviewCount.toLocaleString() : '—'}
          </Text>
          <Text style={pmc.statLbl}>Reviews</Text>
        </View>
        <View style={pmc.div} />
        <View style={pmc.stat}>
          <Text style={pmc.statVal}>
            {item.revenueUSD != null ? `${fmt(item.revenueUSD, 0)}/mo` : '—'}
          </Text>
          <Text style={pmc.statLbl}>Est. Rev.</Text>
        </View>
      </View>

      <SmartBadgeStrip badges={item.badges} finalScore={item.finalScore} />

      {/* ── Primary action ─── */}
      <TouchableOpacity
        style={[pmc.amazonBtn, !hasLink && pmc.amazonBtnDisabled]}
        onPress={() => openURL(item.url)}
        activeOpacity={hasLink ? 0.8 : 1}
        disabled={!hasLink}
      >
        <Text style={[pmc.amazonTxt, !hasLink && pmc.amazonTxtDisabled]}>
          {hasLink ? '↗  View on Amazon' : 'Link unavailable'}
        </Text>
      </TouchableOpacity>

      {/* ── Secondary actions ─── */}
      <View style={pmc.actionsRow}>
        <TouchableOpacity
          style={[pmc.actionBtn, pmc.analyzeBtn, analyzeLoading && { opacity: 0.6 }]}
          onPress={onAnalyze}
          activeOpacity={0.8}
          disabled={analyzeLoading || !onAnalyze}
        >
          <Text style={pmc.analyzeTxt}>{analyzeLoading ? '…' : '⊛  Analyse'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[pmc.actionBtn, inCompare ? pmc.compareActive : pmc.compareBtn]}
          onPress={canCompare ? onToggleCompare : undefined}
          activeOpacity={canCompare ? 0.8 : 1}
          disabled={!canCompare}
        >
          <Text style={[pmc.compareTxt, inCompare && pmc.compareTxtActive]}>
            {inCompare ? '✓  Added' : '⊞  Compare'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[pmc.actionBtn, isSelected ? pmc.selectedBtn : pmc.selectBtn]}
          onPress={onSelect}
          activeOpacity={0.8}
        >
          <Text style={[pmc.selectTxt, isSelected && pmc.selectedTxt]}>
            {isSelected ? '★  Selected' : '☆  Select'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Feasibility ─── */}
      {hasLink && onSaveForFeasibility && (
        <TouchableOpacity
          style={[pmc.feasBtn, isFeasSaved && pmc.feasBtnSaved]}
          onPress={onSaveForFeasibility}
          activeOpacity={0.8}
        >
          <Text style={[pmc.feasTxt, isFeasSaved && pmc.feasTxtSaved]}>
            {isFeasSaved ? '✕  Remove from Feasibility Check' : '⊛  Save for Feasibility Check'}
          </Text>
        </TouchableOpacity>
      )}
    </AppCard>
  );
}

const pmc = StyleSheet.create({
  card:             { gap: 12 },
  cardSelected:     { borderWidth: 2, borderColor: DS.accent },
  // Header
  header:           { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  imgBox:           { width: 52, height: 52, borderRadius: 12, backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  img:              { width: 50, height: 50, borderRadius: 11 },
  imgPlaceholder:   { fontSize: 22 },
  productName:      { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 18 },
  badgesRow:        { flexDirection: 'row', gap: 5, flexWrap: 'wrap' },
  oppPill:          { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  oppTxt:           { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  compPill:         { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  compTxt:          { fontSize: 10, fontWeight: '700' },
  // Stats
  stats:            { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, paddingVertical: 10 },
  stat:             { flex: 1, alignItems: 'center', gap: 2 },
  div:              { width: 1, height: 28, backgroundColor: DS.border },
  statVal:          { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  statLbl:          { fontSize: 9, color: DS.textMuted, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  // Primary button
  amazonBtn:        { backgroundColor: '#FF9900', borderRadius: 12, paddingVertical: 10, alignItems: 'center' as const },
  amazonBtnDisabled:{ backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  amazonTxt:        { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  amazonTxtDisabled:{ color: DS.textMuted },
  // Actions row
  actionsRow:       { flexDirection: 'row', gap: 6 },
  actionBtn:        { flex: 1, borderRadius: 10, paddingVertical: 9, alignItems: 'center' as const },
  analyzeBtn:       { backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigo + '44' },
  analyzeTxt:       { fontSize: 12, fontWeight: '700', color: DS.indigo },
  compareBtn:       { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  compareActive:    { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  compareTxt:       { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  compareTxtActive: { color: DS.accent },
  selectBtn:        { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  selectedBtn:      { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  selectTxt:        { fontSize: 12, fontWeight: '700', color: DS.textSecondary },
  selectedTxt:      { color: DS.accent },
  // Feasibility
  feasBtn:          { borderRadius: 10, paddingVertical: 7, alignItems: 'center' as const, backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigo + '44' },
  feasBtnSaved:     { backgroundColor: DS.bgSubtle, borderColor: DS.border },
  feasTxt:          { fontSize: 11, fontWeight: '700' as const, color: DS.indigo },
  feasTxtSaved:     { color: DS.textMuted },
});

// ── Product card — Lookup mode (full actions) ─────────────────────────────────

interface ProductLookupCardProps {
  item:                     ProductDisplay;
  inCompare:                boolean;
  isSaved:                  boolean;
  analyzeLoading:           boolean;
  canCompare:               boolean;
  onViewAmazon:             () => void;
  onAnalyze:                () => void;
  onToggleCompare:          () => void;
  onSave:                   () => void;
  onSelect:                 () => void;
  isSelected:               boolean;
  onSaveForFeasibility?:    () => void;
  isFeasSaved?:             boolean;
  onAnalyzeOpportunity?:    () => void;
  opportunityLoading?:      boolean;
}

function ProductLookupCard({
  item, inCompare, isSaved, analyzeLoading, canCompare,
  onViewAmazon, onAnalyze, onToggleCompare, onSave, onSelect, isSelected,
  onSaveForFeasibility, isFeasSaved, onAnalyzeOpportunity, opportunityLoading,
}: ProductLookupCardProps) {
  const hasLink = !!item.url;
  return (
    <AppCard
      padding={14}
      radius={18}
      style={[plc.card, isSelected && plc.cardSelected]}
    >
      <ProductTopRow item={item} />
      <ProductStatsRow item={item} />
      <SmartBadgeStrip badges={item.badges} finalScore={item.finalScore} />

      {/* Primary action */}
      <TouchableOpacity
        style={[plc.amazonBtn, !hasLink && plc.disabledBtn]}
        onPress={onViewAmazon}
        activeOpacity={hasLink ? 0.8 : 1}
        disabled={!hasLink}
      >
        <Text style={[plc.amazonTxt, !hasLink && plc.disabledTxt]}>
          {hasLink ? '↗  View on Amazon' : 'Link unavailable'}
        </Text>
      </TouchableOpacity>

      {/* Secondary actions row */}
      <View style={plc.actionsRow}>
        <TouchableOpacity
          style={[plc.actionBtn, plc.analyzeBtn, analyzeLoading && { opacity: 0.6 }]}
          onPress={onAnalyze}
          activeOpacity={0.8}
          disabled={analyzeLoading}
        >
          <Text style={plc.analyzeTxt}>{analyzeLoading ? '…' : '⊛  Analyze'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[plc.actionBtn, !canCompare ? plc.compareDisabled : inCompare ? plc.compareActive : plc.compareBtn]}
          onPress={canCompare ? onToggleCompare : undefined}
          activeOpacity={canCompare ? 0.8 : 1}
          disabled={!canCompare}
        >
          <Text style={[plc.compareTxt, !canCompare && plc.compareTxtDisabled, canCompare && inCompare && plc.compareTxtActive]}>
            {!canCompare ? '⊞ No data' : inCompare ? '✓  Added' : '⊞  Compare'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[plc.actionBtn, isSaved ? plc.savedBtn : plc.saveBtn]}
          onPress={onSave}
          activeOpacity={0.8}
        >
          <Text style={[plc.saveTxt, isSaved && plc.savedTxt]}>
            {isSaved ? '✕ Unsave' : '✦ Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Select as context */}
      <TouchableOpacity
        style={[plc.selectBtn, isSelected && plc.selectBtnActive]}
        onPress={onSelect}
        activeOpacity={0.8}
      >
        <Text style={[plc.selectTxt, isSelected && plc.selectTxtActive]}>
          {isSelected ? '★  Selected as context' : '☆  Select for suppliers & Co-Pilot'}
        </Text>
      </TouchableOpacity>

      {!!item.url && onSaveForFeasibility && (
        <TouchableOpacity
          style={[plc.feasBtn, isFeasSaved && plc.feasBtnSaved]}
          onPress={onSaveForFeasibility}
          activeOpacity={0.8}
        >
          <Text style={[plc.feasTxt, isFeasSaved && plc.feasTxtSaved]}>
            {isFeasSaved ? '✕  Remove from Feasibility Check' : '⊛  Save for Feasibility Check'}
          </Text>
        </TouchableOpacity>
      )}

      {onAnalyzeOpportunity && (
        <TouchableOpacity
          style={[plc.opportunityBtn, opportunityLoading && { opacity: 0.6 }]}
          onPress={onAnalyzeOpportunity}
          activeOpacity={0.8}
          disabled={opportunityLoading}
        >
          <Text style={plc.opportunityTxt}>
            {opportunityLoading ? '◎  Analyzing reviews...' : '◎  Find Improvement Opportunities'}
          </Text>
        </TouchableOpacity>
      )}
    </AppCard>
  );
}
const plc = StyleSheet.create({
  card:            { gap: 10 },
  cardSelected:    { borderWidth: 2, borderColor: DS.accent },
  amazonBtn:       { backgroundColor: '#FF9900', borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  disabledBtn:     { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  amazonTxt:       { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  disabledTxt:     { color: DS.textMuted },
  actionsRow:      { flexDirection: 'row', gap: 7 },
  actionBtn:       { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  analyzeBtn:      { backgroundColor: DS.indigoLight },
  analyzeTxt:      { fontSize: 11, fontWeight: '700', color: DS.indigo },
  compareBtn:       { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  compareActive:    { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  compareDisabled:  { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.borderLight, opacity: 0.5 },
  compareTxt:       { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  compareTxtActive: { color: DS.accent },
  compareTxtDisabled:{ color: DS.textMuted },
  saveBtn:         { backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigoLight },
  savedBtn:        { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  saveTxt:         { fontSize: 11, fontWeight: '700', color: DS.indigo },
  savedTxt:        { color: DS.accent },
  selectBtn:       { backgroundColor: DS.bgSubtle, borderRadius: 10, paddingVertical: 7, alignItems: 'center', borderWidth: 1, borderColor: DS.border },
  selectBtnActive: { backgroundColor: DS.accentLight, borderColor: DS.accent },
  selectTxt:       { fontSize: 11, fontWeight: '600', color: DS.textMuted },
  selectTxtActive: { color: DS.accent, fontWeight: '700' },
  feasBtn:         { borderRadius: 10, paddingVertical: 7, alignItems: 'center' as const, backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigo + '44' },
  feasBtnSaved:    { backgroundColor: DS.bgSubtle, borderColor: DS.border },
  feasTxt:         { fontSize: 11, fontWeight: '700' as const, color: DS.indigo },
  feasTxtSaved:    { color: DS.textMuted },
  opportunityBtn:  { borderRadius: 12, paddingVertical: 11, alignItems: 'center' as const, backgroundColor: DS.accent, marginTop: 2 },
  opportunityTxt:  { fontSize: 13, fontWeight: '800' as const, color: '#fff', letterSpacing: -0.2 },
});

// ── Selected product banner ───────────────────────────────────────────────────

function SelectedProductBanner({
  product, onFindSuppliers, onAskCoPilot, onClear,
}: {
  product: ProductDisplay;
  onFindSuppliers: () => void;
  onAskCoPilot: () => void;
  onClear: () => void;
}) {
  const { fmt } = useCurrency();
  return (
    <AppCard style={spb.card}>
      <View style={spb.header}>
        <View style={spb.dot} />
        <Text style={spb.eyebrow}>SELECTED PRODUCT</Text>
        <TouchableOpacity onPress={onClear} style={spb.clearBtn} activeOpacity={0.7}>
          <Text style={spb.clearTxt}>✕</Text>
        </TouchableOpacity>
      </View>
      <Text style={spb.name} numberOfLines={2}>{product.name}</Text>
      <View style={spb.meta}>
        {product.price != null && <Text style={spb.price}>{fmt(product.price)}</Text>}
        {product.rating != null && <StarRating rating={product.rating} />}
        <Text style={spb.reviews}>{product.reviews}</Text>
      </View>
      <View style={spb.actions}>
        <TouchableOpacity style={spb.suppBtn} onPress={onFindSuppliers} activeOpacity={0.8}>
          <Text style={spb.suppTxt}>🏭  Find Suppliers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={spb.pilotBtn} onPress={onAskCoPilot} activeOpacity={0.8}>
          <Text style={spb.pilotTxt}>⊛  Ask Co-Pilot</Text>
        </TouchableOpacity>
      </View>
    </AppCard>
  );
}
const spb = StyleSheet.create({
  card:     { gap: 8, borderWidth: 1.5, borderColor: DS.accent },
  header:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:      { width: 8, height: 8, borderRadius: 4, backgroundColor: DS.accent },
  eyebrow:  { fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  clearBtn: { marginLeft: 'auto' },
  clearTxt: { fontSize: 14, color: DS.textMuted },
  name:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 18 },
  meta:     { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  price:    { fontSize: 14, fontWeight: '900', color: DS.textPrimary },
  reviews:  { fontSize: 11, color: DS.textMuted, fontWeight: '500' },
  actions:  { flexDirection: 'row', gap: 8 },
  suppBtn:  { flex: 1, backgroundColor: DS.accentLight, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  suppTxt:  { fontSize: 12, fontWeight: '700', color: DS.accentDark },
  pilotBtn: { flex: 1, backgroundColor: DS.indigoLight, borderRadius: 10, paddingVertical: 9, alignItems: 'center' },
  pilotTxt: { fontSize: 12, fontWeight: '700', color: DS.indigo },
});

// ── Platform colors ───────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, { bg: string; color: string }> = {
  'Alibaba':               { bg: '#FFF4E0', color: '#E8720C' },
  'AliExpress Wholesale':  { bg: '#FFF0ED', color: '#E62335' },
  'DHgate':                { bg: DS.infoBg,     color: DS.info   },
  'Made-in-China':         { bg: '#F0FDF4',     color: '#16A34A' },
  'Global Sources':        { bg: DS.indigoLight, color: DS.indigo },
  '1688 (Domestic China)': { bg: '#FFF7ED', color: '#D97706' },
  '1688':                  { bg: '#FFF7ED', color: '#D97706' },
};

// ── Supplier card ─────────────────────────────────────────────────────────────

interface SupplierCardProps {
  item:                  SupplierDisplay;
  inCompare:             boolean;
  analyzeLoading:        boolean;
  outreachLoading:       boolean;
  onView:                () => void;
  onAnalyze:             () => void;
  onToggleCompare:       () => void;
  onOutreach:            () => void;
  onAttachFeasibility?:  () => void;
  isFeasAttached?:       boolean;
}

function SupplierCard({
  item, inCompare, analyzeLoading, outreachLoading,
  onView, onAnalyze, onToggleCompare, onOutreach, onAttachFeasibility, isFeasAttached,
}: SupplierCardProps) {
  const { fmt } = useCurrency();
  const hasLink      = !!item.url;
  const isGold       = item.badge === 'Gold Supplier';
  const priceDisplay = item.priceUSD != null ? `${fmt(item.priceUSD)}/unit` : item.price;
  const pStyle       = PLATFORM_COLORS[item.platform] ?? { bg: DS.bgSubtle, color: DS.textSecondary };

  return (
    <AppCard padding={14} radius={18} style={sc.card}>
      {/* Header */}
      <View style={sc.header}>
        <View style={sc.nameLine}>
          <Text style={sc.country}>{item.country}</Text>
          <View style={{ flex: 1 }}>
            <Text style={sc.name} numberOfLines={1}>{item.name}</Text>
            <View style={[sc.platBadge, { backgroundColor: pStyle.bg }]}>
              <Text style={[sc.platText, { color: pStyle.color }]}>{item.platform}</Text>
            </View>
          </View>
        </View>
        <View style={[sc.trustBadge, isGold ? sc.trustGold : sc.trustVerified]}>
          <Text style={[sc.trustText, isGold ? sc.trustTextGold : sc.trustTextVerified]}>
            {isGold ? '★ Gold' : '✓ Verified'}
          </Text>
        </View>
      </View>

      {/* Stats */}
      {item.wideRange && (
        <View style={sc.rangeNote}>
          <Text style={sc.rangeNoteTxt}>⚠ Wide price range — using high estimate for safer calculations</Text>
        </View>
      )}
      <View style={sc.stats}>
        <View style={sc.stat}>
          <Text style={[sc.statVal, { color: DS.accent }]}>{priceDisplay}</Text>
          <Text style={sc.statLbl}>{item.wideRange ? 'Price (range)' : 'Unit Price'}</Text>
        </View>
        <View style={sc.div} />
        <View style={sc.stat}>
          <Text style={sc.statVal}>{item.moq}</Text>
          <Text style={sc.statLbl}>Min. Order</Text>
        </View>
        <View style={sc.div} />
        <View style={sc.stat}>
          <Text style={[sc.statVal, { color: DS.info }]}>{item.trust.toFixed(1)}</Text>
          <Text style={sc.statLbl}>Score (est.)</Text>
        </View>
      </View>

      <SmartBadgeStrip badges={item.badges} finalScore={item.finalScore} />

      {/* Primary action */}
      <TouchableOpacity
        style={[sc.viewBtn, !hasLink && sc.disabledBtn]}
        onPress={onView}
        activeOpacity={hasLink ? 0.8 : 1}
        disabled={!hasLink}
      >
        <Text style={[sc.viewTxt, !hasLink && sc.disabledTxt]}>
          {hasLink ? `↗  View on ${item.platform}` : 'Link unavailable'}
        </Text>
      </TouchableOpacity>

      {/* Secondary actions */}
      <View style={sc.actionsRow}>
        <TouchableOpacity
          style={[sc.actionBtn, sc.analyzeBtn, analyzeLoading && { opacity: 0.6 }]}
          onPress={onAnalyze}
          activeOpacity={0.8}
          disabled={analyzeLoading}
        >
          <Text style={sc.analyzeTxt}>{analyzeLoading ? '…' : '⊛  Analyze'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sc.actionBtn, inCompare ? sc.compareActive : sc.compareBtn]}
          onPress={onToggleCompare}
          activeOpacity={0.8}
        >
          <Text style={[sc.compareTxt, inCompare && sc.compareTxtActive]}>
            {inCompare ? '✓  Added' : '⊞  Compare'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[sc.actionBtn, sc.outreachBtn, outreachLoading && { opacity: 0.6 }]}
          onPress={onOutreach}
          activeOpacity={0.8}
          disabled={outreachLoading}
        >
          <Text style={sc.outreachTxt}>{outreachLoading ? '…' : '✉  Email'}</Text>
        </TouchableOpacity>
      </View>

      {onAttachFeasibility && (
        <TouchableOpacity
          style={[sc.feasBtn, isFeasAttached && sc.feasBtnSaved]}
          onPress={onAttachFeasibility}
          activeOpacity={0.8}
        >
          <Text style={[sc.feasTxt, isFeasAttached && sc.feasTxtSaved]}>
            {isFeasAttached ? '✕  Remove from Feasibility Check' : '⊛  Attach to Feasibility Check'}
          </Text>
        </TouchableOpacity>
      )}
    </AppCard>
  );
}
const sc = StyleSheet.create({
  card:             { gap: 12 },
  rangeNote:        { backgroundColor: '#FFFBEB', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#FDE68A' },
  rangeNoteTxt:     { fontSize: 11, color: '#92400E', lineHeight: 16 },
  header:           { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  nameLine:         { flexDirection: 'row', alignItems: 'flex-start', gap: 8, flex: 1 },
  country:          { fontSize: 22, marginTop: 2 },
  name:             { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2, lineHeight: 18 },
  platBadge:        { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start', marginTop: 3 },
  platText:         { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
  trustBadge:       { borderRadius: DS.radiusBadge, paddingHorizontal: 9, paddingVertical: 4, flexShrink: 0 },
  trustGold:        { backgroundColor: DS.goldLight },
  trustVerified:    { backgroundColor: DS.accentLight },
  trustText:        { fontSize: 11, fontWeight: '800' },
  trustTextGold:    { color: DS.gold },
  trustTextVerified:{ color: DS.accentDark },
  stats:            { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 11 },
  stat:             { flex: 1, alignItems: 'center', gap: 3 },
  statVal:          { fontSize: 12, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  statLbl:          { fontSize: 8, fontWeight: '600', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4, textAlign: 'center' },
  div:              { width: 1, height: 26, backgroundColor: DS.border },
  viewBtn:          { backgroundColor: DS.info, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  disabledBtn:      { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  viewTxt:          { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
  disabledTxt:      { color: DS.textMuted },
  actionsRow:       { flexDirection: 'row', gap: 7 },
  actionBtn:        { flex: 1, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  analyzeBtn:       { backgroundColor: DS.indigoLight },
  analyzeTxt:       { fontSize: 11, fontWeight: '700', color: DS.indigo },
  compareBtn:       { backgroundColor: DS.bgSubtle, borderWidth: 1, borderColor: DS.border },
  compareActive:    { backgroundColor: DS.accentLight, borderWidth: 1, borderColor: DS.accent },
  compareTxt:       { fontSize: 11, fontWeight: '700', color: DS.textSecondary },
  compareTxtActive: { color: DS.accent },
  outreachBtn:      { backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigoLight },
  outreachTxt:      { fontSize: 11, fontWeight: '700', color: DS.indigo },
  feasBtn:          { borderRadius: 10, paddingVertical: 7, alignItems: 'center' as const, backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.indigo + '44' },
  feasBtnSaved:     { backgroundColor: DS.bgSubtle, borderColor: DS.border },
  feasTxt:          { fontSize: 11, fontWeight: '700' as const, color: DS.indigo },
  feasTxtSaved:     { color: DS.textMuted },
});

// ── Analyze Product modal ─────────────────────────────────────────────────────

function AnalyzeProductModal({
  visible, loading, result, error, onClose,
}: {
  visible: boolean;
  loading: boolean;
  result: AnalyzeProductResult | null;
  error: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Product Analysis</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={am.content} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={am.center}>
              <ActivityIndicator size="large" color={DS.accent} />
              <Text style={am.loadTxt}>Analyzing product...</Text>
            </View>
          )}
          {error !== '' && !loading && (
            <View style={am.errBox}><Text style={am.errTxt}>{error}</Text></View>
          )}
          {result && !loading && (
            <>
              <View style={am.disclaimer}>
                <Text style={am.disclaimerText}>⚠️ Based on estimated data. Verify before ordering.</Text>
              </View>
              <View style={am.section}>
                <Text style={am.sectionTitle}>Verdict</Text>
                <Text style={am.bullet}>{result.verdict} · {result.confidence}% confidence</Text>
              </View>
              <View style={am.section}>
                <Text style={am.sectionTitle}>Summary</Text>
                <Text style={am.bullet}>{result.summary}</Text>
              </View>
              {result.reasons.length > 0 && (
                <View style={am.section}>
                  <Text style={am.sectionTitle}>Key Reasons</Text>
                  {result.reasons.map((r, i) => <Text key={i} style={am.bullet}>· {r}</Text>)}
                </View>
              )}
              <View style={am.section}>
                <Text style={am.sectionTitle}>Risk</Text>
                <Text style={am.bullet}>{result.risk}</Text>
              </View>
              <View style={am.section}>
                <Text style={am.sectionTitle}>Next Step</Text>
                <Text style={am.bullet}>{result.next_step}</Text>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const am = StyleSheet.create({
  sheet:       { flex: 1, backgroundColor: DS.bgCanvas },
  toolbar:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  title:       { fontSize: 17, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4 },
  closeBtn:    { paddingHorizontal: 14, paddingVertical: 6, backgroundColor: DS.bgSubtle, borderRadius: 20 },
  closeTxt:    { fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  content:     { paddingHorizontal: 20, paddingBottom: 60, gap: 16 },
  center:      { alignItems: 'center', paddingVertical: 60, gap: 12 },
  loadTxt:     { fontSize: 13, color: DS.textMuted, fontWeight: '600' },
  errBox:       { backgroundColor: DS.dangerBg, borderRadius: 14, padding: 16 },
  errTxt:       { fontSize: 13, color: DS.dangerText, textAlign: 'center' },
  section:      { backgroundColor: DS.bgCard, borderRadius: 16, padding: 16, gap: 10, borderWidth: 1, borderColor: DS.border },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2 },
  bullet:       { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  disclaimer:   { backgroundColor: '#FFFBEB', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#FDE68A' },
  disclaimerText:{ fontSize: 11, color: '#92400E' },
});

// ── Analyze Supplier modal ────────────────────────────────────────────────────

function AnalyzeSupplierModal({
  visible, loading, result, error, onClose,
}: {
  visible: boolean;
  loading: boolean;
  result: AnalyzeSupplierResult | null;
  error: string;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Supplier Analysis</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={am.content} showsVerticalScrollIndicator={false}>
          {loading && (
            <View style={am.center}>
              <ActivityIndicator size="large" color={DS.accent} />
              <Text style={am.loadTxt}>Scoring supplier...</Text>
            </View>
          )}
          {error !== '' && !loading && (
            <View style={am.errBox}><Text style={am.errTxt}>{error}</Text></View>
          )}
          {result && !loading && (
            <>
              <View style={supm.scoreBox}>
                <Text style={supm.score}>{result.total_score.toFixed(1)}/100</Text>
                <Text style={supm.grade}>{result.grade}</Text>
                <Text style={supm.conf}>{result.confidence_label}</Text>
              </View>
              {result.strengths.length > 0 && (
                <View style={am.section}>
                  <Text style={am.sectionTitle}>Strengths</Text>
                  {result.strengths.map((s, i) => <Text key={i} style={supm.green}>✓ {s}</Text>)}
                </View>
              )}
              {result.risk_flags.length > 0 && (
                <View style={am.section}>
                  <Text style={am.sectionTitle}>Risk Flags</Text>
                  {result.risk_flags.map((r, i) => <Text key={i} style={supm.red}>⚠ {r}</Text>)}
                </View>
              )}
              <View style={am.section}>
                <Text style={am.sectionTitle}>Recommendation</Text>
                <Text style={am.bullet}>{result.recommendation}</Text>
              </View>
              <View style={am.section}>
                <Text style={am.sectionTitle}>Negotiation Strategy</Text>
                <Text style={am.bullet}>Open with: {result.negotiation_strategy.opening_offer}</Text>
                <Text style={am.bullet}>Target price: {result.negotiation_strategy.target_price}</Text>
                <Text style={am.bullet}>MOQ ask: {result.negotiation_strategy.moq_ask}</Text>
                {result.negotiation_strategy.leverage_points.map((lp, i) => (
                  <Text key={i} style={am.bullet}>· {lp}</Text>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
const supm = StyleSheet.create({
  scoreBox: { backgroundColor: DS.indigoLight, borderRadius: 18, padding: 20, alignItems: 'center', gap: 4 },
  score:    { fontSize: 32, fontWeight: '900', color: DS.indigo, letterSpacing: -1 },
  grade:    { fontSize: 18, fontWeight: '800', color: DS.textPrimary },
  conf:     { fontSize: 12, color: DS.textSecondary, fontWeight: '500' },
  green:    { fontSize: 13, color: DS.accentDark, lineHeight: 20 },
  red:      { fontSize: 13, color: DS.dangerText, lineHeight: 20 },
});

// ── Compare helpers ───────────────────────────────────────────────────────────

function scoreProductForCompare(p: ProductDisplay): number {
  let s = (p.revenueUSD ?? 0) * 0.01;
  s += p.competition === 'Low' ? 30 : p.competition === 'Medium' ? 15 : 0;
  s += p.badge === 'Promising' ? 20 : p.badge === 'Moderate' ? 10 : 0;
  s += (p.rating ?? 0) * 4;
  return s;
}

function buildProductReasons(w: ProductDisplay, all: ProductDisplay[]): string[] {
  const r: string[] = [];
  if (all.every(p => (p.revenueUSD ?? 0) <= (w.revenueUSD ?? 0)) && w.revenueUSD)
    r.push(`Highest estimated revenue — ${w.revenue}`);
  if (w.competition === 'Low') r.push('Low competition — easier to rank and win the buy box');
  if (w.badge === 'Promising') r.push('Promising opportunity with strong market demand signal');
  if (w.rating != null && all.every(p => (p.rating ?? 0) <= (w.rating ?? 0)))
    r.push(`Top-rated product — ${w.rating.toFixed(1)} ★ customer satisfaction`);
  if (r.length < 2) r.push('Best combined score across all opportunity metrics');
  return r.slice(0, 4);
}

function scoreSupplierForCompare(s: SupplierDisplay): number {
  return (s.trust * 10)
    + (s.priceUSD != null ? Math.max(0, 10 - s.priceUSD) * 8 : 0)
    + Math.max(0, 500 - s.moqNum) * 0.02;
}

function buildSupplierReasons(w: SupplierDisplay, all: SupplierDisplay[]): string[] {
  const r: string[] = [];
  if (all.every(s => s.trust <= w.trust)) r.push(`Highest trust score — ${w.trust}/10`);
  if (all.every(s => (s.priceUSD ?? 999) >= (w.priceUSD ?? 999)) && w.priceUSD)
    r.push(`Lowest unit price — ${w.price}`);
  if (all.every(s => s.moqNum >= w.moqNum)) r.push(`Lowest minimum order — ${w.moq}`);
  if (r.length < 2) r.push('Best overall score across all sourcing metrics');
  return r.slice(0, 3);
}

type HL = 'best' | 'worst' | 'neutral';

function numHL(vals: (number | null)[], higher: boolean): HL[] {
  const ns = vals.filter((v): v is number => v != null);
  if (ns.length < 2) return vals.map(() => 'neutral');
  const b = higher ? Math.max(...ns) : Math.min(...ns);
  const w = higher ? Math.min(...ns) : Math.max(...ns);
  return vals.map(v =>
    v == null ? 'neutral' : v === b && b !== w ? 'best' : v === w && b !== w ? 'worst' : 'neutral');
}

function hlBg(h: HL): string {
  return h === 'best' ? DS.accentLight : h === 'worst' ? DS.dangerBg : 'transparent';
}
function hlTxt(h: HL): string {
  return h === 'best' ? DS.accentDark : h === 'worst' ? DS.dangerText : DS.textPrimary;
}

const CMP_LABEL_W = 90;
const CMP_CELL_W  = 110;

// ── Premium Compare products modal ───────────────────────────────────────────

function CompareProductsModal({
  visible, items, onClose, onSaveWinner,
}: {
  visible:       boolean;
  items:         ProductDisplay[];
  onClose:       () => void;
  onSaveWinner?: (item: ProductDisplay) => void;
}) {
  const { fmt } = useCurrency();
  const scores  = items.length > 0 ? items.map(scoreProductForCompare) : [];
  const autoIdx = scores.length > 0 ? scores.indexOf(Math.max(...scores)) : 0;
  const [selectedIdx, setSelectedIdx] = useState(autoIdx);

  // Keep selectedIdx in bounds if items change while modal is open
  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1));

  if (items.length === 0) return null;

  const winner  = items[safeIdx];
  const second  = [...scores].sort((a, b) => b - a)[1] ?? 0;
  const rawConf = scores[safeIdx] > 0 ? ((scores[safeIdx] - second) / scores[safeIdx]) * 100 : 50;
  const conf    = Math.round(Math.min(97, Math.max(54, 65 + rawConf * 0.3)));
  const reasons = buildProductReasons(winner, items);
  const vLabel  = winner.badge === 'Promising' ? 'LAUNCH' : winner.badge === 'Saturated' ? 'AVOID' : 'TEST';
  const vColor  = winner.badge === 'Promising' ? DS.successText : winner.badge === 'Saturated' ? DS.dangerText : DS.warningText;
  const vBg     = winner.badge === 'Promising' ? DS.successBg   : winner.badge === 'Saturated' ? DS.dangerBg  : DS.warningBg;

  const priceHL   = numHL(items.map(p => p.price), false);
  const ratingHL  = numHL(items.map(p => p.rating), true);
  const reviewHL  = numHL(items.map(p => p.reviewCount), true);
  const revenueHL = numHL(items.map(p => p.revenueUSD), true);
  const compHL: HL[]  = items.map(p => p.competition === 'Low' ? 'best' : p.competition === 'High' ? 'worst' : 'neutral');
  const badgeHL: HL[] = items.map(p => p.badge === 'Promising' ? 'best' : p.badge === 'Saturated' ? 'worst' : 'neutral');

  const sections = [
    {
      title: 'MARKET METRICS',
      rows: [
        { label: 'Price',        vals: items.map(p => p.price != null ? fmt(p.price) : '—'),                              hls: priceHL   },
        { label: 'Rating',       vals: items.map(p => p.rating != null ? `${p.rating.toFixed(1)} ★` : '—'),               hls: ratingHL  },
        { label: 'Reviews',      vals: items.map(p => p.reviewCount != null ? p.reviewCount.toLocaleString() : '—'),       hls: reviewHL  },
        { label: 'Est. Revenue', vals: items.map(p => p.revenueUSD != null ? `${fmt(p.revenueUSD, 0)}/mo` : '—'),         hls: revenueHL },
      ],
    },
    {
      title: 'OPPORTUNITY METRICS',
      rows: [
        { label: 'Competition', vals: items.map(p => p.competition), hls: compHL  },
        { label: 'Opportunity', vals: items.map(p => p.badge),       hls: badgeHL },
      ],
    },
  ];

  const tableW = CMP_LABEL_W + CMP_CELL_W * items.length;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Product Comparison</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={prm.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={prm.hero}>
            <View style={prm.heroBall1} />
            <View style={prm.heroBall2} />
            <Text style={prm.heroEye}>AI COMPARISON ENGINE</Text>
            <Text style={prm.heroH}>Product Comparison</Text>
            <Text style={prm.heroSub}>Side-by-side analysis of your selected opportunities</Text>
            <View style={prm.heroChip}>
              <Text style={prm.heroChipTxt}>{items.length} Products Selected</Text>
            </View>
          </View>

          {/* ── AI Recommendation ─────────────────────────────────── */}
          <View style={prm.recCard}>
            <View style={prm.recTopRow}>
              <View style={prm.crownWrap}>
                <Text style={prm.crownIcon}>{safeIdx === autoIdx ? '🏆' : '✦'}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={prm.recEye}>{safeIdx === autoIdx ? 'AI RECOMMENDED' : 'YOUR SELECTION'}</Text>
                <Text style={prm.recName} numberOfLines={2}>{winner.name}</Text>
              </View>
              <View style={[prm.vPill, { backgroundColor: vBg }]}>
                <Text style={[prm.vTxt, { color: vColor }]}>{vLabel}</Text>
              </View>
            </View>

            <View style={prm.confWrap}>
              <View style={prm.confBg}>
                <View style={[prm.confFill, { width: `${conf}%` as any }]} />
              </View>
              <Text style={prm.confTxt}>{conf}% confidence</Text>
            </View>

            {reasons.map((r, i) => (
              <View key={i} style={prm.reason}>
                <Text style={prm.reasonDot}>✦</Text>
                <Text style={prm.reasonTxt}>{r}</Text>
              </View>
            ))}

            {onSaveWinner && (
              <TouchableOpacity style={prm.saveWinBtn} onPress={() => onSaveWinner(winner)} activeOpacity={0.8}>
                <Text style={prm.saveWinTxt}>✦  Save to Vault</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── Column headers ────────────────────────────────────── */}
          <AppCard padding={14} radius={18}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={prm.secEye}>PRODUCTS COMPARED</Text>
              <Text style={prm.tapHint}>Tap to select</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {items.map((p, i) => {
                  const isSel  = i === safeIdx;
                  const isAuto = i === autoIdx;
                  const bLabel = p.badge === 'Promising' ? 'LAUNCH' : p.badge === 'Saturated' ? 'AVOID' : 'TEST';
                  const bColor = p.badge === 'Promising' ? DS.successText : p.badge === 'Saturated' ? DS.dangerText : DS.warningText;
                  const bBg    = p.badge === 'Promising' ? DS.successBg   : p.badge === 'Saturated' ? DS.dangerBg  : DS.warningBg;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[prm.colCard, isSel && prm.colCardWin]}
                      onPress={() => setSelectedIdx(i)}
                      activeOpacity={0.75}
                    >
                      {p.image ? (
                        <Image source={{ uri: p.image }} style={prm.colImg} />
                      ) : (
                        <View style={prm.colImgFallback}>
                          <Text style={prm.colImgIcon}>◎</Text>
                        </View>
                      )}
                      <Text style={prm.colTitle} numberOfLines={2}>{p.name}</Text>
                      <View style={prm.colFooter}>
                        <View style={[prm.colBadge, { backgroundColor: bBg }]}>
                          <Text style={[prm.colBadgeTxt, { color: bColor }]}>{bLabel}</Text>
                        </View>
                        {isSel  && <Text style={prm.winTag}>SELECTED</Text>}
                        {!isSel && isAuto && <Text style={prm.aiTag}>AI PICK</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </AppCard>

          {/* ── Metric sections ───────────────────────────────────── */}
          {sections.map(sec => (
            <AppCard key={sec.title} padding={14} radius={18} style={{ gap: 0 }}>
              <Text style={prm.secEye}>{sec.title}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
                <View style={{ width: tableW }}>
                  {sec.rows.map((row, ri) => (
                    <View key={row.label} style={[prm.mRow, ri % 2 === 0 && prm.mRowAlt]}>
                      <View style={[prm.mLabel, { width: CMP_LABEL_W }]}>
                        <Text style={prm.mLabelTxt}>{row.label}</Text>
                      </View>
                      {row.vals.map((v, vi) => (
                        <View
                          key={vi}
                          style={[prm.mCell, { width: CMP_CELL_W, backgroundColor: hlBg(row.hls[vi]) }]}
                        >
                          <Text style={[prm.mCellTxt, { color: hlTxt(row.hls[vi]) }]} numberOfLines={1}>{v}</Text>
                          {row.hls[vi] === 'best' && <Text style={prm.trophy}>🏆</Text>}
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            </AppCard>
          ))}

          {/* ── Action bar ────────────────────────────────────────── */}
          <View style={prm.actions}>
            {onSaveWinner && (
              <TouchableOpacity
                style={prm.actionPrimary}
                onPress={() => { onSaveWinner(winner); onClose(); }}
                activeOpacity={0.85}
              >
                <Text style={prm.actionPrimaryTxt}>✦  Save Winner</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={prm.actionGhost} onPress={onClose} activeOpacity={0.8}>
              <Text style={prm.actionGhostTxt}>Close Comparison</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Premium Compare suppliers modal ──────────────────────────────────────────

function CompareSuppliersModal({
  visible, items, onClose,
}: {
  visible: boolean;
  items:   SupplierDisplay[];
  onClose: () => void;
}) {
  const { fmt } = useCurrency();
  const scores  = items.length > 0 ? items.map(scoreSupplierForCompare) : [];
  const maxIdx  = scores.length > 0 ? scores.indexOf(Math.max(...scores)) : 0;
  const [selectedIdx, setSelectedIdx] = useState(maxIdx);
  const safeIdx = Math.min(selectedIdx, Math.max(0, items.length - 1));

  if (items.length === 0) return null;

  const winner  = items[safeIdx];
  const second  = [...scores].sort((a, b) => b - a)[1] ?? 0;
  const rawConf = scores[safeIdx] > 0 ? ((scores[safeIdx] - second) / scores[safeIdx]) * 100 : 50;
  const conf    = Math.round(Math.min(96, Math.max(54, 65 + rawConf * 0.3)));
  const reasons = buildSupplierReasons(winner, items);

  const priceHL = numHL(items.map(s => s.priceUSD), false);
  const moqHL   = numHL(items.map(s => s.moqNum), false);
  const trustHL = numHL(items.map(s => s.trust), true);

  const tableW = CMP_LABEL_W + CMP_CELL_W * items.length;

  const rows: { label: string; vals: string[]; hls: HL[] }[] = [
    { label: 'Unit Price',  vals: items.map(s => s.priceUSD != null ? `${fmt(s.priceUSD)}/unit` : s.price), hls: priceHL },
    { label: 'Min. Order',  vals: items.map(s => s.moq),                                                    hls: moqHL   },
    { label: 'Score (est.)', vals: items.map(s => `${s.trust.toFixed(1)}/10`),                              hls: trustHL },
    { label: 'Platform',    vals: items.map(s => s.platform),    hls: items.map(() => 'neutral' as HL) },
    { label: 'Country',     vals: items.map(s => s.country),     hls: items.map(() => 'neutral' as HL) },
    { label: 'Badge',       vals: items.map(s => s.badge),       hls: items.map(() => 'neutral' as HL) },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={am.sheet}>
        <View style={am.toolbar}>
          <Text style={am.title}>Supplier Comparison</Text>
          <TouchableOpacity style={am.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={am.closeTxt}>Done</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={prm.scroll} showsVerticalScrollIndicator={false}>

          {/* ── Hero ─────────────────────────────────────────────── */}
          <View style={[prm.hero, prm.heroSupplier]}>
            <View style={prm.heroBall1Sup} />
            <View style={prm.heroBall2Sup} />
            <Text style={[prm.heroEye, { color: DS.accentDark }]}>AI COMPARISON ENGINE</Text>
            <Text style={prm.heroH}>Supplier Comparison</Text>
            <Text style={prm.heroSub}>Side-by-side analysis of your sourcing options</Text>
            <View style={[prm.heroChip, { backgroundColor: DS.accent }]}>
              <Text style={prm.heroChipTxt}>{items.length} Suppliers Selected</Text>
            </View>
          </View>

          {/* ── AI Recommendation ─────────────────────────────────── */}
          <View style={prm.recCard}>
            <View style={prm.recTopRow}>
              <View style={prm.crownWrap}>
                <Text style={prm.crownIcon}>{safeIdx === maxIdx ? '🏆' : '✦'}</Text>
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={prm.recEye}>{safeIdx === maxIdx ? 'BEST SUPPLIER' : 'YOUR SELECTION'}</Text>
                <Text style={prm.recName} numberOfLines={2}>{winner.name}</Text>
              </View>
              <View style={prm.platformPill}>
                <Text style={prm.platformTxt}>{winner.platform}</Text>
              </View>
            </View>

            <View style={prm.confWrap}>
              <View style={prm.confBg}>
                <View style={[prm.confFill, { width: `${conf}%` as any }]} />
              </View>
              <Text style={prm.confTxt}>{conf}% confidence</Text>
            </View>

            {reasons.map((r, i) => (
              <View key={i} style={prm.reason}>
                <Text style={prm.reasonDot}>✦</Text>
                <Text style={prm.reasonTxt}>{r}</Text>
              </View>
            ))}
          </View>

          {/* ── Column headers ────────────────────────────────────── */}
          <AppCard padding={14} radius={18}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={prm.secEye}>SUPPLIERS COMPARED</Text>
              <Text style={prm.tapHint}>Tap to select</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {items.map((s, i) => {
                  const isSel  = i === safeIdx;
                  const isAuto = i === maxIdx;
                  return (
                    <TouchableOpacity
                      key={s.id}
                      style={[prm.colCard, isSel && prm.colCardWin, { width: CMP_CELL_W + 20 }]}
                      onPress={() => setSelectedIdx(i)}
                      activeOpacity={0.75}
                    >
                      <Text style={prm.supCountry}>{s.country}</Text>
                      <Text style={prm.colTitle} numberOfLines={2}>{s.name}</Text>
                      <View style={prm.colFooter}>
                        <View style={prm.platformBadge}>
                          <Text style={prm.platformBadgeTxt}>{s.platform}</Text>
                        </View>
                        {isSel  && isAuto && <Text style={prm.winTag}>WINNER</Text>}
                        {isSel  && !isAuto && <Text style={prm.aiTag}>SELECTED</Text>}
                        {!isSel && isAuto  && <Text style={prm.aiTag}>AI PICK</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </AppCard>

          {/* ── Sourcing metrics ──────────────────────────────────── */}
          <AppCard padding={14} radius={18} style={{ gap: 0 }}>
            <Text style={prm.secEye}>SOURCING METRICS</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }}>
              <View style={{ width: tableW }}>
                {rows.map((row, ri) => (
                  <View key={row.label} style={[prm.mRow, ri % 2 === 0 && prm.mRowAlt]}>
                    <View style={[prm.mLabel, { width: CMP_LABEL_W }]}>
                      <Text style={prm.mLabelTxt}>{row.label}</Text>
                    </View>
                    {row.vals.map((v, vi) => (
                      <View
                        key={vi}
                        style={[prm.mCell, { width: CMP_CELL_W, backgroundColor: hlBg(row.hls[vi]) }]}
                      >
                        <Text style={[prm.mCellTxt, { color: hlTxt(row.hls[vi]) }]} numberOfLines={1}>{v}</Text>
                        {row.hls[vi] === 'best' && <Text style={prm.trophy}>🏆</Text>}
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            </ScrollView>
          </AppCard>

          {/* ── Action bar ────────────────────────────────────────── */}
          <View style={prm.actions}>
            <TouchableOpacity style={prm.actionGhost} onPress={onClose} activeOpacity={0.8}>
              <Text style={prm.actionGhostTxt}>Close Comparison</Text>
            </TouchableOpacity>
          </View>

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Premium compare styles ────────────────────────────────────────────────────

const prm = StyleSheet.create({
  scroll: { paddingHorizontal: 16, paddingBottom: 60, gap: 14 },

  // Hero
  hero: {
    backgroundColor: DS.indigoLight, borderRadius: DS.radiusCard,
    padding: 22, overflow: 'hidden', gap: 5,
    borderWidth: 1, borderColor: `${DS.indigo}22`,
  },
  heroSupplier: { backgroundColor: DS.accentLight, borderColor: `${DS.accent}22` },
  heroBall1: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60, backgroundColor: `${DS.indigo}18`,
  },
  heroBall2: {
    position: 'absolute', bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40, backgroundColor: `${DS.indigo}10`,
  },
  heroBall1Sup: {
    position: 'absolute', top: -30, right: -30,
    width: 120, height: 120, borderRadius: 60, backgroundColor: `${DS.accent}18`,
  },
  heroBall2Sup: {
    position: 'absolute', bottom: -20, left: -20,
    width: 80, height: 80, borderRadius: 40, backgroundColor: `${DS.accent}10`,
  },
  heroEye:     { fontSize: 9, fontWeight: '800', color: DS.indigo, letterSpacing: 2.5 },
  heroH:       { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  heroSub:     { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  heroChip:    {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: DS.indigo, borderRadius: DS.radiusBadge,
    paddingHorizontal: 12, paddingVertical: 5,
  },
  heroChipTxt: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },

  // AI Recommendation card
  recCard: {
    backgroundColor: DS.bgCard, borderRadius: DS.radiusCard,
    borderWidth: 1.5, borderColor: `${DS.accent}44`,
    padding: 18, gap: 10,
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12, shadowRadius: 16, elevation: 5,
  },
  recTopRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  crownWrap:   { width: 40, height: 40, borderRadius: 12, backgroundColor: DS.goldLight, alignItems: 'center', justifyContent: 'center' },
  crownIcon:   { fontSize: 20 },
  recEye:      { fontSize: 9, fontWeight: '800', color: DS.accentDark, letterSpacing: 2 },
  recName:     { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  vPill:       { borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  vTxt:        { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  platformPill: { backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  platformTxt:  { fontSize: 11, fontWeight: '700', color: DS.accentDark },

  // Confidence bar
  confWrap: { gap: 5 },
  confBg:   { height: 6, backgroundColor: DS.bgElevated, borderRadius: 3, overflow: 'hidden' },
  confFill: { height: 6, backgroundColor: DS.accent, borderRadius: 3 },
  confTxt:  { fontSize: 11, fontWeight: '600', color: DS.textMuted },

  // Reasons
  reason:    { flexDirection: 'row', alignItems: 'flex-start', gap: 7 },
  reasonDot: { fontSize: 10, color: DS.accent, marginTop: 3 },
  reasonTxt: { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  // Save winner CTA
  saveWinBtn: {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 11, alignItems: 'center', marginTop: 4,
  },
  saveWinTxt: { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },

  // Section eyebrow
  secEye: { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2, textTransform: 'uppercase' },

  // Column header cards
  colCard: {
    width: CMP_CELL_W + 16,
    backgroundColor: DS.bgSubtle, borderRadius: 14,
    borderWidth: 1, borderColor: DS.border, padding: 10, gap: 6,
  },
  colCardWin: {
    borderColor: DS.accent, borderWidth: 2, backgroundColor: DS.accentLight,
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15, shadowRadius: 10, elevation: 4,
  },
  colImg:        { width: 44, height: 44, borderRadius: 8, backgroundColor: DS.bgElevated },
  colImgFallback:{ width: 44, height: 44, borderRadius: 8, backgroundColor: DS.bgElevated, alignItems: 'center', justifyContent: 'center' },
  colImgIcon:    { fontSize: 20, color: DS.textMuted },
  colTitle:      { fontSize: 11, fontWeight: '700', color: DS.textPrimary, lineHeight: 15 },
  colFooter:     { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  colBadge:      { borderRadius: DS.radiusBadge, paddingHorizontal: 7, paddingVertical: 3 },
  colBadgeTxt:   { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  winTag:        { fontSize: 9, fontWeight: '900', color: DS.accentDark, letterSpacing: 0.5 },
  aiTag:         { fontSize: 9, fontWeight: '800', color: DS.indigo, letterSpacing: 0.5 },
  tapHint:       { fontSize: 10, fontWeight: '600', color: DS.textMuted },
  supCountry:    { fontSize: 22 },
  platformBadge:    { backgroundColor: DS.indigoLight, borderRadius: DS.radiusBadge, paddingHorizontal: 7, paddingVertical: 3 },
  platformBadgeTxt: { fontSize: 9, fontWeight: '800', color: DS.indigo, letterSpacing: 0.3 },

  // Metric table rows
  mRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DS.borderLight },
  mRowAlt:  { backgroundColor: DS.bgSubtle },
  mLabel:   { paddingRight: 8, justifyContent: 'center' },
  mLabelTxt:{ fontSize: 11, fontWeight: '700', color: DS.textMuted },
  mCell:    { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mCellTxt: { fontSize: 12, fontWeight: '700' },
  trophy:   { fontSize: 10 },

  // Action bar
  actions:         { gap: 10, marginTop: 4 },
  actionPrimary:   {
    backgroundColor: DS.accent, borderRadius: DS.radiusButton,
    paddingVertical: 14, alignItems: 'center',
    shadowColor: DS.accent, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 5,
  },
  actionPrimaryTxt:{ fontSize: 15, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  actionGhost:     { backgroundColor: DS.bgSubtle, borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center', borderWidth: 1, borderColor: DS.border },
  actionGhostTxt:  { fontSize: 14, fontWeight: '700', color: DS.textSecondary },
});

// ── Outreach email card ───────────────────────────────────────────────────────

function OutreachEmailCard({ email }: { email: OutreachEmail }) {
  return (
    <AppCard padding={16} radius={18} style={oe.card}>
      <View style={oe.header}><Text style={oe.headerTxt}>✉  Outreach Email Preview</Text></View>
      <View style={oe.subjectRow}>
        <Text style={oe.label}>Subject</Text>
        <Text style={oe.subject}>{email.subject}</Text>
      </View>
      <View style={oe.bodyBox}><Text style={oe.body}>{email.body}</Text></View>
      {email.tips.length > 0 && (
        <View style={oe.tips}>
          <Text style={oe.tipsTitle}>Sending Tips</Text>
          {email.tips.map((t, i) => <Text key={i} style={oe.tip}>· {t}</Text>)}
        </View>
      )}
      <PrimaryButton
        label="Open in Mail App"
        onPress={() => {
          const encoded = encodeURIComponent(email.body);
          const subject = encodeURIComponent(email.subject);
          Linking.openURL(`mailto:?subject=${subject}&body=${encoded}`);
        }}
        icon="↗"
      />
    </AppCard>
  );
}
const oe = StyleSheet.create({
  card:       { gap: 14 },
  header:     { backgroundColor: DS.indigoLight, borderRadius: 10, padding: 10 },
  headerTxt:  { fontSize: 12, fontWeight: '800', color: DS.indigo, letterSpacing: 0.2 },
  subjectRow: { gap: 4 },
  label:      { fontSize: 9, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  subject:    { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2 },
  bodyBox:    { backgroundColor: DS.bgSubtle, borderRadius: 12, padding: 12 },
  body:       { fontSize: 12, color: DS.textSecondary, lineHeight: 19 },
  tips:       { gap: 5 },
  tipsTitle:  { fontSize: 10, fontWeight: '800', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 },
  tip:        { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <View style={es.wrap}>
      <Text style={es.icon}>{icon}</Text>
      <Text style={es.title}>{title}</Text>
      <Text style={es.sub}>{sub}</Text>
    </View>
  );
}
const es = StyleSheet.create({
  wrap:  { alignItems: 'center', paddingVertical: 36, gap: 8 },
  icon:  { fontSize: 38 },
  title: { fontSize: 15, fontWeight: '800', color: DS.textPrimary },
  sub:   { fontSize: 12, color: DS.textMuted, textAlign: 'center', lineHeight: 18, paddingHorizontal: 20 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ResearchWorkspaceScreen() {
  const { can, increment, tier } = useSubscription();
  const vault                    = useVault();
  const navigation               = useNavigation<NavProp>();
  const { setActiveProduct }     = useActiveProduct();
  const { profile: sellerProfile } = useSellerProfile();

  // ── Mode & search ──────────────────────────────────────────────────────────
  const [mode,          setMode]          = useState<Mode>('market');
  const [searchQuery,   setSearchQuery]   = useState('');
  const [supplierQuery, setSupplierQuery] = useState('');
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [paywallFeature, setPaywallFeature] = useState<'research' | 'suppliers' | 'saves'>('research');

  // ── Recent searches ────────────────────────────────────────────────────────
  const [recentMarket,   setRecentMarket]   = useState<string[]>([]);
  const [recentLookup,   setRecentLookup]   = useState<string[]>([]);
  const [recentSupplier, setRecentSupplier] = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.recentMarketSearches),
      AsyncStorage.getItem(STORAGE_KEYS.recentLookupSearches),
      AsyncStorage.getItem(STORAGE_KEYS.recentSupplierSearches),
      AsyncStorage.getItem(STORAGE_KEYS.feasibilityProduct),
      AsyncStorage.getItem(STORAGE_KEYS.feasibilitySupplier),
      AsyncStorage.getItem(STORAGE_KEYS.savedKeywords),
    ]).then(([m, l, s, fp, fs, kw]) => {
      if (m)  setRecentMarket(JSON.parse(m));
      if (l)  setRecentLookup(JSON.parse(l));
      if (s)  setRecentSupplier(JSON.parse(s));
      if (fp) setFeasProductId(JSON.parse(fp)?.id ?? null);
      if (fs) setFeasSupplierName(JSON.parse(fs)?.name ?? null);
      if (kw) setSavedKWs(JSON.parse(kw));
    }).catch(() => {});
  }, []);

  const addRecentMarket = useCallback((q: string) => {
    setRecentMarket(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 5);
      AsyncStorage.setItem(STORAGE_KEYS.recentMarketSearches, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addRecentLookup = useCallback((q: string) => {
    setRecentLookup(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 5);
      AsyncStorage.setItem(STORAGE_KEYS.recentLookupSearches, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const addRecentSupplier = useCallback((q: string) => {
    setRecentSupplier(prev => {
      const next = [q, ...prev.filter(x => x !== q)].slice(0, 5);
      AsyncStorage.setItem(STORAGE_KEYS.recentSupplierSearches, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const clearRecentMarket = useCallback(() => {
    setRecentMarket([]);
    AsyncStorage.removeItem(STORAGE_KEYS.recentMarketSearches).catch(() => {});
  }, []);

  const clearRecentLookup = useCallback(() => {
    setRecentLookup([]);
    AsyncStorage.removeItem(STORAGE_KEYS.recentLookupSearches).catch(() => {});
  }, []);

  const clearRecentSupplier = useCallback(() => {
    setRecentSupplier([]);
    AsyncStorage.removeItem(STORAGE_KEYS.recentSupplierSearches).catch(() => {});
  }, []);

  // ── Saved keyword handlers ─────────────────────────────────────────────────
  const saveKeyword = useCallback((kw: EnrichedKeyword) => {
    setSavedKWs(prev => {
      if (prev.some(k => k.phrase.toLowerCase() === kw.phrase.toLowerCase())) return prev;
      const next = [...prev, { ...kw, savedAt: new Date().toISOString() }];
      AsyncStorage.setItem(STORAGE_KEYS.savedKeywords, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const unsaveKeyword = useCallback((phrase: string) => {
    setSavedKWs(prev => {
      const next = prev.filter(k => k.phrase.toLowerCase() !== phrase.toLowerCase());
      AsyncStorage.setItem(STORAGE_KEYS.savedKeywords, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ── Amazon search state (shared between market & lookup modes) ─────────────
  const [amazonLoading,  setAmazonLoading]  = useState(false);
  const [amazonError,    setAmazonError]    = useState('');
  const [amazonSearched, setAmazonSearched] = useState(false);
  const [products,       setProducts]       = useState<ProductDisplay[]>(MOCK_PRODUCTS);
  const [keywords,       setKeywords]       = useState<EnrichedKeyword[]>(MOCK_RELATED_KEYWORDS);
  const [savedKWs,       setSavedKWs]       = useState<EnrichedKeyword[]>([]);
  const [metrics,        setMetrics]        = useState<KeywordMetric[]>(MOCK_KEYWORD_METRICS);
  const [currentKeyword, setCurrentKeyword] = useState('');

  // ── Smart search summaries ─────────────────────────────────────────────────
  const [productSummary,  setProductSummary]  = useState<SmartSearchSummary | null>(null);
  const [supplierSummary, setSupplierSummary] = useState<SmartSearchSummary | null>(null);

  // ── Supplier search state ──────────────────────────────────────────────────
  const [suppLoading,  setSuppLoading]  = useState(false);
  const [suppError,    setSuppError]    = useState('');
  const [suppSearched, setSuppSearched] = useState(false);
  const [suppliers,    setSuppliers]    = useState<SupplierDisplay[]>(MOCK_SUPPLIERS);

  // ── Selected product (context for suppliers / copilot) ─────────────────────
  const [selectedProduct, setSelectedProduct] = useState<ProductDisplay | null>(null);

  // ── Save state (per ASIN) ──────────────────────────────────────────────────
  const [savedIds,     setSavedIds]     = useState<Set<string>>(new Set());
  const [saveLoadingId, setSaveLoadingId] = useState<string | null>(null);

  // ── Feasibility selection tracking ────────────────────────────────────────
  const [feasProductId,    setFeasProductId]    = useState<string | null>(null);
  const [feasSupplierName, setFeasSupplierName] = useState<string | null>(null);

  // ── Product comparison ─────────────────────────────────────────────────────
  const [compareProductIds,   setCompareProductIds]   = useState<Set<string>>(new Set());
  const [showCompareProducts, setShowCompareProducts] = useState(false);

  // ── Supplier comparison ────────────────────────────────────────────────────
  const [compareSupplierIds,   setCompareSupplierIds]   = useState<Set<string>>(new Set());
  const [showCompareSuppliers, setShowCompareSuppliers] = useState(false);

  // ── Analyze product modal ──────────────────────────────────────────────────
  const [analyzeProductModal,   setAnalyzeProductModal]   = useState(false);
  const [analyzeProductLoading, setAnalyzeProductLoading] = useState(false);
  const [analyzeProductResult,  setAnalyzeProductResult]  = useState<AnalyzeProductResult | null>(null);
  const [analyzeProductError,   setAnalyzeProductError]   = useState('');

  // ── Analyze supplier modal ─────────────────────────────────────────────────
  const [analyzeSupplierModal,   setAnalyzeSupplierModal]   = useState(false);
  const [analyzeSupplierLoading, setAnalyzeSupplierLoading] = useState(false);
  const [analyzeSupplierResult,  setAnalyzeSupplierResult]  = useState<AnalyzeSupplierResult | null>(null);
  const [analyzeSupplierError,   setAnalyzeSupplierError]   = useState('');

  // ── Outreach email ─────────────────────────────────────────────────────────
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [outreachError,   setOutreachError]   = useState('');
  const [outreachEmail,   setOutreachEmail]   = useState<OutreachEmail | null>(null);
  const [outreachLoadingId, setOutreachLoadingId] = useState<string | null>(null);

  // ── Review Intelligence state ──────────────────────────────────────────────
  const [revProductName,      setRevProductName]      = useState('');
  const [revCategory,         setRevCategory]         = useState('');
  const [revLoadingProductId, setRevLoadingProductId] = useState<string | null>(null);
  const [revLoading,          setRevLoading]          = useState(false);
  const [revError,       setRevError]       = useState('');
  const [revResult,      setRevResult]      = useState<{
    top_complaints:           string[];
    opportunities:            string[];
    sentiment_score:          number;
    most_praised:             string[];
    recommended_improvements: string[];
    bundling_ideas:           string[];
    source:                   string;
  } | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError,   setDiffError]   = useState('');
  const [diffResult,  setDiffResult]  = useState<{
    product_improvements: string[];
    bundle_ideas:         string[];
    niche_angles:         string[];
    listing_angle:        string;
    price_positioning:    string;
    source:               string;
  } | null>(null);

  // ── Lookup keyword warning ─────────────────────────────────────────────────
  const [lookupKeywordWarning, setLookupKeywordWarning] = useState(false);

  // ── Ask AI ─────────────────────────────────────────────────────────────────
  const [askQuestion,  setAskQuestion]  = useState('');
  const [askAnswer,    setAskAnswer]    = useState('');
  const [askLoading,   setAskLoading]   = useState(false);
  const [askError,     setAskError]     = useState('');

  // ── Freight tab ────────────────────────────────────────────────────────────
  const [freightProduct,    setFreightProduct]    = useState('');
  const [freightUnits,      setFreightUnits]      = useState('200');
  const [freightWeightKg,   setFreightWeightKg]   = useState('0.5');
  const [freightLengthCm,   setFreightLengthCm]   = useState('20');
  const [freightWidthCm,    setFreightWidthCm]    = useState('15');
  const [freightHeightCm,   setFreightHeightCm]   = useState('10');
  const [freightLoading,    setFreightLoading]    = useState(false);
  const [freightError,      setFreightError]      = useState('');
  const [freightResult,     setFreightResult]     = useState<{
    product: string;
    marketplace: string;
    units: number;
    total_weight_kg: number;
    total_cbm: number;
    modes: {
      air:     { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string };
      sea_lcl: { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string };
      sea_fcl: { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string } | null;
      express: { mode: string; total_cost: number; cost_per_unit: number; transit_days: number; notes: string };
    };
    recommended: string;
    fba_inbound_est: number;
    prep_cost: number;
  } | null>(null);

  const handleAskAI = useCallback(async () => {
    const q = askQuestion.trim();
    if (!q || askLoading) return;
    setAskLoading(true);
    setAskAnswer('');
    setAskError('');
    try {
      const context = selectedProduct
        ? `Current product: ${selectedProduct.name}, price $${selectedProduct.price ?? 'N/A'}, competition: ${selectedProduct.competition}`
        : undefined;
      const res = await api.askAI(q, context);
      setAskAnswer(res.answer);
    } catch (e: any) {
      setAskError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAskLoading(false);
    }
  }, [askQuestion, askLoading, selectedProduct]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const runLookupSearch = useCallback(async (q: string) => {
    setAmazonLoading(true);
    setAmazonError('');
    setProducts([]);
    setProductSummary(null);
    try {
      const res = await api.searchAmazon(q);
      const finalProducts: ProductDisplay[] = res.products.map(p => productToDisplay(p));
      setProducts(finalProducts);
      setAmazonSearched(true);
      setCompareProductIds(new Set());
      await increment('research');
    } catch (err: any) {
      setAmazonError(err?.message ?? 'Search failed. Please try again.');
    } finally {
      setAmazonLoading(false);
    }
  }, [increment]);

  const runMarketSearch = useCallback(async (q: string) => {
    setAmazonLoading(true);
    setAmazonError('');
    setProducts([]);
    setProductSummary(null);
    try {
      // ── 1. Expand keywords based on tier ─────────────────────────────────
      const expanded = expandProductKeywords(q, tier);

      // ── 2. Run primary search + keyword research in parallel ──────────────
      const [primaryAmazonRes, kwRes] = await Promise.all([
        api.searchAmazon(q),
        api.researchKeywords(q),
      ]);

      // ── 3. Run remaining expanded keyword searches in parallel ────────────
      const extraKeywords = expanded.slice(1); // skip first — already searched above
      const extraResults = await Promise.allSettled(
        extraKeywords.map(kw => api.searchAmazon(kw)),
      );

      // ── 4. Collect all raw products ───────────────────────────────────────
      const allRaw: Product[] = [...primaryAmazonRes.products];
      for (const r of extraResults) {
        if (r.status === 'fulfilled') allRaw.push(...r.value.products);
      }

      // ── 5. Deduplicate ────────────────────────────────────────────────────
      const { results: deduplicated, removed } = deduplicateProducts(allRaw);

      // ── 6. Score and rank ─────────────────────────────────────────────────
      const scored = deduplicated
        .map(p => {
          const s   = scoreProduct(p, q, expanded);
          const disp = productToDisplay(p);
          return {
            ...disp,
            relevanceScore:   s.relevanceScore,
            opportunityScore: s.opportunityScore,
            finalScore:       s.finalScore,
            badges:           s.badges,
            matchReason:      s.matchReason,
            _finalScore:      s.finalScore,
          };
        })
        .sort((a, b) => (b._finalScore ?? 0) - (a._finalScore ?? 0))
        .slice(0, 20);

      // ── 7. Strip internal sort key ────────────────────────────────────────
      const finalProducts: ProductDisplay[] = scored.map(({ _finalScore: _, ...rest }) => rest);

      // ── 8. Increment usage exactly once ───────────────────────────────────
      await increment('research');

      // ── 9. Update state ───────────────────────────────────────────────────
      setProducts(finalProducts);
      setKeywords(enrichKeywords(kwRes, primaryAmazonRes.trends, q));
      setMetrics(trendsToMetrics(q, primaryAmazonRes.trends, kwRes.total_found, kwRes.seo_score));
      setCurrentKeyword(primaryAmazonRes.keyword);
      setAmazonSearched(true);
      setCompareProductIds(new Set());
      setProductSummary({
        originalQuery:    q,
        expandedKeywords: expanded,
        totalScanned:     allRaw.length,
        duplicatesRemoved: removed,
        finalCount:       finalProducts.length,
        topCategory:      detectCategory(q),
      });
    } catch (err: any) {
      setAmazonError(err?.message ?? 'Search failed. Please try again.');
    } finally {
      setAmazonLoading(false);
    }
  }, [increment, tier]);

  const handleAmazonSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    if (!can('research')) { setPaywallFeature('research'); setShowPaywall(true); return; }
    if (mode === 'market') { addRecentMarket(q); await runMarketSearch(q); }
    else                   { addRecentLookup(q); await runLookupSearch(q); }
  }, [searchQuery, mode, can, runMarketSearch, runLookupSearch, addRecentMarket, addRecentLookup]);

  const selectRecentQuery = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!can('research')) { setPaywallFeature('research'); setShowPaywall(true); return; }
    if (mode === 'market') { addRecentMarket(q); await runMarketSearch(q); }
    else                   { addRecentLookup(q); await runLookupSearch(q); }
  }, [mode, can, runMarketSearch, runLookupSearch, addRecentMarket, addRecentLookup]);

  const runSmartSupplierSearch = useCallback(async (rawQ: string, selectedProd: ProductDisplay | null) => {
    setSuppLoading(true);
    setSuppError('');
    setSuppliers([]);
    setSupplierSummary(null);
    try {
      const queries = buildSupplierQueries(rawQ, selectedProd, tier);

      // Run all supplier queries in parallel
      const results = await Promise.allSettled(
        queries.map(q => api.searchSuppliers(q)),
      );

      const allRaw: Supplier[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') allRaw.push(...r.value.suppliers);
      }
      if (allRaw.length === 0) throw new Error('No suppliers found. Try a different product name.');

      const { results: deduped, removed } = deduplicateSuppliers(allRaw);

      const scored = deduped
        .map((s, i) => {
          const sc   = scoreSupplier(s, rawQ);
          const disp = supplierToDisplay(s, i);
          return {
            ...disp,
            relevanceScore:   sc.relevanceScore,
            opportunityScore: sc.opportunityScore,
            finalScore:       sc.finalScore,
            badges:           sc.badges,
            matchReason:      sc.matchReason,
            _finalScore:      sc.finalScore,
          };
        })
        .sort((a, b) => (b._finalScore ?? 0) - (a._finalScore ?? 0))
        .slice(0, 15);

      const finalSuppliers: SupplierDisplay[] = scored.map(({ _finalScore: _, ...rest }) => rest);

      await increment('suppliers');
      setSuppliers(finalSuppliers);
      setSuppSearched(true);
      setCompareSupplierIds(new Set());
      setSupplierSummary({
        originalQuery:     rawQ,
        expandedKeywords:  queries,
        totalScanned:      allRaw.length,
        duplicatesRemoved: removed,
        finalCount:        finalSuppliers.length,
        topCategory:       detectSupplierType(allRaw),
      });
    } catch (err: any) {
      setSuppError(err?.message ?? 'Supplier search failed. Please try again.');
    } finally {
      setSuppLoading(false);
    }
  }, [tier, increment]);

  const selectRecentSupplier = useCallback(async (q: string) => {
    setSupplierQuery(q);
    if (!can('suppliers')) { setPaywallFeature('suppliers'); setShowPaywall(true); return; }
    await runSmartSupplierSearch(q, selectedProduct);
  }, [can, runSmartSupplierSearch, selectedProduct]);

  const handleDifferentiation = useCallback(async () => {
    const name = revProductName.trim();
    const cat  = revCategory.trim() || 'General';
    if (!name) return;
    if (!can('research')) { setPaywallFeature('research'); setShowPaywall(true); return; }
    setDiffLoading(true); setDiffError(''); setDiffResult(null);
    try {
      const top_complaints = revResult?.top_complaints ?? [];
      const result = await api.getDifferentiation(name, cat, top_complaints);
      setDiffResult(result);
    } catch (e: any) {
      setDiffError(e?.message ?? 'Could not generate strategy. Try again.');
    } finally {
      setDiffLoading(false);
    }
  }, [revProductName, revCategory, revResult, can]);

  const analyzeProductOpportunity = useCallback(async (item: ProductDisplay) => {
    if (!can('research')) { setPaywallFeature('research'); setShowPaywall(true); return; }
    const name = item.name;
    const cat  = searchQuery.trim() || 'General';
    setRevProductName(name);
    setRevCategory(cat);
    setRevLoading(true);
    setRevLoadingProductId(item.id);
    setRevError('');
    setRevResult(null);
    setDiffResult(null);
    try {
      const result = await api.analyzeReviews(name, cat, []);
      setRevResult(result);
      AsyncStorage.setItem(
        STORAGE_KEYS.reviewIntelligence,
        JSON.stringify({ name, cat, result, savedAt: new Date().toISOString() }),
      ).catch(() => {});
    } catch (e: any) {
      setRevError(e?.message ?? 'Could not analyze reviews. Try again.');
    } finally {
      setRevLoading(false);
      setRevLoadingProductId(null);
    }
  }, [can, searchQuery]);

  const handleDirectAnalysis = useCallback(async (input: string) => {
    const q = input.trim();
    if (!q) return;
    if (!can('research')) { setPaywallFeature('research'); setShowPaywall(true); return; }
    setRevLoading(true);
    setRevError('');
    setRevResult(null);
    setDiffResult(null);

    try {
      let name = q;
      let cat  = 'General';

      // If it looks like an ASIN or Amazon URL, resolve to a product name first
      const isAsinOrUrl =
        /^[A-Z0-9]{10}$/i.test(q) ||
        /amazon\.(com|co\.uk|de|ca|co\.jp|com\.au|in|fr|es|it)/i.test(q);

      if (isAsinOrUrl) {
        const lookup = await api.lookupProduct(q);
        if (lookup.title && lookup.source === 'scraped') {
          name = lookup.title;
          cat  = lookup.category ?? 'General';
        } else if (lookup.error) {
          // Could not resolve — still run AI on the raw ASIN as a fallback label
          name = q;
        }
      }

      setRevProductName(name);
      setRevCategory(cat);
      const result = await api.analyzeReviews(name, cat, []);
      setRevResult(result);
      AsyncStorage.setItem(
        STORAGE_KEYS.reviewIntelligence,
        JSON.stringify({ name, cat, result, savedAt: new Date().toISOString() }),
      ).catch(() => {});
    } catch (e: any) {
      setRevError(e?.message ?? 'Could not analyze reviews. Try again.');
    } finally {
      setRevLoading(false);
    }
  }, [can]);

  const handleSearchMarketInstead = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    setLookupKeywordWarning(false);
    setMode('market');
    if (!can('research')) { setPaywallFeature('research'); setShowPaywall(true); return; }
    addRecentMarket(q);
    await runMarketSearch(q);
  }, [searchQuery, can, runMarketSearch, addRecentMarket]);

  const handleSupplierSearch = useCallback(async () => {
    const q = (supplierQuery.trim() || selectedProduct?.name || '').trim();
    if (!q) return;
    if (!can('suppliers')) { setPaywallFeature('suppliers'); setShowPaywall(true); return; }
    addRecentSupplier(q);
    await runSmartSupplierSearch(q, selectedProduct);
  }, [supplierQuery, selectedProduct, can, runSmartSupplierSearch, addRecentSupplier]);

  const handleSaveProduct = useCallback(async (item: ProductDisplay) => {
    if (!savedIds.has(item.id) && !can('saves')) {
      setPaywallFeature('research');
      setShowPaywall(true);
      return;
    }
    setSaveLoadingId(item.id);
    try {
      if (savedIds.has(item.id)) {
        vault.removeEntry(item.id);
        setSavedIds(prev => { const n = new Set(prev); n.delete(item.id); return n; });
      } else {
        const saveResult = vault.addEntry(displayToProduct(item), null, 'US', 'USD', SAVE_LIMITS[tier]);
        if (!saveResult.success) {
          setPaywallFeature(saveResult.reason === 'save_limit_reached' ? 'saves' : 'research');
          setShowPaywall(true);
          return;
        }
        setSavedIds(prev => new Set([...prev, item.id]));
        setSelectedProduct(item);
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Could not update saved products.');
    } finally {
      setSaveLoadingId(null);
    }
  }, [savedIds, vault, can, tier]);

  const handleAnalyzeProduct = useCallback(async (item: ProductDisplay) => {
    setAnalyzeProductResult(null);
    setAnalyzeProductError('');
    setAnalyzeProductModal(true);
    setAnalyzeProductLoading(true);
    try {
      const res = await api.analyzeProduct(
        item.price ?? 0,
        item.reviewCount ?? 0,
        item.competition,
        'Stable',
      );
      setAnalyzeProductResult({
        verdict:    res.verdict,
        confidence: res.confidence,
        summary:    res.summary,
        reasons:    res.reasons,
        risk:       res.risk,
        next_step:  res.next_step,
      });
    } catch (err: any) {
      setAnalyzeProductError(err?.message ?? 'Analysis failed. Please try again.');
    } finally {
      setAnalyzeProductLoading(false);
    }
  }, []);

  const handleAnalyzeSupplier = useCallback(async (item: SupplierDisplay) => {
    setAnalyzeSupplierResult(null);
    setAnalyzeSupplierError('');
    setAnalyzeSupplierModal(true);
    setAnalyzeSupplierLoading(true);
    try {
      const res = await api.scoreSupplier({
        supplier_name:  item.name,
        price_per_unit: item.priceUSD ?? 0,
        moq:            item.moqNum,
        product_name:   selectedProduct?.name,
      });
      setAnalyzeSupplierResult({
        total_score:            res.total_score,
        grade:                  res.grade,
        confidence_label:       res.confidence_label,
        strengths:              res.strengths,
        risk_flags:             res.risk_flags,
        recommendation:         res.recommendation,
        negotiation_strategy:   res.negotiation_strategy,
      });
    } catch (err: any) {
      setAnalyzeSupplierError(err?.message ?? 'Analysis failed. Please try again.');
    } finally {
      setAnalyzeSupplierLoading(false);
    }
  }, [selectedProduct]);

  const handleGenerateOutreach = useCallback(async (item: SupplierDisplay) => {
    const productName = selectedProduct?.name || supplierQuery.trim() || 'your product';
    setOutreachLoadingId(item.id);
    setOutreachError('');
    try {
      const result = await api.getSupplierEmail(productName, 'Your Brand');
      setOutreachEmail(result);
    } catch (err: any) {
      setOutreachError(err?.message ?? 'Failed to generate email.');
    } finally {
      setOutreachLoadingId(null);
    }
  }, [selectedProduct, supplierQuery]);

  const toggleProductCompare = useCallback((id: string) => {
    setCompareProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else if (next.size < 3) { next.add(id); }
      return next;
    });
  }, []);

  const toggleSupplierCompare = useCallback((id: string) => {
    setCompareSupplierIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else if (next.size < 3) { next.add(id); }
      return next;
    });
  }, []);

  const handleSelectProduct = useCallback((item: ProductDisplay) => {
    setSelectedProduct(prev => prev?.id === item.id ? null : item);
  }, []);

  const switchToSuppliers = useCallback(() => {
    setMode('suppliers');
    if (selectedProduct && !supplierQuery) {
      setSupplierQuery(selectedProduct.name);
    }
  }, [selectedProduct, supplierQuery]);

  const switchToFreight = useCallback(() => {
    setMode('freight');
    const productName = selectedProduct?.name || supplierQuery.trim() || searchQuery.trim();
    if (productName && !freightProduct) {
      setFreightProduct(productName);
    }
  }, [selectedProduct, supplierQuery, searchQuery, freightProduct]);

  const handleFreightSearch = useCallback(() => {
    const name = freightProduct.trim();
    if (!name) return;
    setFreightLoading(true);
    setFreightError('');
    setFreightResult(null);

    // Small delay so the loading state is visible
    setTimeout(() => {
      try {
        const units   = parseInt(freightUnits, 10)     || 200;
        const weightKg = parseFloat(freightWeightKg)   || 0.5;
        const lenCm    = parseFloat(freightLengthCm)   || 20;
        const widCm    = parseFloat(freightWidthCm)    || 15;
        const htCm     = parseFloat(freightHeightCm)   || 10;
        const mkt      = sellerProfile?.marketplace ?? 'US';

        // Volumetric weight per unit (air divisor 5000)
        const volWtPerUnit    = (lenCm * widCm * htCm) / 5000;
        const chargeablePerUnit = Math.max(weightKg, volWtPerUnit);
        const totalActualKg   = units * weightKg;
        const totalChargeKg   = units * chargeablePerUnit;
        const totalCBM        = units * (lenCm / 100) * (widCm / 100) * (htCm / 100);

        // Air freight — $5.80/kg chargeable, min 45 kg
        const airKg      = Math.max(45, totalChargeKg);
        const airCost    = Math.round(airKg * 5.80);

        // Sea LCL — $145/CBM + $65 handling flat
        const lclCost    = Math.round(totalCBM * 145 + 65);

        // Sea FCL — only show if order > 3 CBM (otherwise LCL wins)
        const fclBase    = 3_800;
        const fclCost    = Math.round(fclBase + totalCBM * 30);
        const showFCL    = totalCBM > 3;

        // Express — $11.50/kg chargeable, min 10 kg
        const expKg      = Math.max(10, totalChargeKg);
        const expCost    = Math.round(expKg * 11.50);

        // Pick recommended mode
        const cheapestLarge = showFCL && fclCost < lclCost ? 'sea_fcl' : 'sea_lcl';
        const recommended: 'air' | 'sea_lcl' | 'sea_fcl' | 'express' =
          totalCBM < 0.5 ? 'air' : totalCBM < 1 ? (airCost < lclCost ? 'air' : 'sea_lcl') : cheapestLarge;

        setFreightResult({
          product:           name,
          marketplace:       mkt,
          units,
          total_weight_kg:   parseFloat(totalActualKg.toFixed(1)),
          total_cbm:         parseFloat(totalCBM.toFixed(3)),
          modes: {
            air: {
              mode:          'Air Freight',
              total_cost:    airCost,
              cost_per_unit: parseFloat((airCost / units).toFixed(2)),
              transit_days:  10,
              notes:         `Billed on ${airKg.toFixed(0)} kg chargeable weight (volumetric or actual, whichever is higher). Fast and reliable — ideal for first orders.`,
            },
            sea_lcl: {
              mode:          'Sea LCL',
              total_cost:    lclCost,
              cost_per_unit: parseFloat((lclCost / units).toFixed(2)),
              transit_days:  32,
              notes:         `${totalCBM.toFixed(2)} CBM in a shared container. Best value for orders under 5 CBM.`,
            },
            sea_fcl: showFCL ? {
              mode:          'Sea FCL (20ft)',
              total_cost:    fclCost,
              cost_per_unit: parseFloat((fclCost / units).toFixed(2)),
              transit_days:  30,
              notes:         'Full container — most cost-efficient for large orders over 5 CBM.',
            } : null,
            express: {
              mode:          'Express (DHL/FedEx)',
              total_cost:    expCost,
              cost_per_unit: parseFloat((expCost / units).toFixed(2)),
              transit_days:  5,
              notes:         'Door-to-door. Use for samples, urgent restocks, or orders under 50 kg.',
            },
          },
          recommended,
          fba_inbound_est:  parseFloat((units * 0.50).toFixed(2)),
          prep_cost:        parseFloat((units * 0.40).toFixed(2)),
        });
      } catch {
        setFreightError('Calculation failed. Please check your inputs and try again.');
      } finally {
        setFreightLoading(false);
      }
    }, 600);
  }, [freightProduct, freightUnits, freightWeightKg, freightLengthCm, freightWidthCm, freightHeightCm, sellerProfile]);

  const handleSaveForFeasibility = useCallback(async (item: ProductDisplay) => {
    if (feasProductId === item.id) {
      setActiveProduct(null);
      setFeasProductId(null);
      return;
    }
    const snapshot: FeasibilityProduct = {
      id:          item.id,
      name:        item.name,
      price:       item.price,
      rating:      item.rating,
      reviewCount: item.reviewCount,
      competition: item.competition,
      url:         item.url,
      savedAt:     new Date().toISOString(),
    };
    setActiveProduct(snapshot); // updates context + AsyncStorage atomically
    setFeasProductId(item.id);
    navigation.navigate('LaunchPad' as any);
  }, [feasProductId, navigation, setActiveProduct]);

  const handleAttachSupplierFeasibility = useCallback(async (item: SupplierDisplay) => {
    if (feasSupplierName === item.name) {
      await AsyncStorage.removeItem(STORAGE_KEYS.feasibilitySupplier);
      setFeasSupplierName(null);
      return;
    }
    const snapshot: FeasibilitySupplier = {
      name:       item.name,
      platform:   item.platform,
      priceUSD:   item.priceUSD,
      moqNum:     item.moqNum,
      moqDisplay: item.moq,
      url:        item.url,
      savedAt:    new Date().toISOString(),
    };
    await AsyncStorage.setItem(STORAGE_KEYS.feasibilitySupplier, JSON.stringify(snapshot));
    setFeasSupplierName(item.name);
    navigation.navigate('LaunchPad' as any);
  }, [feasSupplierName, navigation]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const compareProductItems = useMemo(
    () => products.filter(p => compareProductIds.has(p.id)),
    [products, compareProductIds],
  );

  const compareSupplierItems = useMemo(
    () => suppliers.filter(s => compareSupplierIds.has(s.id)),
    [suppliers, compareSupplierIds],
  );

  const featureContext = mode === 'suppliers' ? 'suppliers' : 'research';

  // ── Render helpers ─────────────────────────────────────────────────────────

  function renderMarketTab() {
    if (amazonLoading) {
      return (
        <View style={xt.skeletonWrap}>
          {[0, 1, 2].map(i => <SkeletonProductCard key={i} style={i > 0 ? { marginTop: 10 } : undefined} />)}
        </View>
      );
    }
    if (amazonError) {
      return (
        <View style={xt.errBox}>
          <Text style={xt.errTxt}>{amazonError}</Text>
          <TouchableOpacity
            style={xt.retryBtn}
            onPress={handleAmazonSearch}
            activeOpacity={0.8}
            accessibilityLabel="Retry search"
          >
            <Text style={xt.retryTxt}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={xt.wrap}>
        {productSummary && <SmartSummaryCard summary={productSummary} />}
        <SectionHeader
          title="Product Opportunities"
          subtitle={amazonSearched ? `${products.length} results · ranked by score` : 'Based on your keyword'}
          style={xt.sectionHead}
        />
        {amazonSearched && products.length === 0 && !amazonLoading && (
          <EmptyState
            icon="◎"
            title="No strong matches found"
            sub={buildEmptySuggestion(currentKeyword || searchQuery)}
          />
        )}
        {!amazonSearched && products.length === 0 && (
          <EmptyState icon="◎" title="No products yet" sub="Enter a keyword and tap Search Amazon to find opportunities." />
        )}
        {products.map(p => {
          const comparable = hasEnoughDataForCompare(p);
          return (
            <ProductMarketCard
              key={p.id}
              item={p}
              onSelect={() => handleSelectProduct(p)}
              isSelected={selectedProduct?.id === p.id}
              onSaveForFeasibility={p.url ? () => handleSaveForFeasibility(p) : undefined}
              isFeasSaved={feasProductId === p.id}
              inCompare={compareProductIds.has(p.id)}
              canCompare={comparable}
              onToggleCompare={() => comparable ? toggleProductCompare(p.id) : undefined}
              onAnalyze={() => handleAnalyzeProduct(p)}
              analyzeLoading={analyzeProductLoading}
            />
          );
        })}
        {amazonSearched && savedIds.size > 0 && (
          <AppCard style={fl.card}>
            <Text style={fl.eye}>RESEARCH FLOW · STEP 2</Text>
            <Text style={fl.title}>Find suppliers for your saved product</Text>
            <Text style={fl.sub}>You've saved {savedIds.size} product{savedIds.size > 1 ? 's' : ''}. Select the one you want to source, then find matching suppliers.</Text>
            <TouchableOpacity style={fl.btn} onPress={switchToSuppliers} activeOpacity={0.85}>
              <Text style={fl.btnTxt}>🏭  Find Suppliers →</Text>
            </TouchableOpacity>
          </AppCard>
        )}
        {amazonSearched && products.length > 0 && (
          <MarketSummaryCard products={products} keyword={currentKeyword} />
        )}
        <KeywordMetricsCard keyword={currentKeyword} metrics={metrics} />
        <SEOKeywordsPanel
          keywords={keywords}
          savedKWs={savedKWs}
          onSave={saveKeyword}
          onUnsave={unsaveKeyword}
          sourceQuery={currentKeyword || searchQuery}
        />
        <AskAIPanel
          question={askQuestion}
          answer={askAnswer}
          loading={askLoading}
          error={askError}
          onChangeQuestion={setAskQuestion}
          onSubmit={handleAskAI}
        />
      </View>
    );
  }

  function renderLookupTab() {
    const sentColor = revResult
      ? revResult.sentiment_score >= 70 ? DS.accent
        : revResult.sentiment_score >= 40 ? DS.warning : DS.danger
      : DS.accent;

    return (
      <View style={xt.wrap}>

        {/* ── Empty / loading state ─────────────────────────────────────── */}
        {revLoading && (
          <View style={xt.center}>
            <ActivityIndicator size="large" color={DS.accent} />
            <Text style={xt.loadTxt}>Analyzing product...</Text>
          </View>
        )}

        {!revLoading && revError !== '' && (
          <View style={xt.errBox}><Text style={xt.errTxt}>{revError}</Text></View>
        )}

        {!revLoading && !revResult && revError === '' && (
          <AppCard style={ri.emptyCard}>
            <Text style={ri.emptyIcon}>◎</Text>
            <Text style={ri.emptyTitle}>Product Improvement Finder</Text>
            <Text style={ri.emptyBody}>
              Enter a product name, ASIN, or Amazon URL above and tap <Text style={{ fontWeight: '700', color: DS.accent }}>Analyze</Text>.{'\n\n'}
              The AI reads the reviews for that specific product and tells you exactly what to fix in your version.
            </Text>
          </AppCard>
        )}

        {revResult && (
          <>
            {/* Header */}
            <AppCard style={[ri.resultHeader, { borderColor: sentColor + '40' }]}>
              <View style={ri.sentRow}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={ri.cardTitle}>Review Intelligence</Text>
                  <Text style={ri.hint}>{revProductName}</Text>
                </View>
                <View style={[ri.sentCircle, { borderColor: sentColor }]}>
                  <Text style={[ri.sentScore, { color: sentColor }]}>{revResult.sentiment_score}</Text>
                  <Text style={ri.sentLabel}>/ 100</Text>
                </View>
              </View>
              <View style={ri.scoreTrack}>
                <View style={[ri.scoreFill, { width: `${revResult.sentiment_score}%` as any, backgroundColor: sentColor }]} />
              </View>
              <Text style={ri.disclaimer}>
                {revResult.sentiment_score >= 70
                  ? 'Customers are mostly happy — you need a meaningful upgrade to compete'
                  : revResult.sentiment_score >= 40
                  ? 'Mixed reviews — clear gaps you can fix in your version'
                  : 'Poor reviews — strong opportunity to source a better product'}
              </Text>
            </AppCard>

            {/* What customers hate */}
            {revResult.top_complaints.length > 0 && (
              <AppCard style={{ gap: 8 }}>
                <Text style={ri.sectionTitle}>WHAT CUSTOMERS HATE</Text>
                <Text style={ri.sectionSub}>Fix these in your version — they are your competitive edge.</Text>
                {revResult.top_complaints.map((c, i) => (
                  <View key={i} style={ri.listRow}>
                    <View style={[ri.dot, { backgroundColor: DS.danger }]} />
                    <Text style={ri.listTxt}>{c}</Text>
                  </View>
                ))}
              </AppCard>
            )}

            {/* What customers love */}
            {revResult.most_praised.length > 0 && (
              <AppCard style={{ gap: 8 }}>
                <Text style={ri.sectionTitle}>WHAT CUSTOMERS LOVE</Text>
                <Text style={ri.sectionSub}>Keep these in your improved version — do not remove what already works.</Text>
                {revResult.most_praised.map((c, i) => (
                  <View key={i} style={ri.listRow}>
                    <View style={[ri.dot, { backgroundColor: DS.accent }]} />
                    <Text style={ri.listTxt}>{c}</Text>
                  </View>
                ))}
              </AppCard>
            )}

            {/* Market gaps */}
            {revResult.opportunities.length > 0 && (
              <AppCard style={{ gap: 8 }}>
                <Text style={ri.sectionTitle}>MARKET GAPS</Text>
                <Text style={ri.sectionSub}>Unmet needs in this category — your entry point.</Text>
                {revResult.opportunities.map((o, i) => (
                  <View key={i} style={ri.listRow}>
                    <View style={[ri.dot, { backgroundColor: DS.warning }]} />
                    <Text style={ri.listTxt}>{o}</Text>
                  </View>
                ))}
              </AppCard>
            )}

            {/* Fix this in your version */}
            {revResult.recommended_improvements.length > 0 && (
              <AppCard style={{ gap: 8 }}>
                <Text style={ri.sectionTitle}>FIX THIS IN YOUR VERSION</Text>
                <Text style={ri.sectionSub}>Specific changes that would beat the competition on reviews.</Text>
                {revResult.recommended_improvements.map((imp, i) => (
                  <View key={i} style={ri.listRow}>
                    <View style={[ri.dot, { backgroundColor: DS.indigo }]} />
                    <Text style={ri.listTxt}>{imp}</Text>
                  </View>
                ))}
              </AppCard>
            )}

            {/* Bundle ideas */}
            {revResult.bundling_ideas.length > 0 && (
              <AppCard style={{ gap: 8 }}>
                <Text style={ri.sectionTitle}>BUNDLE IDEAS</Text>
                <Text style={ri.sectionSub}>Bundle these to command a higher price and AOV.</Text>
                {revResult.bundling_ideas.map((b, i) => (
                  <View key={i} style={ri.listRow}>
                    <View style={[ri.dot, { backgroundColor: DS.infoText ?? DS.indigo }]} />
                    <Text style={ri.listTxt}>{b}</Text>
                  </View>
                ))}
              </AppCard>
            )}

            {/* Sourcing strategy CTA */}
            {!diffResult && (
              <AppCard style={{ gap: 10 }}>
                <Text style={ri.cardTitle}>Build Your Sourcing Strategy</Text>
                <Text style={ri.hint}>Turn the complaints into a concrete plan — product improvements, niche angles, and a winning listing hook.</Text>
                <PrimaryButton
                  label={diffLoading ? 'Generating...' : 'Generate Strategy'}
                  onPress={handleDifferentiation}
                  loading={diffLoading}
                  icon="✦"
                />
                {diffError !== '' && (
                  <View style={xt.errBox}><Text style={xt.errTxt}>{diffError}</Text></View>
                )}
              </AppCard>
            )}
          </>
        )}

        {/* ── Sourcing strategy results ─────────────────────────────────── */}
        {diffResult && (
          <>
            <AppCard style={{ gap: 8 }}>
              <Text style={ri.sectionTitle}>PRODUCT IMPROVEMENTS</Text>
              <Text style={ri.sectionSub}>Source a version with these upgrades.</Text>
              {diffResult.product_improvements.map((imp, i) => (
                <View key={i} style={ri.listRow}>
                  <View style={[ri.dot, { backgroundColor: DS.accent }]} />
                  <Text style={ri.listTxt}>{imp}</Text>
                </View>
              ))}
            </AppCard>

            <AppCard style={{ gap: 8 }}>
              <Text style={ri.sectionTitle}>BUNDLE IDEAS</Text>
              {diffResult.bundle_ideas.map((b, i) => (
                <View key={i} style={ri.listRow}>
                  <View style={[ri.dot, { backgroundColor: DS.indigo }]} />
                  <Text style={ri.listTxt}>{b}</Text>
                </View>
              ))}
            </AppCard>

            <AppCard style={{ gap: 8 }}>
              <Text style={ri.sectionTitle}>NICHE ANGLES</Text>
              {diffResult.niche_angles.map((n, i) => (
                <View key={i} style={ri.listRow}>
                  <View style={[ri.dot, { backgroundColor: DS.warning }]} />
                  <Text style={ri.listTxt}>{n}</Text>
                </View>
              ))}
            </AppCard>

            {diffResult.listing_angle !== '' && (
              <AppCard style={{ gap: 6 }}>
                <Text style={ri.sectionTitle}>LISTING ANGLE</Text>
                <Text style={ri.listTxt}>{diffResult.listing_angle}</Text>
              </AppCard>
            )}

            {diffResult.price_positioning !== '' && (
              <AppCard style={{ gap: 6 }}>
                <Text style={ri.sectionTitle}>PRICE POSITIONING</Text>
                <Text style={ri.listTxt}>{diffResult.price_positioning}</Text>
              </AppCard>
            )}
          </>
        )}

      </View>
    );
  }

  function renderSuppliersTab() {
    return (
      <View style={xt.wrap}>
        <ModeDescStrip mode="suppliers" />

        {suppLoading && (
          <View style={xt.center}>
            <ActivityIndicator size="large" color={DS.accent} />
            <Text style={xt.loadTxt}>Finding suppliers...</Text>
          </View>
        )}

        {!suppLoading && suppError !== '' && (
          <View style={xt.errBox}><Text style={xt.errTxt}>{suppError}</Text></View>
        )}

        {!suppLoading && suppError === '' && (
          <>

            {supplierSummary && <SmartSummaryCard summary={supplierSummary} />}

            <SectionHeader
              title="Supplier Platforms"
              subtitle={suppSearched ? `${suppliers.length} sources · ranked by score` : 'Verified manufacturers'}
              style={xt.sectionHead}
            />

            {suppSearched && suppliers.length === 0 && (
              <EmptyState
                icon="🏭"
                title="No suppliers found"
                sub={buildEmptySuggestion(supplierQuery || selectedProduct?.name || 'this product')}
              />
            )}
            {!suppSearched && suppliers.length === 0 && (
              <EmptyState icon="🏭" title="No suppliers yet" sub="Enter a product name above to find supplier platforms." />
            )}

            {suppliers.map(s => (
              <SupplierCard
                key={s.id}
                item={s}
                inCompare={compareSupplierIds.has(s.id)}
                analyzeLoading={analyzeSupplierLoading && analyzeSupplierModal}
                outreachLoading={outreachLoadingId === s.id}
                onView={() => openURL(s.url)}
                onAnalyze={() => handleAnalyzeSupplier(s)}
                onToggleCompare={() => toggleSupplierCompare(s.id)}
                onOutreach={() => handleGenerateOutreach(s)}
                onAttachFeasibility={() => handleAttachSupplierFeasibility(s)}
                isFeasAttached={feasSupplierName === s.name}
              />
            ))}

            {suppSearched && suppliers.length > 0 && (
              <AppCard style={[fl.card, { borderColor: DS.warning + '55', backgroundColor: DS.warning + '10' }]}>
                <Text style={[fl.eye, { color: DS.warning }]}>RESEARCH FLOW · STEP 3</Text>
                <Text style={fl.title}>Estimate your freight cost</Text>
                <Text style={fl.sub}>
                  You have a supplier. Now estimate shipping costs from China to FBA — air vs sea, cost per unit, transit time.
                </Text>
                <TouchableOpacity style={[fl.btn, { backgroundColor: DS.warning }]} onPress={switchToFreight} activeOpacity={0.85}>
                  <Text style={fl.btnTxt}>✈️  Estimate Freight Cost →</Text>
                </TouchableOpacity>
              </AppCard>
            )}

            {outreachError !== '' && (
              <View style={xt.errBox}><Text style={xt.errTxt}>{outreachError}</Text></View>
            )}

            {outreachEmail !== null && <OutreachEmailCard email={outreachEmail} />}
          </>
        )}
      </View>
    );
  }

  // ── Freight tab ────────────────────────────────────────────────────────────

  function renderFreightTab() {
    const modes = freightResult
      ? [freightResult.modes.air, freightResult.modes.sea_lcl, freightResult.modes.sea_fcl, freightResult.modes.express].filter(Boolean)
      : [];

    return (
      <View style={{ gap: 16 }}>
        {/* ── Input form ─────────────────────────────────────────────── */}
        <AppCard padding={16} style={{ gap: 14 }}>
          <Text style={fr.sectionTitle}>📦 Product Details</Text>

          <InputField
            label="Product name"
            value={freightProduct}
            onChangeText={setFreightProduct}
            placeholder="e.g. portable blender"
            containerStyle={{ flex: undefined }}
          />

          <View style={fr.row}>
            <View style={fr.halfField}>
              <InputField
                label="Units to ship"
                value={freightUnits}
                onChangeText={setFreightUnits}
                placeholder="200"
                keyboardType="numeric"
                containerStyle={{ flex: undefined }}
              />
            </View>
            <View style={fr.halfField}>
              <InputField
                label="Weight/unit (kg)"
                value={freightWeightKg}
                onChangeText={setFreightWeightKg}
                placeholder="0.5"
                keyboardType="numeric"
                containerStyle={{ flex: undefined }}
              />
            </View>
          </View>

          <Text style={fr.sectionTitle}>📐 Dimensions per unit (cm)</Text>
          <View style={fr.row}>
            <View style={fr.thirdField}>
              <InputField
                label="Length"
                value={freightLengthCm}
                onChangeText={setFreightLengthCm}
                placeholder="20"
                keyboardType="numeric"
                containerStyle={{ flex: undefined }}
              />
            </View>
            <View style={fr.thirdField}>
              <InputField
                label="Width"
                value={freightWidthCm}
                onChangeText={setFreightWidthCm}
                placeholder="15"
                keyboardType="numeric"
                containerStyle={{ flex: undefined }}
              />
            </View>
            <View style={fr.thirdField}>
              <InputField
                label="Height"
                value={freightHeightCm}
                onChangeText={setFreightHeightCm}
                placeholder="10"
                keyboardType="numeric"
                containerStyle={{ flex: undefined }}
              />
            </View>
          </View>

          <PrimaryButton
            label={freightLoading ? 'Calculating...' : 'Estimate Freight →'}
            onPress={handleFreightSearch}
            loading={freightLoading}
            disabled={!freightProduct.trim() || freightLoading}
            icon="✈"
          />
        </AppCard>

        {/* ── Error ─────────────────────────────────────────────────── */}
        {!!freightError && (
          <AppCard padding={14}>
            <Text style={{ color: DS.danger, fontSize: 13 }}>{freightError}</Text>
          </AppCard>
        )}

        {/* ── Results ───────────────────────────────────────────────── */}
        {freightResult && (
          <View style={{ gap: 12 }}>
            <View style={fr.summaryCard}>
              <Text style={fr.summaryLabel}>SHIPMENT SUMMARY</Text>
              <Text style={fr.summaryTitle}>{freightResult.product}</Text>
              <Text style={fr.summarySub}>{freightResult.units.toLocaleString()} units · {freightResult.total_weight_kg} kg · {freightResult.total_cbm} CBM</Text>
            </View>

            {modes.map((m) => {
              if (!m) return null;
              const isRec = m.mode.toLowerCase().includes(freightResult.recommended.replace('_', ' '));
              return (
                <AppCard key={m.mode} padding={16} style={[fr.modeCard, isRec && fr.modeCardRec]}>
                  {isRec && (
                    <View style={fr.recBadge}>
                      <Text style={fr.recBadgeTxt}>★ RECOMMENDED</Text>
                    </View>
                  )}
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
                  </View>
                  <Text style={fr.modeNotes}>{m.notes}</Text>
                </AppCard>
              );
            })}

            <AppCard padding={14} style={{ gap: 6 }}>
              <Text style={fr.sectionTitle}>Additional Costs</Text>
              <View style={fr.extraRow}>
                <Text style={fr.extraLabel}>FBA Inbound Handling</Text>
                <Text style={fr.extraValue}>${freightResult.fba_inbound_est.toFixed(2)}</Text>
              </View>
              <View style={fr.extraRow}>
                <Text style={fr.extraLabel}>China 3PL Prep / Labeling</Text>
                <Text style={fr.extraValue}>${freightResult.prep_cost.toFixed(2)}</Text>
              </View>
            </AppCard>
          </View>
        )}

        {/* ── Empty state ────────────────────────────────────────────── */}
        {!freightResult && !freightLoading && (
          <AppCard padding={28} style={{ alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 36, textAlign: 'center' }}>✈️</Text>
            <Text style={{ fontSize: 15, fontWeight: '800', color: DS.textPrimary, textAlign: 'center' }}>Freight Estimator</Text>
            <Text style={{ fontSize: 13, color: DS.textMuted, lineHeight: 20, textAlign: 'center' }}>
              Enter your product details to compare air, sea, and express shipping costs from China to FBA.
            </Text>
          </AppCard>
        )}
      </View>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        featureContext={paywallFeature}
      />

      <AnalyzeProductModal
        visible={analyzeProductModal}
        loading={analyzeProductLoading}
        result={analyzeProductResult}
        error={analyzeProductError}
        onClose={() => setAnalyzeProductModal(false)}
      />

      <AnalyzeSupplierModal
        visible={analyzeSupplierModal}
        loading={analyzeSupplierLoading}
        result={analyzeSupplierResult}
        error={analyzeSupplierError}
        onClose={() => setAnalyzeSupplierModal(false)}
      />

      <CompareProductsModal
        visible={showCompareProducts}
        items={compareProductItems}
        onClose={() => setShowCompareProducts(false)}
        onSaveWinner={(item) => { handleSaveProduct(item); setShowCompareProducts(false); }}
      />

      <CompareSuppliersModal
        visible={showCompareSuppliers}
        items={compareSupplierItems}
        onClose={() => setShowCompareSuppliers(false)}
      />

      {/* ── Pinned header ───────────────────────────────────── */}
      <View style={s.header}>
        <View style={s.headerTop}>
          <Text style={s.eyebrow}>RESEARCH WORKSPACE</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CurrencySelector />
            <HelpButton featureKey={mode === 'suppliers' ? 'suppliers' : mode === 'market' ? 'research' : mode === 'freight' ? 'freight_tab' : 'smart_search'} size="sm" />
          </View>
        </View>
        <Text style={s.heroTitle}>Discover Winning Products</Text>
        <Text style={s.heroSub}>Research markets, look up products, and find suppliers.</Text>
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Search input — market / lookup / suppliers only ── */}
        {mode !== 'freight' && <AppCard padding={14} style={s.searchCard}>
          <View style={s.searchRow}>
            <InputField
              value={mode === 'suppliers' ? supplierQuery : searchQuery}
              onChangeText={mode === 'suppliers' ? setSupplierQuery : setSearchQuery}
              placeholder={
                mode === 'lookup'    ? 'Product name, ASIN, or Amazon URL...'
                : mode === 'suppliers' ? (selectedProduct ? `Suppliers for: ${selectedProduct.name.slice(0, 30)}…` : 'Search product name for suppliers...')
                : 'Search a product idea or niche...'
              }
              leadingIcon={mode === 'suppliers' ? '🏭' : '◎'}
              containerStyle={s.searchInput}
              returnKeyType="search"
              onSubmitEditing={mode === 'suppliers' ? handleSupplierSearch : mode === 'lookup' ? () => handleDirectAnalysis(searchQuery) : handleAmazonSearch}
            />
          </View>
          {(mode === 'suppliers'
            ? (supplierQuery.trim().length > 0 || !!selectedProduct)
            : searchQuery.length > 0
          ) && (
            <PrimaryButton
              label={
                mode === 'suppliers' ? (suppLoading  ? 'Searching...' : 'Find Suppliers')
                : mode === 'lookup'  ? (revLoading ? 'Analyzing...' : 'Analyze')
                :                     (amazonLoading ? 'Searching...' : 'Search Amazon')
              }
              onPress={mode === 'suppliers' ? handleSupplierSearch : mode === 'lookup' ? () => handleDirectAnalysis(searchQuery) : handleAmazonSearch}
              size="sm"
              icon={mode === 'suppliers' ? '⬡' : '◎'}
              style={s.searchBtn}
              loading={mode === 'suppliers' ? suppLoading : amazonLoading}
            />
          )}
        </AppCard>}

        {/* ── Recent searches — market / lookup / suppliers ─── */}
        {mode !== 'freight' && (
          <RecentSearches
            items={mode === 'market' ? recentMarket : mode === 'lookup' ? recentLookup : recentSupplier}
            accentColor={mode === 'market' ? DS.info : mode === 'lookup' ? DS.indigo : DS.accent}
            onSelect={mode === 'suppliers' ? selectRecentSupplier : selectRecentQuery}
            onClear={mode === 'market' ? clearRecentMarket : mode === 'lookup' ? clearRecentLookup : clearRecentSupplier}
          />
        )}

        {/* ── Seller profile defaults ──────────────────────── */}
        {sellerProfile && (
          <View style={pd.row}>
            <Text style={pd.label}>Your profile:</Text>
            <View style={pd.chip}><Text style={pd.chipTxt}>🌐 {sellerProfile.marketplace}</Text></View>
            <View style={pd.chip}><Text style={pd.chipTxt}>💰 ${sellerProfile.priceMin}–${sellerProfile.priceMax}</Text></View>
            <View style={pd.chip}><Text style={pd.chipTxt}>⭐ &lt;{sellerProfile.maxTopSellerReviews} rev</Text></View>
          </View>
        )}

        {/* ── Mode selector ────────────────────────────────── */}
        <ModeSegment value={mode} onChange={setMode} />
        {mode !== 'suppliers' && mode !== 'freight' && <ModeDescStrip mode={mode} />}

        {/* ── Selected product banner (all modes) ──────────── */}
        {selectedProduct && (
          <SelectedProductBanner
            product={selectedProduct}
            onFindSuppliers={mode === 'suppliers'
              ? () => { const q = supplierQuery.trim() || selectedProduct?.name || ''; if (q) handleSupplierSearch(); }
              : switchToSuppliers}
            onAskCoPilot={() => navigation.navigate('Copilot' as any)}
            onClear={() => setSelectedProduct(null)}
          />
        )}

        {/* ── Mode content ─────────────────────────────────── */}
        {mode === 'market'    && renderMarketTab()}
        {mode === 'lookup'    && renderLookupTab()}
        {mode === 'suppliers' && renderSuppliersTab()}
        {mode === 'freight'   && renderFreightTab()}
      </ScrollView>

      {/* ── Floating compare bar ─────────────────────────────── */}
      {(compareProductIds.size >= 1 && mode === 'market') && (
        <View style={cfb.wrap} pointerEvents="box-none">
          {compareProductIds.size === 1 ? (
            <View style={cfb.pillPending}>
              <Text style={cfb.pillIcon}>⊞</Text>
              <Text style={cfb.pillTextPending}>1 selected — add 1 more to compare</Text>
              <TouchableOpacity onPress={() => setCompareProductIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={cfb.clearPending}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={cfb.pill} onPress={() => setShowCompareProducts(true)} activeOpacity={0.88}>
              <Text style={cfb.pillIcon}>⊞</Text>
              <Text style={cfb.pillText}>Compare {compareProductIds.size} Products</Text>
              <Text style={cfb.pillArrow}>→</Text>
              <TouchableOpacity
                style={cfb.clearBtn}
                onPress={() => setCompareProductIds(new Set())}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={cfb.clearText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
      )}
      {(compareSupplierIds.size >= 1 && mode === 'suppliers') && (
        <View style={cfb.wrap} pointerEvents="box-none">
          {compareSupplierIds.size === 1 ? (
            <View style={cfb.pillPending}>
              <Text style={cfb.pillIcon}>⊞</Text>
              <Text style={cfb.pillTextPending}>1 selected — add 1 more to compare</Text>
              <TouchableOpacity onPress={() => setCompareSupplierIds(new Set())} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={cfb.clearPending}>✕</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={cfb.pill} onPress={() => setShowCompareSuppliers(true)} activeOpacity={0.88}>
              <Text style={cfb.pillIcon}>⊞</Text>
              <Text style={cfb.pillText}>Compare {compareSupplierIds.size} Suppliers</Text>
              <Text style={cfb.pillArrow}>→</Text>
              <TouchableOpacity
                style={cfb.clearBtn}
                onPress={() => setCompareSupplierIds(new Set())}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={cfb.clearText}>✕</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

// ── Review Intelligence styles ────────────────────────────────────────────────

const ri = StyleSheet.create({
  cardTitle:  { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  hint:       { fontSize: 12, color: DS.textMuted, lineHeight: 17 },
  disclaimer: { fontSize: 11, color: DS.textMuted, lineHeight: 16, fontStyle: 'italic' },

  emptyCard:  { gap: 12, alignItems: 'center', paddingVertical: 28 },
  emptyIcon:  { fontSize: 36, textAlign: 'center', color: DS.textMuted },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4, textAlign: 'center' },
  emptyBody:  { fontSize: 13, color: DS.textMuted, lineHeight: 20, textAlign: 'center' },

  resultHeader: { gap: 10, borderWidth: 1.5 },

  sentRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sentCircle: {
    width: 60, height: 60, borderRadius: 30, borderWidth: 3,
    alignItems: 'center', justifyContent: 'center',
  },
  sentScore:  { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  sentLabel:  { fontSize: 9, fontWeight: '600', color: DS.textMuted },

  scoreTrack: { height: 5, backgroundColor: DS.border, borderRadius: 3, overflow: 'hidden' },
  scoreFill:  { height: 5, borderRadius: 3 },

  sectionTitle:{ fontSize: 9, fontWeight: '800', color: DS.accent, letterSpacing: 2 },
  sectionSub:  { fontSize: 11, color: DS.textMuted, lineHeight: 16 },

  listRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot:        { width: 7, height: 7, borderRadius: 4, marginTop: 6, flexShrink: 0 },
  listTxt:    { fontSize: 13, color: DS.textSecondary, lineHeight: 20, flex: 1 },
});

// ── Lookup keyword warning / hint styles ──────────────────────────────────────

const lkw = StyleSheet.create({
  card:      { gap: 14, borderWidth: 1.5, borderColor: DS.warning, backgroundColor: DS.warningBg },
  icon:      { fontSize: 30, textAlign: 'center' },
  title:     { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3, textAlign: 'center' },
  body:      { fontSize: 13, color: DS.textSecondary, lineHeight: 21, textAlign: 'center' },
  mono:      { fontWeight: '700', color: DS.textPrimary },
  hintCard:  { gap: 8, backgroundColor: DS.indigoLight, borderWidth: 1, borderColor: DS.border },
  hintTitle: { fontSize: 13, fontWeight: '800', color: DS.indigo, letterSpacing: -0.2 },
  hintBody:  { fontSize: 12, color: DS.textSecondary, lineHeight: 19 },
});

// ── Shared tab styles ─────────────────────────────────────────────────────────

const xt = StyleSheet.create({
  wrap:        { gap: 16 },
  sectionHead: { marginBottom: -8 },
  center:      { alignItems: 'center', justifyContent: 'center', paddingVertical: 44, gap: 12 },
  loadTxt:     { fontSize: 13, color: DS.textMuted, fontWeight: '600' },
  skeletonWrap: { paddingHorizontal: 16, paddingTop: 8 },
  errBox:      { backgroundColor: DS.dangerBg, borderRadius: 16, padding: 18, alignItems: 'center', gap: 12 },
  errTxt:      { fontSize: 13, color: DS.dangerText, textAlign: 'center' },
  retryBtn:    { backgroundColor: DS.dangerText, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryTxt:    { fontSize: 13, fontWeight: '700', color: '#fff' },
  suppSearch:  { padding: 12 },
  compareBanner: {
    backgroundColor: DS.accentLight, borderRadius: 14, borderWidth: 1.5, borderColor: DS.accent,
    paddingVertical: 12, alignItems: 'center',
  },
  compareBannerTxt: { fontSize: 13, fontWeight: '800', color: DS.accentDark, letterSpacing: -0.2 },
});

// ── Research flow next-step card ──────────────────────────────────────────────

const cfb = StyleSheet.create({
  wrap:         { position: 'absolute', bottom: 16, left: 16, right: 16, alignItems: 'center' },
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.accent, borderRadius: 28, paddingVertical: 13, paddingLeft: 18, paddingRight: 12, shadowColor: '#0D1B4B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10 },
  pillPending:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.bgCard, borderRadius: 28, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, borderWidth: 1.5, borderColor: DS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  pillIcon:     { fontSize: 15 },
  pillText:     { flex: 1, fontSize: 14, fontWeight: '800', color: '#fff', letterSpacing: -0.3 },
  pillTextPending: { flex: 1, fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  pillArrow:    { fontSize: 16, fontWeight: '800', color: '#fff' },
  clearBtn:     { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  clearText:    { fontSize: 12, fontWeight: '700', color: '#fff' },
  clearPending: { fontSize: 13, fontWeight: '600', color: DS.textMuted, paddingHorizontal: 4 },
});

const fl = StyleSheet.create({
  card:  { gap: 8, borderWidth: 1.5, borderColor: DS.accent + '55', backgroundColor: DS.accentLight },
  eye:   { fontSize: 8, fontWeight: '800', color: DS.accentDark, letterSpacing: 2 },
  title: { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:   { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  btn:   { backgroundColor: DS.accent, borderRadius: 12, paddingVertical: 10, alignItems: 'center' as const },
  btnTxt:{ fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});

const pd = StyleSheet.create({
  row:    { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: 6 },
  label:  { fontSize: 10, fontWeight: '700', color: DS.textMuted },
  chip:   { backgroundColor: DS.indigoLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: DS.indigo + '30' },
  chipTxt:{ fontSize: 10, fontWeight: '700', color: DS.indigo },
});

const fr = StyleSheet.create({
  row:       { flexDirection: 'row' as const, gap: 10 },
  halfField: { flex: 1 },
  thirdField:{ flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' as const },

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
  modePriceRow:  { flexDirection: 'row' as const, gap: 20 },
  modePriceBlock:{ gap: 2 },
  modePriceLabel:{ fontSize: 9, fontWeight: '700', color: DS.textMuted, letterSpacing: 1.5 },
  modePrice:   { fontSize: 22, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8 },
  modeNotes:   { fontSize: 12, color: DS.textMuted, lineHeight: 17, fontStyle: 'italic' as const },

  extraRow:   { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const },
  extraLabel: { fontSize: 13, color: DS.textSecondary },
  extraValue: { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
});

// ── Screen-level styles ───────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: DS.bgCanvas },

  header: {
    paddingHorizontal: DS.pagePadding,
    paddingTop:        10,
    paddingBottom:     12,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
    gap:               3,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow:   { fontSize: 9, fontWeight: '800', color: DS.info, letterSpacing: 2.5 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.7 },
  heroSub:   { fontSize: 13, color: DS.textSecondary, lineHeight: 18 },

  scroll:  { flex: 1 },
  content: { paddingHorizontal: DS.pagePadding, paddingTop: DS.sectionGap, paddingBottom: 80, gap: DS.sectionGap },

  searchCard: {},
  searchRow:  { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  searchInput:{ flex: 1 },
  searchBtn:  { marginTop: 10 },
});
