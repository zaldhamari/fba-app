import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
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
import { useProductIntelligence } from '../hooks/useProductIntelligence';
import { IntelligenceSummaryBanner } from '../components/IntelligenceSummaryBanner';
import { FBAGlossaryModal } from '../components/FBAGlossaryModal';
import type { TabParamList } from '../navigation/tabTypes';
import type { WinnerEntry } from '../types/builder';

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
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
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
            <Text style={ap.idleHintText}>Enter any product keyword and Copilot will pull live Amazon data, run an AI verdict, and surface review gaps you can exploit.</Text>
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
            <Text style={ap.productEyebrow}>TOP RESULT</Text>
            <Text style={ap.productTitle} numberOfLines={3}>{result.product.title}</Text>
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
  input:            { flex: 1, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: DS.border, paddingHorizontal: 14, fontSize: 14, color: DS.textPrimary, backgroundColor: DS.bgCard },
  searchBtn:        { width: 48, height: 48, borderRadius: 12, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center' },
  searchBtnDisabled:{ opacity: 0.45 },
  searchBtnText:    { color: '#fff', fontWeight: '700', fontSize: 18 },
  // Idle state
  idleWrap:         { gap: 14, marginTop: 4, paddingBottom: 8 },
  idleLabel:        { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  chipRow:          { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip:             { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: DS.bgCard, borderWidth: 1, borderColor: DS.border },
  chipText:         { fontSize: 12, color: DS.textSecondary, fontWeight: '500' },
  idleHint:         { flexDirection: 'row', gap: 10, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12, alignItems: 'flex-start' },
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
                    <VerdictBadge verdict={srResult.verdict.label} />
                  </View>
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
  profileStrip:     { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
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
    { icon: '🔍', label: 'Get a\nVerdict',  color: '#EFF6FF', border: '#BFDBFE', onPress: () => setShowAnalyze(true) },
    { icon: '💡', label: 'Find\nOpportunities', color: '#F0FDF4', border: '#BBF7D0', onPress: () => setShowOpps(true) },
    { icon: '🤖', label: 'Ask\nCopilot',        color: '#FAF5FF', border: '#E9D5FF', onPress: () => setShowAsk(true) },
    { icon: '📖', label: 'FBA\nGlossary',       color: DS.warningBg, border: '#FDE68A', onPress: () => setShowGlossary(true) },
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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <HelpButton featureKey="winner_vault" size="sm" />
          <TouchableOpacity onPress={() => nav.navigate('Checklist' as any)}>
            <Text style={wv.link}>View all ›</Text>
          </TouchableOpacity>
        </View>
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
  sectionTitle: { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  sectionSub:   { fontSize: 11, color: DS.textMuted, marginTop: 1 },
  link:         { fontSize: 13, color: DS.accent, fontWeight: '600', marginTop: 2 },
  card:         { width: 180, backgroundColor: DS.bgCard, borderRadius: 14, borderWidth: 1, borderColor: DS.border, overflow: 'hidden' },
  accentBar:    { height: 4, width: '100%' },
  cardTopRow:   { flexDirection: 'row', alignItems: 'center', gap: 5 },
  verdictDot:   { width: 6, height: 6, borderRadius: 3 },
  verdictLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5, flex: 1 },
  cardTapHint:  { fontSize: 10, color: DS.textMuted },
  productTitle: { fontSize: 13, fontWeight: '600', color: DS.textPrimary, lineHeight: 18 },
  brand:        { fontSize: 11, color: DS.textMuted },
  stat:         { flex: 1, alignItems: 'center', backgroundColor: DS.bgCanvas, borderRadius: 8, paddingVertical: 6 },
  statVal:      { fontSize: 13, fontWeight: '800' },
  statLabel:    { fontSize: 9, color: DS.textMuted, marginTop: 1, textTransform: 'uppercase', letterSpacing: 0.3 },
});

// ─── Active Product Card ──────────────────────────────────────────────────────

const STAGE_ORDER_LIST = ['discovery', 'analysis', 'supplier', 'freight', 'calculations', 'brand', 'complete'];
const STAGE_LABEL_MAP: Record<string, string> = {
  discovery: 'Find a Product', analysis: 'AI Analysis', supplier: 'Lock In Supplier',
  freight: 'Choose Freight', calculations: 'Check the Numbers', brand: 'Build Your Brand',
};

function ActiveProductCard({ session }: { session: any }) {
  const nav = useNavigation<Nav>();
  const stage    = session.currentStage;
  const progress = (STAGE_ORDER_LIST.indexOf(stage) + 1) / STAGE_ORDER_LIST.length;

  return (
    <TouchableOpacity style={ac.card} onPress={() => nav.navigate('Checklist' as any)} activeOpacity={0.8}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={ac.label}>Active Build</Text>
        <Text style={ac.arrow}>→</Text>
      </View>
      <Text style={ac.stageName}>{STAGE_LABEL_MAP[stage] ?? stage}</Text>
      <View style={ac.bar}><View style={[ac.fill, { width: `${Math.round(progress * 100)}%` as any }]} /></View>
      <Text style={ac.progress}>{Math.round(progress * 100)}% complete</Text>
    </TouchableOpacity>
  );
}

const ac = StyleSheet.create({
  card:      { backgroundColor: DS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 6 },
  label:     { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  stageName: { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  arrow:     { fontSize: 16, color: DS.accent },
  bar:       { height: 4, backgroundColor: DS.border, borderRadius: 2, overflow: 'hidden' },
  fill:      { height: 4, backgroundColor: DS.accent, borderRadius: 2 },
  progress:  { fontSize: 11, color: DS.textMuted },
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
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: DS.border,
    gap: 10,
  },
  topRow:    { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  timeLabel: { fontSize: 12, fontWeight: '600', color: DS.textMuted, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 2 },
  name:      { fontSize: 28, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5, lineHeight: 33 },
  wave:      { fontSize: 26 },
  roleBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: DS.accentLight, borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: DS.accent + '30',
  },
  roleIcon:  { fontSize: 14 },
  roleText:  { fontSize: 12, fontWeight: '800', color: DS.accent, letterSpacing: 0.2 },
  tagline:   { fontSize: 14, color: DS.textSecondary, lineHeight: 21, fontStyle: 'italic' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: DS.bgCanvas, borderRadius: 10,
    borderWidth: 1, borderColor: DS.border,
    paddingVertical: 10,
  },
  statCell:       { flex: 1, alignItems: 'center', gap: 2 },
  statCellBorder: { borderRightWidth: 1, borderRightColor: DS.border },
  statValue:      { fontSize: 16, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  statLabel:      { fontSize: 10, fontWeight: '600', color: DS.textMuted },
});

// ─── Pipeline Context Banner ──────────────────────────────────────────────────

function PipelineContextBanner() {
  const pipeline  = usePipeline();
  const nav       = useNavigation<Nav>();
  const hasData   = pipeline.activeProduct || pipeline.selectedSupplier || pipeline.costModel;
  if (!hasData) return null;

  return (
    <View style={pcb.card}>
      <Text style={pcb.heading}>Active Pipeline</Text>
      {pipeline.activeNiche && (
        <TouchableOpacity style={pcb.row} onPress={() => nav.navigate('Home' as never)}>
          <Text style={pcb.icon}>🔍</Text>
          <View style={{ flex: 1 }}>
            <Text style={pcb.label}>Niche</Text>
            <Text style={pcb.value} numberOfLines={1}>{pipeline.activeNiche.keyword}</Text>
          </View>
          <Text style={pcb.chevron}>›</Text>
        </TouchableOpacity>
      )}
      {pipeline.activeProduct && (
        <TouchableOpacity style={pcb.row} onPress={() => nav.navigate('Research' as never)}>
          <Text style={pcb.icon}>📦</Text>
          <View style={{ flex: 1 }}>
            <Text style={pcb.label}>Product</Text>
            <Text style={pcb.value} numberOfLines={1}>{pipeline.activeProduct.title}</Text>
          </View>
          <Text style={pcb.chevron}>›</Text>
        </TouchableOpacity>
      )}
      {pipeline.selectedSupplier && (
        <TouchableOpacity style={pcb.row} onPress={() => nav.navigate('Sourcing' as never)}>
          <Text style={pcb.icon}>🏭</Text>
          <View style={{ flex: 1 }}>
            <Text style={pcb.label}>Supplier</Text>
            <Text style={pcb.value} numberOfLines={1}>{pipeline.selectedSupplier.name} · ${pipeline.selectedSupplier.unitCost}/unit</Text>
          </View>
          <Text style={pcb.chevron}>›</Text>
        </TouchableOpacity>
      )}
      {pipeline.costModel && (
        <View style={[pcb.row, { borderBottomWidth: 0 }]}>
          <Text style={pcb.icon}>💰</Text>
          <View style={{ flex: 1 }}>
            <Text style={pcb.label}>Cost Model</Text>
            <Text style={pcb.value}>${pipeline.costModel.netProfit.toFixed(2)}/unit profit · {pipeline.costModel.marginPct.toFixed(0)}% margin</Text>
          </View>
        </View>
      )}
    </View>
  );
}

const pcb = StyleSheet.create({
  card:    { backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: DS.cardPadding, gap: 0 },
  heading: { fontSize: 13, fontWeight: '700', color: DS.textPrimary, marginBottom: 8, letterSpacing: 0.3 },
  row:     { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: DS.border },
  icon:    { fontSize: 16, width: 24, textAlign: 'center' },
  label:   { fontSize: 10, color: DS.textMuted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  value:   { fontSize: 13, color: DS.textPrimary, fontWeight: '500', marginTop: 1 },
  chevron: { fontSize: 18, color: DS.textMuted },
});

// ─── Copilot Screen ───────────────────────────────────────────────────────────

// ─── Home Screen (dashboard, pipeline, launch plan) ──────────────────────────

// ─── Trending products feed (live) ────────────────────────────────────────────
// No backend "trending" endpoint exists, so we surface real products from a live
// Amazon search on a rotating evergreen category. Cached once per session.

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
          <Text style={tp.loadingTxt}>Pulling live products…</Text>
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
                  <Text style={tp.stat}>${p.price}</Text>
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
  header:     { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.2 },
  row:        { gap: 10, paddingRight: 4 },
  card:       { width: 150, backgroundColor: DS.bgCard, borderRadius: DS.radiusCard, borderWidth: 1, borderColor: DS.border, padding: 12, gap: 8 },
  cardTop:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  img:        { width: 40, height: 40, borderRadius: 8, backgroundColor: DS.bgSubtle },
  icon:       { fontSize: 24 },
  name:       { fontSize: 13, fontWeight: '700', color: DS.textPrimary, lineHeight: 17, minHeight: 34 },
  stats:      { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stat:       { fontSize: 11, fontWeight: '600', color: DS.textSecondary },
  statDot:    { fontSize: 11, color: DS.textMuted },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 16 },
  loadingTxt: { fontSize: 13, color: DS.textMuted },
});

export function HomeScreen() {
  const { vault, activeSession, reloadVault } = useBuilderSession();
  const { isOnline }                          = useNetworkStatus();
  const { devMode, usage, remaining, isFree } = useSubscription();
  const tapCount                              = useRef(0);
  const tapTimer                              = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state lifted here so the launchpad's hero can trigger the
  // existing AI tools directly (Get a Verdict, Discover).
  const [showAnalyze,  setShowAnalyze]  = useState(false);
  const [showOpps,     setShowOpps]     = useState(false);

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
      <AppHeader helpKey="copilot" />
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
        <FeatureExplainer text="Search any category or keyword and Siftly scores the whole market — demand, competition, and the gap you could fill. Use this when you don't have a product yet; use 'Get a Verdict' below when you already have one in mind." />
        <NicheResearchScreen embedded />

        {/* ── HERO: get a verdict on a specific product ── */}
        <View style={hl.hero}>
          <Text style={hl.heroEyebrow}>GOT A PRODUCT IN MIND?</Text>
          <Text style={hl.heroTitle}>Should I sell this?</Text>
          <Text style={hl.heroSub}>
            Search any product by name — get an instant Launch / Test / Avoid verdict based on the top match.
          </Text>
          <TouchableOpacity
            style={hl.heroBtn}
            onPress={() => setShowAnalyze(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Get a verdict on a product"
          >
            <Text style={hl.heroBtnTxt}>🔍  Get a Verdict →</Text>
          </TouchableOpacity>
        </View>

        {/* ── Trending products feed ── */}
        <TrendingProducts onPick={() => setShowAnalyze(true)} />

        {/* ── Returning-user context (each self-hides when empty) ── */}
        {activeSession && <ActiveProductCard session={activeSession} />}
        <PipelineContextBanner />
        <WinnerVaultCard vault={vault} />

        {/* ── AI tool modals (reused) ── */}
        <AnalyzeProductModal visible={showAnalyze} onClose={() => setShowAnalyze(false)} />
        <FindOpportunitiesModal visible={showOpps} onClose={() => setShowOpps(false)} />
      </ScrollView>
    </SafeAreaView>
  );
}

const hl = StyleSheet.create({
  hero: {
    backgroundColor: DS.accent,
    borderRadius:    DS.radiusHero,
    padding:         20,
    gap:             8,
  },
  heroEyebrow: { fontSize: 10, fontWeight: '800', color: DS.textInverse, letterSpacing: 2, opacity: 0.85 },
  heroTitle:   { fontSize: 23, fontWeight: '900', color: DS.textInverse, letterSpacing: -0.6, lineHeight: 28 },
  heroSub:     { fontSize: 13, color: DS.textInverse, opacity: 0.9, lineHeight: 19 },
  heroBtn: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusButton,
    paddingVertical: 14,
    alignItems:      'center',
    marginTop:       6,
  },
  heroBtnTxt: { fontSize: 15, fontWeight: '800', color: DS.accent, letterSpacing: -0.2 },

  discoverSection: { gap: 10 },
  sectionLabel:    { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.2 },
  chipGrid:        { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: DS.bgCard, borderRadius: DS.radiusBadge,
    borderWidth: 1, borderColor: DS.border,
    paddingHorizontal: 12, paddingVertical: 9,
  },
  chipIcon:     { fontSize: 14 },
  chipLabel:    { fontSize: 12, fontWeight: '600', color: DS.textSecondary },
  discoverMore: { fontSize: 13, fontWeight: '700', color: DS.accent, marginTop: 2 },
});

// ─── Copilot Screen (pure AI tools — navigated from header) ──────────────────

export default function CopilotScreen() {
  const { isOnline }    = useNetworkStatus();
  const navigation      = useNavigation<Nav>();
  const intelProfile    = useProductIntelligence();
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
      <AppHeader helpKey="copilot" />
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
  scroll:         { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 20 },
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
