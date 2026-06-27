import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView, StyleSheet, View, Text,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import type { CompositeNavigationProp } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import type { StackNavigationProp } from '@react-navigation/stack';
import type { RootStackParamList } from '../navigation/RootNavigator';
import {
  AppCard,
  SectionHeader,
  InputField,
  PrimaryButton,
  DS,
} from '../components/ds';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeParseJSON } from '../utils/safeJSON';
import { STORAGE_KEYS } from '../constants/storage';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { api, Product } from '../services/api';
import { useSubscription, SAVE_LIMITS } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { enqueueEvent } from '../lib/analyticsTransmit';
import { FreeAllowanceBar } from '../components/FreeAllowanceBar';
import { useVault } from '../hooks/useVault';
import PaywallModal from '../components/PaywallModal';
import { AppHeader } from '../components/AppHeader';
import { SkeletonProductCard } from '../components/ds/LoadingSkeleton';
import { AnimatedLoader } from '../components/AnimatedLoader';
import { useCurrency } from '../context/CurrencyContext';
import { useActiveProduct } from '../context/ActiveProductContext';
import { usePipeline, PipelineReconInsights } from '../context/PipelineContext';
import { confidenceColor } from '../lib/financialEngine';
import { DataSourceBanner, type DataSourceType } from '../components/DataSourceBanner';
import { determineOverallDataSource } from '../lib/dataSourceUtils';
import {
  expandProductKeywords,
  deduplicateProducts,
  scoreProduct,
  detectCategory,
  buildEmptySuggestion,
  SmartSearchSummary,
} from '../lib/smartSearch';

// ── Nav types ─────────────────────────────────────────────────────────────────

import type { TabParamList } from '../navigation/tabTypes';
type NavProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList>,
  StackNavigationProp<RootStackParamList>
>;

// ── Types ─────────────────────────────────────────────────────────────────────

import {
  Mode,
  ProductDisplay,
  KeywordMetric,
  EnrichedKeyword,
  AnalyzeProductResult,
} from './research/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

import {
  productToDisplay,
  displayToProduct,
  trendsToMetrics,
  enrichKeywords,
  hasEnoughDataForCompare,
  productToPipelinePayload,
  isASIN,
  REAL_ASIN_RE,
} from './research/productHelpers';

// ── Shared components ─────────────────────────────────────────────────────────

import {
  RecentSearches,
  ModeSegment,
  ModeDescStrip,
  SmartSummaryCard,
  SmartBadgeStrip,
  AskAIPanel,
  EmptyState,
  AnalyzeProductModal,
  KeywordMetricsCard,
  MarketSummaryCard,
  SEOKeywordsPanel,
} from './research/SharedComponents';

// ── Product card components ───────────────────────────────────────────────────

import {
  ProductMarketCard,
  CompareProductsModal,
} from './research/ProductCards';

// ── URL opener ────────────────────────────────────────────────────────────────

