import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, ScrollView, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, radius, shadow } from '../theme';
import { api, Product, TrendData } from '../services/api';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import { CurrencySelector } from '../components/CurrencySelector';
import { useCurrency } from '../context/CurrencyContext';
import { CopilotResult, ReviewResult } from '../types';
import { useVault } from '../hooks/useVault';
import VaultCard from '../components/VaultCard';
import VaultFilterBar from '../components/VaultFilterBar';
import ShareCard from '../components/ShareCard';
import VaultExportModal from '../components/VaultExportModal';
import { VaultEntry, VaultStatus } from '../types/vault';
import AnalyzeInlineCard from '../components/AnalyzeInlineCard';
import CompareModal from '../components/CompareModal';
import ProductCard from '../components/ProductCard';
import PulseDots from '../components/PulseDots';
import { AnalyzeResult } from '../types/research';
import { pushAnalysis } from '../services/sync';
import { supabase } from '../lib/supabase';

const ANALYZE_USAGE_KEY = 'fba_analyze_usage_v1';
const ANALYZE_CACHE_KEY = 'fba_analyze_cache_v2';
const ANALYZE_CACHE_KEY_LEGACY = 'fba_analyze_cache_v1';
const QUERY_MAX_LENGTH  = 100;

// ─── Review Insights ──────────────────────────────────────────────────────────
const REVIEW_DATA: Record<string, { complaints: string[]; opportunities: string[] }> = {
  kitchen:  { complaints: ['Broke after a few uses','Smaller than pictured','Hard to clean','Cheap material'], opportunities: ['Use premium materials, show durability tests','Add accurate size chart with real photos','Design for easy cleaning, show how in images','Reinforce weak points competitors miss'] },
  fitness:  { complaints: ['Snapped under load','Sizing runs small','No instructions included','Poor grip'], opportunities: ['Show strength testing in images','Add full size guide','Include QR-code setup guide','Textured grip = easy differentiation'] },
  pet:      { complaints: ['Dog chewed through it','Sizing off','Hard to assemble','Cheap smell'], opportunities: ['Heavy-duty materials with chew-resistant claim','Detailed sizing chart with breed examples','Tool-free assembly as a headline feature','Non-toxic certified materials'] },
  beauty:   { complaints: ['Irritated skin','Scent too strong','Leaked in bag','Broke after 2 uses'], opportunities: ['Hypoallergenic + dermatologist tested badge','Fragrance-free option or subtle scent','Leak-proof packaging as key feature','Reinforce structural weak points'] },
  tech:     { complaints: ['Short cable','Stopped working after 3 months','Flimsy build','No instructions'], opportunities: ['6ft cable standard, longer than competition','18-month warranty prominently featured','Metal build vs plastic competitors','Video QR code for setup'] },
  baby:     { complaints: ['Sizing wrong','Hard to clean','Scratched baby','Not durable'], opportunities: ['Detailed sizing + age guide','Machine washable as headline','Smooth edges certification','BPA-free + drop-test certification'] },
  outdoor:  { complaints: ['Not waterproof as claimed','Heavy','Broke on first trip','Poor stitching'], opportunities: ['IPX rating clearly stated with test video','Lightweight vs comparable products','Reinforced stress points shown in images','Triple-stitched as a specific claim'] },
  default:  { complaints: ['Broke quickly','Not as described','Hard to use','Poor instructions'], opportunities: ['Show durability test in listing images','Accurate photos from multiple angles','Intuitive design as a headline','Include QR code for video tutorial'] },
};

function getReviewCategory(title: string): string {
  const t = title.toLowerCase();
  if (/kitchen|cook|pan|knife|cutting|mug|bottle/.test(t)) return 'kitchen';
  if (/fitness|yoga|gym|exercise|band|dumbbell|weight/.test(t)) return 'fitness';
  if (/dog|cat|pet|paw|collar|leash/.test(t)) return 'pet';
  if (/skin|hair|beauty|cream|serum|nail|makeup/.test(t)) return 'beauty';
  if (/phone|cable|charger|speaker|headphone|tech|electronic/.test(t)) return 'tech';
  if (/baby|infant|toddler|kid|child/.test(t)) return 'baby';
  if (/hik|camp|outdoor|trail|waterproof|tent/.test(t)) return 'outdoor';
  return 'default';
}

function ReviewInsightsModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const { fmt, marketplace, currency } = useCurrency();
  const cat = getReviewCategory(product.title);
  const fallback = REVIEW_DATA[cat];
  const [tab, setTab] = useState<'insights' | 'copilot'>('insights');
  const [copilot, setCopilot] = useState<CopilotResult | null>(null);
  const [reviews, setReviews] = useState<ReviewResult | null>(null);
  const [loading, setLoading] = useState(false);

  async function runAI() {
    if (copilot) { setTab('copilot'); return; }
    setLoading(true);
    setTab('copilot');
    try {
      const [cop, rev] = await Promise.all([
        api.analyzeCopilot({
          product_name: product.title,
          amazon_price: product.price ?? 29.99,
          supplier_price: (product.price ?? 29.99) * 0.22,
          review_count: product.review_count ?? 0,
          trend_direction: 'Stable',
          category: cat,
          competition: product.competition,
          marketplace,
          currency,
        }),
        api.analyzeReviews(product.title, cat),
      ]);
      setCopilot(cop);
      setReviews(rev);
    } catch { /* fallback shown below */ }
    finally { setLoading(false); }
  }

  const verdictColor = copilot?.verdict === 'Launch' ? colors.green
    : copilot?.verdict === 'Avoid' ? colors.red : colors.amber;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={ri.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={ri.sheet}>
        <View style={ri.handle} />

        {/* Tab switcher */}
        <View style={ri.tabs}>
          <TouchableOpacity style={[ri.tabBtn, tab === 'insights' && ri.tabBtnActive]} onPress={() => setTab('insights')}>
            <Text style={[ri.tabBtnText, tab === 'insights' && ri.tabBtnTextActive]}>Review Insights</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ri.tabBtn, tab === 'copilot' && ri.tabBtnActive]} onPress={runAI}>
            <Text style={[ri.tabBtnText, tab === 'copilot' && ri.tabBtnTextActive]}>⚡ AI Copilot</Text>
          </TouchableOpacity>
        </View>
        <Text style={ri.tabHint}>
          {tab === 'insights'
            ? 'What buyers hate about competitors — and exactly how to stand out'
            : 'Full AI verdict: risks, differentiation strategy & launch plan'}
        </Text>

        <Text style={ri.subtitle} numberOfLines={1}>{product.title}</Text>

        <ScrollView showsVerticalScrollIndicator={false}>
          {tab === 'insights' && (
            <>
              <Text style={ri.sectionLabel}>TOP COMPETITOR COMPLAINTS</Text>
              {(reviews?.top_complaints ?? fallback.complaints).map((c: string, i: number) => (
                <View key={i} style={ri.row}>
                  <Text style={ri.redDot}>✗</Text>
                  <Text style={ri.rowText}>{c}</Text>
                </View>
              ))}
              <Text style={[ri.sectionLabel, { marginTop: spacing.md }]}>YOUR OPPORTUNITIES</Text>
              {(reviews?.opportunities ?? fallback.opportunities).map((o: string, i: number) => (
                <View key={i} style={ri.row}>
                  <Text style={ri.greenDot}>✓</Text>
                  <Text style={ri.rowText}>{o}</Text>
                </View>
              ))}
              {reviews?.bundling_ideas?.length > 0 && (
                <>
                  <Text style={[ri.sectionLabel, { marginTop: spacing.md }]}>BUNDLE IDEAS</Text>
                  {reviews.bundling_ideas.map((b: string, i: number) => (
                    <View key={i} style={ri.row}>
                      <Text style={[ri.greenDot, { color: '#0284C7' }]}>◎</Text>
                      <Text style={ri.rowText}>{b}</Text>
                    </View>
                  ))}
                </>
              )}
            </>
          )}

          {tab === 'copilot' && (
            loading ? (
              <View style={{ alignItems: 'center', paddingVertical: 40, gap: 10 }}>
                <PulseDots color={'#0284C7'} />
                <Text style={ri.noteText}>Analysing with AI…</Text>
              </View>
            ) : copilot ? (
              <>
                {/* Verdict */}
                <View style={[ri.verdictCard, { borderColor: verdictColor }]}>
                  <Text style={[ri.verdictBadge, { color: verdictColor }]}>{copilot.verdict.toUpperCase()}</Text>
                  <Text style={ri.verdictSummary}>{copilot.summary}</Text>
                  <View style={ri.scoreRow}>
                    <Text style={ri.scoreLabel}>OPPORTUNITY SCORE</Text>
                    <Text style={[ri.scoreNum, { color: verdictColor }]}>{copilot.opportunity_score}/100</Text>
                  </View>
                </View>

                {/* Risks */}
                <Text style={[ri.sectionLabel, { marginTop: spacing.md }]}>TOP RISKS</Text>
                {copilot.top_risks.map((r: string, i: number) => (
                  <View key={i} style={ri.row}>
                    <Text style={ri.redDot}>⚠</Text>
                    <Text style={ri.rowText}>{r}</Text>
                  </View>
                ))}

                {/* Differentiation */}
                <Text style={[ri.sectionLabel, { marginTop: spacing.md }]}>HOW TO DIFFERENTIATE</Text>
                {copilot.differentiation.map((d: string, i: number) => (
                  <View key={i} style={ri.row}>
                    <Text style={ri.greenDot}>✦</Text>
                    <Text style={ri.rowText}>{d}</Text>
                  </View>
                ))}

                {/* Launch strategy */}
                <View style={ri.note}>
                  <Text style={[ri.noteText, { fontWeight: '700', color: colors.textPrimary, marginBottom: 4 }]}>LAUNCH STRATEGY</Text>
                  <Text style={ri.noteText}>{copilot.launch_strategy}</Text>
                </View>

                {/* Est. profit */}
                {copilot.estimated_monthly_profit > 0 && (
                  <View style={ri.profitRow}>
                    <Text style={ri.profitLabel}>EST. MONTHLY PROFIT</Text>
                    <Text style={ri.profitNum}>{fmt(copilot.estimated_monthly_profit, 0)}</Text>
                  </View>
                )}
              </>
            ) : (
              <View style={ri.note}>
                <Text style={ri.noteText}>AI analysis unavailable. Check your server connection.</Text>
              </View>
            )
          )}
        </ScrollView>

        <TouchableOpacity style={ri.closeBtn} onPress={onClose} activeOpacity={0.8}>
          <Text style={ri.closeBtnText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}
