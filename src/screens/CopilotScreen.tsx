import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, Modal, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PHASES, ALL_IDS, LAUNCH_CHECKLIST_KEY } from '../data/launchPhases';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { WinnerVaultDetailModal } from '../components/WinnerVaultDetailModal';
import { useAuth } from '../hooks/useAuth';
import { HelpButton } from '../components/HelpModal';
import { AppHeader } from '../components/AppHeader';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { DS } from '../theme/ds';
import { api } from '../services/api';
import { useBuilderSession } from '../hooks/useBuilderSession';
import { useSellerProfile } from '../hooks/useSellerProfile';
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
    <ToolModal visible={visible} title="Analyze a Product" subtitle="Get an AI verdict before you commit" onClose={handleClose}>

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

function FindOpportunitiesModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profile }               = useSellerProfile();
  const [tab, setTab]             = useState<'foryou' | 'search'>('foryou');
  const [fyLoading, setFyLoading] = useState(false);
  const [fyResult, setFyResult]   = useState<any[]>([]);
  const [fyError, setFyError]     = useState('');
  const [srQuery, setSrQuery]     = useState('');
  const [srLoading, setSrLoading] = useState(false);
  const [srResult, setSrResult]   = useState<any>(null);
  const [srError, setSrError]     = useState('');

  const generateForYou = useCallback(async () => {
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
      const json = JSON.parse(match[0]);
      if (!Array.isArray(json) || json.length === 0) throw new Error('No results. Tap retry.');
      setFyResult(json);
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
  'What makes a product listing rank?',
  'How do I find my first supplier?',
  'When is my product ready to scale?',
];

function AskCopilotModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [question, setQuestion] = useState('');
  const [loading, setLoading]   = useState(false);
  const [answer, setAnswer]     = useState('');
  const [error, setError]       = useState('');

  const ask = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setQuestion(q); setLoading(true); setError(''); setAnswer('');
    try {
      const res = await api.askAI(q, 'FBA seller looking for actionable advice.');
      setAnswer((res as any).answer ?? String(res));
    } catch (e: any) {
      setError(e?.message ?? 'Failed to get answer.');
    } finally {
      setLoading(false);
    }
  }, []);

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

        {loading && <ActivityIndicator color={DS.accent} style={{ marginTop: 24 }} />}
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
  answerCard:  { backgroundColor: '#DBEAFE', borderRadius: 12, padding: 14 },
  answerLabel: { fontSize: 11, fontWeight: '700', color: DS.accent, letterSpacing: 0.5, marginBottom: 6 },
  answerText:  { fontSize: 14, color: DS.textPrimary, lineHeight: 21 },
});

// ─── AI Tools Row ─────────────────────────────────────────────────────────────

