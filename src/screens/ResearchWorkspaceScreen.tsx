import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  ScrollView, StyleSheet, View, Text,
  TouchableOpacity, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
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
import { STORAGE_KEYS } from '../constants/storage';
import { useSellerProfile } from '../hooks/useSellerProfile';
import { api, Product, Supplier } from '../services/api';
import { useSubscription, SAVE_LIMITS } from '../hooks/useSubscription';
import { useVault } from '../hooks/useVault';
import PaywallModal from '../components/PaywallModal';
import { AppHeader } from '../components/AppHeader';
import { SkeletonProductCard } from '../components/ds/LoadingSkeleton';
import { useCurrency } from '../context/CurrencyContext';
import { useActiveProduct } from '../context/ActiveProductContext';
import { usePipeline } from '../context/PipelineContext';
import { PipelineProgressBar } from '../components/PipelineProgressBar';
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

// ── Types ─────────────────────────────────────────────────────────────────────

import {
  Mode,
  ProductDisplay,
  SupplierDisplay,
  KeywordMetric,
  EnrichedKeyword,
  AnalyzeProductResult,
  AnalyzeSupplierResult,
  OutreachEmail,
} from './research/types';

// ── Helpers ───────────────────────────────────────────────────────────────────

import {
  MOCK_KEYWORD_METRICS,
  MOCK_RELATED_KEYWORDS,
  MOCK_PRODUCTS,
  MOCK_SUPPLIERS,
  productToDisplay,
  supplierToDisplay,
  displayToProduct,
  trendsToMetrics,
  enrichKeywords,
  hasEnoughDataForCompare,
} from './research/productHelpers';

// ── Shared components ─────────────────────────────────────────────────────────

import {
  RecentSearches,
  ModeSegment,
  ModeDescStrip,
  SmartSummaryCard,
  SmartBadgeStrip,
  AskAIPanel,
  SelectedProductBanner,
  EmptyState,
  AnalyzeProductModal,
  AnalyzeSupplierModal,
  KeywordMetricsCard,
  MarketSummaryCard,
  SEOKeywordsPanel,
} from './research/SharedComponents';

// ── Product card components ───────────────────────────────────────────────────

import {
  ProductMarketCard,
  ProductLookupCard,
  CompareProductsModal,
} from './research/ProductCards';

// ── Supplier card components ──────────────────────────────────────────────────

import {
  SupplierCard,
  CompareSuppliersModal,
  OutreachEmailCard,
} from './research/SupplierCards';

// ── URL opener ────────────────────────────────────────────────────────────────

import { openURL } from './research/utils';

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ResearchWorkspaceScreen() {
  const { can, increment, tier } = useSubscription();
  const vault                    = useVault();
  const navigation               = useNavigation<NavProp>();
  const { setActiveProduct }     = useActiveProduct();
  const { profile: sellerProfile } = useSellerProfile();
  const { marketplace }          = useCurrency();
  const pipeline                 = usePipeline();
  const prefilled                = useRef(false);

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

  useFocusEffect(useCallback(() => {
    if (!prefilled.current && pipeline.activeNiche?.keyword && !searchQuery) {
      setSearchQuery(pipeline.activeNiche.keyword);
      prefilled.current = true;
    }
  }, [pipeline.activeNiche, searchQuery]));

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
      const res = await api.searchAmazon(q, marketplace);
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
        queries.map(q => api.searchSuppliers(q, marketplace)),
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
      setOutreachEmail({ ...result, supplierUrl: item.url, supplierName: item.name });
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

  const handleFreightSearch = useCallback(async () => {
    const name = freightProduct.trim();
    if (!name) return;
    setFreightLoading(true);
    setFreightError('');
    setFreightResult(null);
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
      setFreightResult(result);
    } catch (err: any) {
      setFreightError(err?.message ?? 'Freight estimate failed. Please try again.');
    } finally {
      setFreightLoading(false);
    }
  }, [freightProduct, freightUnits, freightWeightKg, freightLengthCm, freightWidthCm, freightHeightCm, marketplace]);

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
    pipeline.setActiveProduct({
      title:   item.name,
      asin:    item.id,
      price:   item.price ?? 0,
      reviews: item.reviewCount ?? 0,
      rating:  item.rating ?? 0,
      url:     item.url,
    });
    pipeline.trackPipelineEvent('product_selected', { title: item.name, asin: item.id });
    navigation.navigate('FeasibilityCheck' as any);
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
    navigation.navigate('FeasibilityCheck' as any);
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
            <TouchableOpacity
              style={fl.btn}
              onPress={() => {
                pipeline.trackPipelineEvent('validate_handoff_suppliers', { query: searchQuery });
                navigation.navigate('Suppliers' as any);
              }}
              activeOpacity={0.85}
            >
              <Text style={fl.btnTxt}>Source This Product →</Text>
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
            <Text style={ri.emptyTitle}>Recon</Text>
            <Text style={ri.emptyBody}>
              Enter a product name, ASIN, or Amazon URL above and tap <Text style={{ fontWeight: '700', color: DS.accent }}>Analyze</Text>.{'\n\n'}
              AI reads the reviews and tells you exactly what to fix — so your version beats the original.
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

      <AppHeader helpKey={mode === 'suppliers' ? 'suppliers' : mode === 'market' ? 'research' : mode === 'freight' ? 'freight_tab' : 'smart_search'} />
      <PipelineProgressBar />

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