const ri = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheet: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing.lg, maxHeight: '78%',
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1,
    borderColor: colors.border,
  },
  handle: { width: 36, height: 4, backgroundColor: colors.bgElevated, borderRadius: 2, alignSelf: 'center', marginBottom: spacing.md },
  title: { fontSize: 18, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
  subtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: spacing.md },
  sectionLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginBottom: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm, marginBottom: 8, alignItems: 'flex-start' },
  redDot:   { fontSize: 12, color: colors.red,   fontWeight: '800', marginTop: 1 },
  greenDot: { fontSize: 12, color: colors.green, fontWeight: '800', marginTop: 1 },
  rowText: { fontSize: 14, flex: 1, lineHeight: 20, color: colors.textSecondary },
  note: { backgroundColor: colors.bgElevated, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, marginBottom: spacing.md },
  noteText: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  closeBtn: { backgroundColor: '#0284C7', borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  closeBtnText: { fontSize: 15, fontWeight: '700', color: colors.white },
  // Tabs
  tabs: { flexDirection: 'row', backgroundColor: colors.bgElevated, borderRadius: radius.md, padding: 3, marginBottom: spacing.md, gap: 3 },
  tabBtn: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radius.sm },
  tabBtnActive: { backgroundColor: '#0284C7' },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  tabBtnTextActive: { color: colors.white },
  // Copilot
  verdictCard: { borderWidth: 1.5, borderRadius: radius.lg, padding: spacing.md, gap: 6, marginBottom: spacing.sm },
  verdictBadge: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  verdictSummary: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  scoreLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5 },
  scoreNum: { fontSize: 20, fontWeight: '900', letterSpacing: -0.5 },
  profitRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(2,132,199,0.09)', borderRadius: radius.md, padding: spacing.md, marginVertical: spacing.sm, borderWidth: 1, borderColor: 'rgba(2,132,199,0.22)' },
  profitLabel: { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5 },
  profitNum: { fontSize: 22, fontWeight: '900', color: '#0284C7', letterSpacing: -0.5 },
  tabHint: { fontSize: 11.5, color: colors.textMuted, lineHeight: 17, letterSpacing: 0.1, marginBottom: spacing.xs },
});

// ─── Trend helpers (local — only used in the main screen header) ─────────────
function TrendChart({ data }: { data: { month: string; value: number }[] }) {
  const pts = data.slice(-12);
  const max = Math.max(...pts.map(d => d.value), 1);
  return (
    <View style={tc.wrap}>
      {pts.map((d, i) => (
        <View key={i} style={[tc.bar, { height: Math.max(3, (d.value / max) * 40) }]} />
      ))}
    </View>
  );
}
const tc = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-end', height: 40, gap: 2, flex: 1 },
  bar:  { flex: 1, backgroundColor: '#0284C7', borderRadius: 2, opacity: 0.8 },
});





