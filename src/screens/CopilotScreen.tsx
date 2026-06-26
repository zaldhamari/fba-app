import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator, Linking,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import { safeParseJSON } from '../utils/safeJSON';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { WinnerVaultDetailModal } from '../components/WinnerVaultDetailModal';
import { useAuth } from '../hooks/useAuth';
import { useSubscription, toggleDevMode } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import { HelpButton } from '../components/HelpModal';
import { AppHeader } from '../components/AppHeader';
import NicheResearchScreen from './NicheResearchScreen';
import { FeatureExplainer } from '../components/FeatureExplainer';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { DS } from '../theme/ds';
import { api, Product } from '../services/api';
import { useCurrency } from '../context/CurrencyContext';
import { Image } from 'expo-image';
import { useBuilderSession } from '../hooks/useBuilderSession';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { usePipeline } from '../context/PipelineContext';
import { useVault } from '../hooks/useVault';
import { useProductIntelligence } from '../hooks/useProductIntelligence';
import { IntelligenceSummaryBanner } from '../components/IntelligenceSummaryBanner';
import { FBAGlossaryModal } from '../components/FBAGlossaryModal';
import type { TabParamList } from '../navigation/tabTypes';
import type { WinnerEntry } from '../types/builder';
import { EstimateLabel } from '../components/EstimateLabel';

type Nav = BottomTabNavigationProp<TabParamList>;

// ─── Shared Modal Shell ───────────────────────────────────────────────────────

interface ToolModalProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

function ToolModal({ visible, title, subtitle, onClose, children }: ToolModalProps) {
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={m.header}>
            <View style={{ flex: 1 }}>
              <Text style={m.title}>{title}</Text>
              {subtitle ? <Text style={m.subtitle}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity onPress={onClose} style={m.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={m.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: DS.pagePadding, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const m = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: DS.border,
  },
  title:    { fontSize: 20, fontWeight: '700', color: DS.textPrimary },
  subtitle: { fontSize: 13, color: DS.textMuted, marginTop: 2 },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: DS.bgCard, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 14, color: DS.textMuted, fontWeight: '600' },
});

// ─── Verdict Badge ────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const color = verdict === 'LAUNCH' ? DS.success : verdict === 'AVOID' ? DS.danger : DS.warning;
  return (
    <View style={[vb.pill, { backgroundColor: color + '22', borderColor: color + '66' }]}>
      <Text style={[vb.text, { color }]}>{verdict}</Text>
    </View>
  );
}
const vb = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, alignSelf: 'flex-start' },
  text: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
});

// ─── Analyze a Product Modal ──────────────────────────────────────────────────

const AP_EXAMPLES = [
  'bamboo cutting board', 'posture corrector', 'dog slow feeder',
  'silicone baking mat', 'car seat organiser', 'LED desk lamp',
];

const AP_LOADING_MSGS = [
  'Scanning Amazon listings…',
  'Running AI analysis…',
  'Checking review patterns…',
  'Crunching the numbers…',
];

function AnalyzeProductModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [query, setQuery]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [loadMsg, setLoadMsg]   = useState(0);
  const [error, setError]       = useState('');
  const [result, setResult]     = useState<any>(null);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);

  const startLoadCycle = () => {
    setLoadMsg(0);
    timerRef.current = setInterval(() => setLoadMsg(m => (m + 1) % AP_LOADING_MSGS.length), 1400);
  };
  const stopLoadCycle = () => { if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; } };

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery(trimmed); setLoading(true); setError(''); setResult(null);
    startLoadCycle();
    try {
      const res = await api.searchAmazon(trimmed);
      const products = res.products;
      if (!products?.length) { setError('No products found. Try a different keyword.'); return; }
      const top = products[0];
      const avgReviews = products.reduce((s: number, p: any) => s + (p.review_count ?? 0), 0) / products.length;
      const competition = avgReviews > 500 ? 'high' : avgReviews > 200 ? 'medium' : 'low';
      const [analysis, reviews] = await Promise.all([
        api.analyzeProduct(top.price ?? 0, top.review_count ?? 0, competition, 'stable'),
        api.analyzeReviews(top.title ?? trimmed, 'general'),
      ]);
      setResult({ product: top, analysis, reviews, competition, avgReviews: Math.round(avgReviews) });
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong.');
    } finally {
      stopLoadCycle(); setLoading(false);
    }
  }, []);

  const handleClose = () => { stopLoadCycle(); setQuery(''); setResult(null); setError(''); onClose(); };

  const verdict      = result?.analysis?.verdict ?? '';
  const confidence   = Math.round((result?.analysis?.confidence ?? 0) * 100);
  const verdictColor = verdict === 'LAUNCH' ? DS.success : verdict === 'AVOID' ? DS.danger : DS.warning;

  return (
    <ToolModal visible={visible} title="Get a Verdict" subtitle="Should I sell this? An AI launch/test/avoid call before you commit" onClose={handleClose}>

      {/* Search bar */}
      <View style={ap.inputRow}>
        <TextInput
          style={ap.input}
          placeholder="e.g. bamboo cutting board"
          placeholderTextColor={DS.textMuted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => runSearch(query)}
          returnKeyType="search"
          autoFocus
        />
        <TouchableOpacity style={[ap.searchBtn, (!query.trim() || loading) && ap.searchBtnDisabled]}
          onPress={() => runSearch(query)} disabled={loading || !query.trim()}>
          <Text style={ap.searchBtnText}>↗</Text>
        </TouchableOpacity>
      </View>

      {/* Idle: example chips */}
      {!loading && !result && !error && (
        <View style={ap.idleWrap}>
          <Text style={ap.idleLabel}>Try an example</Text>
          <View style={ap.chipRow}>
            {AP_EXAMPLES.map(ex => (
              <TouchableOpacity key={ex} style={ap.chip} onPress={() => runSearch(ex)} activeOpacity={0.75}>
                <Text style={ap.chipText}>{ex}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={ap.idleHint}>
            <Text style={ap.idleHintIcon}>🔍</Text>
            <Text style={ap.idleHintText}>Enter any product keyword and Copilot will pull real Amazon listing data when available, run an AI verdict, and surface review gaps you can exploit.</Text>
          </View>
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={ap.loadingWrap}>
          <ActivityIndicator color={DS.accent} size="large" />
          <Text style={ap.loadingMsg}>{AP_LOADING_MSGS[loadMsg]}</Text>
          <Text style={ap.loadingQuery}>"{query}"</Text>
        </View>
      )}

      {/* Error */}
      {!!error && !loading && (
        <View style={ap.errorWrap}>
          <Text style={ap.errorIcon}>⚠️</Text>
          <Text style={ap.errorText}>{error}</Text>
          <TouchableOpacity style={ap.retryBtn} onPress={() => runSearch(query)}>
            <Text style={ap.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {result && !loading && (
        <View style={{ gap: 12, marginTop: 4 }}>

          {/* Product snapshot */}
          <View style={ap.productCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={ap.productEyebrow}>TOP RESULT</Text>
              {result.product.source && result.product.source !== 'dataforseo' && <EstimateLabel type="estimated" />}
            </View>
            <Text style={ap.productTitle} numberOfLines={3}>{result.product.title}</Text>
            {result.product.source && result.product.source !== 'dataforseo' && (
              <Text style={ap.productEstNote}>Price is a category estimate, not a live listing — the verdict below inherits that uncertainty.</Text>
            )}
            <View style={ap.statsRow}>
              <View style={ap.statBox}>
                <Text style={ap.statVal}>${result.product.price?.toFixed(2) ?? '—'}</Text>
                <Text style={ap.statLabel}>Price</Text>
              </View>
              <View style={ap.statDivider} />
              <View style={ap.statBox}>
                <Text style={ap.statVal}>{result.product.review_count?.toLocaleString() ?? '—'}</Text>
                <Text style={ap.statLabel}>Reviews</Text>
              </View>
              <View style={ap.statDivider} />
              <View style={ap.statBox}>
                <Text style={[ap.statVal, { textTransform: 'capitalize' }]}>{result.competition}</Text>
                <Text style={ap.statLabel}>Competition</Text>
              </View>
              <View style={ap.statDivider} />
              <View style={ap.statBox}>
                <Text style={ap.statVal}>{result.avgReviews?.toLocaleString()}</Text>
                <Text style={ap.statLabel}>Avg Reviews</Text>
              </View>
            </View>
          </View>

          {/* Verdict hero */}
          {verdict ? (
            <View style={[ap.verdictCard, { borderColor: verdictColor + '55', backgroundColor: verdictColor + '0D' }]}>
              <View style={ap.verdictTop}>
                <View>
                  <Text style={ap.verdictEyebrow}>AI VERDICT</Text>
                  <Text style={[ap.verdictLabel, { color: verdictColor }]}>{verdict}</Text>
                </View>
                <View style={[ap.confidenceBadge, { backgroundColor: verdictColor + '22', borderColor: verdictColor + '55' }]}>
                  <Text style={[ap.confidenceNum, { color: verdictColor }]}>{confidence}%</Text>
                  <Text style={[ap.confidenceLabel, { color: verdictColor }]}>confidence</Text>
                </View>
              </View>
              {/* Confidence bar */}
              <View style={ap.confBarTrack}>
                <View style={[ap.confBarFill, { width: `${confidence}%` as any, backgroundColor: verdictColor }]} />
              </View>
              {result.analysis.summary ? (
                <Text style={ap.verdictSummary}>{result.analysis.summary}</Text>
              ) : null}
              {result.analysis.reasons?.length > 0 && (
                <View style={{ gap: 5, marginTop: 4 }}>
                  {result.analysis.reasons.map((r: string, i: number) => (
                    <View key={i} style={ap.reasonRow}>
                      <View style={[ap.reasonDot, { backgroundColor: verdictColor }]} />
                      <Text style={ap.reasonText}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}

          {/* Review gaps */}
          {result.reviews?.opportunities?.length > 0 && (
            <View style={ap.gapsCard}>
              <View style={ap.gapsHeader}>
                <Text style={ap.gapsTitle}>Review Gaps</Text>
                <View style={ap.gapsBadge}>
                  <Text style={ap.gapsBadgeText}>{result.reviews.opportunities.length} found</Text>
                </View>
              </View>
              <Text style={ap.gapsSub}>Weaknesses in the top listings you can exploit</Text>
              <View style={{ gap: 8, marginTop: 4 }}>
                {result.reviews.opportunities.map((w: string, i: number) => (
                  <View key={i} style={ap.gapRow}>
                    <View style={ap.gapIndex}><Text style={ap.gapIndexText}>{i + 1}</Text></View>
                    <Text style={ap.gapText}>{w}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Search again */}
          <TouchableOpacity style={ap.searchAgainBtn} onPress={() => { setResult(null); setQuery(''); setError(''); }}>
            <Text style={ap.searchAgainText}>← Analyze another product</Text>
          </TouchableOpacity>
        </View>
      )}
    </ToolModal>
  );
}

const ap = StyleSheet.create({
  // Search bar
  inputRow:         { flexDirection: 'row', gap: 8, marginTop: 16, marginBottom: 8 },
  input:            { flex: 1, borderRadius: DS.radiusInput, borderWidth: 1.5, borderColor: DS.border, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: DS.textPrimary, backgroundColor: DS.bgCard },
  searchBtn:        { width: 48, borderRadius: DS.radiusInput, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  searchBtnDisabled:{ opacity: 0.45 },
  searchBtnText:    { color: '#fff', fontWeight: '700', fontSize: 18 },
  // Idle state
  idleWrap:         { gap: 14, marginTop: 4, paddingBottom: 8 },
  idleLabel:        { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:             { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: DS.bgCard, borderWidth: 1, borderColor: DS.border },
  chipText:         { fontSize: 12, color: DS.textSecondary, fontWeight: '500' },
  idleHint:         { flexDirection: 'row', gap: 10, backgroundColor: DS.accentLight, borderRadius: DS.radiusButton, padding: 12, alignItems: 'flex-start' },
  idleHintIcon:     { fontSize: 18, marginTop: 1 },
  idleHintText:     { flex: 1, fontSize: 12, color: DS.accent, lineHeight: 18 },
  // Loading state
  loadingWrap:      { alignItems: 'center', gap: 12, paddingVertical: 48 },
  loadingMsg:       { fontSize: 15, fontWeight: '600', color: DS.textPrimary },
  loadingQuery:     { fontSize: 13, color: DS.textMuted, fontStyle: 'italic' },
  // Error state
  errorWrap:        { alignItems: 'center', gap: 10, paddingVertical: 36 },
  errorIcon:        { fontSize: 32 },
  errorText:        { fontSize: 14, color: DS.danger, textAlign: 'center', lineHeight: 20 },
  retryBtn:         { borderWidth: 1, borderColor: DS.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 24, marginTop: 4 },
  retryText:        { color: DS.accent, fontWeight: '700', fontSize: 13 },
  // Product card
  productCard:      { backgroundColor: DS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 10 },
  productEyebrow:   { fontSize: 10, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.8 },
  productTitle:     { fontSize: 15, fontWeight: '700', color: DS.textPrimary, lineHeight: 22 },
  productEstNote:   { fontSize: 11, color: DS.warningText, lineHeight: 15, marginTop: 2 },
  statsRow:         { flexDirection: 'row', alignItems: 'center' },
  statBox:          { flex: 1, alignItems: 'center', gap: 2 },
  statDivider:      { width: 1, height: 28, backgroundColor: DS.border },
  statVal:          { fontSize: 13, fontWeight: '800', color: DS.textPrimary },
  statLabel:        { fontSize: 9, color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
  // Verdict card
  verdictCard:      { borderRadius: 14, padding: 16, borderWidth: 1.5, gap: 10 },
  verdictTop:       { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  verdictEyebrow:   { fontSize: 10, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.8, marginBottom: 2 },
  verdictLabel:     { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  confidenceBadge:  { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center' },
  confidenceNum:    { fontSize: 20, fontWeight: '900' },
  confidenceLabel:  { fontSize: 9, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
  confBarTrack:     { height: 5, backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' },
  confBarFill:      { height: 5, borderRadius: 3 },
  verdictSummary:   { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  reasonRow:        { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonDot:        { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  reasonText:       { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  // Gaps card
  gapsCard:         { backgroundColor: DS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 4 },
  gapsHeader:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  gapsTitle:        { fontSize: 15, fontWeight: '700', color: DS.textPrimary },
  gapsBadge:        { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: DS.accent + '18' },
  gapsBadgeText:    { fontSize: 11, fontWeight: '700', color: DS.accent },
  gapsSub:          { fontSize: 12, color: DS.textMuted, marginBottom: 4 },
  gapRow:           { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: DS.bgCanvas, borderRadius: 10, padding: 10, borderWidth: 1, borderColor: DS.border },
  gapIndex:         { width: 22, height: 22, borderRadius: 11, backgroundColor: DS.accent + '18', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  gapIndexText:     { fontSize: 11, fontWeight: '800', color: DS.accent },
  gapText:          { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  // Search again
  searchAgainBtn:   { alignItems: 'center', paddingVertical: 12 },
  searchAgainText:  { fontSize: 13, color: DS.accent, fontWeight: '600' },
});

// ─── Find Opportunities Modal ─────────────────────────────────────────────────

type NicheSuggestion = {
  niche:             string;
  verdict:           'LAUNCH' | 'TEST' | 'AVOID' | string;
  reason:            string;
  estimated_margin:  string;
  competition_level: 'Low' | 'Medium' | 'High' | string;
};

function FindOpportunitiesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile }               = useSellerProfile();
  const { can, increment }        = useSubscription();
  const [tab, setTab]             = useState<'foryou' | 'search'>('foryou');
  const [fyLoading, setFyLoading] = useState(false);
  const [fyResult, setFyResult]   = useState<NicheSuggestion[]>([]);
  const [fyError, setFyError]     = useState('');
  const [srQuery, setSrQuery]     = useState('');
  const [srLoading, setSrLoading] = useState(false);
  const [srResult, setSrResult]   = useState<any>(null);
  const [srError, setSrError]     = useState('');
  const [showPaywall, setShowPaywall] = useState(false);

  const generateForYou = useCallback(async () => {
    if (!can('research')) { setShowPaywall(true); return; }
    await increment('research');
    setFyLoading(true); setFyError(''); setFyResult([]);
    const ctx = profile
      ? `Budget: $${profile.budget}, marketplace: ${profile.marketplace}, price range: $${profile.priceMin}–$${profile.priceMax}, experience: ${profile.experience}`
      : 'New seller, US marketplace, $3000 budget, price range $20–$60';
    try {
      const res = await api.askAI(
        'You are an FBA product researcher. Suggest exactly 3 profitable FBA product niches for this seller. Respond ONLY with a JSON array, no other text. Format: [{"niche":"string","verdict":"LAUNCH"|"TEST"|"AVOID","reason":"string","estimated_margin":"string","competition_level":"Low"|"Medium"|"High"}]',
        ctx,
      );
      const raw = res.answer ?? '';
      const match = raw.match(/\[[\s\S]*?\]/);
      if (!match) throw new Error('No suggestions returned. Tap retry.');
      const parsed = safeParseJSON<unknown[]>(match[0]);
      if (!parsed || !Array.isArray(parsed) || parsed.length === 0) throw new Error('No results. Tap retry.');
      // Runtime type guard — filter out any items missing required fields
      const valid = parsed.filter(
        (item): item is NicheSuggestion =>
          typeof item === 'object' && item !== null &&
          typeof (item as any).niche === 'string' &&
          typeof (item as any).verdict === 'string' &&
          typeof (item as any).reason === 'string',
      );
      if (valid.length === 0) throw new Error('Unexpected response format. Tap retry.');
      setFyResult(valid);
    } catch (e: any) {
      setFyError(e?.message ?? 'Something went wrong. Tap retry.');
    } finally {
      setFyLoading(false);
    }
  }, [profile]);

  const handleSearch = useCallback(async () => {
    const q = srQuery.trim();
    if (!q) return;
    setSrLoading(true); setSrError(''); setSrResult(null);
    try {
      const res = await api.searchNiche({
        keyword: q,
        marketplace: profile?.marketplace ?? 'US',
        budget: profile?.budget ?? 3000,
        price_min: profile?.priceMin ?? 15,
        price_max: profile?.priceMax ?? 80,
        max_top_seller_reviews: profile?.maxTopSellerReviews ?? 500,
      });
      setSrResult(res);
    } catch (e: any) {
      setSrError(e?.message ?? 'Something went wrong.');
    } finally {
      setSrLoading(false);
    }
  }, [srQuery, profile]);

  const handleClose = () => {
    setTab('foryou'); setFyResult([]); setSrResult(null);
    setSrQuery(''); setSrError(''); setFyError('');
    onClose();
  };

  return (
    <>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="AI Opportunity Finder" />
      <ToolModal visible={visible} title="Find Opportunities" subtitle="Niches matched to your profile" onClose={handleClose}>
      {/* Tab toggle */}
      <View style={fo.tabs}>
        {(['foryou', 'search'] as const).map(t => (
          <TouchableOpacity key={t} style={[fo.tab, tab === t && fo.tabActive]} onPress={() => setTab(t)}>
            <Text style={[fo.tabText, tab === t && fo.tabTextActive]}>
              {t === 'foryou' ? '✦  For You' : '◎  Search'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── For You ── */}
      {tab === 'foryou' && (
        <View style={{ gap: 14, marginTop: 4 }}>
          {/* Profile context strip */}
          {profile && (
            <View style={fo.profileStrip}>
              <Text style={fo.profileStripText}>
                {profile.marketplace} · ${profile.budget.toLocaleString()} budget · ${profile.priceMin}–${profile.priceMax} price range
              </Text>
            </View>
          )}

          {/* Idle / empty state */}
          {!fyLoading && fyResult.length === 0 && !fyError && (
            <View style={fo.emptyState}>
              <Text style={fo.emptyIcon}>💡</Text>
              <Text style={fo.emptyTitle}>Ready to find your niche?</Text>
              <Text style={fo.emptySub}>AI will suggest 3 product opportunities matched to your budget, marketplace, and experience level.</Text>
              <TouchableOpacity style={fo.generateBtn} onPress={generateForYou} activeOpacity={0.85}>
                <Text style={fo.generateBtnText}>Generate Suggestions →</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Loading */}
          {fyLoading && (
            <View style={fo.loadingState}>
              <ActivityIndicator color={DS.accent} />
              <Text style={fo.loadingText}>Analyzing your profile…</Text>
            </View>
          )}

          {/* Error */}
          {!!fyError && !fyLoading && (
            <View style={fo.errorState}>
              <Text style={fo.errorText}>{fyError}</Text>
              <TouchableOpacity style={fo.retryBtn} onPress={generateForYou} activeOpacity={0.8}>
                <Text style={fo.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Results */}
          {fyResult.length > 0 && (
            <>
              {fyResult.map((item, i) => (
                <View key={i} style={fo.nicheCard}>
                  <View style={fo.nicheCardHeader}>
                    <Text style={fo.nicheTitle} numberOfLines={2}>{item.niche}</Text>
                    {item.verdict && <VerdictBadge verdict={item.verdict} />}
                  </View>
                  <Text style={fo.nicheReason}>{item.reason}</Text>
                  <View style={fo.nicheMetas}>
                    {item.estimated_margin && (
                      <View style={fo.metaChip}>
                        <Text style={fo.metaChipLabel}>Margin</Text>
                        <Text style={fo.metaChipVal}>{item.estimated_margin}</Text>
                      </View>
                    )}
                    {item.competition_level && (
                      <View style={fo.metaChip}>
                        <Text style={fo.metaChipLabel}>Competition</Text>
                        <Text style={fo.metaChipVal}>{item.competition_level}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
              <TouchableOpacity style={fo.retryBtn} onPress={generateForYou} activeOpacity={0.8}>
                <Text style={fo.retryText}>↻  Regenerate</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* ── Search ── */}
      {tab === 'search' && (
        <View style={{ gap: 14, marginTop: 4 }}>
          <View style={ap.inputRow}>
            <TextInput
              style={ap.input}
              placeholder="e.g. bamboo kitchen tools"
              placeholderTextColor={DS.textMuted}
              value={srQuery}
              onChangeText={setSrQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={ap.searchBtn} onPress={handleSearch} disabled={srLoading || !srQuery.trim()}>
              <Text style={ap.searchBtnText}>Go</Text>
            </TouchableOpacity>
          </View>

          {!srLoading && !srResult && !srError && (
            <View style={fo.searchHint}>
              <Text style={fo.searchHintText}>Enter a product category or keyword to get a full niche report — verdict, market snapshot, the gap, and affordability check.</Text>
            </View>
          )}

          {srLoading && (
            <View style={fo.loadingState}>
              <ActivityIndicator color={DS.accent} />
              <Text style={fo.loadingText}>Researching niche…</Text>
            </View>
          )}

          {!!srError && <Text style={fo.errorText}>{srError}</Text>}

          {srResult && (
            <View style={{ gap: 12 }}>
              {/* Verdict header card */}
              {srResult.verdict && (
                <View style={fo.resultCard}>
                  <View style={fo.resultCardHeader}>
                    <Text style={fo.resultCardTitle}>{srQuery}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <EstimateLabel type={srResult.data_source && srResult.data_source !== 'stub' ? 'confirmed' : 'estimated'} />
                      <VerdictBadge verdict={srResult.verdict.label} />
                    </View>
                  </View>
                  {(!srResult.data_source || srResult.data_source === 'stub') && (
                    <Text style={fo.nicheReason}>Live Amazon data isn't connected yet — the numbers below are placeholders, not real market data.</Text>
                  )}
                  <View style={fo.scoreRow}>
                    <Text style={fo.scoreLabel}>Score</Text>
                    <View style={fo.scoreBarTrack}>
                      <View style={[fo.scoreBarFill, { width: `${(srResult.verdict.score / 10) * 100}%` as any }]} />
                    </View>
                    <Text style={fo.scoreNum}>{srResult.verdict.score}/10</Text>
                  </View>
                  {srResult.verdict.reasons?.map((r: string, i: number) => (
                    <Text key={i} style={fo.nicheReason}>• {r}</Text>
                  ))}
                </View>
              )}

              {/* Stats row */}
              {srResult.market_snapshot && (
                <View style={fo.statsGrid}>
                  <View style={fo.statBox}>
                    <Text style={fo.statBoxVal}>${srResult.market_snapshot.avg_price?.toFixed(0) ?? '—'}</Text>
                    <Text style={fo.statBoxLabel}>Avg Price</Text>
                  </View>
                  <View style={fo.statBox}>
                    <Text style={fo.statBoxVal}>{srResult.market_snapshot.avg_reviews?.toLocaleString() ?? '—'}</Text>
                    <Text style={fo.statBoxLabel}>Avg Reviews</Text>
                  </View>
                  <View style={fo.statBox}>
                    <Text style={fo.statBoxVal}>{srResult.market_snapshot.total_products ?? '—'}</Text>
                    <Text style={fo.statBoxLabel}>Listings</Text>
                  </View>
                </View>
              )}

              {/* The Gap */}
              {srResult.the_gap && (
                <View style={fo.resultCard}>
                  <Text style={fo.resultCardSectionLabel}>The Gap</Text>
                  <Text style={fo.nicheReason}>{srResult.the_gap}</Text>
                </View>
              )}

              {/* Affordability */}
              {srResult.can_you_afford_it && (
                <View style={fo.resultCard}>
                  <Text style={fo.resultCardSectionLabel}>Can you afford it?</Text>
                  <Text style={fo.nicheReason}>{srResult.can_you_afford_it.summary}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}
    </ToolModal>
    </>
  );
}

const fo = StyleSheet.create({
  // Tabs
  tabs:          { flexDirection: 'row', backgroundColor: DS.bgCanvas, borderRadius: 10, padding: 3, marginTop: 16, borderWidth: 1, borderColor: DS.border },
  tab:           { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  tabActive:     { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tabText:       { fontSize: 13, fontWeight: '600', color: DS.textMuted },
  tabTextActive: { color: DS.accent, fontWeight: '700' },
  // Profile strip
  profileStrip:     { backgroundColor: DS.accentLight, borderRadius: DS.radiusChip, paddingHorizontal: 12, paddingVertical: 7 },
  profileStripText: { fontSize: 12, color: DS.accent, fontWeight: '500' },
  // Empty / idle state
  emptyState:    { alignItems: 'center', gap: 10, paddingVertical: 32, paddingHorizontal: 12 },
  emptyIcon:     { fontSize: 36 },
  emptyTitle:    { fontSize: 17, fontWeight: '700', color: DS.textPrimary, textAlign: 'center' },
  emptySub:      { fontSize: 13, color: DS.textMuted, textAlign: 'center', lineHeight: 19 },
  generateBtn:   { backgroundColor: DS.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, marginTop: 4 },
  generateBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  // Loading
  loadingState:  { alignItems: 'center', gap: 10, paddingVertical: 32 },
  loadingText:   { fontSize: 13, color: DS.textMuted },
  // Error
  errorState:    { alignItems: 'center', gap: 12, paddingVertical: 24 },
  errorText:     { color: DS.danger, textAlign: 'center', fontSize: 13, lineHeight: 19 },
  retryBtn:      { borderWidth: 1, borderColor: DS.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  retryText:     { color: DS.accent, fontWeight: '700', fontSize: 13 },
  // Niche cards (For You)
  nicheCard:       { backgroundColor: DS.bgCanvas, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 8 },
  nicheCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  nicheTitle:      { flex: 1, fontSize: 15, fontWeight: '700', color: DS.textPrimary, lineHeight: 20 },
  nicheReason:     { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  nicheMetas:      { flexDirection: 'row', gap: 8 },
  metaChip:        { flex: 1, backgroundColor: DS.bgCard, borderRadius: 8, padding: 8, alignItems: 'center', gap: 2, borderWidth: 1, borderColor: DS.border },
  metaChipLabel:   { fontSize: 10, color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  metaChipVal:     { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  // Search hint
  searchHint:      { backgroundColor: DS.bgCanvas, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: DS.border },
  searchHintText:  { fontSize: 13, color: DS.textMuted, lineHeight: 19 },
  // Search results
  resultCard:           { backgroundColor: DS.bgCanvas, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 8 },
  resultCardHeader:     { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  resultCardTitle:      { flex: 1, fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  resultCardSectionLabel: { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  scoreRow:       { flexDirection: 'row', alignItems: 'center', gap: 8 },
  scoreLabel:     { fontSize: 11, color: DS.textMuted, width: 36 },
  scoreBarTrack:  { flex: 1, height: 5, backgroundColor: DS.border, borderRadius: 3, overflow: 'hidden' },
  scoreBarFill:   { height: 5, backgroundColor: DS.accent, borderRadius: 3 },
  scoreNum:       { fontSize: 12, fontWeight: '700', color: DS.accent, width: 30 },
  statsGrid:      { flexDirection: 'row', gap: 8 },
  statBox:        { flex: 1, backgroundColor: DS.bgCanvas, borderRadius: 10, padding: 10, alignItems: 'center', gap: 3, borderWidth: 1, borderColor: DS.border },
  statBoxVal:     { fontSize: 15, fontWeight: '800', color: DS.textPrimary },
  statBoxLabel:   { fontSize: 10, color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ─── Ask Copilot Modal ────────────────────────────────────────────────────────

const QUICK_CHIPS = [
  'What should I sell this season?',
  'How do I beat a saturated market?',
  'Is my margin healthy?',
  'Why is this product freight sensitive?',
  'Should I use 1688 instead of Alibaba?',
  'Is this product beginner-friendly to source?',
  'Should I source locally instead?',
  'What should I do next in sourcing?',
];

// Builds the human-readable seller context sent to the AI.
// When copilotContext is provided (from ProductIntelligenceProfile), it contains the
// full supply chain intelligence — so we only include seller/product/niche data here
// to avoid duplicating what the profile already covers.
function buildSourcingContext(
  pipeline:       ReturnType<typeof usePipeline>,
  profile:        ReturnType<typeof useSellerProfile>['profile'],
  copilotContext?: string,
): string {
  const parts: string[] = [];

  if (profile) {
    parts.push(`Seller experience: ${profile.experience}. Marketplace: ${profile.marketplace}. Budget: $${profile.budget}.`);
  }

  if (pipeline.activeProduct) {
    parts.push(`Active product: "${pipeline.activeProduct.title}" priced at $${pipeline.activeProduct.price}.`);
    if (pipeline.activeProduct.reviews != null) {
      parts.push(`Product reviews: ${pipeline.activeProduct.reviews.toLocaleString()}.`);
    }
  }

  if (pipeline.activeNiche) {
    parts.push(`Niche: "${pipeline.activeNiche.keyword}" (score ${pipeline.activeNiche.score}/5, ${pipeline.activeNiche.verdictLabel}).`);
  }

  // Supplier + sourcing strategy are fully covered by the intelligence copilotContext.
  // Only include them when the profile context is absent (no product/supplier yet).
  if (!copilotContext) {
    if (pipeline.selectedSupplier) {
      parts.push(`Supplier: ${pipeline.selectedSupplier.name} at $${pipeline.selectedSupplier.unitCost}/unit, MOQ ${pipeline.selectedSupplier.moq}.`);
    }
    if (pipeline.costModel) {
      parts.push(`Cost model: $${pipeline.costModel.netProfit.toFixed(2)}/unit profit, ${pipeline.costModel.marginPct.toFixed(0)}% margin.`);
    }
  }

  const base = parts.length > 0
    ? `Seller context:\n${parts.join('\n')}`
    : 'FBA seller looking for actionable advice.';

  if (copilotContext) {
    return `${base}\n\n${copilotContext}`;
  }

  return base;
}

function AskCopilotModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pipeline        = usePipeline();
  const { profile }     = useSellerProfile();
  const intelProfile    = useProductIntelligence();
  const [question, setQuestion] = useState('');
  const [loading, setLoading]   = useState(false);
  const [slowConn, setSlowConn] = useState(false);
  const [answer, setAnswer]     = useState('');
  const [error, setError]       = useState('');

  useEffect(() => {
    if (!loading) { setSlowConn(false); return; }
    const t = setTimeout(() => setSlowConn(true), 6_000);
    return () => clearTimeout(t);
  }, [loading]);

  const ask = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setQuestion(q); setLoading(true); setError(''); setAnswer('');
    try {
      const context = buildSourcingContext(pipeline, profile, intelProfile?.copilotContext);
      const res = await api.askAI(q, context);
      setAnswer((res as any).answer ?? String(res));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to get answer.');
    } finally {
      setLoading(false);
    }
  }, [pipeline, profile, intelProfile]);

  const handleClose = () => { setQuestion(''); setAnswer(''); setError(''); onClose(); };

  return (
    <ToolModal visible={visible} title="Ask Copilot" subtitle="Your FBA advisor, always on" onClose={handleClose}>
      <View style={{ gap: 8, marginTop: 16 }}>
        <Text style={aq.chipLabel}>Quick questions</Text>
        <View style={aq.chipWrap}>
          {QUICK_CHIPS.map(chip => (
            <TouchableOpacity key={chip} style={aq.chip} onPress={() => ask(chip)}>
              <Text style={aq.chipText}>{chip}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={aq.inputRow}>
          <TextInput
            style={aq.input}
            placeholder="Ask anything…"
            placeholderTextColor={DS.textMuted}
            value={question}
            onChangeText={setQuestion}
            onSubmitEditing={() => ask(question)}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity style={aq.sendBtn} onPress={() => ask(question)} disabled={loading || !question.trim()}>
            <Text style={aq.sendBtnText}>→</Text>
          </TouchableOpacity>
        </View>

        {loading && (
          <View style={{ alignItems: 'center', marginTop: 24, gap: 6 }}>
            <ActivityIndicator color={DS.accent} />
            {slowConn && <Text style={{ fontSize: 12, color: DS.textMuted, textAlign: 'center' }}>Connecting to server… first request may take a moment.</Text>}
          </View>
        )}
        {!!error && <Text style={aq.errorText}>{error}</Text>}

        {!!answer && (
          <View style={aq.answerCard}>
            <Text style={aq.answerLabel}>Copilot</Text>
            <Text style={aq.answerText}>{answer}</Text>
          </View>
        )}
      </View>
    </ToolModal>
  );
}

const aq = StyleSheet.create({
  chipLabel:   { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipWrap:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:        { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: DS.bgCard, borderWidth: 1, borderColor: DS.border },
  chipText:    { fontSize: 13, color: DS.textSecondary },
  inputRow:    { flexDirection: 'row', gap: 8, marginTop: 4 },
  input:       { flex: 1, minHeight: 44, maxHeight: 88, borderRadius: 10, borderWidth: 1, borderColor: DS.border, paddingHorizontal: 14, paddingTop: 12, fontSize: 14, color: DS.textPrimary, backgroundColor: DS.bgCard },
  sendBtn:     { width: 44, height: 44, borderRadius: 10, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: -2 },
  errorText:   { color: DS.danger, fontSize: 14, textAlign: 'center', marginTop: 12 },
  answerCard:  { backgroundColor: DS.accentLight, borderRadius: 12, padding: 14 },
  answerLabel: { fontSize: 11, fontWeight: '700', color: DS.accent, letterSpacing: 0.5, marginBottom: 6 },
  answerText:  { fontSize: 14, color: DS.textPrimary, lineHeight: 21 },
});

// ─── AI Tools Row ─────────────────────────────────────────────────────────────

function AITools() {
  const [showAnalyze,  setShowAnalyze]  = useState(false);
  const [showOpps,     setShowOpps]     = useState(false);
  const [showAsk,      setShowAsk]      = useState(false);
  const [showGlossary, setShowGlossary] = useState(false);

  const tools = [
    { icon: '🔍', label: 'Get a\nVerdict',       color: DS.accentLight, border: DS.accent + '40', onPress: () => setShowAnalyze(true) },
    { icon: '💡', label: 'Find\nOpportunities', color: DS.successBg,   border: DS.success + '40', onPress: () => setShowOpps(true) },
    { icon: '🤖', label: 'Ask\nCopilot',        color: DS.bgElevated,  border: DS.border,          onPress: () => setShowAsk(true) },
    { icon: '📖', label: 'FBA\nGlossary',       color: DS.warningBg,   border: DS.warning + '50', onPress: () => setShowGlossary(true) },
  ];

  return (
    <>
      <View style={at.row}>
        {tools.map(t => (
          <TouchableOpacity key={t.label} style={[at.card, { backgroundColor: t.color, borderColor: t.border }]} onPress={t.onPress} activeOpacity={0.75}>
            <Text style={at.icon}>{t.icon}</Text>
            <Text style={at.label}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <AnalyzeProductModal visible={showAnalyze} onClose={() => setShowAnalyze(false)} />
      <FindOpportunitiesModal visible={showOpps} onClose={() => setShowOpps(false)} />
      <AskCopilotModal visible={showAsk} onClose={() => setShowAsk(false)} />
      <FBAGlossaryModal visible={showGlossary} onClose={() => setShowGlossary(false)} />
    </>
  );
}

const at = StyleSheet.create({
  row:   { flexDirection: 'row', gap: 8 },
  card:  { flex: 1, borderRadius: 14, borderWidth: 1, padding: 12, gap: 6, alignItems: 'flex-start' },
  icon:  { fontSize: 22 },
  label: { fontSize: 12, fontWeight: '700', color: DS.textPrimary, lineHeight: 16 },
});

// ─── Winner Vault Card ────────────────────────────────────────────────────────

function marginColor(pct: number) {
  if (pct >= 35) return DS.success;
  if (pct >= 25) return DS.warning;
  return DS.danger;
}

function WinnerVaultCard({ vault }: { vault: WinnerEntry[] }) {
  const nav = useNavigation<Nav>();
  const [selected, setSelected] = useState<WinnerEntry | null>(null);
  if (!vault.length) return null;

  return (
    <View style={wv.container}>
      <View style={wv.headerRow}>
        <View>
          <Text style={wv.sectionTitle}>Winner Vault</Text>
          <Text style={wv.sectionSub}>{vault.length} product{vault.length !== 1 ? 's' : ''} ready to launch</Text>
        </View>
        <HelpButton featureKey="winner_vault" size="sm" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
        {vault.map((entry, i) => {
          const mc = marginColor(entry.marginPct ?? 0);
          return (
            <TouchableOpacity
              key={entry.sessionId + i}
              style={wv.card}
              onPress={() => setSelected(entry)}
              activeOpacity={0.75}
            >
              {/* Top accent bar */}
              <View style={[wv.accentBar, { backgroundColor: mc }]} />

              <View style={{ padding: 12, gap: 8 }}>
                <View style={wv.cardTopRow}>
                  <View style={[wv.verdictDot, { backgroundColor: mc }]} />
                  <Text style={[wv.verdictLabel, { color: mc }]}>
                    {entry.marginPct >= 35 ? 'LAUNCH' : entry.marginPct >= 25 ? 'VIABLE' : 'REVIEW'}
                  </Text>
                  <Text style={wv.cardTapHint}>Tap ›</Text>
                </View>

                <Text style={wv.productTitle} numberOfLines={2}>{entry.productTitle}</Text>
                <Text style={wv.brand}>{entry.brandName}</Text>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
                  <View style={wv.stat}>
                    <Text style={[wv.statVal, { color: mc }]}>{entry.marginPct?.toFixed(0)}%</Text>
                    <Text style={wv.statLabel}>Margin</Text>
                  </View>
                  <View style={wv.stat}>
                    <Text style={[wv.statVal, { color: DS.accent }]}>{entry.roiPct?.toFixed(0)}%</Text>
                    <Text style={wv.statLabel}>ROI</Text>
                  </View>
                  <View style={wv.stat}>
                    <Text style={[wv.statVal, { color: DS.success, fontSize: 11 }]}>
                      ${entry.monthlyProfitEst?.toLocaleString()}
                    </Text>
                    <Text style={wv.statLabel}>Mo. Profit</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <WinnerVaultDetailModal entry={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const wv = StyleSheet.create({
  container:    { gap: 10 },
  headerRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.3 },
  sectionSub:   { fontSize: 11, color: DS.textMuted, marginTop: 2 },
  link:         { fontSize: 13, color: DS.accent, fontWeight: '600', marginTop: 3 },
  card:         { width: 182, backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  accentBar:    { height: 4, width: '100%' },
  cardTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verdictDot:   { width: 6, height: 6, borderRadius: 3 },
  verdictLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, flex: 1 },
  cardTapHint:  { fontSize: 10, color: DS.textMuted },
  productTitle: { fontSize: 13, fontWeight: '600', color: DS.textPrimary, lineHeight: 18 },
  brand:        { fontSize: 11, color: DS.textMuted },
  stat:         { flex: 1, alignItems: 'center', backgroundColor: DS.bgSubtle, borderRadius: 8, paddingVertical: 7 },
  statVal:      { fontSize: 12, fontWeight: '800' },
  statLabel:    { fontSize: 9, color: DS.textMuted, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ─── Greeting Header ──────────────────────────────────────────────────────────

const MORNING_LINES = [
  'Today could be the day you find it.',
  'The best products aren\'t found — they\'re hunted.',
  'Your next winner is one search away.',
  'Early hours, big moves. Let\'s go.',
  'Market opens fresh every morning.',
];
const AFTERNOON_LINES = [
  'Momentum is everything. Keep building.',
  'Good products don\'t wait. Neither should you.',
  'Your pipeline is calling.',
  'The grind is the strategy.',
  'Every stage you complete is a decision made.',
];
const EVENING_LINES = [
  'Great founders review. You\'re in the right place.',
  'End the day with a decision, not a question.',
  'One more stage. One step closer to launch.',
  'The vault grows one product at a time.',
  'Review the numbers. Trust the process.',
];

function extractFirstName(email: string | null | undefined): string {
  if (!email) return 'Founder';
  const local = email.split('@')[0];
  const cleaned = local.replace(/[0-9._\-]/g, ' ').trim();
  const first = cleaned.split(' ').find(w => w.length > 1) ?? cleaned;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function GreetingHeader({ vaultCount, analyzed, lookupsLeft, isFree }: { vaultCount: number; analyzed: number; lookupsLeft: number; isFree: boolean }) {
  const { user }   = useAuth();
  const hour       = new Date().getHours();
  const name       = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).split(' ')[0]
    : extractFirstName(user?.email);

  const timeLabel  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const lines      = hour < 12 ? MORNING_LINES : hour < 17 ? AFTERNOON_LINES : EVENING_LINES;
  const [tagline]  = useState(() => lines[new Date().getDate() % lines.length]);

  const roleLabel  = vaultCount >= 3 ? 'Serial Founder' : vaultCount >= 1 ? 'FBA Founder' : 'Future Founder';
  const roleIcon   = vaultCount >= 3 ? '🏆' : vaultCount >= 1 ? '🚀' : '⚡';

  const statCells = [
    { value: String(analyzed),  label: 'Analyzed' },
    { value: String(vaultCount), label: 'Saved' },
    { value: isFree ? String(lookupsLeft) : '∞', label: isFree ? 'Lookups left' : 'Lookups' },
  ];

  return (
    <View style={gh.card}>
      {/* Top row: greeting + role badge */}
      <View style={gh.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={gh.timeLabel}>{timeLabel}</Text>
          <Text style={gh.name}>{name} <Text style={gh.wave}>👋</Text></Text>
        </View>
        <View style={gh.roleBadge}>
          <Text style={gh.roleIcon}>{roleIcon}</Text>
          <Text style={gh.roleText}>{roleLabel}</Text>
        </View>
      </View>

      {/* Tagline */}
      <Text style={gh.tagline}>{tagline}</Text>

      {/* Stats strip */}
      <View style={gh.statsRow}>
        {statCells.map((c, i) => (
          <View key={c.label} style={[gh.statCell, i < statCells.length - 1 && gh.statCellBorder]}>
            <Text style={gh.statValue}>{c.value}</Text>
            <Text style={gh.statLabel}>{c.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const gh = StyleSheet.create({
  card: {
    backgroundColor: DS.bgCard,
    borderRadius: DS.radiusCard,
    padding: 18,
    borderWidth: 1,
    borderColor: DS.border,
    gap: 14,
  },
  topRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  timeLabel: { fontSize: 10, fontWeight: '700', color: DS.textMuted, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 },
  name:      { fontSize: 30, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.8, lineHeight: 35 },
  wave:      { fontSize: 26 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: DS.accent, borderRadius: DS.radiusBadge,
    paddingHorizontal: 12, paddingVertical: 7,
    flexShrink: 0,
  },
  roleIcon:  { fontSize: 12 },
  roleText:  { fontSize: 11, fontWeight: '800', color: DS.textInverse, letterSpacing: 0.3 },
  tagline:   { fontSize: 14, color: DS.textSecondary, lineHeight: 20, fontStyle: 'italic' },
  statsRow:       { flexDirection: 'row', gap: 8 },
  statCell:       { flex: 1, alignItems: 'center', gap: 3, backgroundColor: DS.bgSubtle, borderRadius: 12, borderWidth: 1, borderColor: DS.border, paddingVertical: 12 },
  statCellBorder: {},
  statValue:      { fontSize: 18, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  statLabel:      { fontSize: 9, fontWeight: '700', color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
});

// ─── Launch Report HTML generator ────────────────────────────────────────────

function generateReportHTML(p: ReturnType<typeof usePipeline>): string {
  const product  = p.activeProduct;
  const niche    = p.activeNiche;
  const supplier = p.selectedSupplier;
  const freight  = p.freightEstimate;
  const costs    = p.costModel;
  const brand    = p.brandData;
  const recon    = p.reconInsights;
  const date     = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  const supplierEmail = supplier ? `Subject: Product Inquiry – ${product?.title ?? 'Your Product'}

Dear ${supplier.name} Team,

I am interested in sourcing the following product and would like to discuss a potential long-term partnership.

Product: ${product?.title ?? 'As discussed'}
Target Quantity: ${costs?.unitsOrdered ?? 500} units (initial order)
Target Unit Price: $${supplier.unitCost}
MOQ Required: ${supplier.moq}

Could you please confirm:
1. Availability and lead time (currently estimated ${supplier.leadTimeDays ?? 30} days)
2. Sample availability and cost
3. Customisation options (packaging, labelling)
4. Payment terms

I look forward to your response.

Best regards,
${brand?.brandName ?? 'Our Brand'}` : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Launch Report – ${product?.title ?? 'Product'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #0D1B4B; background: #F5F7FF; padding: 24px; font-size: 14px; line-height: 1.6; }
  .page { max-width: 720px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 32px; box-shadow: 0 2px 16px rgba(0,0,0,0.08); }
  h1 { font-size: 26px; font-weight: 800; color: #2563EB; margin-bottom: 4px; }
  .meta { font-size: 12px; color: #8196B0; margin-bottom: 32px; }
  h2 { font-size: 14px; font-weight: 800; color: #2563EB; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E6ECFF; padding-bottom: 6px; margin: 28px 0 14px; }
  .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #F0F4FF; }
  .label { color: #5C6B8A; font-weight: 600; }
  .value { font-weight: 700; color: #0D1B4B; text-align: right; max-width: 60%; }
  .verdict { display: inline-block; padding: 6px 18px; border-radius: 999px; font-weight: 900; font-size: 16px; margin: 8px 0 16px; }
  .verdict.launch { background: #D1FAE5; color: #065F46; }
  .verdict.test { background: #FEF3C7; color: #92400E; }
  .verdict.hold { background: #FEF3C7; color: #92400E; }
  .verdict.avoid { background: #FEE2E2; color: #991B1B; }
  .tag { display: inline-block; background: #EEF2FA; color: #2563EB; border-radius: 6px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin: 3px 3px 3px 0; }
  .email-block { background: #F5F7FF; border-radius: 10px; padding: 16px; font-family: monospace; font-size: 12px; white-space: pre-wrap; line-height: 1.7; color: #0D1B4B; }
  ul { padding-left: 18px; }
  li { margin-bottom: 6px; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #8196B0; }
</style>
</head>
<body>
<div class="page">
  <h1>🚀 Launch Report</h1>
  <div class="meta">Generated by Siftly · ${date}</div>

  ${niche ? `
  <h2>Market Research</h2>
  <div class="row"><span class="label">Niche</span><span class="value">${niche.keyword}</span></div>
  <div class="row"><span class="label">Marketplace</span><span class="value">${niche.marketplace}</span></div>
  <div class="row"><span class="label">Niche Score</span><span class="value">${niche.score}/100</span></div>
  <div class="row"><span class="label">Verdict</span><span class="value">${niche.verdictLabel}</span></div>
  ` : ''}

  ${product ? `
  <h2>Product</h2>
  <div class="row"><span class="label">Title</span><span class="value">${product.title}</span></div>
  <div class="row"><span class="label">Price</span><span class="value">$${product.price}</span></div>
  <div class="row"><span class="label">Reviews</span><span class="value">${product.reviews?.toLocaleString() ?? '—'}</span></div>
  <div class="row"><span class="label">Rating</span><span class="value">${product.rating ?? '—'} ★</span></div>
  <div class="row"><span class="label">Competition</span><span class="value">${product.competition ?? '—'}</span></div>
  ${product.salesEstLow ? `<div class="row"><span class="label">Est. Monthly Sales</span><span class="value">${product.salesEstLow}–${product.salesEstHigh} units</span></div>` : ''}
  ` : ''}

  ${recon ? `
  <h2>Competitor Recon</h2>
  ${recon.complaints?.length ? `<p style="font-weight:700;margin-bottom:6px;">Customer Complaints</p><ul>${recon.complaints.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
  ${recon.opportunities?.length ? `<p style="font-weight:700;margin:12px 0 6px;">Opportunities</p><ul>${recon.opportunities.map(o => `<li>${o}</li>`).join('')}</ul>` : ''}
  ${recon.improvementSpecs?.length ? `<p style="font-weight:700;margin:12px 0 6px;">Improvement Specs</p><ul>${recon.improvementSpecs.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}
  ` : ''}

  ${supplier ? `
  <h2>Supplier</h2>
  <div class="row"><span class="label">Name</span><span class="value">${supplier.name}</span></div>
  <div class="row"><span class="label">Platform</span><span class="value">${supplier.platform}</span></div>
  <div class="row"><span class="label">Unit Cost</span><span class="value">$${supplier.unitCost}</span></div>
  <div class="row"><span class="label">MOQ</span><span class="value">${supplier.moq} units</span></div>
  ${supplier.leadTimeDays ? `<div class="row"><span class="label">Lead Time</span><span class="value">${supplier.leadTimeDays} days</span></div>` : ''}
  ${supplier.country ? `<div class="row"><span class="label">Country</span><span class="value">${supplier.country}</span></div>` : ''}
  ${supplier.url ? `<div class="row"><span class="label">URL</span><span class="value"><a href="${supplier.url}" style="color:#2563EB">View Listing</a></span></div>` : ''}
  ` : ''}

  ${freight ? `
  <h2>Freight & Logistics</h2>
  <div class="row"><span class="label">Mode</span><span class="value">${freight.selectedMode.toUpperCase()}</span></div>
  <div class="row"><span class="label">Per Unit Cost</span><span class="value">$${freight.perUnitCost}</span></div>
  <div class="row"><span class="label">Total Freight</span><span class="value">$${freight.totalCost}</span></div>
  <div class="row"><span class="label">Origin</span><span class="value">${freight.originCountry}</span></div>
  <div class="row"><span class="label">Destination</span><span class="value">${freight.destinationMarketplace}</span></div>
  ` : ''}

  ${costs ? `
  <h2>Financial Model</h2>
  <div class="row"><span class="label">Selling Price</span><span class="value">$${costs.sellingPrice.toFixed(2)}</span></div>
  <div class="row"><span class="label">Unit Cost</span><span class="value">$${costs.unitCost.toFixed(2)}</span></div>
  <div class="row"><span class="label">Freight / Unit</span><span class="value">$${costs.freight.toFixed(2)}</span></div>
  <div class="row"><span class="label">FBA Fee</span><span class="value">$${costs.fbaFee.toFixed(2)}</span></div>
  <div class="row"><span class="label">Referral Fee</span><span class="value">$${costs.referralFee.toFixed(2)}</span></div>
  <div class="row"><span class="label">Total Cost</span><span class="value">$${costs.totalCost.toFixed(2)}</span></div>
  <div class="row" style="background:#EEF2FA;border-radius:8px;padding:10px;margin-top:8px;"><span class="label">Net Profit / Unit</span><span class="value" style="color:#2563EB;font-size:16px;">$${costs.netProfit.toFixed(2)}</span></div>
  <div class="row"><span class="label">Margin</span><span class="value">${costs.marginPct.toFixed(1)}%</span></div>
  <div class="row"><span class="label">ROI</span><span class="value">${costs.roiPct.toFixed(1)}%</span></div>
  <div class="row"><span class="label">Units Ordered</span><span class="value">${costs.unitsOrdered}</span></div>
  <div class="row"><span class="label">Total Investment</span><span class="value">$${costs.totalInvestment.toFixed(2)}</span></div>
  ` : ''}

  ${brand ? `
  <h2>Brand</h2>
  <div class="row"><span class="label">Brand Name</span><span class="value">${brand.brandName}</span></div>
  <div class="row"><span class="label">Product Title</span><span class="value">${brand.productTitle}</span></div>
  ${brand.tagline ? `<div class="row"><span class="label">Tagline</span><span class="value">${brand.tagline}</span></div>` : ''}
  ${brand.style ? `<div class="row"><span class="label">Style</span><span class="value">${brand.style}</span></div>` : ''}
  ${brand.keywords?.length ? `<div class="row"><span class="label">Keywords</span><span class="value">${brand.keywords.join(', ')}</span></div>` : ''}
  ${brand.listingTitle ? `<div class="row"><span class="label">Listing Title</span><span class="value">${brand.listingTitle}</span></div>` : ''}
  ${brand.listingBullets?.length ? `<p style="font-weight:700;margin:12px 0 6px;">Listing Bullets</p><ul>${brand.listingBullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
  ` : ''}

  ${supplier ? `
  <h2>Supplier Email Template</h2>
  <div class="email-block">${supplierEmail}</div>
  ` : ''}

  <div class="footer">Siftly · FBA Launch Report · ${date}</div>
</div>
</body>
</html>`;
}

// ─── Launch Report Modal ──────────────────────────────────────────────────────

function LaunchReportModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const pipeline  = usePipeline();
  const vault     = useVault();
  const [busy, setBusy]           = useState<'pdf' | 'email' | 'vault' | null>(null);
  const [vaultSaved, setVaultSaved] = useState(false);

  const product = pipeline.activeProduct;
  const costs   = pipeline.costModel;
  const brand   = pipeline.brandData;
  const supplier = pipeline.selectedSupplier;

  async function handleDownloadPDF() {
    setBusy('pdf');
    try {
      const html  = generateReportHTML(pipeline);
      const path  = `${FileSystem.documentDirectory}siftly-launch-report.html`;
      await FileSystem.writeAsStringAsync(path, html, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(path, { mimeType: 'text/html', dialogTitle: 'Save Launch Report' });
      } else {
        Alert.alert('Sharing unavailable', 'Cannot share files on this device.');
      }
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not generate report.');
    } finally {
      setBusy(null);
    }
  }

  function handleEmail() {
    setBusy('email');
    const subject = encodeURIComponent(`Launch Report – ${product?.title ?? 'My FBA Product'}`);
    const body    = encodeURIComponent(
      `Hi,\n\nPlease find my FBA launch report attached.\n\nProduct: ${product?.title ?? '—'}\nNet Profit: $${costs?.netProfit?.toFixed(2) ?? '—'}/unit\nMargin: ${costs?.marginPct?.toFixed(1) ?? '—'}%\nBrand: ${brand?.brandName ?? '—'}\nSupplier: ${supplier?.name ?? '—'}\n\nGenerated by Siftly.`
    );
    Linking.openURL(`mailto:?subject=${subject}&body=${body}`).finally(() => setBusy(null));
  }

  function handleSaveVault() {
    if (!product) return;
    setBusy('vault');
    const vaultProduct: Product = {
      title:        product.title,
      price:        product.price,
      rating:       product.rating,
      review_count: product.reviews,
      asin:         `siftly-${Date.now()}`,
      image:        '',
      competition:  (product.competition as any) ?? 'Unknown',
      opportunity:  costs && costs.marginPct >= 30 ? 'Good' : costs && costs.marginPct >= 20 ? 'Moderate' : 'Saturated',
      url:          product.url ?? '',
    };
    const result = vault.addEntry(vaultProduct, null, 'US', 'USD');
    setBusy(null);
    if (result.success) {
      setVaultSaved(true);
      Alert.alert('Saved to Vault ✓', `${product.title} has been added to your Winner Vault.`);
    } else {
      Alert.alert('Could not save', result.reason === 'save_limit_reached' ? 'You have reached your vault limit. Upgrade to save more.' : 'Something went wrong.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
        {/* Header */}
        <View style={rp.header}>
          <View style={{ flex: 1 }}>
            <Text style={rp.title}>Launch Report</Text>
            <Text style={rp.subtitle}>{product?.title ?? 'Your Product'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={rp.closeBtn}>
            <Text style={rp.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={rp.scroll} showsVerticalScrollIndicator={false}>

          {/* Action buttons */}
          <View style={rp.actions}>
            <TouchableOpacity style={rp.actionBtn} onPress={handleDownloadPDF} activeOpacity={0.8} disabled={!!busy}>
              {busy === 'pdf'
                ? <ActivityIndicator color="#fff" size="small" />
                : <><Text style={rp.actionIcon}>📄</Text><Text style={rp.actionLabel}>Download PDF</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={[rp.actionBtn, rp.actionBtnSecondary]} onPress={handleEmail} activeOpacity={0.8} disabled={!!busy}>
              {busy === 'email'
                ? <ActivityIndicator color={DS.accent} size="small" />
                : <><Text style={rp.actionIcon}>✉️</Text><Text style={[rp.actionLabel, { color: DS.accent }]}>Send Email</Text></>
              }
            </TouchableOpacity>
            <TouchableOpacity style={[rp.actionBtn, vaultSaved ? rp.actionBtnSaved : rp.actionBtnSecondary]} onPress={handleSaveVault} activeOpacity={0.8} disabled={!!busy || vaultSaved || !product}>
              {busy === 'vault'
                ? <ActivityIndicator color={DS.accent} size="small" />
                : <><Text style={rp.actionIcon}>{vaultSaved ? '✓' : '🏆'}</Text><Text style={[rp.actionLabel, { color: vaultSaved ? DS.accent : DS.accent }]}>{vaultSaved ? 'Saved!' : 'Save to Vault'}</Text></>
              }
            </TouchableOpacity>
          </View>

          {/* Report sections */}
          {[
            { title: '🎯 Market Research', rows: [
              ['Niche', pipeline.activeNiche?.keyword],
              ['Marketplace', pipeline.activeNiche?.marketplace],
              ['Score', pipeline.activeNiche?.score ? `${pipeline.activeNiche.score}/100` : null],
              ['Verdict', pipeline.activeNiche?.verdictLabel],
            ]},
            { title: '📦 Product', rows: [
              ['Title', product?.title],
              ['Price', product?.price ? `$${product.price}` : null],
              ['Reviews', product?.reviews ? product.reviews.toLocaleString() : null],
              ['Rating', product?.rating ? `${product.rating} ★` : null],
              ['Competition', product?.competition],
              ['Est. Sales', product?.salesEstLow ? `${product.salesEstLow}–${product.salesEstHigh} units/mo` : null],
            ]},
            { title: '🔬 Competitor Recon', rows: [
              ['Complaints found', pipeline.reconInsights?.complaints?.length ? `${pipeline.reconInsights.complaints.length} issues` : null],
              ['Opportunities', pipeline.reconInsights?.opportunities?.length ? `${pipeline.reconInsights.opportunities.length} gaps` : null],
            ]},
            { title: '🏭 Supplier', rows: [
              ['Name', supplier?.name],
              ['Platform', supplier?.platform],
              ['Unit Cost', supplier?.unitCost ? `$${supplier.unitCost}` : null],
              ['MOQ', supplier?.moq ? `${supplier.moq} units` : null],
              ['Lead Time', supplier?.leadTimeDays ? `${supplier.leadTimeDays} days` : null],
              ['Country', supplier?.country],
            ]},
            { title: '🚢 Freight', rows: [
              ['Mode', pipeline.freightEstimate?.selectedMode?.toUpperCase()],
              ['Per Unit', pipeline.freightEstimate?.perUnitCost ? `$${pipeline.freightEstimate.perUnitCost}` : null],
              ['Total', pipeline.freightEstimate?.totalCost ? `$${pipeline.freightEstimate.totalCost}` : null],
              ['Origin', pipeline.freightEstimate?.originCountry],
            ]},
            { title: '💰 Financials', rows: [
              ['Selling Price', costs?.sellingPrice ? `$${costs.sellingPrice.toFixed(2)}` : null],
              ['Unit Cost', costs?.unitCost ? `$${costs.unitCost.toFixed(2)}` : null],
              ['Freight / Unit', costs?.freight ? `$${costs.freight.toFixed(2)}` : null],
              ['FBA Fee', costs?.fbaFee ? `$${costs.fbaFee.toFixed(2)}` : null],
              ['Referral Fee', costs?.referralFee ? `$${costs.referralFee.toFixed(2)}` : null],
              ['Net Profit / Unit', costs?.netProfit ? `$${costs.netProfit.toFixed(2)}` : null],
              ['Margin', costs?.marginPct ? `${costs.marginPct.toFixed(1)}%` : null],
              ['ROI', costs?.roiPct ? `${costs.roiPct.toFixed(1)}%` : null],
              ['Units Ordered', costs?.unitsOrdered ? `${costs.unitsOrdered}` : null],
              ['Total Investment', costs?.totalInvestment ? `$${costs.totalInvestment.toFixed(2)}` : null],
            ]},
            { title: '✦ Brand', rows: [
              ['Brand Name', brand?.brandName],
              ['Product Title', brand?.productTitle],
              ['Tagline', brand?.tagline],
              ['Style', brand?.style],
              ['Keywords', brand?.keywords?.join(', ')],
            ]},
          ].map(section => {
            const validRows = section.rows.filter(([, v]) => v);
            if (!validRows.length) return null;
            return (
              <View key={section.title} style={rp.section}>
                <Text style={rp.sectionTitle}>{section.title}</Text>
                {validRows.map(([label, value]) => (
                  <View key={label} style={rp.row}>
                    <Text style={rp.rowLabel}>{label}</Text>
                    <Text style={rp.rowValue}>{value}</Text>
                  </View>
                ))}
              </View>
            );
          })}

          {/* Supplier email template */}
          {supplier && (
            <View style={rp.section}>
              <Text style={rp.sectionTitle}>✉️ Supplier Email Template</Text>
              <View style={rp.emailBlock}>
                <Text style={rp.emailText}>{`Subject: Product Inquiry – ${product?.title ?? 'Your Product'}

Dear ${supplier.name} Team,

I am interested in sourcing the following product and would like to discuss a potential partnership.

Product: ${product?.title ?? 'As discussed'}
Target Qty: ${costs?.unitsOrdered ?? 500} units (initial order)
Target Unit Price: $${supplier.unitCost}
MOQ: ${supplier.moq}

Could you confirm:
1. Availability and lead time
2. Sample availability and cost
3. Customisation options (packaging, labelling)
4. Payment terms

Looking forward to hearing from you.

Best regards,
${brand?.brandName ?? 'Our Brand'}`}</Text>
              </View>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const rp = StyleSheet.create({
  header:              { flexDirection: 'row', alignItems: 'flex-start', padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: DS.border },
  title:               { fontSize: 20, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.4 },
  subtitle:            { fontSize: 13, color: DS.textMuted, marginTop: 2 },
  closeBtn:            { width: 32, height: 32, borderRadius: 16, backgroundColor: DS.bgCanvas, alignItems: 'center', justifyContent: 'center' },
  closeTxt:            { fontSize: 14, color: DS.textMuted, fontWeight: '600' },
  scroll:              { padding: 20, gap: 16, paddingBottom: 48 },
  actions:             { flexDirection: 'row', gap: 10 },
  actionBtn:           { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 13 },
  actionBtnSecondary:  { backgroundColor: DS.bgCard, borderWidth: 1, borderColor: DS.border },
  actionBtnSaved:      { backgroundColor: DS.accent + '18', borderWidth: 1, borderColor: DS.accent + '44' },
  actionIcon:          { fontSize: 14 },
  actionLabel:         { fontSize: 12, fontWeight: '800', color: '#fff' },
  section:             { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  sectionTitle:        { fontSize: 12, fontWeight: '800', color: DS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10, borderBottomWidth: 1, borderBottomColor: DS.border },
  row:                 { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, borderTopColor: DS.border },
  rowLabel:            { fontSize: 13, color: DS.textSecondary, fontWeight: '500', flex: 1 },
  rowValue:            { fontSize: 13, color: DS.textPrimary, fontWeight: '700', flex: 1, textAlign: 'right' },
  emailBlock:          { margin: 12, backgroundColor: DS.bgCanvas, borderRadius: DS.radiusChip, padding: 14 },
  emailText:           { fontSize: 12, color: DS.textSecondary, lineHeight: 20, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
});

// ─── FBA Launch Journey (lifecycle + checklist, unified) ─────────────────────

const JOURNEY_PHASES = [
  {
    key:   'research',
    icon:  '🎯',
    label: 'Research',
    tip:   'Validate demand and competition before spending a dollar. Look for niches with steady search volume, under 300 reviews on top listings, and a price point above $25.',
    steps: [
      { key: 'niche',   icon: '🔍', label: 'Pick a Niche',         tab: 'Home'     as keyof TabParamList | null },
      { key: 'product', icon: '📦', label: 'Research a Product',   tab: 'Research' as keyof TabParamList | null },
      { key: 'recon',   icon: '🔬', label: 'Recon Competitors',    tab: 'Research' as keyof TabParamList | null },
    ],
  },
  {
    key:   'source',
    icon:  '🏭',
    label: 'Source',
    tip:   'Contact at least 5 suppliers on Alibaba. Ask for samples before committing. Negotiate MOQ down — most manufacturers will go lower than their listing. Target landed cost under 25% of selling price.',
    steps: [
      { key: 'supplier', icon: '🏭', label: 'Find a Supplier',  tab: 'Sourcing' as keyof TabParamList | null },
      { key: 'freight',  icon: '🚢', label: 'Estimate Freight', tab: 'Sourcing' as keyof TabParamList | null },
    ],
  },
  {
    key:   'profit',
    icon:  '💰',
    label: 'Profit',
    tip:   'Model your numbers before ordering. Target 30%+ margin after all FBA fees. If the margin is under 20%, renegotiate your unit cost or find a higher price point — not the other way around.',
    steps: [
      { key: 'costs', icon: '💰', label: 'Calculate Profit', tab: 'Profit' as keyof TabParamList | null },
    ],
  },
  {
    key:   'brand',
    icon:  '✦',
    label: 'Brand',
    tip:   'Your brand name and listing are your first impression. Lead the title with your primary keyword. Run auto PPC from day one and aim for 10–15 reviews in the first 30 days via Vine or follow-up.',
    steps: [
      { key: 'brand',    icon: '✦',  label: 'Create Your Brand',    tab: 'Brand' as keyof TabParamList | null },
      { key: 'decision', icon: '📋', label: 'Save Launch Decision', tab: null },
    ],
  },
  {
    key:   'scale',
    icon:  '📈',
    label: 'Scale',
    tip:   'Once ranked and cash-flow positive, expand with variations or complementary SKUs. Enrol in Brand Registry, build a storefront, and push external traffic via social or influencers to lower your ACoS.',
    steps: [],
  },
];

function getStepSubtitle(key: string, p: ReturnType<typeof usePipeline>): string {
  switch (key) {
    case 'niche':    return p.activeNiche?.keyword ?? '';
    case 'product':  return p.activeProduct?.title ?? '';
    case 'recon':    return `${p.reconInsights?.complaints?.length ?? 0} review complaints found`;
    case 'supplier': return p.selectedSupplier ? `${p.selectedSupplier.name} · $${p.selectedSupplier.unitCost}/unit` : '';
    case 'freight':  return p.freightEstimate ? `$${p.freightEstimate.perUnitCost}/unit · ${p.freightEstimate.selectedMode}` : '';
    case 'costs':    return p.costModel ? `${p.costModel.marginPct.toFixed(0)}% margin · $${p.costModel.netProfit.toFixed(2)}/unit profit` : '';
    case 'brand':    return p.brandData?.brandName ?? '';
    case 'decision': return 'All steps complete — view your verdict';
    default:         return '';
  }
}

function LaunchPipelineCard({ onNichePress }: { onNichePress?: () => void }) {
  const pipeline = usePipeline();
  const nav      = useNavigation<Nav>();
  const [infoOpen,   setInfoOpen]   = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  function handleClearJourney() {
    Alert.alert(
      'Start Over?',
      'This will clear all your current journey progress — niche, product, supplier, costs, and brand. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Start Over', style: 'destructive', onPress: () => pipeline.clearPipeline() },
      ],
    );
  }

  const stepDone: Record<string, boolean> = {
    niche:    !!pipeline.activeNiche,
    product:  !!pipeline.activeProduct,
    recon:    !!pipeline.reconInsights,
    supplier: !!pipeline.selectedSupplier,
    freight:  !!pipeline.freightEstimate,
    costs:    !!pipeline.costModel,
    brand:    !!pipeline.brandData,
  };
  const allMainDone = Object.values(stepDone).every(Boolean);
  const completionMap: Record<string, boolean> = { ...stepDone, decision: allMainDone };

  const totalSteps     = Object.keys(completionMap).length;
  const completedSteps = Object.values(completionMap).filter(Boolean).length;
  const allDone        = completedSteps === totalSteps;
  const pct            = completedSteps / totalSteps;

  function phaseStatus(phase: typeof JOURNEY_PHASES[number]): 'done' | 'active' | 'upcoming' {
    if (phase.steps.length === 0) return 'upcoming';
    const keys = phase.steps.map(s => s.key);
    if (keys.every(k => completionMap[k])) return 'done';
    if (keys.some(k => completionMap[k]))  return 'active';
    return 'upcoming';
  }

  const phaseStatuses = JOURNEY_PHASES.map(phaseStatus);
  const currentPhaseIdx = phaseStatuses.findIndex(s => s !== 'done');

  const activeIdx = currentPhaseIdx === -1 ? 0 : currentPhaseIdx;

  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    JOURNEY_PHASES.forEach((p, i) => { init[p.key] = i === activeIdx; });
    return init;
  });

  useEffect(() => {
    setExpanded(prev => {
      const next: Record<string, boolean> = {};
      JOURNEY_PHASES.forEach((p, i) => { next[p.key] = prev[p.key] ?? (i === activeIdx); });
      next[JOURNEY_PHASES[activeIdx].key] = true;
      return next;
    });
  }, [activeIdx]);

  function togglePhase(key: string) {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  }

  function handleStepPress(step: { key: string; tab: keyof TabParamList | null }) {
    if (step.key === 'decision') { nav.navigate('LaunchDecision' as never); return; }
    if (step.key === 'niche') { onNichePress?.(); return; }
    if (step.tab) nav.navigate(step.tab as never);
  }

  return (
    <View style={lp.card}>
      {/* ── Card header ── */}
      <View style={lp.cardHeader}>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={lp.cardTitle}>FBA Launch Journey</Text>
            <TouchableOpacity onPress={() => setInfoOpen(o => !o)} activeOpacity={0.7} style={lp.infoBtn}>
              <Text style={lp.infoBtnTxt}>{infoOpen ? '✕' : 'ℹ'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleClearJourney} activeOpacity={0.7} style={lp.clearBtn}>
              <Text style={lp.clearBtnTxt}>Start Over</Text>
            </TouchableOpacity>
          </View>
          {/* Phase dots */}
          <View style={lp.dotsRow}>
            {JOURNEY_PHASES.map((p, i) => {
              const st = phaseStatuses[i];
              return (
                <View key={p.key} style={[
                  lp.dot,
                  st === 'done'    && lp.dotDone,
                  st === 'active'  && lp.dotActive,
                  st === 'upcoming'&& lp.dotUpcoming,
                ]}>
                  {st === 'done' && <Text style={lp.dotCheck}>✓</Text>}
                </View>
              );
            })}
          </View>
        </View>
        <View style={[lp.pill, { backgroundColor: DS.accent + '18', borderColor: DS.accent + '44' }]}>
          <Text style={[lp.pillText, { color: DS.accent }]}>
            {allDone ? '✓ Ready' : `${completedSteps}/${totalSteps}`}
          </Text>
        </View>
      </View>

      {/* ── Collapsible info ── */}
      {infoOpen && (
        <View style={lp.infoBanner}>
          <Text style={lp.infoText}>
            The FBA Launch Journey guides you through every step of launching an Amazon product — from finding a profitable niche, validating demand, locking in a supplier, modelling your numbers, and building your brand, all the way to a documented launch decision.{'\n\n'}
            Complete all 5 phases to unlock your full Launch Report — a downloadable PDF with every calculation, supplier details, a ready-to-send supplier email, and your brand assets in one place.
          </Text>
        </View>
      )}

      {/* ── Phases — only show done/active; upcoming are hidden until reached ── */}
      {JOURNEY_PHASES
        .map((phase, phaseIdx) => ({ phase, phaseIdx, status: phaseStatuses[phaseIdx] }))
        .filter(({ status, phaseIdx }) => status !== 'upcoming' || phaseIdx === activeIdx)
        .map(({ phase, phaseIdx, status }) => {
        const isCurrent  = phaseIdx === currentPhaseIdx;
        const isExpanded = expanded[phase.key] ?? false;
        const isScale    = phase.steps.length === 0;

        const accentColor = status === 'done' ? DS.accent : status === 'active' ? DS.accent : DS.textMuted;
        const bgColor     = status === 'done' ? DS.accent + '08' : status === 'active' ? DS.accent + '08' : 'transparent';

        return (
          <View key={phase.key} style={[lp.phaseOuter, phaseIdx > 0 && lp.phaseBorder]}>

            {/* Phase content */}
            <View style={[{ flex: 1, backgroundColor: bgColor }]}>
              <TouchableOpacity style={lp.phaseHeader} onPress={() => togglePhase(phase.key)} activeOpacity={0.72}>
                <View style={[lp.phaseIconWrap, { backgroundColor: accentColor + '22' }]}>
                  <Text style={lp.phaseIcon}>{phase.icon}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[lp.phaseLabel, { color: accentColor }]}>{phase.label}</Text>
                  {!isScale && (
                    <Text style={lp.phaseCount}>
                      {phase.steps.filter(s => completionMap[s.key]).length} / {phase.steps.length} done
                    </Text>
                  )}
                  {isScale && <Text style={lp.phaseCount}>Your next chapter</Text>}
                </View>
                {isCurrent && !isScale && (
                  <Text style={lp.hereText}>YOU ARE HERE</Text>
                )}
                <Text style={[lp.chevron, { color: accentColor }]}>{isExpanded ? '⌄' : '›'}</Text>
              </TouchableOpacity>

            {/* Expanded content */}
            {isExpanded && (
              <View style={lp.phaseBody}>
                {/* Tip */}
                <View style={lp.tipRow}>
                  <Text style={lp.tipText}>{phase.tip}</Text>
                </View>

                {/* Steps */}
                {phase.steps.map((step, stepIdx) => {
                  const done = completionMap[step.key] ?? false;
                  const sub  = done ? getStepSubtitle(step.key, pipeline) : '';
                  return (
                    <TouchableOpacity
                      key={step.key}
                      style={[lp.stepRow, stepIdx === 0 && lp.stepRowFirst]}
                      onPress={() => handleStepPress(step)}
                      activeOpacity={0.72}
                    >
                      <View style={[lp.dot, { backgroundColor: done ? DS.accent : DS.border }]}>
                        {done
                          ? <Text style={lp.dotCheck}>✓</Text>
                          : <Text style={[lp.dotNum, { color: DS.textMuted }]}>{stepIdx + 1}</Text>
                        }
                      </View>
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={[lp.stepLabel, done && lp.stepLabelDone]}>{step.icon}  {step.label}</Text>
                        {!!sub && <Text style={lp.stepSub} numberOfLines={1}>{sub}</Text>}
                      </View>
                      <Text style={[lp.stepArrow, { color: done ? DS.accent : DS.textMuted }]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            </View>
          </View>
        );
      })}

      {/* ── CTAs when all done ── */}
      {allDone && (
        <View style={lp.ctaRow}>
          <TouchableOpacity style={[lp.cta, { flex: 1 }]} onPress={() => nav.navigate('LaunchDecision' as never)} activeOpacity={0.85}>
            <Text style={lp.ctaText}>🚀  Launch Decision</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[lp.cta, lp.ctaReport]} onPress={() => setReportOpen(true)} activeOpacity={0.85}>
            <Text style={lp.ctaText}>📄  Full Report</Text>
          </TouchableOpacity>
        </View>
      )}

      <LaunchReportModal visible={reportOpen} onClose={() => setReportOpen(false)} />
    </View>
  );
}

const lp = StyleSheet.create({
  card:           { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  cardHeader:     { flexDirection: 'row', alignItems: 'center', gap: 10, padding: DS.cardPadding, paddingBottom: 12 },
  cardTitle:      { fontSize: 15, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  cardSubtitle:   { fontSize: 11, color: DS.textMuted, fontWeight: '500' },
  pill:           { borderRadius: DS.radiusBadge, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 3 },
  pillText:       { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  phaseOuter:     {},
  phaseBorder:    { borderTopWidth: 1, borderTopColor: DS.border },
  dotsRow:        { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot:            { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  dotDone:        { backgroundColor: DS.accent },
  dotActive:      { backgroundColor: DS.accent + '33', borderWidth: 2, borderColor: DS.accent },
  dotUpcoming:    { backgroundColor: DS.border },
  dotCheck:       { fontSize: 11, fontWeight: '900', color: '#fff' },
  dotNum:         { fontSize: 10, fontWeight: '800', color: '#fff' },
  hereText:       { fontSize: 11, fontWeight: '900', color: DS.accent, letterSpacing: 0.4 },
  phaseHeader:    { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: DS.cardPadding },
  phaseIconWrap:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  phaseIcon:      { fontSize: 18 },
  phaseLabel:     { fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  phaseCount:     { fontSize: 11, color: DS.textMuted, fontWeight: '500' },
  chevron:        { fontSize: 18, fontWeight: '700' },
  phaseBody:      { paddingBottom: 14, paddingHorizontal: DS.cardPadding, gap: 0 },
  tipRow:         { backgroundColor: DS.bgSubtle ?? DS.bgCanvas, borderRadius: DS.radiusChip, padding: 12, marginBottom: 10 },
  tipText:        { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  stepRow:        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: DS.border },
  stepRowFirst:   { borderTopWidth: 0 },
  stepLabel:      { fontSize: 13, fontWeight: '600', color: DS.textPrimary },
  stepLabelDone:  { color: DS.textSecondary },
  stepSub:        { fontSize: 11, color: DS.textMuted, fontWeight: '500' },
  stepArrow:      { fontSize: 20 },
  infoBtn:        { width: 22, height: 22, borderRadius: 11, backgroundColor: DS.accent + '18', borderWidth: 1, borderColor: DS.accent + '44', alignItems: 'center', justifyContent: 'center' },
  infoBtnTxt:     { fontSize: 11, fontWeight: '800', color: DS.accent },
  clearBtn:       { marginLeft: 'auto' as any, paddingHorizontal: 10, paddingVertical: 4, borderRadius: DS.radiusBadge, borderWidth: 1, borderColor: DS.danger + '40', backgroundColor: DS.danger + '08' },
  clearBtnTxt:    { fontSize: 10, fontWeight: '700', color: DS.danger },
  infoBanner:     { backgroundColor: DS.bgCanvas, borderTopWidth: 1, borderTopColor: DS.border, padding: DS.cardPadding },
  infoText:       { fontSize: 13, color: DS.textSecondary, lineHeight: 20 },
  ctaRow:         { flexDirection: 'row', gap: 10, margin: DS.cardPadding, marginTop: 4 },
  cta:            { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 15, alignItems: 'center' },
  ctaReport:      { backgroundColor: DS.accent + 'CC' },
  ctaText:        { fontSize: 13, fontWeight: '800', color: '#fff', letterSpacing: -0.2 },
});

// ─── Pipeline Context Banner ──────────────────────────────────────────────────


// ─── Copilot Screen ───────────────────────────────────────────────────────────

// ─── Home Screen (dashboard, pipeline, launch plan) ──────────────────────────

// ─── Trending products feed ───────────────────────────────────────────────────
// No backend "trending" endpoint exists, so we surface results from an Amazon
// search on a rotating evergreen category — real listing data when DataForSEO
// credentials are configured server-side, otherwise a labeled price estimate
// (see the "(est)" suffix below). Cached once per session.

const TRENDING_KEYWORDS = [
  'kitchen gadgets', 'home organization', 'pet accessories', 'fitness gear',
  'desk accessories', 'travel essentials', 'baby products', 'car accessories',
];
let _trendingCache: Product[] | null = null;

function TrendingProducts({ onPick }: { onPick: () => void }) {
  const { marketplace } = useCurrency();
  const [items, setItems]     = useState<Product[] | null>(_trendingCache);
  const [loading, setLoading] = useState(_trendingCache === null);

  useEffect(() => {
    if (_trendingCache !== null) { setLoading(false); return; }
    let alive = true;
    const kw = TRENDING_KEYWORDS[new Date().getDate() % TRENDING_KEYWORDS.length];
    api.searchAmazon(kw, marketplace)
      .then(r => {
        const list = (r.products || []).filter(p => p.asin && !p.error && p.price != null).slice(0, 8);
        _trendingCache = list;
        if (alive) setItems(list);
      })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Quietly hide the whole section if the live fetch returns nothing.
  if (!loading && (!items || items.length === 0)) return null;

  return (
    <View style={tp.wrap}>
      <Text style={tp.header}>🔥  POPULAR RIGHT NOW</Text>
      {loading ? (
        <View style={tp.loadingRow}>
          <ActivityIndicator color={DS.accent} />
          <Text style={tp.loadingTxt}>Finding trending products…</Text>
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={tp.row}>
          {items!.map(p => {
            const verdict = p.opportunity === 'Good' ? 'LAUNCH' : p.opportunity === 'Saturated' ? 'AVOID' : 'TEST';
            const reviews = p.review_count ?? 0;
            return (
              <TouchableOpacity
                key={p.asin}
                style={tp.card}
                onPress={onPick}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Analyze ${p.title}`}
              >
                <View style={tp.cardTop}>
                  {p.image
                    ? <Image source={{ uri: p.image }} style={tp.img} contentFit="contain" transition={150} accessibilityLabel={`Product photo: ${p.title}`} />
                    : <Text style={tp.icon}>📦</Text>}
                  <VerdictBadge verdict={verdict} />
                </View>
                <Text style={tp.name} numberOfLines={2}>{p.title}</Text>
                <View style={tp.stats}>
                  <Text style={tp.stat}>${p.price}{p.source && p.source !== 'dataforseo' ? ' (est)' : ''}</Text>
                  {reviews > 0 && (
                    <>
                      <Text style={tp.statDot}>·</Text>
                      <Text style={tp.stat}>{reviews >= 1000 ? (reviews / 1000).toFixed(1) + 'k' : reviews} rev</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const tp = StyleSheet.create({
  wrap:       { gap: 10 },
  header:     { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
  row:        { gap: 10, paddingRight: 4 },
  card:       { width: 152, backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 12, gap: 8 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  img:        { width: 44, height: 44, borderRadius: 10, backgroundColor: DS.bgSubtle },
  icon:       { fontSize: 26 },
  name:       { fontSize: 12, fontWeight: '700', color: DS.textPrimary, lineHeight: 17, minHeight: 34 },
  stats:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stat:       { fontSize: 11, fontWeight: '600', color: DS.textSecondary },
  statDot:    { fontSize: 11, color: DS.textMuted },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingTxt: { fontSize: 13, color: DS.textMuted },
});

export function HomeScreen() {
  const { vault, reloadVault }                 = useBuilderSession();
  const { isOnline }                           = useNetworkStatus();
  const { devMode, usage, remaining, isFree }  = useSubscription();
  const tapCount                               = useRef(0);
  const tapTimer                               = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef                              = useRef<ScrollView>(null);

  const [showAnalyze,       setShowAnalyze]       = useState(false);
  const [nicheFocusTrigger, setNicheFocusTrigger] = useState(0);

  useFocusEffect(useCallback(() => { reloadVault(); }, [reloadVault]));

  const handleSecretTap = useCallback(async () => {
    // Only functional in dev builds — toggleDevMode() is a no-op in production.
    if (!__DEV__) return;
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    if (tapCount.current >= 7) {
      tapCount.current = 0;
      const isNowOn = await toggleDevMode();
      Alert.alert(
        isNowOn ? '🔓 Dev Mode ON' : '🔒 Dev Mode OFF',
        isNowOn
          ? 'All paywalls bypassed. Operator tier active.'
          : 'Restrictions restored.',
      );
    } else {
      tapTimer.current = setTimeout(() => { tapCount.current = 0; }, 2000);
    }
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
      <AppHeader helpKey="copilot" hideJourneyStrip />
      <OfflineBanner visible={!isOnline} />
      {devMode && (
        <TouchableOpacity onPress={handleSecretTap} activeOpacity={0.8}>
          <View style={s.devBanner}>
            <Text style={s.devBannerText}>DEV MODE — all restrictions bypassed · tap to toggle</Text>
          </View>
        </TouchableOpacity>
      )}
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity activeOpacity={1} onPress={handleSecretTap}>
          <GreetingHeader
            vaultCount={vault.length}
            analyzed={usage.research}
            lookupsLeft={remaining('research')}
            isFree={isFree}
          />
        </TouchableOpacity>

        {/* ── Discover engine: the full Niche screen, embedded ── */}
        <Text style={hl.sectionLabel}>DON'T HAVE ONE YET? EXPLORE A MARKET TO FIND ONE ↓</Text>
        <FeatureExplainer text="Search any category or keyword and Siftly scores the whole market — demand, competition, and the gap you could fill." />
        <NicheResearchScreen embedded focusTrigger={nicheFocusTrigger} />

        {/* ── Launch checklist ── */}
        <Text style={hl.sectionLabel}>YOUR LAUNCH CHECKLIST</Text>
        <LaunchPipelineCard onNichePress={() => {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
          setTimeout(() => setNicheFocusTrigger(t => t + 1), 200);
        }} />

        {/* ── Trending products feed ── */}
        <TrendingProducts onPick={() => setShowAnalyze(true)} />

        {/* ── Winner vault ── */}
        <WinnerVaultCard vault={vault} />

        <AnalyzeProductModal visible={showAnalyze} onClose={() => setShowAnalyze(false)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const hl = StyleSheet.create({
  sectionLabel: { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.2, textTransform: 'uppercase' },
});

// ─── Copilot Screen (pure AI tools — navigated from header) ──────────────────

export default function CopilotScreen() {
  const { isOnline }    = useNetworkStatus();
  const navigation      = useNavigation<Nav>();
  const intelProfile    = useProductIntelligence();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
      <AppHeader helpKey="copilot" hideJourneyStrip />
      {navigation.canGoBack() && (
        <TouchableOpacity style={s.backBar} onPress={() => navigation.goBack()} activeOpacity={0.7}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
      )}
      <OfflineBanner visible={!isOnline} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.copilotHeader}>
          <Text style={s.copilotTitle}>AI Copilot</Text>
          <Text style={s.copilotSub}>Analyze products, find opportunities, and get answers.</Text>
        </View>
        {intelProfile && (
          <IntelligenceSummaryBanner
            profile={intelProfile}
            onNavigate={tab => navigation.navigate(tab as keyof TabParamList)}
          />
        )}
        {!intelProfile && (
          <View style={s.coldStartCard}>
            <Text style={s.coldStartIcon}>◉</Text>
            <Text style={s.coldStartTitle}>No product context yet</Text>
            <Text style={s.coldStartBody}>
              Search a niche in the Niche tab, then select a product in Research to unlock product-specific AI analysis here.
            </Text>
          </View>
        )}
        <AITools />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  backBar: {
    paddingHorizontal: DS.pagePadding,
    paddingVertical:   8,
    backgroundColor:   DS.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: DS.border,
  },
  backTxt:        { fontSize: 13, fontWeight: '700', color: DS.accent },
  scroll:         { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40, gap: 16 },
  copilotHeader:  { gap: 4 },
  copilotTitle:   { fontSize: 26, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  copilotSub:     { fontSize: 14, color: DS.textSecondary, lineHeight: 20 },
  coldStartCard:  { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: DS.cardPadding, alignItems: 'center', gap: 8 },
  coldStartIcon:  { fontSize: 28, color: DS.accent },
  coldStartTitle: { fontSize: 14, fontWeight: '800', color: DS.textPrimary },
  coldStartBody:  { fontSize: 13, color: DS.textSecondary, textAlign: 'center', lineHeight: 19 },
  devBanner:      { backgroundColor: DS.warning, paddingVertical: 6, paddingHorizontal: 16 },
  devBannerText:  { fontSize: 11, fontWeight: '700', color: '#1C1C1E', textAlign: 'center', letterSpacing: 0.3 },
});