function AITools() {
  const [showAnalyze, setShowAnalyze] = useState(false);
  const [showOpps, setShowOpps]       = useState(false);
  const [showAsk, setShowAsk]         = useState(false);

  const tools = [
    { icon: '🔍', label: 'Analyze a\nProduct',  color: '#EFF6FF', border: '#BFDBFE', onPress: () => setShowAnalyze(true) },
    { icon: '💡', label: 'Find\nOpportunities', color: '#F0FDF4', border: '#BBF7D0', onPress: () => setShowOpps(true) },
    { icon: '🤖', label: 'Ask\nCopilot',        color: '#FAF5FF', border: '#E9D5FF', onPress: () => setShowAsk(true) },
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
          <TouchableOpacity onPress={() => nav.navigate('LaunchPad' as any)}>
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
    <TouchableOpacity style={ac.card} onPress={() => nav.navigate('LaunchPad' as any)} activeOpacity={0.8}>
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

// ─── Vault Summary ────────────────────────────────────────────────────────────

function VaultSummary({ vault }: { vault: WinnerEntry[] }) {
  const nav = useNavigation<Nav>();
  return (
    <TouchableOpacity style={vs.row} onPress={() => nav.navigate('LaunchPad' as any)} activeOpacity={0.8}>
      <Text style={vs.label}>Vault</Text>
      <View style={vs.chip}><Text style={vs.chipText}>{vault.length} builds completed</Text></View>
    </TouchableOpacity>
  );
}

const vs = StyleSheet.create({
  row:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label:    { fontSize: 12, color: DS.textMuted, fontWeight: '600' },
  chip:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#DBEAFE' },
  chipText: { fontSize: 12, fontWeight: '700', color: DS.accent },
});

// ─── Checklist state hook ─────────────────────────────────────────────────────

function useChecklistState() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    AsyncStorage.getItem(LAUNCH_CHECKLIST_KEY).then(raw => {
      if (raw) setChecked(new Set(JSON.parse(raw) as string[]));
    });
  }, []);

  const toggle = useCallback(async (id: string) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      AsyncStorage.setItem(LAUNCH_CHECKLIST_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { checked, toggle };
}

// ─── Overall Progress Card ────────────────────────────────────────────────────

function OverallProgressCard({ checked }: { checked: Set<string> }) {
  const done  = checked.size;
  const total = ALL_IDS.length;
  const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
  const statusLabel = pct === 100 ? 'Complete 🏆' : pct >= 75 ? 'Launch Ready' : pct >= 50 ? 'Validating' : pct >= 25 ? 'Building' : 'Planning';
  const statusColor = pct === 100 ? DS.success : pct >= 50 ? DS.accent : pct >= 25 ? DS.warning : DS.textMuted;
  const nextPhase   = PHASES.find(p => p.items.some(i => !checked.has(i.id)));

  return (
    <View style={op.card}>
      <View style={op.hero}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={op.eyebrow}>OVERALL PROGRESS</Text>
          <Text style={op.bigPct}>{pct}<Text style={op.bigPctSign}>%</Text></Text>
          <Text style={op.taskCount}>{done} of {total} tasks complete</Text>
          <View style={[op.statusPill, { backgroundColor: statusColor + '18', borderColor: statusColor + '44' }]}>
            <Text style={[op.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {nextPhase && pct < 100 && (
            <Text style={op.upNext}>Up next: {nextPhase.icon} {nextPhase.title}</Text>
          )}
        </View>
        <View style={op.pctCircle}>
          <Text style={op.pctCircleNum}>{pct}</Text>
          <Text style={op.pctCircleSub}>%</Text>
        </View>
      </View>

      <View style={op.barTrack}>
        <View style={[op.barFill, { width: `${pct}%` as any }]} />
      </View>

      <View style={op.statsRow}>
        <View style={op.stat}><Text style={op.statVal}>{done}</Text><Text style={op.statLabel}>Done</Text></View>
        <View style={op.statDiv} />
        <View style={op.stat}><Text style={op.statVal}>{total - done}</Text><Text style={op.statLabel}>Left</Text></View>
        <View style={op.statDiv} />
        <View style={op.stat}><Text style={op.statVal}>{PHASES.length}</Text><Text style={op.statLabel}>Stages</Text></View>
      </View>
    </View>
  );
}

const op = StyleSheet.create({
  card:        { backgroundColor: DS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 12 },
  hero:        { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  eyebrow:     { fontSize: 10, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.8, textTransform: 'uppercase' },
  bigPct:      { fontSize: 52, fontWeight: '900', color: DS.textPrimary, lineHeight: 56, letterSpacing: -2 },
  bigPctSign:  { fontSize: 26, fontWeight: '700', color: DS.textMuted },
  taskCount:   { fontSize: 12, color: DS.textMuted },
  statusPill:  { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20, borderWidth: 1, marginTop: 2 },
  statusText:  { fontSize: 11, fontWeight: '700' },
  upNext:      { fontSize: 11, color: DS.textMuted, marginTop: 4 },
  pctCircle:   { width: 80, height: 80, borderRadius: 40, borderWidth: 6, borderColor: DS.accent, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF' },
  pctCircleNum:{ fontSize: 22, fontWeight: '900', color: DS.accent, lineHeight: 26 },
  pctCircleSub:{ fontSize: 12, fontWeight: '700', color: DS.accent },
  barTrack:    { height: 5, backgroundColor: DS.border, borderRadius: 3, overflow: 'hidden' },
  barFill:     { height: 5, backgroundColor: DS.accent, borderRadius: 3 },
  statsRow:    { flexDirection: 'row', alignItems: 'center', backgroundColor: DS.bgCanvas, borderRadius: 10, paddingVertical: 10 },
  stat:        { flex: 1, alignItems: 'center', gap: 2 },
  statVal:     { fontSize: 15, fontWeight: '800', color: DS.textPrimary },
  statLabel:   { fontSize: 9, color: DS.textMuted, textTransform: 'uppercase', letterSpacing: 0.4 },
  statDiv:     { width: 1, height: 28, backgroundColor: DS.border },
});

// ─── Full Launch Checklist (all 7 phases) ─────────────────────────────────────

function FullChecklistCard({ checked, toggle }: { checked: Set<string>; toggle: (id: string) => void }) {
  const [activePhaseId, setActivePhaseId] = useState(PHASES[0].id);
  const phase = PHASES.find(p => p.id === activePhaseId) ?? PHASES[0];
  const phaseDone = phase.items.filter(i => checked.has(i.id)).length;
  const allDone   = phaseDone === phase.items.length;

  return (
    <View style={dc.container}>
      <Text style={dc.sectionTitle}>Launch Checklist</Text>

      {/* Phase tab strip — horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={dc.tabStrip}
      >
        {PHASES.map(p => {
          const done  = p.items.filter(i => checked.has(i.id)).length;
          const total = p.items.length;
          const active = p.id === activePhaseId;
          const complete = done === total;
          return (
            <TouchableOpacity
              key={p.id}
              style={[dc.tab, active && dc.tabActive, complete && !active && dc.tabComplete]}
              onPress={() => setActivePhaseId(p.id)}
              activeOpacity={0.7}
            >
              <Text style={dc.tabIcon}>{complete ? '✓' : p.icon}</Text>
              <Text style={[dc.tabLabel, active && dc.tabLabelActive]}>{p.num}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Phase header */}
      <View style={dc.phaseHeader}>
        <View style={{ flex: 1 }}>
          <Text style={dc.phaseTitle}>{phase.title}</Text>
          <Text style={dc.phaseSub}>{phase.desc}</Text>
        </View>
        <View style={[dc.badge, allDone && dc.badgeDone]}>
          <Text style={[dc.badgeText, allDone && dc.badgeTextDone]}>{phaseDone}/{phase.items.length}</Text>
        </View>
      </View>

      {/* Phase progress bar */}
      <View style={dc.progressTrack}>
        <View style={[dc.progressFill, { width: `${(phaseDone / phase.items.length) * 100}%` as any }]} />
      </View>

      {/* Tasks */}
      <View style={{ gap: 0 }}>
        {phase.items.map(item => {
          const isChecked = checked.has(item.id);
          return (
            <TouchableOpacity key={item.id} style={dc.row} onPress={() => toggle(item.id)} activeOpacity={0.7}>
              <View style={[dc.checkbox, isChecked && dc.checkboxDone]}>
                {isChecked && <Text style={dc.checkmark}>✓</Text>}
              </View>
              <Text style={[dc.itemText, isChecked && dc.itemTextDone]}>{item.text}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const dc = StyleSheet.create({
  container:      { backgroundColor: DS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 10 },
  sectionTitle:   { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  tabStrip:       { gap: 6, paddingBottom: 2 },
  tab:            { width: 44, height: 44, borderRadius: 10, borderWidth: 1, borderColor: DS.border, backgroundColor: DS.bgCanvas, alignItems: 'center', justifyContent: 'center', gap: 1 },
  tabActive:      { backgroundColor: DS.accent, borderColor: DS.accent },
  tabComplete:    { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  tabIcon:        { fontSize: 13 },
  tabLabel:       { fontSize: 9, fontWeight: '700', color: DS.textMuted },
  tabLabelActive: { color: '#fff' },
  phaseHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  phaseTitle:     { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  phaseSub:       { fontSize: 11, color: DS.textMuted, marginTop: 2, lineHeight: 15 },
  badge:          { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: DS.bgCanvas, borderWidth: 1, borderColor: DS.border, flexShrink: 0 },
  badgeDone:      { backgroundColor: '#DBEAFE', borderColor: DS.accent + '40' },
  badgeText:      { fontSize: 12, fontWeight: '700', color: DS.textMuted },
  badgeTextDone:  { color: DS.accent },
  progressTrack:  { height: 4, backgroundColor: DS.border, borderRadius: 2, overflow: 'hidden' },
  progressFill:   { height: 4, backgroundColor: DS.accent, borderRadius: 2 },
  row:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: DS.border + '80' },
  checkbox:       { width: 20, height: 20, borderRadius: 5, borderWidth: 2, borderColor: DS.border, alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 },
  checkboxDone:   { backgroundColor: DS.accent, borderColor: DS.accent },
  checkmark:      { fontSize: 11, color: '#fff', fontWeight: '900' },
  itemText:       { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },
  itemTextDone:   { color: DS.textMuted },
});

// ─── Daily Insight Card ───────────────────────────────────────────────────────

const INSIGHTS = [
  'Products with fewer than 200 reviews in the top 10 are the sweet spot for new sellers.',
  'Aim for at least 25% margin after FBA fees — anything below is a race to the bottom.',
  'Your first 30 reviews are the hardest. Budget for 3–5 PPC campaigns at launch.',
  'Niche down first. "Yoga mat" is a war zone — "extra-wide non-slip yoga mat" is a door.',
  'Freight timing is strategy. Sea freight 6–8 weeks, air 1–2 weeks. Plan 90 days ahead.',
  'A supplier with MOQ 100 is better than one with MOQ 1000 when you are starting out.',
];

function DailyInsightCard() {
  const [insight] = useState(() => INSIGHTS[new Date().getDate() % INSIGHTS.length]);
  return (
    <View style={di.card}>
      <Text style={di.label}>Daily Insight</Text>
      <Text style={di.text}>{insight}</Text>
    </View>
  );
}

const di = StyleSheet.create({
  card:  { backgroundColor: DS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 6 },
  label: { fontSize: 11, fontWeight: '700', color: DS.textMuted, letterSpacing: 0.5, textTransform: 'uppercase' },
  text:  { fontSize: 14, color: DS.textPrimary, lineHeight: 21 },
});

// ─── Profile Strip ────────────────────────────────────────────────────────────

const MARKETPLACE_FLAG: Record<string, string> = { US: '🇺🇸', UK: '🇬🇧', DE: '🇪🇺', CA: '🇨🇦', AE: '🇦🇪', SA: '🇸🇦' };
const EXPERIENCE_LABEL: Record<string, string> = { beginner: 'Beginner', some: 'Some exp.', selling: 'Active seller' };

function ProfileStrip() {
  const { profile } = useSellerProfile();
  const nav = useNavigation<Nav>();
  if (!profile) return null;
  const flag = MARKETPLACE_FLAG[profile.marketplace] ?? '🌐';
  const exp  = EXPERIENCE_LABEL[profile.experience] ?? profile.experience;
  return (
    <TouchableOpacity style={ps.strip} onPress={() => (nav as any).navigate('SellerProfile')} activeOpacity={0.8}>
      <Text style={ps.flag}>{flag}</Text>
      <Text style={ps.chip}>{profile.marketplace}</Text>
      <View style={ps.dot} />
      <Text style={ps.chip}>${profile.budget.toLocaleString()} budget</Text>
      <View style={ps.dot} />
      <Text style={ps.chip}>${profile.priceMin}–${profile.priceMax}</Text>
      <View style={ps.dot} />
      <Text style={ps.chip}>{exp}</Text>
      <Text style={ps.edit}>Edit ›</Text>
    </TouchableOpacity>
  );
}

const ps = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: DS.bgCard, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: DS.border, flexWrap: 'wrap' },
  flag:  { fontSize: 14 },
  chip:  { fontSize: 12, color: DS.textSecondary, fontWeight: '500' },
  dot:   { width: 3, height: 3, borderRadius: 1.5, backgroundColor: DS.border },
  edit:  { marginLeft: 'auto', fontSize: 12, color: DS.accent, fontWeight: '600' },
});

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions() {
  const nav = useNavigation<Nav>();
  const actions = [
    { icon: '◈', label: 'Start a Build',   sub: 'LaunchPad pipeline',   onPress: () => nav.navigate('LaunchPad' as any) },
    { icon: '◎', label: 'Research Market', sub: 'Search niches & data', onPress: () => nav.navigate('Search') },
    { icon: '#',  label: 'Profit Lab',     sub: '9 calculation tools',  onPress: () => nav.navigate('Calculate' as any) },
    { icon: '✦', label: 'Brand Studio',   sub: 'Build your identity',   onPress: () => nav.navigate('Brand') },
  ];
  return (
    <View style={qa.container}>
      <Text style={qa.sectionTitle}>Quick Actions</Text>
      <View style={qa.grid}>
        {actions.map(a => (
          <TouchableOpacity key={a.label} style={qa.card} onPress={a.onPress} activeOpacity={0.75}>
            <Text style={qa.icon}>{a.icon}</Text>
            <Text style={qa.label}>{a.label}</Text>
            <Text style={qa.sub}>{a.sub}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const qa = StyleSheet.create({
  container:    { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  grid:         { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  card:         { width: '48%', backgroundColor: DS.bgCard, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: DS.border, gap: 3 },
  icon:         { fontSize: 18, color: DS.accent, marginBottom: 2 },
  label:        { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  sub:          { fontSize: 11, color: DS.textMuted, lineHeight: 15 },
});

// ─── FBA Tips Carousel ────────────────────────────────────────────────────────

const FBA_TIPS = [
  { title: 'Price Sweet Spot',   body: 'Target $20–$70. Below $20 leaves no margin; above $70 buyers research too hard.', icon: '💰' },
  { title: 'Review Gate',        body: 'If the top 10 results average under 300 reviews, there\'s still room to compete.', icon: '⭐' },
  { title: 'Margin Rule',        body: 'Never launch below 25% net margin after FBA fees, COGS, and freight.', icon: '📊' },
  { title: 'First Order Size',   body: 'Start with 200–300 units. Enough to test, not so much you\'re stuck with dead stock.', icon: '📦' },
  { title: 'Launch PPC Budget',  body: 'Spend roughly 2× your unit cost per day on ads during your first 30 days.', icon: '🚀' },
  { title: 'Freight Threshold',  body: 'Sea freight beats air once your order exceeds ~$2,000 in value. Plan 6–8 weeks.', icon: '🚢' },
  { title: 'Brand Register',     body: 'Register your brand in year 1. Protects against hijackers and unlocks A+ content.', icon: '🛡️' },
  { title: 'Avoid These First',  body: 'Skip electronics, supplements, and toys for your first product — too much compliance.', icon: '⚠️' },
];

function TipsCarousel() {
  return (
    <View style={tc.container}>
      <Text style={tc.sectionTitle}>FBA Fundamentals</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {FBA_TIPS.map(tip => (
          <View key={tip.title} style={tc.card}>
            <Text style={tc.icon}>{tip.icon}</Text>
            <Text style={tc.title}>{tip.title}</Text>
            <Text style={tc.body}>{tip.body}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const tc = StyleSheet.create({
  container:    { gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: DS.textPrimary },
  card:         { width: 200, backgroundColor: DS.bgCard, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: DS.border, gap: 6 },
  icon:         { fontSize: 24 },
  title:        { fontSize: 13, fontWeight: '700', color: DS.textPrimary },
  body:         { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
});

// ─── Empty Build CTA ──────────────────────────────────────────────────────────

function EmptyBuildCTA() {
  const nav = useNavigation<Nav>();
  return (
    <TouchableOpacity style={eb.card} onPress={() => nav.navigate('LaunchPad' as any)} activeOpacity={0.85}>
      <View style={eb.iconWrap}><Text style={eb.icon}>◈</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={eb.title}>Ready to find your first product?</Text>
        <Text style={eb.sub}>The LaunchPad guides you step-by-step from idea to a profitable brand.</Text>
      </View>
      <Text style={eb.arrow}>→</Text>
    </TouchableOpacity>
  );
}

const eb = StyleSheet.create({
  card:    { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: DS.accent, borderRadius: 16, padding: 16 },
  iconWrap: { width: 44, height: 44, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  icon:    { fontSize: 22, color: '#fff' },
  title:   { fontSize: 14, fontWeight: '700', color: '#fff', marginBottom: 3 },
  sub:     { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17 },
  arrow:   { fontSize: 20, color: '#fff', fontWeight: '700' },
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

function GreetingHeader({ vaultCount }: { vaultCount: number }) {
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

      {/* Vault count strip */}
      {vaultCount > 0 && (
        <View style={gh.vaultStrip}>
          <Text style={gh.vaultStripText}>
            {vaultCount} product{vaultCount !== 1 ? 's' : ''} in the Winner Vault
          </Text>
          <View style={gh.vaultDots}>
            {Array.from({ length: Math.min(vaultCount, 6) }).map((_, i) => (
              <View key={i} style={[gh.vaultDot, i < 3 && { backgroundColor: DS.success }, i >= 3 && { backgroundColor: DS.accent }]} />
            ))}
          </View>
        </View>
      )}
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
  vaultStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: DS.bgCanvas, borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: DS.border,
  },
  vaultStripText: { fontSize: 12, fontWeight: '600', color: DS.textMuted },
  vaultDots:      { flexDirection: 'row', gap: 4 },
  vaultDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: DS.border },
});

// ─── Copilot Screen ───────────────────────────────────────────────────────────

export default function CopilotScreen() {
  const { vault, activeSession, reloadVault } = useBuilderSession();
  const { checked, toggle }                   = useChecklistState();

  useFocusEffect(useCallback(() => { reloadVault(); }, [reloadVault]));

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: DS.bgCanvas }}>
      <AppHeader helpKey="copilot" />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <GreetingHeader vaultCount={vault.length} />
        <ProfileStrip />
        <AITools />
        {!activeSession && !vault.length && <EmptyBuildCTA />}
        {activeSession && <ActiveProductCard session={activeSession} />}
        <QuickActions />
        <WinnerVaultCard vault={vault} />
        <TipsCarousel />
        <OverallProgressCard checked={checked} />
        <FullChecklistCard checked={checked} toggle={toggle} />
        <DailyInsightCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 20 },
});