import { openURL } from './research/utils';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { OfflineBanner } from '../components/OfflineBanner';
import { track } from '../lib/analytics';
import { useProductIntelligence } from '../hooks/useProductIntelligence';
import { ProductQuickIntel } from '../components/ProductQuickIntel';
import VaultCard from '../components/VaultCard';
import VaultFilterBar from '../components/VaultFilterBar';
import VaultExportModal from '../components/VaultExportModal';
import ShareCard from '../components/ShareCard';
import LaunchPackModal from '../components/LaunchPackModal';
import type { VaultEntry, VaultStatus } from '../types/vault';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ResearchWorkspaceScreen() {
  const { isOnline } = useNetworkStatus();
  const { can, increment, tier } = useSubscription();
  const { user } = useAuth();
  const vault                    = useVault();
  const navigation               = useNavigation<NavProp>();
  const { setActiveProduct }     = useActiveProduct();
  const { profile: sellerProfile } = useSellerProfile();
  const { marketplace }          = useCurrency();
  const pipeline                 = usePipeline();
  const intelProfile             = useProductIntelligence();
  const route                    = useRoute<any>();
  const prefilled                = useRef(false);
  const autoSearchConsumed       = useRef(false);
  const autoReconConsumed        = useRef(false);
  const isMountedRef             = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // ── Mode & search ──────────────────────────────────────────────────────────
  const [mode,              setMode]              = useState<Mode>('market');
  const [searchQuery,       setSearchQuery]       = useState('');
  const [pendingAutoSearch, setPendingAutoSearch] = useState<string | null>(null);
  const [pendingAutoRecon,  setPendingAutoRecon]  = useState<string | null>(null);
  const [reconSaved,        setReconSaved]        = useState(false);
  const [showPaywall,       setShowPaywall]       = useState(false);
  const [paywallFeature,    setPaywallFeature]    = useState<'research' | 'saves' | 'free_limit'>('research');
  const [paywallResetDate,  setPaywallResetDate]  = useState<string | undefined>(undefined);

  // ── Free-tier Keepa allowance ──────────────────────────────────────────────
  const [freeAllowance,     setFreeAllowance]     = useState<{ used: number; limit: number; resets_on: string } | null>(null);
  const [allowanceLoading,  setAllowanceLoading]  = useState(false);
  const allowanceDebounce   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Vault state ────────────────────────────────────────────────────────────
  const [vaultSearch,       setVaultSearch]       = useState('');
  const [vaultStatusFilter, setVaultStatusFilter] = useState<VaultStatus | 'all'>('all');
  const [showVaultExport,   setShowVaultExport]   = useState(false);
  const [shareEntry,        setShareEntry]        = useState<VaultEntry | null>(null);
  const [showLaunchPack,    setShowLaunchPack]    = useState(false);
  const [launchPackProduct, setLaunchPackProduct] = useState<string | undefined>(undefined);

  // ── Recent searches ────────────────────────────────────────────────────────
  const [recentMarket,   setRecentMarket]   = useState<string[]>([]);
  const [recentLookup,   setRecentLookup]   = useState<string[]>([]);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.recentMarketSearches),
      AsyncStorage.getItem(STORAGE_KEYS.recentLookupSearches),
      AsyncStorage.getItem(STORAGE_KEYS.savedKeywords),
      AsyncStorage.getItem(STORAGE_KEYS.reviewIntelligence),
    ]).then(([m, l, kw, rev]) => {
      if (m)  { const p = safeParseJSON<string[]>(m);         if (p) setRecentMarket(p); }
      if (l)  { const p = safeParseJSON<string[]>(l);         if (p) setRecentLookup(p); }
      if (kw) { const p = safeParseJSON<unknown[]>(kw);        if (p) setSavedKWs(p as any); }
      // Restore last review recon — only if < 2 hours old so it doesn't feel stale
      if (rev) {
        const parsed = safeParseJSON<{ name: string; cat: string; result: any; savedAt: string }>(rev);
        if (parsed?.savedAt) {
          const ageMs = Date.now() - new Date(parsed.savedAt).getTime();
          if (ageMs < 2 * 60 * 60 * 1000) {
            setRevResult(parsed.result);
            setRevProductName(parsed.name);
            setRevCategory(parsed.cat);
          }
        }
      }
    }).catch(() => {});
    // Restore persisted differentiation result from pipeline on mount
    const ri = pipeline.reconInsights;
    if (ri?.differentiationAngles) {
      setDiffResult({
        product_improvements: ri.improvementSpecs ?? [],
        bundle_ideas:         ri.bundleIdeas        ?? [],
        niche_angles:         ri.differentiationAngles,
        listing_angle:        ri.listingAngle        ?? '',
        price_positioning:    ri.pricePositioning    ?? '',
        source:               'pipeline',
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(useCallback(() => {
    const params = route.params as { autoSearch?: string; autoRecon?: string } | undefined;
    if (params?.autoRecon && !autoReconConsumed.current) {
      autoReconConsumed.current = true;
      const q = params.autoRecon as string;
      (navigation as any).setParams({ autoRecon: undefined });
      setSearchQuery(q);
      setMode('lookup');
      setPendingAutoRecon(q);
    } else if (params?.autoSearch && !autoSearchConsumed.current) {
      autoSearchConsumed.current = true;
      const q = params.autoSearch as string;
      (navigation as any).setParams({ autoSearch: undefined });
      setSearchQuery(q);
      setMode('market');
      setPendingAutoSearch(q);
    } else if (!prefilled.current && pipeline.activeNiche?.keyword && !searchQuery) {
      setSearchQuery(pipeline.activeNiche.keyword);
      prefilled.current = true;
    }
  }, [route.params, pipeline.activeNiche, searchQuery, navigation]));

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

  const clearRecentMarket = useCallback(() => {
    setRecentMarket([]);
    AsyncStorage.removeItem(STORAGE_KEYS.recentMarketSearches).catch(() => {});
  }, []);

  const clearRecentLookup = useCallback(() => {
    setRecentLookup([]);
    AsyncStorage.removeItem(STORAGE_KEYS.recentLookupSearches).catch(() => {});
  }, []);

  // ── Free-tier allowance fetch (debounced, explorer only) ──────────────────
  const refreshAllowance = useCallback(async (userId: string) => {
    if (!userId || tier !== 'explorer') return;
    if (allowanceDebounce.current) clearTimeout(allowanceDebounce.current);
    allowanceDebounce.current = setTimeout(async () => {
      try {
        setAllowanceLoading(true);
        const data = await api.getFreeAllowance(userId);
        if (isMountedRef.current) setFreeAllowance(data);
      } catch {
        // Non-critical — allowance display is best-effort
      } finally {
        if (isMountedRef.current) setAllowanceLoading(false);
      }
    }, 400);
  }, [tier]);

  useEffect(() => {
    if (user?.id && tier === 'explorer') {
      void refreshAllowance(user.id);
    }
  }, [user?.id, tier, refreshAllowance]);

  // ── Saved keyword handlers ─────────────────────────────────────────────────
  const saveKeyword = useCallback((kw: EnrichedKeyword) => {
    setSavedKWs(prev => {
      if (prev.some(k => k.phrase.toLowerCase() === kw.phrase.toLowerCase())) return prev;
      const next = [...prev, { ...kw, savedAt: new Date().toISOString() }];
      AsyncStorage.setItem(STORAGE_KEYS.savedKeywords, JSON.stringify(next)).catch(() => {});
      return next;
    });
    if (pipeline.brandData) {
      const existing = pipeline.brandData.keywords ?? [];
      if (!existing.some(k => k.toLowerCase() === kw.phrase.toLowerCase())) {
        pipeline.setBrandData({ ...pipeline.brandData, keywords: [...existing, kw.phrase] });
      }
    }
  }, [pipeline]);

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
  const [products,       setProducts]       = useState<ProductDisplay[]>([]);
  const [keywords,       setKeywords]       = useState<EnrichedKeyword[]>([]);
  const [savedKWs,       setSavedKWs]       = useState<EnrichedKeyword[]>([]);
  const [metrics,        setMetrics]        = useState<KeywordMetric[]>([]);
  const [currentKeyword, setCurrentKeyword] = useState('');

  // ── Smart search summaries ─────────────────────────────────────────────────
  const [productSummary,  setProductSummary]  = useState<SmartSearchSummary | null>(null);

  // ── Save state (per ASIN) ──────────────────────────────────────────────────
  const [savedIds,     setSavedIds]     = useState<Set<string>>(new Set());
  const [saveLoadingId, setSaveLoadingId] = useState<string | null>(null);

  // ── Product comparison ─────────────────────────────────────────────────────
  const [compareProductIds,   setCompareProductIds]   = useState<Set<string>>(new Set());
  const [showCompareProducts, setShowCompareProducts] = useState(false);

  // ── Analyze product modal ──────────────────────────────────────────────────
  const [analyzeProductModal,   setAnalyzeProductModal]   = useState(false);
  const [analyzeProductLoading, setAnalyzeProductLoading] = useState(false);
  const [analyzeProductResult,  setAnalyzeProductResult]  = useState<AnalyzeProductResult | null>(null);
  const [analyzeProductError,   setAnalyzeProductError]   = useState('');
  const [analyzingProduct,      setAnalyzingProduct]      = useState<ProductDisplay | null>(null);

  // ── Review Intelligence state ──────────────────────────────────────────────
  const [revProductName,      setRevProductName]      = useState('');
  const [revCategory,         setRevCategory]         = useState('');
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

  // ── Ask AI ─────────────────────────────────────────────────────────────────
  const [askQuestion,  setAskQuestion]  = useState('');
  const [askAnswer,    setAskAnswer]    = useState('');
  const [askLoading,   setAskLoading]   = useState(false);
  const [askError,     setAskError]     = useState('');

  const handleAskAI = useCallback(async () => {
    const q = askQuestion.trim();
    if (!q || askLoading) return;
    setAskLoading(true);
    setAskAnswer('');
    setAskError('');
    try {
      const res = await api.askAI(q, undefined);
      setAskAnswer(res.answer);
    } catch (e: any) {
      setAskError(e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setAskLoading(false);
    }
  }, [askQuestion, askLoading]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const runMarketSearch = useCallback(async (q: string) => {
    setAmazonLoading(true);
    setAmazonError('');
    setProducts([]);
    setProductSummary(null);
    setRevResult(null); setRevError(''); setDiffResult(null); setDiffError('');
    try {
      // ── 1. Expand keywords based on tier ─────────────────────────────────
      const expanded = expandProductKeywords(q, tier);

      // ── 2. Run primary search + keyword research in parallel ──────────────
      const [primaryAmazonRes, kwRes] = await Promise.all([
        api.searchAmazon(q, marketplace),
        api.researchKeywords(q),
      ]);

      // ── 3. Run remaining expanded keyword searches in parallel ────────────
      const extraKeywords = expanded.slice(1); // skip first — already searched above
      const extraResults = await Promise.allSettled(
        extraKeywords.map(kw => api.searchAmazon(kw, marketplace)),
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
      if (!isMountedRef.current) return;
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
      if (!isMountedRef.current) return;
      setAmazonError(err?.message ?? 'Search failed. Please try again.');
    } finally {
      if (isMountedRef.current) setAmazonLoading(false);
    }
  }, [increment, tier]);

  useEffect(() => {
    if (pendingAutoSearch && can('research')) {
      addRecentMarket(pendingAutoSearch);
      runMarketSearch(pendingAutoSearch);
      setPendingAutoSearch(null);
    }
  }, [pendingAutoSearch, can, addRecentMarket, runMarketSearch]);

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
      // Auto-persist diff result into reconInsights so it survives navigation
      const base = pipeline.reconInsights;
      pipeline.setReconInsights({
        sourceKeyword:       base?.sourceKeyword    ?? name,
        complaints:          base?.complaints        ?? [],
        opportunities:       base?.opportunities     ?? [],
        improvementSpecs:    base?.improvementSpecs  ?? result.product_improvements,
        positioningAngles:   base?.positioningAngles ?? [],
        qualityRisks:        base?.qualityRisks      ?? [],
        createdAt:           base?.createdAt         ?? new Date().toISOString(),
        differentiationAngles: result.niche_angles,
        bundleIdeas:           result.bundle_ideas,
        listingAngle:          result.listing_angle,
        pricePositioning:      result.price_positioning,
        differentiatedAt:      new Date().toISOString(),
      });
    } catch (e: any) {
      setDiffError(e?.message ?? 'Could not generate strategy. Try again.');
    } finally {
      setDiffLoading(false);
    }
  }, [revProductName, revCategory, revResult, can, pipeline]);

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
        isASIN(q) ||
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

  useEffect(() => {
    if (pendingAutoRecon) {
      handleDirectAnalysis(pendingAutoRecon);
      setPendingAutoRecon(null);
    }
  }, [pendingAutoRecon, handleDirectAnalysis]);

  const handleAmazonSearch = useCallback(async () => {
    const q = searchQuery.trim();
    if (!q) return;
    if (!can('research')) {
      track('paywall_shown', { feature: 'research', source: 'search' });
      track('quota_exceeded', { feature: 'research' });
      setPaywallFeature('research'); setShowPaywall(true); return;
    }
    if (mode === 'market') { addRecentMarket(q); await runMarketSearch(q); }
    else                   { addRecentLookup(q); await handleDirectAnalysis(q); }
  }, [searchQuery, mode, can, runMarketSearch, handleDirectAnalysis, addRecentMarket, addRecentLookup]);

  const selectRecentQuery = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!can('research')) { setPaywallFeature('research'); setShowPaywall(true); return; }
    if (mode === 'market') { addRecentMarket(q); await runMarketSearch(q); }
    else                   { addRecentLookup(q); await handleDirectAnalysis(q); }
  }, [mode, can, runMarketSearch, handleDirectAnalysis, addRecentMarket, addRecentLookup]);

  const handleSaveReconInsights = useCallback(() => {
    if (!revResult) return;
    const insights: PipelineReconInsights = {
      sourceKeyword:     revProductName || searchQuery,
      complaints:        revResult.top_complaints,
      opportunities:     [...revResult.opportunities, ...revResult.bundling_ideas],
      improvementSpecs:  [
        ...revResult.recommended_improvements,
        ...(diffResult?.product_improvements ?? []),
      ],
      positioningAngles: [
        ...(diffResult?.niche_angles ?? []),
        ...(diffResult?.listing_angle ? [diffResult.listing_angle] : []),
      ],
      qualityRisks:      revResult.top_complaints,
      createdAt:         new Date().toISOString(),
    };
    pipeline.setReconInsights(insights);
    pipeline.trackPipelineEvent('recon_insights_saved', { keyword: insights.sourceKeyword });
    setReconSaved(true);
    setTimeout(() => setReconSaved(false), 3000);
  }, [revResult, diffResult, revProductName, searchQuery, pipeline]);

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
    setAnalyzingProduct(item);
    setAnalyzeProductModal(true);
    setAnalyzeProductLoading(true);

    const hasRealAsin = REAL_ASIN_RE.test(item.id);
    const userId      = user?.id ?? '';

    // If we already know the free allowance is spent, go straight to the paywall
    // instead of firing the (billable) AI + Keepa calls only to discard them on a 402.
    if (tier === 'explorer' && hasRealAsin && freeAllowance && freeAllowance.used >= freeAllowance.limit) {
      setAnalyzeProductModal(false);
      setPaywallFeature('free_limit');
      setPaywallResetDate(freeAllowance.resets_on || undefined);
      setShowPaywall(true);
      setAnalyzeProductLoading(false);
      void enqueueEvent(
        'hit_free_keepa_limit',
        { used: freeAllowance.used, limit: freeAllowance.limit, asin: item.id },
        'ResearchWorkspace',
      );
      return;
    }

    try {
      const [analysisSettled, keepaSettled] = await Promise.allSettled([
        api.analyzeProduct(item.price ?? 0, item.reviewCount ?? 0, item.competition, 'Stable'),
        hasRealAsin && userId
          ? api.getProductData(item.id, userId, tier)
          : Promise.resolve(null),
      ]);

      if (!isMountedRef.current) return;

      // 402 free-limit: close loader, show paywall, return
      if (keepaSettled.status === 'fulfilled' && keepaSettled.value?.kind === 'free_limit') {
        const freeLimit = keepaSettled.value;
        setAnalyzeProductModal(false);
        setPaywallFeature('free_limit');
        setPaywallResetDate(freeLimit.resets_on || undefined);
        setShowPaywall(true);
        void enqueueEvent(
          'hit_free_keepa_limit',
          { used: freeLimit.used, limit: freeLimit.limit, asin: item.id },
          'ResearchWorkspace',
        );
        // Sync the allowance bar to its exhausted state after hitting the wall.
        if (userId) void refreshAllowance(userId);
        return;
      }

      const signals =
        keepaSettled.status === 'fulfilled' && keepaSettled.value?.kind === 'success'
          ? keepaSettled.value.signals
          : undefined;

      // Refresh allowance bar after a live Keepa call
      if (keepaSettled.status === 'fulfilled' && keepaSettled.value?.kind === 'success' && userId) {
        void refreshAllowance(userId);
      }

      if (analysisSettled.status === 'fulfilled') {
        const res = analysisSettled.value;
        setAnalyzeProductResult({
          verdict:    res.verdict,
          confidence: res.confidence,
          summary:    res.summary,
          reasons:    res.reasons,
          risk:       res.risk,
          next_step:  res.next_step,
          signals,
        });
      } else {
        throw (analysisSettled as PromiseRejectedResult).reason;
      }
    } catch (err: any) {
      if (!isMountedRef.current) return;
      setAnalyzeProductError(err?.message ?? 'Analysis failed. Please try again.');
    } finally {
      if (isMountedRef.current) setAnalyzeProductLoading(false);
    }
  }, [user, tier, refreshAllowance, freeAllowance]);


  const toggleProductCompare = useCallback((id: string) => {
    setCompareProductIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else if (next.size < 3) { next.add(id); }
      return next;
    });
  }, []);


  // ── Pipeline track handler ─────────────────────────────────────────────────

  const handleTrackInPipeline = useCallback((item: ProductDisplay) => {
    pipeline.setActiveProduct(productToPipelinePayload(item));
    setActiveProduct({
      id: item.id, name: item.name, price: item.price, rating: item.rating,
      reviewCount: item.reviewCount, competition: item.competition, url: item.url,
      savedAt: new Date().toISOString(),
    } as any);
    pipeline.trackPipelineEvent('product_tracked', { title: item.name, asin: item.id });
    navigation.navigate('Main', { screen: 'Sourcing' } as any);
  }, [pipeline, setActiveProduct, navigation]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const compareProductItems = useMemo(
    () => products.filter(p => compareProductIds.has(p.id)),
    [products, compareProductIds],
  );

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
            style={[xt.retryBtn, !isOnline && xt.retryBtnDisabled]}
            onPress={handleAmazonSearch}
            disabled={!isOnline}
            activeOpacity={0.8}
            accessibilityLabel="Retry search"
          >
            <Text style={xt.retryTxt}>{isOnline ? 'Try again' : 'Offline'}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return (
      <View style={xt.wrap}>
        <RecentSearches
          items={recentMarket}
          accentColor={DS.info}
          onSelect={selectRecentQuery}
          onClear={clearRecentMarket}
        />
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
              inCompare={compareProductIds.has(p.id)}
              canCompare={comparable}
              onToggleCompare={() => comparable ? toggleProductCompare(p.id) : undefined}
              onAnalyze={() => handleAnalyzeProduct(p)}
              analyzeLoading={analyzeProductLoading}
              onTrackInPipeline={() => handleTrackInPipeline(p)}
              isTracked={pipeline.activeProduct?.asin === p.id}
              onSave={() => handleSaveProduct(p)}
              isSaved={savedIds.has(p.id)}
              saveLoading={saveLoadingId === p.id}
            />
          );
        })}
        {amazonSearched && savedIds.size > 0 && (
          <AppCard style={fl.card}>
            <Text style={fl.eye}>RESEARCH FLOW · STEP 2</Text>
            <Text style={fl.title}>Continue to Supplier Sourcing</Text>
            <Text style={fl.sub}>You've identified {savedIds.size} product {savedIds.size === 1 ? 'opportunity' : 'opportunities'}. Find manufacturers and lock in your unit cost.</Text>
            <TouchableOpacity
              style={fl.btn}
              accessibilityRole="button"
              onPress={() => {
                pipeline.trackPipelineEvent('validate_handoff_suppliers', { query: searchQuery });
                navigation.navigate('Main', { screen: 'Sourcing' } as any);
              }}
              activeOpacity={0.85}
            >
              <Text style={fl.btnTxt}>Continue to Supplier Sourcing →</Text>
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
        <RecentSearches
          items={recentLookup}
          accentColor={DS.accent}
          onSelect={selectRecentQuery}
          onClear={clearRecentLookup}
        />

        {!revLoading && revError !== '' && (
          <View style={xt.errBox}>
            <Text style={xt.errTxt}>{revError}</Text>
            {revProductName.trim() !== '' && (
              <TouchableOpacity
                style={[xt.retryBtn, !isOnline && xt.retryBtnDisabled]}
                onPress={() => handleDirectAnalysis(revProductName)}
                disabled={!isOnline}
                activeOpacity={0.8}
                accessibilityLabel="Retry analysis"
              >
                <Text style={xt.retryTxt}>{isOnline ? 'Try again' : 'Offline'}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {!revLoading && !revResult && revError === '' && (
          <AppCard style={ri.emptyCard}>
            <Text style={ri.emptyIcon}>◎</Text>
            <Text style={ri.emptyTitle}>Recon a Competitor</Text>
            <Text style={ri.emptyBody}>
              Enter a product name, ASIN, or Amazon URL above and tap <Text style={{ fontWeight: '700', color: DS.accent }}>Run Recon</Text>.{'\n\n'}
              AI reads the reviews and tells you exactly what to fix — so your version beats the original.
            </Text>
          </AppCard>
        )}

        {revResult && (
          <>
            {/* Product label + clear */}
            <View style={ri.productBar}>
              <View style={ri.productBarInner}>
                <Text style={ri.productBarLabel}>TEARDOWN FOR</Text>
                <Text style={ri.productBarName} numberOfLines={1}>{revProductName}</Text>
              </View>
              <TouchableOpacity
                style={ri.clearBtn}
                onPress={() => { setRevResult(null); setDiffResult(null); setRevProductName(''); setRevCategory(''); }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Clear recon"
              >
                <Text style={ri.clearBtnTxt}>Clear ✕</Text>
              </TouchableOpacity>
            </View>

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
                    <View style={[ri.dot, { backgroundColor: DS.accent }]} />
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
                    <View style={[ri.dot, { backgroundColor: DS.infoText ?? DS.accent }]} />
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
                  <View style={xt.errBox}>
                    <Text style={xt.errTxt}>{diffError}</Text>
                    <TouchableOpacity
                      style={[xt.retryBtn, !isOnline && xt.retryBtnDisabled]}
                      onPress={handleDifferentiation}
                      disabled={!isOnline}
                      activeOpacity={0.8}
                      accessibilityLabel="Retry strategy generation"
                    >
                      <Text style={xt.retryTxt}>{isOnline ? 'Try again' : 'Offline'}</Text>
                    </TouchableOpacity>
                  </View>
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
                  <View style={[ri.dot, { backgroundColor: DS.accent }]} />
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

        {/* ── Save insights to pipeline ─────────────────────────────────── */}
        {revResult && (
          <AppCard style={ri.saveInsightsCard}>
            <View style={ri.saveInsightsHeader}>
              <Text style={ri.saveInsightsIcon}>⬡</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={ri.saveInsightsTitle}>Use Recon Insights for Supplier Specs</Text>
                <Text style={ri.saveInsightsSub}>
                  Save pain points, improvements, and angles so your supplier sourcing and brand strategy target what customers actually want.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={[ri.saveInsightsBtn, reconSaved && ri.saveInsightsBtnSaved]}
              onPress={handleSaveReconInsights}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={[ri.saveInsightsBtnTxt, reconSaved && ri.saveInsightsBtnSavedTxt]}>
                {reconSaved ? '✓  Insights Saved to Pipeline' : '▣  Save Insights to Pipeline →'}
              </Text>
            </TouchableOpacity>
          </AppCard>
        )}

      </View>
    );
  }

  // ── Vault tab ──────────────────────────────────────────────────────────────

  function renderVaultTab() {
    const allEntries = vault.entries ?? [];
    const filtered = allEntries.filter(e => {
      const matchSearch = !vaultSearch || e.product.title.toLowerCase().includes(vaultSearch.toLowerCase());
      const matchStatus = vaultStatusFilter === 'all' || e.status === vaultStatusFilter;
      return matchSearch && matchStatus;
    });

    return (
      <View style={{ gap: DS.sectionGap }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: DS.textPrimary }}>
            {allEntries.length} saved product{allEntries.length !== 1 ? 's' : ''}
          </Text>
          {allEntries.length > 0 && (
            <TouchableOpacity onPress={() => setShowVaultExport(true)} activeOpacity={0.8}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: DS.gold }}>Export Report ↗</Text>
            </TouchableOpacity>
          )}
        </View>

        <VaultFilterBar
          search={vaultSearch}
          onSearchChange={setVaultSearch}
          statusFilter={vaultStatusFilter}
          onStatusChange={setVaultStatusFilter}
          count={filtered.length}
        />

        {filtered.length === 0 ? (
          <AppCard>
            <Text style={{ textAlign: 'center', color: DS.textMuted, fontSize: 13, paddingVertical: 24 }}>
              {allEntries.length === 0 ? 'Save products from the Products tab to build your vault.' : 'No products match your filters.'}
            </Text>
          </AppCard>
        ) : (
          filtered.map(entry => (
            <VaultCard
              key={entry.asin}
              entry={entry}
              onRemove={() => vault.removeEntry(entry.asin)}
              onStatusChange={status => vault.updateStatus(entry.asin, status)}
              onNoteChange={note => vault.updateNote(entry.asin, note)}
              onShare={() => setShareEntry(entry)}
            />
          ))
        )}

        {allEntries.length > 0 && (
          <TouchableOpacity
            onPress={() => { setLaunchPackProduct(filtered[0]?.product.title); setShowLaunchPack(true); }}
            activeOpacity={0.85}
            style={{
              backgroundColor: DS.gold,
              borderRadius: DS.radiusButton,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: DS.sectionGap,
            }}
          >
            <Text style={{ color: DS.bgCard, fontWeight: '700', fontSize: 14 }}>🚀 Get Launch Pack</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }


  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <PaywallModal
        visible={showPaywall}
        onClose={() => { setShowPaywall(false); setPaywallResetDate(undefined); }}
        featureContext={paywallFeature}
        resetDate={paywallResetDate}
      />

      <AnalyzeProductModal
        visible={analyzeProductModal}
        loading={analyzeProductLoading}
        result={analyzeProductResult}
        error={analyzeProductError}
        product={analyzingProduct}
        onClose={() => setAnalyzeProductModal(false)}
      />

      <CompareProductsModal
        visible={showCompareProducts}
        items={compareProductItems}
        onClose={() => setShowCompareProducts(false)}
        onSaveWinner={(item) => { handleSaveProduct(item); setShowCompareProducts(false); }}
      />
      <VaultExportModal
        visible={showVaultExport}
        entries={vault.entries ?? []}
        onClose={() => setShowVaultExport(false)}
      />
      {shareEntry && (
        <ShareCard
          entry={shareEntry}
          onClose={() => setShareEntry(null)}
        />
      )}
      <LaunchPackModal
        visible={showLaunchPack}
        onClose={() => setShowLaunchPack(false)}
        productName={launchPackProduct}
      />

      <AppHeader helpKey={mode === 'market' ? 'research' : 'smart_search'} />
      <OfflineBanner visible={!isOnline} />
      {mode === 'market' && products.length > 0 && (
        <DataSourceBanner
          source={determineOverallDataSource(products.map(p => p.source)) as DataSourceType}
          context="products"
        />
      )}

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews
        overScrollMode="never"
      >
        {/* ── Search input ── */}
        {<AppCard padding={14} style={s.searchCard}>
          {sellerProfile && (
            <TouchableOpacity style={pd.row} onPress={() => navigation.navigate('SellerProfile' as any)} activeOpacity={0.7}>
              <Text style={pd.label}>Searching for:</Text>
              <View style={pd.chip}><Text style={pd.chipTxt}>🌐 {sellerProfile.marketplace}</Text></View>
              <View style={pd.chip}><Text style={pd.chipTxt}>💰 ${sellerProfile.priceMin}–${sellerProfile.priceMax}</Text></View>
              <View style={pd.chip}><Text style={pd.chipTxt}>⭐ &lt;{sellerProfile.maxTopSellerReviews} rev</Text></View>
            </TouchableOpacity>
          )}
          <View style={s.searchRow}>
            <InputField
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={mode === 'lookup' ? 'Product name, ASIN, or Amazon URL...' : 'Search a product idea or niche...'}
              leadingIcon="◎"
              containerStyle={s.searchInput}
              returnKeyType="search"
              onSubmitEditing={mode === 'lookup' ? () => handleDirectAnalysis(searchQuery) : handleAmazonSearch}
            />
          </View>
          {searchQuery.length > 0 && (
            <PrimaryButton
              label={!isOnline ? 'Offline' : mode === 'lookup' ? (revLoading ? 'Reading reviews…' : 'Run Recon') : (amazonLoading ? 'Searching…' : 'Scout Products')}
              onPress={mode === 'lookup' ? () => handleDirectAnalysis(searchQuery) : handleAmazonSearch}
              size="sm"
              icon="◎"
              style={s.searchBtn}
              loading={amazonLoading}
              disabled={!isOnline}
            />
          )}
          <FreeAllowanceBar
            tier={tier}
            used={freeAllowance?.used ?? null}
            limit={freeAllowance?.limit ?? 5}
            resetsOn={freeAllowance?.resets_on ?? ''}
            loading={allowanceLoading}
            onUpgrade={() => {
              setPaywallFeature('free_limit');
              setPaywallResetDate(freeAllowance?.resets_on);
              setShowPaywall(true);
            }}
          />
        </AppCard>}

        {/* ── Inline loading — right under search bar ──────── */}
        {mode === 'market' && amazonLoading && (
          <AnimatedLoader
            color={DS.accent}
            msPerStep={1200}
            messages={[
              'Searching Amazon products…',
              'Pulling prices & ratings…',
              'Estimating monthly revenue…',
              'Scoring competition level…',
              'Ranking opportunities…',
              'Preparing your results…',
            ]}
          />
        )}
        {mode === 'lookup' && revLoading && (
          <ReconLoadingView />
        )}

        {/* ── Mode selector ────────────────────────────────── */}
        <ModeSegment value={mode} onChange={setMode} exclude={['suppliers', 'freight']} />

        <ModeDescStrip mode={mode} />

        {/* ── Product Intelligence Preview ─────────────────────────────────── */}
        {/* Only shown when an activeProduct is set in the pipeline — never blocks browsing */}
        {intelProfile && (
          <ProductQuickIntel
            profile={intelProfile}
            reconInsights={pipeline.reconInsights}
          />
        )}

        {/* ── Mode content ─────────────────────────────────── */}
        {mode === 'market'  && renderMarketTab()}
        {mode === 'lookup'  && renderLookupTab()}
        {mode === 'vault'   && renderVaultTab()}
      </ScrollView>

      {/* ── Floating compare bar ─────────────────────────────── */}
      {(compareProductIds.size >= 1 && mode === 'market') && (
        <View style={cfb.wrap} pointerEvents="box-none">
          <TouchableOpacity style={cfb.pill} onPress={() => setShowCompareProducts(true)} activeOpacity={0.88} accessibilityRole="button">
            <Text style={cfb.pillIcon}>⊞</Text>
            <Text style={cfb.pillText}>
              {compareProductIds.size === 1 ? 'Analyse 1 Product' : `Compare ${compareProductIds.size} Products`}
            </Text>
            <Text style={cfb.pillArrow}>→</Text>
            <TouchableOpacity
              style={cfb.clearBtn}
              onPress={() => setCompareProductIds(new Set())}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Clear comparison"
            >
              <Text style={cfb.clearText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

function ReconLoadingView() {
  return (
    <AnimatedLoader
      color={DS.accent}
      msPerStep={1300}
      messages={[
        'Looking up this product on Amazon…',
        'Reading competitor reviews…',
        'Mapping the review landscape…',
        'Finding unmet buyer complaints…',
        'Scoring your entry window…',
        'Analysing sentiment patterns…',
        'Building your recon report…',
      ]}
    />
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

  productBar:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: DS.bgElevated, borderRadius: DS.radiusChip, paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  productBarInner:   { flex: 1, gap: 1 },
  productBarLabel:   { fontSize: 8, fontWeight: '800', color: DS.textMuted, letterSpacing: 1.5, textTransform: 'uppercase' },
  productBarName:    { fontSize: 13, fontWeight: '700', color: DS.textPrimary, letterSpacing: -0.2 },
  clearBtn:          { backgroundColor: DS.border, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  clearBtnTxt:       { fontSize: 11, fontWeight: '700', color: DS.textSecondary },

  saveInsightsCard:      { gap: 12, borderWidth: 1.5, borderColor: DS.accent + '50', backgroundColor: DS.accentLight },
  saveInsightsHeader:    { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  saveInsightsIcon:      { fontSize: 22, color: DS.accent },
  saveInsightsTitle:     { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  saveInsightsSub:       { fontSize: 12, color: DS.textSecondary, lineHeight: 17 },
  saveInsightsBtn:       { backgroundColor: DS.accent, borderRadius: DS.radiusButton, paddingVertical: 13, alignItems: 'center' },
  saveInsightsBtnSaved:  { backgroundColor: DS.success },
  saveInsightsBtnTxt:    { fontSize: 13, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.1 },
  saveInsightsBtnSavedTxt: { color: DS.bgCard },
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
  retryBtn:         { backgroundColor: DS.dangerText, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 8 },
  retryBtnDisabled: { backgroundColor: DS.textMuted },
  retryTxt:         { fontSize: 13, fontWeight: '700', color: DS.bgCard },
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
  pill:         { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.accent, borderRadius: 28, paddingVertical: 13, paddingLeft: 18, paddingRight: 12, shadowColor: DS.textPrimary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 10 },
  pillPending:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: DS.bgCard, borderRadius: 28, paddingVertical: 12, paddingLeft: 16, paddingRight: 14, borderWidth: 1.5, borderColor: DS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 6 },
  pillIcon:     { fontSize: 15 },
  pillText:     { flex: 1, fontSize: 14, fontWeight: '800', color: DS.bgCard, letterSpacing: -0.3 },
  pillTextPending: { flex: 1, fontSize: 13, fontWeight: '600', color: DS.textSecondary },
  pillArrow:    { fontSize: 16, fontWeight: '800', color: DS.bgCard },
  clearBtn:     { width: 26, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  clearText:    { fontSize: 12, fontWeight: '700', color: DS.bgCard },
  clearPending: { fontSize: 13, fontWeight: '600', color: DS.textMuted, paddingHorizontal: 4 },
});

const fl = StyleSheet.create({
  card:             { gap: 10, borderWidth: 1.5, borderColor: DS.accent + '55', backgroundColor: DS.accentLight },
  eye:              { fontSize: 8, fontWeight: '800', color: DS.accentDark, letterSpacing: 2 },
  title:            { fontSize: 14, fontWeight: '800', color: DS.textPrimary, letterSpacing: -0.3 },
  sub:              { fontSize: 12, color: DS.textSecondary, lineHeight: 18 },
  btn:              { backgroundColor: DS.accent, borderRadius: 12, paddingVertical: 12, alignItems: 'center' as const, shadowColor: DS.accent, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  btnTxt:           { fontSize: 13, fontWeight: '900', color: DS.bgCard, letterSpacing: -0.2 },
});

const pd = StyleSheet.create({
  row:    { flexDirection: 'row' as const, alignItems: 'center' as const, flexWrap: 'wrap' as const, gap: 6, marginBottom: 10 },
  label:  { fontSize: 10, fontWeight: '700', color: DS.textMuted },
  chip:   { backgroundColor: DS.accentLight, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: DS.accent + '30' },
  chipTxt:{ fontSize: 10, fontWeight: '700', color: DS.accent },
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

