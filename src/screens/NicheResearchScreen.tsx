import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParseJSON } from '../utils/safeJSON';
import { useNavigation, useRoute } from '@react-navigation/native';
import { DS } from '../components/ds';
import { api } from '../services/api';
import { AppHeader } from '../components/AppHeader';
import { useCurrency } from '../context/CurrencyContext';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { usePipeline } from '../context/PipelineContext';
import { UsageQuotaBar } from '../components/UsageQuotaBar';
import { useProductIntelligence } from '../hooks/useProductIntelligence';
import { ProductQuickIntel } from '../components/ProductQuickIntel';
import { FeatureExplainer } from '../components/FeatureExplainer';
import { useSubscription } from '../hooks/useSubscription';
import PaywallModal from '../components/PaywallModal';
import { EstimateLabel } from '../components/EstimateLabel';
import { DataSourceBanner, type DataSourceType } from '../components/DataSourceBanner';
import { PipelineProgressBar } from '../components/PipelineProgressBar';

const WATCHLIST_KEY = 'siftly_niche_watchlist_v1';

type NicheVerdict = {
  label: string;
  color: string;
  score: number;
  reasons: string[];
  warnings: string[];
};

type NicheReport = {
  keyword: string;
  marketplace: string;
  verdict: NicheVerdict;
  market_snapshot: {
    avg_price: number;
    avg_reviews: number;
    avg_rating: number;
    top_reviews: number;
    total_products: number;
    in_price_range: number;
    low_competition: number;
  };
  the_gap: string[];
  products_to_model: {
    title: string;
    price: number;
    rating: number;
    review_count: number;
    asin: string;
    url: string;
  }[];
  can_you_afford_it: {
    budget: number;
    target_unit_cost: number;
    min_order_cost: number;
    can_afford: boolean;
    verdict: string;
  };
  data_source?: string;
};

type SavedNiche = {
  keyword: string;
  marketplace: string;
  verdictLabel: string;
  verdictColor: string;
  score: number;
  savedAt: string;
};