// ─── Analyze Helpers ─────────────────────────────────────────────────────────
function localFallback(price: number, reviews: number, competition: string): AnalyzeResult {
  const margin = Math.round(((price - price / 3.5) / price) * 100);
  const comp = competition.toLowerCase();
  const verdict: AnalyzeResult['verdict'] =
    margin > 30 && reviews < 500 && comp !== 'high' ? 'LAUNCH' : margin > 20 ? 'TEST' : 'AVOID';
  return {
    verdict, confidence: 42,
    summary: `${verdict} — estimated from product data (offline mode)`,
    reasons: [
      `${margin}% estimated margin based on a 3.5× supplier markup`,
      `${reviews} reviews — ${reviews < 300 ? 'low' : reviews < 1000 ? 'moderate' : 'high'} competition level`,
      `${competition} competition signals ${comp === 'low' ? 'an open market' : comp === 'high' ? 'a crowded space' : 'moderate difficulty'}`,
    ],
    risk: 'Offline estimate only — refresh for full AI analysis',
    next_step: 'Reconnect and tap Refresh for a full AI-powered decision',
    metrics: { price, margin, reviews, competition, trend: 'stable' },
  };
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ResearchScreen({ edges }: { edges?: readonly ('top'|'right'|'bottom'|'left')[] } = {}) {
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [trends, setTrends] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaywall, setShowPaywall] = useState(false);
  const vault = useVault();
  const savedSet = useMemo(() => new Set(vault.entries.map(e => e.asin)), [vault.entries]);
  const [showSaved, setShowSaved] = useState(false);
  const [vaultSearch, setVaultSearch] = useState('');
  const [vaultStatusFilter, setVaultStatusFilter] = useState<VaultStatus | 'all'>('all');
  const [shareEntry, setShareEntry] = useState<VaultEntry | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [insightProduct, setInsightProduct] = useState<Product | null>(null);
  // ── Analyze state
  const [expandedAsin, setExpandedAsin]   = useState<string | null>(null);
  const [loadingAsin, setLoadingAsin]     = useState<string | null>(null);
  const [analyzeCache, setAnalyzeCache]   = useState<Record<string, AnalyzeResult>>({});
  const analyzeCacheRef = useRef<Record<string, AnalyzeResult>>({});
  analyzeCacheRef.current = analyzeCache; // always points to latest cache for use in callbacks
  const [compareAsins, setCompareAsins]   = useState<string[]>([]);
  const [showCompare, setShowCompare]     = useState(false);
  const [analyzeUsed, setAnalyzeUsed]     = useState(0);
  const [limitAsin, setLimitAsin]         = useState<string | null>(null);
  const ANALYZE_LIMIT = 3; // Explorer monthly limit

  const { can, increment, remaining, isFree, limits } = useSubscription();
  const { fmt, currency, marketplace } = useCurrency();
  const searchesLeft = remaining('research');
  const savesAllowed = can('saves');

  const filteredVaultEntries = useMemo(() => {
    let result = vault.entries;
    if (vaultStatusFilter !== 'all') {
      result = result.filter(e => e.status === vaultStatusFilter);
    }
    if (vaultSearch.trim()) {
      const q = vaultSearch.toLowerCase();
      result = result.filter(e =>
        e.product.title.toLowerCase().includes(q) ||
        (e.note && e.note.toLowerCase().includes(q))
      );
    }
    return result;
  }, [vault.entries, vaultStatusFilter, vaultSearch]);

  useEffect(() => {
    AsyncStorage.getItem(ANALYZE_USAGE_KEY).then(raw => {
      if (!raw) return;
      try {
        const { month, count } = JSON.parse(raw);
        const cur = new Date().toISOString().slice(0, 7);
        if (month === cur) setAnalyzeUsed(count);
      } catch { /* ignore corrupted */ }
    });
    // Load v2 cache; if empty, migrate from v1
    AsyncStorage.getItem(ANALYZE_CACHE_KEY).then(async raw => {
      if (raw) {
        try { setAnalyzeCache(prev => ({ ...JSON.parse(raw), ...prev })); } catch { /* ignore */ }
        return;
      }
      const legacy = await AsyncStorage.getItem(ANALYZE_CACHE_KEY_LEGACY);
      if (!legacy) return;
      try {
        const migrated = JSON.parse(legacy);
        setAnalyzeCache(prev => ({ ...migrated, ...prev }));
        await AsyncStorage.setItem(ANALYZE_CACHE_KEY, legacy);
      } catch { /* ignore */ }
    });
  }, []);

  async function saveWinner(product: Product, result: AnalyzeResult) {
    if (!savesAllowed) { setShowPaywall(true); return; }
    vault.addEntry(product, result as any, marketplace, currency);
    const nextCache = { ...analyzeCacheRef.current, [product.asin]: result };
    setAnalyzeCache(nextCache);
    await AsyncStorage.setItem(ANALYZE_CACHE_KEY, JSON.stringify(nextCache));
  }

  function incrementAnalyzeUsage() {
    const month = new Date().toISOString().slice(0, 7);
    setAnalyzeUsed(prev => {
      const next = prev + 1;
      AsyncStorage.setItem(ANALYZE_USAGE_KEY, JSON.stringify({ month, count: next }));
      return next;
    });
  }

  async function runAnalysis(item: Product, force = false) {
    const asin = item.asin;
    // Prevent duplicate in-flight requests
    if (loadingAsin === asin) return;
    // Toggle collapse
    if (expandedAsin === asin && !force) { setExpandedAsin(null); setLimitAsin(null); return; }
    // Cache hit → expand instantly, no API, no limit counted
    if (analyzeCache[asin] && !force) { setLimitAsin(null); setExpandedAsin(asin); return; }
    // Limit check: only block if there is no cached result yet (don't block force-refresh of existing)
    if (isFree && analyzeUsed >= ANALYZE_LIMIT && !analyzeCache[asin]) {
      setLimitAsin(asin); setExpandedAsin(asin); return;
    }
    setLimitAsin(null);
    setExpandedAsin(asin);
    setLoadingAsin(asin);
    const isNew = !analyzeCache[asin];
    try {
      const data = await api.analyzeProduct(
        item.price ?? 29.99,
        item.review_count ?? 0,
        item.competition.toLowerCase(),
        (trendDir ?? 'stable').toLowerCase(),
        { currency, marketplace },
      );
      setAnalyzeCache(prev => ({ ...prev, [asin]: data as AnalyzeResult }));
      if (vault.hasEntry(asin)) vault.updateAnalysis(asin, data as any);
      if (isFree && isNew) incrementAnalyzeUsage();
      // Persist analysis to cloud (fire-and-forget — does not block UI)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) pushAnalysis(session.user.id, asin, item.title, data as object);
      });
    } catch {
      const fallback = localFallback(item.price ?? 29.99, item.review_count ?? 0, item.competition);
      setAnalyzeCache(prev => ({ ...prev, [asin]: fallback }));
      if (vault.hasEntry(asin)) vault.updateAnalysis(asin, fallback as any);
    } finally {
      setLoadingAsin(null);
    }
  }

  function toggleCompare(asin: string) {
    setCompareAsins(prev =>
      prev.includes(asin)
        ? prev.filter(a => a !== asin)
        : prev.length < 3 ? [...prev, asin] : prev,
    );
  }

  function toggleSave(product: Product) {
    const exists = savedSet.has(product.asin);
    if (!exists && !savesAllowed) { setShowPaywall(true); return; }
    if (exists) {
      vault.removeEntry(product.asin);
    } else {
      vault.addEntry(product, analyzeCache[product.asin] as any ?? null, marketplace, currency);
    }
  }

  function isSaved(product: Product) {
    return savedSet.has(product.asin);
  }

  async function search(queryOverride?: string) {
    const q = (queryOverride ?? query).trim();
    if (!q) return;
    if (q.length > QUERY_MAX_LENGTH) {
      setError(`Query too long — keep it under ${QUERY_MAX_LENGTH} characters.`);
      return;
    }
    if (!can('research')) { setShowPaywall(true); return; }
    setLoading(true); setError(''); setProducts([]); setTrends(null);
    setExpandedAsin(null); setLimitAsin(null);
    try {
      const data = await api.searchAmazon(q);
      const good = data.products.filter(p => !p.error);
      const errs = data.products.filter(p => p.error);
      setProducts(good);
      setTrends(data.trends);
      if (errs.length) setError(errs[0].error || 'Some results had issues.');
      await increment('research');
    } catch (e: any) {
      setError(e.message || "Couldn't fetch live data right now. Try again shortly.");
    } finally {
      setLoading(false);
    }
  }

  function quickSearch(demo: string) {
    setQuery(demo);
    search(demo);
  }

  const trendDir   = trends?.trend_direction;
  const trendColor = trendDir === 'Rising' ? colors.green : trendDir === 'Declining' ? colors.red : colors.textSecondary;
  const trendArrow = trendDir === 'Rising' ? '↑' : trendDir === 'Declining' ? '↓' : '→';

  return (
    <SafeAreaView style={s.container} edges={edges as any}>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="research" />
      {shareEntry && (
        <ShareCard entry={shareEntry} onClose={() => setShareEntry(null)} />
      )}
      <VaultExportModal
        visible={showExport}
        entries={vault.entries}
        onClose={() => setShowExport(false)}
      />
      {insightProduct && (
        <ReviewInsightsModal product={insightProduct} onClose={() => setInsightProduct(null)} />
      )}
      {showCompare && compareAsins.length >= 2 && (
        <CompareModal
          items={[...products, ...vault.entries.map(e => e.product)].filter((p, i, arr) =>
            compareAsins.includes(p.asin) && arr.findIndex(x => x.asin === p.asin) === i
          )}
          cache={analyzeCache}
          onClose={() => setShowCompare(false)}
        />
      )}

      {/* ─── Hero ─── */}
      <View style={s.hero}>
        {/* Layered atmosphere orbs */}
        <View style={s.heroOrb1} pointerEvents="none" />
        <View style={s.heroOrb2} pointerEvents="none" />
        <View style={s.heroOrb3} pointerEvents="none" />
        <View style={s.heroTop}>
          <View>
            <Text style={s.brandWord}>Siftly</Text>
            <Text style={s.eyebrow}>OPPORTUNITY INTELLIGENCE</Text>
            <Text style={s.title}>Find what's{'\n'}worth building.</Text>
            <Text style={s.titleSub}>Real demand · AI signal · 6 markets</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 8 }}>
            <CurrencySelector />
            {isFree && (
              <TouchableOpacity style={s.usagePill} onPress={() => setShowPaywall(true)} activeOpacity={0.8}>
                <Text style={s.usagePillText}>{searchesLeft} of {limits.research} searches</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.savedBtn} onPress={() => setShowSaved(v => !v)} activeOpacity={0.8}>
              <Text style={s.savedBtnText}>
                {showSaved ? '← Back' : `Vault${vault.entries.length > 0 ? ` (${vault.entries.length})` : ''}`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.searchRow}>
            <TextInput
              style={s.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Enter a product to research…"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={() => search()}
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[s.searchBtn, loading && { opacity: 0.5 }]}
              onPress={() => search()}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <PulseDots color={colors.white} />
                : <Text style={s.searchBtnText}>→</Text>
              }
            </TouchableOpacity>
          </View>
      </View>

      {!!error && !showSaved && (
        <Text style={s.errorText}>{error}</Text>
      )}

      {/* ─── Winner Vault ─── */}
      {showSaved && (
        <View style={{ flex: 1 }}>
          {/* Vault toolbar — always visible */}
          <View style={s.vaultToolbar}>
            <View>
              <Text style={s.vaultToolbarTitle}>OPPORTUNITY VAULT</Text>
              <Text style={s.vaultToolbarCount}>
                {vault.entries.length === 0
                  ? 'No saved products yet'
                  : `${vault.entries.length} opportunit${vault.entries.length !== 1 ? 'ies' : 'y'} saved`}
              </Text>
            </View>
            <TouchableOpacity
              style={[s.exportToolbarBtn, vault.entries.length === 0 && { opacity: 0.4 }]}
              onPress={() => setShowExport(true)}
              activeOpacity={0.8}
            >
              <Text style={s.exportToolbarBtnText}>↓ Export</Text>
            </TouchableOpacity>
          </View>

          {vault.entries.length > 0 && (
            <VaultFilterBar
              search={vaultSearch}
              onSearchChange={setVaultSearch}
              statusFilter={vaultStatusFilter}
              onStatusChange={setVaultStatusFilter}
              count={filteredVaultEntries.length}
            />
          )}
          <FlatList
            data={filteredVaultEntries}
            keyExtractor={item => item.asin}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              vault.entries.length === 0 ? (
                <View style={s.empty}>
                  <View style={s.emptyOrb}>
                    <Text style={s.emptyOrbIcon}>♡</Text>
                  </View>
                  <Text style={s.emptyTitle}>Winner Vault is empty</Text>
                  <Text style={s.emptyText}>Analyze a product and tap{'\n'}"Save to Vault" to track it here.</Text>
                </View>
              ) : (
                <View style={s.empty}>
                  <Text style={s.emptyTitle}>No matches</Text>
                  <Text style={s.emptyText}>Try a different search or filter.</Text>
                </View>
              )
            }
            ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            renderItem={({ item }) => (
              <VaultCard
                entry={item}
                onRemove={() => vault.removeEntry(item.asin)}
                onStatusChange={status => vault.updateStatus(item.asin, status)}
                onNoteChange={note => vault.updateNote(item.asin, note)}
                onShare={() => setShareEntry(item)}
              />
            )}
          />
        </View>
      )}

      {/* ─── Search results ─── */}
      {!showSaved && (
        <FlatList
          data={products}
          keyExtractor={(item, i) => item.asin || String(i)}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          windowSize={10}
          maxToRenderPerBatch={5}
          ListHeaderComponent={
            <View>
              {trends && !trends.error && (
                <View style={s.trendCard}>
                  <View style={s.trendLeft}>
                    <Text style={s.trendLabel}>GOOGLE TRENDS</Text>
                    <View style={s.trendDirRow}>
                      <Text style={[s.trendArrow, { color: trendColor }]}>{trendArrow}</Text>
                      <Text style={[s.trendDir, { color: trendColor }]}>{trendDir}</Text>
                      {trends.interest_score != null && (
                        <Text style={s.trendScore}>{trends.interest_score}/100</Text>
                      )}
                    </View>
                    {trends.related_queries.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {trends.related_queries.slice(0, 6).map((q, i) => (
                            <View key={i} style={s.relTag}>
                              <Text style={s.relTagText}>{q}</Text>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    )}
                  </View>
                  {trends.monthly_interest.length > 0 && (
                    <View style={s.trendChartWrap}>
                      <TrendChart data={trends.monthly_interest} />
                      <Text style={s.trendChartLabel}>12-month demand</Text>
                    </View>
                  )}
                </View>
              )}
              {products.length > 0 && (
                <Text style={s.resultsLabel}>{products.length} PRODUCTS FOUND</Text>
              )}
            </View>
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          ListEmptyComponent={
            !loading ? (
              <View style={s.empty}>
                <View style={s.emptyOrb}>
                  <Text style={s.emptyOrbIcon}>◎</Text>
                </View>
                <Text style={s.emptyTitle}>What will you hunt today?</Text>
                <Text style={s.emptyText}>Real Amazon prices · AI verdict · Margin estimate</Text>
                <Text style={s.emptySubtext}>Enter any product keyword to begin</Text>
                <View style={s.demoRow}>
                  {['bamboo cutting board', 'resistance bands', 'yoga mat bag'].map(demo => (
                    <TouchableOpacity key={demo} style={s.demoChip} onPress={() => quickSearch(demo)}>
                      <Text style={s.demoChipText}>{demo} →</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
          renderItem={({ item, index }) => (
            <View>
              <ProductCard
                item={item}
                isSaved={isSaved(item)}
                onSave={() => toggleSave(item)}
                onInsight={() => setInsightProduct(item)}
                onAnalyze={() => runAnalysis(item)}
                expanded={expandedAsin === item.asin}
                analyzing={loadingAsin === item.asin}
                showHint={index === 0 && analyzeUsed === 0}
                cardIndex={index}
                usageMeter={
                  isFree && analyzeUsed > 0 && analyzeUsed < ANALYZE_LIMIT
                    ? `${analyzeUsed} of ${ANALYZE_LIMIT} free analyses used`
                    : isFree && analyzeUsed >= ANALYZE_LIMIT
                    ? 'Free limit reached — cached analyses are free'
                    : null
                }
              />
              {expandedAsin === item.asin && (
                <AnalyzeInlineCard
                  result={analyzeCache[item.asin] ?? null}
                  loading={loadingAsin === item.asin}
                  fromCache={!!analyzeCache[item.asin] && loadingAsin !== item.asin}
                  onRefresh={() => runAnalysis(item, true)}
                  isCompareSelected={compareAsins.includes(item.asin)}
                  canAddCompare={compareAsins.length < 3}
                  onToggleCompare={() => toggleCompare(item.asin)}
                  isSaved={isSaved(item)}
                  onSaveWinner={() => { if (isSaved(item)) { toggleSave(item); } else { const r = analyzeCache[item.asin]; if (r) saveWinner(item, r); } }}
                  limitReached={limitAsin === item.asin}
                  analyzeUsed={analyzeUsed}
                  analyzeLimit={ANALYZE_LIMIT}
                  onUpgrade={() => { setExpandedAsin(null); setLimitAsin(null); setShowPaywall(true); }}
                />
              )}
            </View>
          )}
        />
      )}
      {/* ─── Compare Bar ─── */}
      {compareAsins.length >= 1 && (
        <TouchableOpacity
          style={[s.compareBar, compareAsins.length < 2 && s.compareBarDim]}
          onPress={() => compareAsins.length >= 2 && setShowCompare(true)}
          activeOpacity={0.9}
        >
          <Text style={[s.compareBarText, compareAsins.length < 2 && s.compareBarTextDim]}>
            {compareAsins.length < 2
              ? `${compareAsins.length} selected — add 1 more to compare`
              : `Compare ${compareAsins.length} products →`}
          </Text>
          <TouchableOpacity onPress={() => setCompareAsins([])} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={[s.compareBarClear, compareAsins.length < 2 && s.compareBarClearDim]}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { paddingBottom: spacing.xxl },

  // ── Hero
  hero: {
    backgroundColor: colors.bgHero,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(2,132,199,0.22)',
    overflow: 'hidden',
  },
  // 3-layer orb atmosphere
  heroOrb1: {
    position: 'absolute', top: -70, right: -60,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: 'rgba(2,132,199,0.09)',
    opacity: 0.55,
  },
  heroOrb2: {
    position: 'absolute', top: 20, right: 60,
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: colors.purpleDim,
    opacity: 0.45,
  },
  heroOrb3: {
    position: 'absolute', bottom: -50, left: -40,
    width: 160, height: 160, borderRadius: 80,
    backgroundColor: 'rgba(2,132,199,0.09)',
    opacity: 0.30,
  },
  heroTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: spacing.md,
  },
  brandWord: {
    fontSize: 20, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -0.8, marginBottom: 2,
  },
  eyebrow: {
    fontSize: 9, fontWeight: '800', color: '#0284C7',
    letterSpacing: 2.8, marginBottom: 6,
  },
  title: {
    fontSize: 30, fontWeight: '900', color: colors.textPrimary,
    letterSpacing: -1.2, lineHeight: 36,
  },
  titleSub: { fontSize: 11, color: colors.textSecondary, marginTop: 6, letterSpacing: 0.1 },
  usagePill: {
    backgroundColor: 'rgba(2,132,199,0.09)', borderRadius: radius.full,
    paddingHorizontal: spacing.sm + 4, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(2,132,199,0.22)',
  },
  usagePillText: { fontSize: 10, fontWeight: '700', color: '#0284C7' },
  savedBtn: {
    backgroundColor: colors.bgCard, borderRadius: radius.full,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs + 2,
    borderWidth: 1, borderColor: colors.border,
    ...shadow.sm,
  },
  savedBtnText: { fontSize: 10, fontWeight: '700', color: colors.textSecondary },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1, backgroundColor: colors.bgElevated,
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4, fontSize: 15, color: colors.textPrimary,
  },
  searchBtn: {
    backgroundColor: '#0284C7', borderRadius: radius.md,
    paddingHorizontal: spacing.lg, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#0284C7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 6,
  },
  searchBtnText: { color: colors.bg, fontSize: 20, fontWeight: '900' },
  errorText: { fontSize: 12, color: colors.red, paddingHorizontal: spacing.lg, marginVertical: spacing.sm },

  // ── Trend card
  trendCard: {
    backgroundColor: colors.bgCard,
    marginHorizontal: spacing.lg, marginBottom: spacing.md,
    borderRadius: radius.lg, padding: spacing.md,
    flexDirection: 'row', gap: spacing.md,
    borderWidth: 1, borderColor: 'rgba(2,132,199,0.22)',
  },
  trendLeft:       { flex: 1 },
  trendLabel:      { fontSize: 8, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, marginBottom: 4 },
  trendDirRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trendArrow:      { fontSize: 22, fontWeight: '800' },
  trendDir:        { fontSize: 16, fontWeight: '800' },
  trendScore:      { fontSize: 12, color: colors.textMuted, marginLeft: 4 },
  relTag: {
    backgroundColor: colors.bgElevated, borderRadius: radius.full,
    paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: colors.border,
  },
  relTagText:      { fontSize: 10, color: colors.textSecondary, fontWeight: '600' },
  trendChartWrap:  { width: 90, alignItems: 'flex-end', justifyContent: 'flex-end' },
  trendChartLabel: { fontSize: 8, color: colors.textMuted, marginTop: 4, fontWeight: '600' },
  resultsLabel:    { fontSize: 9, fontWeight: '800', color: colors.textMuted, letterSpacing: 1.5, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },

  // Compare bar
  compareBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0284C7',
    paddingVertical: 14, paddingHorizontal: spacing.lg,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  compareBarDim:      { backgroundColor: colors.bgElevated, borderTopWidth: 1, borderTopColor: colors.border },
  compareBarText:     { fontSize: 14, fontWeight: '700', color: colors.white, flex: 1 },
  compareBarTextDim:  { color: colors.textSecondary },
  compareBarClear:    { fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.7)', paddingLeft: 12 },
  compareBarClearDim: { color: colors.textMuted },

  // ── Empty state
  empty: { alignItems: 'center', paddingTop: 72, gap: spacing.xs + 2, paddingHorizontal: spacing.lg },
  emptyOrb: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(2,132,199,0.09)',
    borderWidth: 1.5, borderColor: 'rgba(2,132,199,0.22)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: spacing.sm,
  },
  emptyOrbIcon:  { fontSize: 32, color: '#0284C7' },
  emptyTitle:    { fontSize: 20, fontWeight: '800', color: colors.textPrimary, letterSpacing: -0.5, textAlign: 'center' },
  emptyText:     { fontSize: 13, color: colors.textSecondary, textAlign: 'center', letterSpacing: 0.2, marginTop: 2 },
  emptySubtext:  { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: -2 },

  // ── Demo chips (empty state)
  demoRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    marginTop: spacing.md + 2, justifyContent: 'center',
  },
  demoChip: {
    backgroundColor: colors.bgCard, borderRadius: radius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(2,132,199,0.22)',
    ...shadow.sm,
  },
  demoChipText: { fontSize: 11, fontWeight: '700', color: '#0284C7' },


  // ── Vault toolbar
  vaultToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    backgroundColor: colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  vaultToolbarTitle: {
    fontSize: 8, fontWeight: '900', color: colors.textMuted,
    letterSpacing: 2.5, marginBottom: 2,
  },
  vaultToolbarCount: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  exportToolbarBtn: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: 'rgba(2,132,199,0.22)',
  },
  exportToolbarBtnText: { fontSize: 12, fontWeight: '800', color: '#0284C7' },
});