const VERDICT_COLOR: Record<string, string> = {
  green: DS.success,
  amber: DS.warning,
  red:   DS.danger,
  grey:  DS.textMuted,
};

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreDot({ score }: { score: number }) {
  const color = score >= 4 ? DS.success : score >= 2 ? DS.warning : DS.danger;
  return (
    <View style={[sc.scoreDotWrap, { backgroundColor: color + '18' }]}>
      {[1, 2, 3, 4, 5].map(i => (
        <View key={i} style={[sc.dot, { backgroundColor: i <= score ? color : DS.bgElevated }]} />
      ))}
    </View>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={sc.stat}>
      <Text style={sc.statVal}>{value}</Text>
      <Text style={sc.statLbl}>{label}</Text>
      {sub && <Text style={sc.statSub}>{sub}</Text>}
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function NicheResearchScreen({ embedded = false, focusTrigger = 0 }: { embedded?: boolean; focusTrigger?: number } = {}) {
  const { marketplace, symbol: currencySymbol } = useCurrency();
  const { profile }     = useSellerProfile();
  const pipeline        = usePipeline();
  const navigation      = useNavigation<any>();
  const route           = useRoute<any>();
  const { isOnline }    = useNetworkStatus();
  const { can, increment } = useSubscription();

  const searchInputRef  = useRef<TextInput>(null);

  useEffect(() => {
    if (!focusTrigger) return;
    const t = setTimeout(() => searchInputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, [focusTrigger]);

  const [keyword,   setKeyword]   = useState('');
  const [priceMin,  setPriceMin]  = useState('15');
  const [priceMax,  setPriceMax]  = useState('60');
  const [maxReviews, setMaxReviews] = useState('300');
  const [loading,   setLoading]   = useState(false);
  const [report,    setReport]    = useState<NicheReport | null>(null);
  const [error,     setError]     = useState('');
  const [watchlist, setWatchlist] = useState<SavedNiche[]>([]);
  const [watchlistLoaded, setWatchlistLoaded] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  const intelProfile = useProductIntelligence();

  React.useEffect(() => {
    AsyncStorage.getItem(WATCHLIST_KEY).then(raw => {
      if (raw) {
        const parsed = safeParseJSON<SavedNiche[]>(raw);
        if (parsed) setWatchlist(parsed);
      }
      setWatchlistLoaded(true);
    });
  }, []);

  // Pre-fill + auto-run a search when opened from a Home niche chip.
  const initialQ: string | undefined = route.params?.q;
  React.useEffect(() => {
    if (initialQ) { setKeyword(initialQ); handleSearchWith(initialQ); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQ]);

  const budget = profile?.budget ?? 1000;

  async function handleSearchWith(kw: string) {
    if (!kw) { Alert.alert('Enter a niche or keyword'); return; }
    if (!can('keywords')) { setShowPaywall(true); return; }
    await increment('keywords');
    setLoading(true);
    setError('');
    setReport(null);
    try {
      const result = await api.searchNiche({
        keyword:                kw,
        marketplace,
        price_min:              parseFloat(priceMin) || 15,
        price_max:              parseFloat(priceMax) || 60,
        max_top_seller_reviews: parseInt(maxReviews) || 300,
        budget,
      });
      setReport(result);
      pipeline.setActiveNiche({
        keyword:      result.keyword,
        marketplace:  result.marketplace,
        verdictLabel: result.verdict.label,
        score:        result.verdict.score,
      });
      pipeline.trackPipelineEvent('niche_analyzed', { keyword: result.keyword, verdict: result.verdict.label });
    } catch (e: any) {
      setError(e?.message ?? 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function handleSearch() {
    handleSearchWith(keyword.trim());
  }

  const saveToWatchlist = useCallback(async () => {
    if (!report) return;
    const entry: SavedNiche = {
      keyword:      report.keyword,
      marketplace:  report.marketplace,
      verdictLabel: report.verdict.label,
      verdictColor: report.verdict.color,
      score:        report.verdict.score,
      savedAt:      new Date().toISOString(),
    };
    const next = [entry, ...watchlist.filter(w => w.keyword !== entry.keyword)].slice(0, 20);
    setWatchlist(next);
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
    Alert.alert('Saved', `"${report.keyword}" added to your watchlist`);
  }, [report, watchlist]);

  async function removeFromWatchlist(kw: string) {
    const next = watchlist.filter(w => w.keyword !== kw);
    setWatchlist(next);
    await AsyncStorage.setItem(WATCHLIST_KEY, JSON.stringify(next));
  }

  const vc = report ? VERDICT_COLOR[report.verdict.color] ?? DS.textMuted : DS.textMuted;

  const nicheBody = (
    <>

        {/* Hero (hidden when embedded in Home — Home supplies its own header) */}
        {!embedded && (
          <View style={s.hero}>
            <Text style={s.heroTitle}>Discover a Niche</Text>
            <Text style={s.heroSub}>Find high-demand, low-competition markets before committing capital.</Text>
          </View>
        )}

        {/* Search card */}
        <View style={s.searchCard}>
          <View style={s.searchRow}>
            <TextInput
              ref={searchInputRef}
              style={s.input}
              value={keyword}
              onChangeText={setKeyword}
              placeholder="e.g. bamboo cutting board, pet water fountain..."
              placeholderTextColor={DS.textMuted}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
              autoCapitalize="none"
            />
            <TouchableOpacity style={s.searchBtn} onPress={handleSearch} activeOpacity={0.85} disabled={loading}>
              <Text style={s.searchBtnTxt}>{loading ? '…' : '◎'}</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={s.filterToggle} onPress={() => setShowFilters(f => !f)} activeOpacity={0.7}>
            <Text style={s.filterToggleTxt}>{showFilters ? '▲ Hide filters' : '▼ Filters'}</Text>
          </TouchableOpacity>

          {showFilters && (
            <View style={s.filters}>
              <View style={s.filterRow}>
                <View style={s.filterField}>
                  <Text style={s.filterLabel}>MIN PRICE {currencySymbol}</Text>
                  <TextInput style={s.filterInput} value={priceMin} onChangeText={setPriceMin} keyboardType="decimal-pad" placeholderTextColor={DS.textMuted} />
                </View>
                <View style={s.filterField}>
                  <Text style={s.filterLabel}>MAX PRICE {currencySymbol}</Text>
                  <TextInput style={s.filterInput} value={priceMax} onChangeText={setPriceMax} keyboardType="decimal-pad" placeholderTextColor={DS.textMuted} />
                </View>
                <View style={s.filterField}>
                  <Text style={s.filterLabel}>MAX REVIEWS</Text>
                  <TextInput style={s.filterInput} value={maxReviews} onChangeText={setMaxReviews} keyboardType="number-pad" placeholderTextColor={DS.textMuted} />
                </View>
              </View>
              <Text style={s.filterHint}>Budget: ${budget.toLocaleString()} · Marketplace: {marketplace}</Text>
            </View>
          )}

          <UsageQuotaBar feature="keywords" />
        </View>


        {/* Quick-start niches — only when no search yet */}
        {!report && !loading && (
          <View style={s.quickSection}>
            <Text style={s.quickTitle}>TRENDING NICHES TO EXPLORE</Text>
            <View style={s.quickGrid}>
              {[
                { label: 'Bamboo kitchen', icon: '🎋' },
                { label: 'Pet enrichment toys', icon: '🐾' },
                { label: 'Portable blender', icon: '🥤' },
                { label: 'Posture corrector', icon: '🧘' },
                { label: 'LED desk lamp', icon: '💡' },
                { label: 'Silicone baby spoon', icon: '🍼' },
                { label: 'Car phone holder', icon: '🚗' },
                { label: 'Resistance bands', icon: '💪' },
                { label: 'Reusable beeswax wrap', icon: '🍯' },
                { label: 'Magnetic bookmarks', icon: '📚' },
                { label: 'Shower head filter', icon: '🚿' },
                { label: 'Dog cooling mat', icon: '🐕' },
              ].map(n => (
                <TouchableOpacity
                  key={n.label}
                  style={s.quickChip}
                  onPress={() => { setKeyword(n.label); }}
                  activeOpacity={0.75}
                >
                  <Text style={s.quickChipIcon}>{n.icon}</Text>
                  <Text style={s.quickChipTxt}>{n.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>
        )}

        {loading && (
          <View style={s.loadingWrap}>
            <ActivityIndicator color={DS.accent} size="large" />
            <Text style={s.loadingTxt}>Scanning the market…</Text>
          </View>
        )}

        {/* Error */}
        {!!error && (
          <View style={s.errorWrap}>
            <Text style={s.errorTxt}>{error}</Text>
            <TouchableOpacity style={s.retryBtn} onPress={handleSearch} activeOpacity={0.8} disabled={!isOnline}>
              <Text style={s.retryBtnTxt}>{!isOnline ? 'Offline' : 'Retry'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Report */}
        {report && !loading && (
          <>
            {/* Verdict */}
            <View style={[s.verdictCard, { borderColor: vc + '40', backgroundColor: vc + '08' }]}>
              <View style={s.verdictTop}>
                <View style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.verdictKeyword}>{report.keyword}</Text>
                    <EstimateLabel type={report.data_source && report.data_source !== 'stub' && report.data_source !== 'keyword_estimate' ? 'confirmed' : 'estimated'} />
                  </View>
                  <Text style={[s.verdictLabel, { color: vc }]}>{report.verdict.label}</Text>
                </View>
                <ScoreDot score={report.verdict.score} />
              </View>

              {report.verdict.reasons.length > 0 && (
                <View style={s.verdictReasons}>
                  {report.verdict.reasons.map((r, i) => (
                    <View key={i} style={s.reasonRow}>
                      <Text style={[s.reasonIcon, { color: DS.success }]}>✓</Text>
                      <Text style={s.reasonTxt}>{r}</Text>
                    </View>
                  ))}
                </View>
              )}

              {report.verdict.warnings.length > 0 && (
                <View style={s.verdictReasons}>
                  {report.verdict.warnings.map((w, i) => (
                    <View key={i} style={s.reasonRow}>
                      <Text style={[s.reasonIcon, { color: DS.warning }]}>⚠</Text>
                      <Text style={[s.reasonTxt, { color: DS.warning }]}>{w}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={[s.saveBtn, { borderColor: vc + '50' }]} onPress={saveToWatchlist} activeOpacity={0.8}>
                <Text style={[s.saveBtnTxt, { color: vc }]}>+ Save to Watchlist</Text>
              </TouchableOpacity>

              <View style={s.handoffRow}>
                <TouchableOpacity
                  style={[s.handoffBtn, s.handoffBtnAmazon]}
                  onPress={() => {
                    pipeline.trackPipelineEvent('niche_handoff_amazon', { keyword: report.keyword });
                    navigation.navigate('Research', { autoSearch: report.keyword } as any);
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={s.handoffBtnAmazonTxt}>Find Products on Amazon →</Text>
                  <Text style={s.handoffBtnHint}>What's selling in this niche?</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[s.handoffBtn, s.handoffBtnRecon]}
                  onPress={() => {
                    pipeline.trackPipelineEvent('niche_handoff_recon', { keyword: report.keyword });
                    navigation.navigate('Research', { autoRecon: report.keyword } as any);
                  }}
                  activeOpacity={0.88}
                >
                  <Text style={s.handoffBtnReconTxt}>Run Teardown →</Text>
                  <Text style={s.handoffBtnHint}>What complaints can you exploit?</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Market snapshot */}
            {report.market_snapshot && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Market Snapshot</Text>
                <View style={s.statsGrid}>
                  <Stat label="Avg Price" value={`$${report.market_snapshot.avg_price}`} />
                  <Stat label="Avg Reviews" value={report.market_snapshot.avg_reviews?.toLocaleString() ?? '—'} />
                  <Stat label="Avg Rating" value={`${report.market_snapshot.avg_rating}★`} />
                  <Stat label="Products" value={`${report.market_snapshot.total_products}`} />
                  <Stat label="In Range" value={`${report.market_snapshot.in_price_range}`} sub="price range" />
                  <Stat label="Low Comp." value={`${report.market_snapshot.low_competition}`} sub="< max reviews" />
                </View>
              </View>
            )}

            {/* The Gap */}
            {report.the_gap?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>The Gap — Where You Can Win</Text>
                <FeatureExplainer text="The space competitors are leaving open — common complaints, missing features, or price points no one serves well. This is the wedge a new product can use to stand out." />
                {report.the_gap.map((g, i) => (
                  <View key={i} style={s.gapRow}>
                    <Text style={s.gapIcon}>◉</Text>
                    <Text style={s.gapTxt}>{g}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Can you afford it */}
            {report.can_you_afford_it && Object.keys(report.can_you_afford_it).length > 0 && (
              <View style={[s.card, { borderColor: report.can_you_afford_it.can_afford ? DS.success + '40' : DS.warning + '40' }]}>
                <Text style={s.cardTitle}>Can You Afford It?</Text>
                <View style={s.statsGrid}>
                  <Stat label="Your Budget" value={`$${report.can_you_afford_it.budget?.toLocaleString()}`} />
                  <Stat label="Target Unit Cost" value={`$${report.can_you_afford_it.target_unit_cost}`} />
                  <Stat label="Min Order Est." value={`$${report.can_you_afford_it.min_order_cost?.toLocaleString()}`} />
                </View>
                <View style={[s.affordVerdict, { backgroundColor: report.can_you_afford_it.can_afford ? DS.success + '12' : DS.warning + '12' }]}>
                  <Text style={[s.affordVerdictTxt, { color: report.can_you_afford_it.can_afford ? DS.success : DS.warning }]}>
                    {report.can_you_afford_it.verdict}
                  </Text>
                </View>
              </View>
            )}

            {/* Products to model */}
            {report.products_to_model?.length > 0 && (
              <View style={s.card}>
                <Text style={s.cardTitle}>Products to Model</Text>
                <Text style={s.cardSub}>Low-competition listings in your price range</Text>
                <FeatureExplainer text="Existing products to study and beat — not copy. Benchmark their price, reviews, and buyer complaints to design a better version." />
                {report.products_to_model.map((p, i) => (
                  <View key={i} style={s.modelProduct}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.modelTitle} numberOfLines={2}>{p.title}</Text>
                      <View style={s.modelMeta}>
                        <Text style={s.modelMetaTxt}>${p.price}</Text>
                        <Text style={s.modelMetaTxt}>{p.rating}★</Text>
                        <Text style={s.modelMetaTxt}>{p.review_count?.toLocaleString()} reviews</Text>
                      </View>
                    </View>
                    <View style={s.modelRank}>
                      <Text style={s.modelRankTxt}>#{i + 1}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </>
        )}

        {/* Watchlist */}
        {watchlistLoaded && watchlist.length > 0 && (
          <View style={s.watchlistSection}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>SAVED NICHES</Text>
              <Text style={s.sectionCount}>{watchlist.length}</Text>
            </View>
            {watchlist.map(w => {
              const wc = VERDICT_COLOR[w.verdictColor] ?? DS.textMuted;
              return (
                <View key={w.keyword} style={s.watchCard}>
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => { setKeyword(w.keyword); handleSearchWith(w.keyword); }}
                    activeOpacity={0.7}
                  >
                    <Text style={s.watchKeyword}>{w.keyword}</Text>
                    <View style={s.watchMeta}>
                      <Text style={[s.watchVerdict, { color: wc }]}>{w.verdictLabel}</Text>
                      <Text style={s.watchDate}>{w.marketplace} · {new Date(w.savedAt).toLocaleDateString()}</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removeFromWatchlist(w.keyword)} activeOpacity={0.7} style={s.watchRemove}>
                    <Text style={s.watchRemoveTxt}>✕</Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
    </>
  );

  // Embedded in Home: no SafeArea / header / inner ScrollView (Home provides them).
  if (embedded) {
    return (
      <View style={s.embeddedWrap}>
        <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="Niche research" />
        {nicheBody}
      </View>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <PaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} featureContext="Niche research" />
      <AppHeader helpKey="niche" />
      <PipelineProgressBar />
      <OfflineBanner visible={!isOnline} />
      {report && (
        <DataSourceBanner
          source={(report.data_source === 'stub' ? 'stub' : (report.data_source === 'keyword_estimate' ? 'keyword_estimate' : 'confirmed')) as DataSourceType}
          context="niche"
          onActionPress={() => navigation.navigate('SellerProfile' as any)}
        />
      )}
      <ScrollView style={s.scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {nicheBody}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const sc = StyleSheet.create({
  scoreDotWrap: { flexDirection: 'row', gap: 4, padding: 8, borderRadius: DS.radiusButton, alignItems: 'center' },
  dot:          { width: 8, height: 8, borderRadius: 4 },
  stat:         { alignItems: 'center', gap: 2, flex: 1, minWidth: 70 },
  statVal:      { fontSize: 16, fontWeight: '900', color: DS.textPrimary },
  statLbl:      { fontSize: 9, fontWeight: '700', color: DS.textMuted, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' },
  statSub:      { fontSize: 9, color: DS.textMuted, textAlign: 'center' },
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: DS.bgCanvas },
  scroll:    { flex: 1 },
  content:   { paddingHorizontal: DS.pagePadding, paddingBottom: 60, gap: DS.sectionGap },
  embeddedWrap: { gap: DS.sectionGap },

  hero:      { paddingTop: DS.sectionGap, gap: 4 },
  heroTitle: { fontSize: 24, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.6 },
  heroSub:   { fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  searchCard: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             10,
  },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex:              1,
    backgroundColor:   DS.bgCard,
    borderRadius:      DS.radiusInput,
    borderWidth:       1.5,
    borderColor:       DS.border,
    paddingHorizontal: 14,
    paddingVertical:   12,
    fontSize:          15,
    color:             DS.textPrimary,
  },
  searchBtn: {
    backgroundColor: DS.accent,
    borderRadius:    DS.radiusInput,
    paddingHorizontal: 18,
    alignItems:      'center',
    justifyContent:  'center',
  },
  searchBtnTxt: { fontSize: 18, color: '#fff', fontWeight: '800' },

  filterToggle:    { alignSelf: 'flex-start' },
  filterToggleTxt: { fontSize: 11, color: DS.accent, fontWeight: '700' },
  filters:         { gap: 8, paddingTop: 4 },
  filterRow:       { flexDirection: 'row', gap: 8 },
  filterField:     { flex: 1, gap: 4 },
  filterLabel:     { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 1 },
  filterInput: {
    backgroundColor: DS.bgElevated,
    borderRadius:    DS.radiusInput,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         10,
    fontSize:        13,
    color:           DS.textPrimary,
    fontWeight:      '600',
  },
  filterHint: { fontSize: 10, color: DS.textMuted },

  intelPrompt:    { paddingVertical: 10, paddingHorizontal: 14, backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, borderWidth: 1, borderColor: DS.border },
  intelPromptTxt: { fontSize: 12, color: DS.textMuted, textAlign: 'center', fontStyle: 'italic' },

  quickSection:  { gap: 14 },
  quickTitle:    { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  quickGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickChip: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             6,
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusBadge,
    borderWidth:     1,
    borderColor:     DS.border,
    paddingHorizontal: 12,
    paddingVertical:   8,
  },
  quickChipIcon: { fontSize: 14 },
  quickChipTxt:  { fontSize: 12, fontWeight: '600', color: DS.textPrimary },

  howItWorks: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             12,
  },
  howTitle:  { fontSize: 9, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  howRow:    { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howStep:   { width: 24, height: 24, borderRadius: 12, backgroundColor: DS.accent, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  howNum:    { fontSize: 12, fontWeight: '900', color: '#fff' },
  howTxt:    { fontSize: 13, color: DS.textSecondary, flex: 1, lineHeight: 18 },

  loadingWrap: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  loadingTxt:  { fontSize: 14, color: DS.textSecondary },
  errorWrap:   { alignItems: 'center', gap: 10 },
  errorTxt:    { fontSize: 13, color: DS.danger, textAlign: 'center' },
  retryBtn:    { paddingHorizontal: 20, paddingVertical: 9, borderRadius: DS.radiusButton, backgroundColor: DS.accent },
  retryBtnTxt: { fontSize: 13, fontWeight: '700', color: '#fff' },

  verdictCard: {
    borderRadius:  DS.radiusCard,
    borderWidth:   1.5,
    padding:       DS.cardPadding,
    gap:           14,
  },
  verdictTop:     { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  verdictKeyword: { fontSize: 18, fontWeight: '900', color: DS.textPrimary, letterSpacing: -0.5 },
  verdictLabel:   { fontSize: 13, fontWeight: '700' },
  verdictReasons: { gap: 6 },
  reasonRow:      { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  reasonIcon:     { fontSize: 11, fontWeight: '800', marginTop: 2 },
  reasonTxt:      { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  saveBtn: {
    borderWidth:     1,
    borderRadius:    DS.radiusButton,
    paddingVertical: 10,
    alignItems:      'center',
  },
  saveBtnTxt: { fontSize: 13, fontWeight: '800' },

  handoffRow: { gap: 8 },
  handoffBtn: {
    borderRadius:    DS.radiusButton,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems:      'center',
    gap:             3,
  },
  handoffBtnAmazon:    { backgroundColor: DS.accent },
  handoffBtnRecon:     { backgroundColor: DS.accent },
  handoffBtnAmazonTxt: { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  handoffBtnReconTxt:  { fontSize: 14, fontWeight: '900', color: '#fff', letterSpacing: -0.2 },
  handoffBtnHint:      { fontSize: 11, color: 'rgba(255,255,255,0.72)', fontWeight: '500' },

  card: {
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusCard,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         DS.cardPadding,
    gap:             12,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.2 },
  cardSub:   { fontSize: 12, color: DS.textMuted, marginTop: -8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },

  gapRow:  { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  gapIcon: { fontSize: 10, color: DS.accent, marginTop: 3 },
  gapTxt:  { flex: 1, fontSize: 13, color: DS.textSecondary, lineHeight: 19 },

  affordVerdict:    { borderRadius: DS.radiusButton, padding: 12, alignItems: 'center' },
  affordVerdictTxt: { fontSize: 13, fontWeight: '800' },

  modelProduct: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             12,
    paddingVertical: 10,
    borderTopWidth:  1,
    borderTopColor:  DS.border,
  },
  modelTitle:   { fontSize: 13, color: DS.textPrimary, fontWeight: '600', lineHeight: 18 },
  modelMeta:    { flexDirection: 'row', gap: 10, marginTop: 4 },
  modelMetaTxt: { fontSize: 11, color: DS.textMuted },
  modelRank:    { width: 28, height: 28, borderRadius: 14, backgroundColor: DS.bgElevated, alignItems: 'center', justifyContent: 'center' },
  modelRankTxt: { fontSize: 10, fontWeight: '800', color: DS.textSecondary },

  watchlistSection: { gap: DS.cardGap },
  sectionHeader:    { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle:     { fontSize: 10, fontWeight: '800', color: DS.textMuted, letterSpacing: 2 },
  sectionCount:     { fontSize: 10, fontWeight: '700', color: DS.accent, backgroundColor: DS.accentLight, borderRadius: DS.radiusBadge, paddingHorizontal: 6, paddingVertical: 1 },
  watchCard: {
    flexDirection:   'row',
    alignItems:      'center',
    backgroundColor: DS.bgCard,
    borderRadius:    DS.radiusChip,
    borderWidth:     1,
    borderColor:     DS.border,
    padding:         14,
    gap:             10,
  },
  watchKeyword: { fontSize: 14, fontWeight: '700', color: DS.textPrimary },
  watchMeta:    { flexDirection: 'row', gap: 10, marginTop: 3, alignItems: 'center' },
  watchVerdict: { fontSize: 11, fontWeight: '700' },
  watchDate:    { fontSize: 10, color: DS.textMuted },
  watchRemove:  { padding: 4 },
  watchRemoveTxt: { fontSize: 14, color: DS.textMuted },
});
