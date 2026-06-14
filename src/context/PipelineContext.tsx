import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useMemo, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { track } from '../lib/analytics';
import { safeParseJSON } from '../utils/safeJSON';

const PIPELINE_KEY    = 'siftly_pipeline_v1';
const EVENTS_KEY      = 'siftly_events_v1';
const PIPELINE_VERSION = 1;

// ── Shared types ──────────────────────────────────────────────────────────────

export interface PipelineNiche {
  keyword:      string;
  marketplace:  string;
  verdictLabel: string;
  score:        number;
  updatedAt?:   string;
}

export interface PipelineProduct {
  title:    string;
  asin?:    string;
  price:    number;
  reviews:  number;
  rating:   number;
  url?:     string;
  competition?: 'Low' | 'Medium' | 'High';
  // Sales estimates (directional, review-model based)
  salesEstLow?:      number;   // conservative monthly units
  salesEstHigh?:     number;   // optimistic monthly units
  salesEstDaily?:    string;   // "~4–9/day"
  salesConfidence?:  'Low' | 'Medium';
  ppcPressure?:      'Low' | 'Medium' | 'High';
  // Revenue estimates
  revenueEstLow?:    number;   // monthly USD conservative
  revenueEstHigh?:   number;   // monthly USD optimistic
  updatedAt?:        string;
}

export interface PipelineSupplier {
  name:      string;
  platform:  string;
  unitCost:  number;
  moq:       number;
  url?:      string;
  score?:    number;
  grade?:    string;
  country?:  string;   // e.g. "🇨🇳 China" — populated from search results, editable inline
  // Extended sourcing fields
  leadTimeDays?:          number;
  shippingType?:          'sea' | 'air' | 'express';
  notes?:                 string;
  estimatedLandedCost?:   number;   // unitCost + rough freight
  estimatedROIPct?:       number;   // roughROIPct at product price
  recommendation?:        'Best Margin' | 'Lowest Risk' | 'Fastest Launch' | 'Budget Friendly';
  updatedAt?:             string;
}

export interface PipelineCostModel {
  sellingPrice:    number;
  unitCost:        number;
  freight:         number;
  fbaFee:          number;
  referralFee:     number;
  duties:          number;
  packaging:       number;
  netProfit:       number;
  marginPct:       number;
  roiPct:          number;
  totalCost:       number;
  unitsOrdered:    number;
  totalInvestment: number;
  savedAt:         string;
}

export interface PipelineReconInsights {
  sourceKeyword:       string;
  complaints:          string[];
  opportunities:       string[];
  improvementSpecs:    string[];
  positioningAngles:   string[];
  qualityRisks:        string[];
  createdAt:           string;
  differentiationAngles?: string[];
  bundleIdeas?:          string[];
  listingAngle?:         string;
  pricePositioning?:     string;
  differentiatedAt?:     string;
}

export interface PipelineBrandData {
  brandName:        string;
  productTitle:     string;
  tagline:          string;
  keywords:         string[];
  style:            string;
  savedAt:          string;
  personality?:     string;
  colorPalette?:    string;
  fontStyle?:       string;
  brandDirection?:  string;
  listingTitle?:    string;
  listingBullets?:  string[];
  backendKeywords?: string[];
  // Barcode workflow
  barcodeMode?:           string;
  barcodeIdentifier?:     string;
  barcodePlacement?:      string;
  barcodePackagingType?:  string;
  barcodeGs1Required?:    boolean;
  barcodeFnskuRequired?:  boolean;
  // Label workspace
  labelTemplate?:         string;
  labelFields?:           Record<string, string>;
  labelBarcodePlacement?: string;
  updatedAt?:             string;
}

// ── Freight Estimate ──────────────────────────────────────────────────────────

export interface PipelineFreightEstimate {
  selectedMode:           'sea' | 'air' | 'local';
  perUnitCost:            number;
  totalCost:              number;
  originCountry:          string;
  destinationMarketplace: string;
  isConfirmed:            boolean;
  updatedAt:              string;
}

// ── Sourcing Strategy Snapshot ────────────────────────────────────────────────

export interface PipelineSourcingStrategy {
  recommendedPlatforms: string[];  // platform ids, top 4
  recommendedRegions:   string[];  // region ids
  freightSensitivity:   'Low' | 'Medium' | 'High' | 'Extreme';
  freightStrategy:      string;
  sourcingDifficulty:   'Beginner' | 'Intermediate' | 'Advanced';
  sourcingWarnings:     string[];
  selectedPlatform:     string | null;
  updatedAt:            string;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface PipelineState {
  _version?:        number;
  activeNiche:      PipelineNiche           | null;
  activeProduct:    PipelineProduct         | null;
  selectedSupplier: PipelineSupplier        | null;
  supplierQuotes:   PipelineSupplier[];
  activeSupplierId: string | null;
  costModel:        PipelineCostModel       | null;
  brandData:        PipelineBrandData       | null;
  reconInsights:    PipelineReconInsights   | null;
  sourcingStrategy: PipelineSourcingStrategy | null;
  freightEstimate:  PipelineFreightEstimate | null;
  lastUpdated:      string;
}

const INITIAL: PipelineState = {
  activeNiche:      null,
  activeProduct:    null,
  selectedSupplier: null,
  supplierQuotes:   [],
  activeSupplierId: null,
  costModel:        null,
  brandData:        null,
  reconInsights:    null,
  sourcingStrategy: null,
  freightEstimate:  null,
  lastUpdated:      '',
};

// ── Context shape ─────────────────────────────────────────────────────────────

export interface PipelineContextValue extends PipelineState {
  loaded:               boolean;
  completedStages:      string[];
  setActiveNiche:       (niche: PipelineNiche | null) => void;
  setActiveProduct:     (product: PipelineProduct | null) => void;
  setSelectedSupplier:  (supplier: PipelineSupplier | null) => void;
  setActiveSupplierId:  (id: string | null) => void;
  addSupplierQuote:     (quote: PipelineSupplier) => void;
  removeSupplierQuote:  (name: string) => void;
  updateSupplierQuote:  (name: string, updates: Partial<PipelineSupplier>) => void;
  setCostModel:         (model: PipelineCostModel | null) => void;
  setBrandData:         (brand: PipelineBrandData | null) => void;
  setReconInsights:     (insights: PipelineReconInsights | null) => void;
  setSourcingStrategy:  (strategy: PipelineSourcingStrategy | null) => void;
  setFreightEstimate:   (estimate: PipelineFreightEstimate | null) => void;
  clearPipeline:        () => void;
  trackPipelineEvent:   (event: string, data?: Record<string, unknown>) => void;
  exportPipeline:       () => Promise<string>;
}

const PipelineContext = createContext<PipelineContextValue>({
  ...INITIAL,
  loaded:               false,
  completedStages:      [],
  setActiveNiche:       () => {},
  setActiveProduct:     () => {},
  setSelectedSupplier:  () => {},
  setActiveSupplierId:  () => {},
  addSupplierQuote:     () => {},
  removeSupplierQuote:  () => {},
  updateSupplierQuote:  () => {},
  setCostModel:         () => {},
  setBrandData:         () => {},
  setReconInsights:     () => {},
  setSourcingStrategy:  () => {},
  setFreightEstimate:   () => {},
  clearPipeline:        () => {},
  trackPipelineEvent:   () => {},
  exportPipeline:       async () => '{}',
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state,  setState]  = useState<PipelineState>(INITIAL);
  const [loaded, setLoaded] = useState(false);
  const persistTimer        = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;
    AsyncStorage.getItem(PIPELINE_KEY)
      .then(raw => {
        if (!isMounted) return;
        if (raw) {
          const parsed = safeParseJSON<PipelineState & { _version?: number }>(raw);
          if (parsed) {
            const migrated = (parsed._version === undefined || parsed._version < PIPELINE_VERSION)
              ? { ...parsed, _version: PIPELINE_VERSION }
              : parsed;
            setState({
              ...INITIAL,
              ...migrated,
              supplierQuotes:   migrated.supplierQuotes   ?? [],
              activeSupplierId: migrated.activeSupplierId ?? null,
            });
          } else {
            // Corrupt data — clear it so the app does not stay broken after an update
            AsyncStorage.removeItem(PIPELINE_KEY).catch(() => {});
          }
        }
      })
      .finally(() => { if (isMounted) setLoaded(true); });
    return () => { isMounted = false; };
  }, []);

  const persist = useCallback((updater: (prev: PipelineState) => PipelineState) => {
    setState(prev => {
      const next = { ...updater(prev), _version: PIPELINE_VERSION };
      // Debounce disk writes — update React state immediately but batch AsyncStorage I/O.
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        AsyncStorage.setItem(PIPELINE_KEY, JSON.stringify(next)).catch(() => {});
      }, 250);
      return next;
    });
  }, []);

  const setActiveNiche = useCallback((niche: PipelineNiche | null) => {
    persist(prev => ({ ...prev, activeNiche: niche, lastUpdated: new Date().toISOString() }));
    if (niche) track('niche_selected', { keyword: niche.keyword, marketplace: niche.marketplace });
    else track('niche_cleared');
  }, [persist]);

  const setActiveProduct = useCallback((product: PipelineProduct | null) => {
    persist(prev => ({ ...prev, activeProduct: product, lastUpdated: new Date().toISOString() }));
    if (product) track('product_selected', { title: product.title, asin: product.asin, price: product.price });
    else track('product_cleared');
  }, [persist]);

  const setSelectedSupplier = useCallback((supplier: PipelineSupplier | null) => {
    persist(prev => ({ ...prev, selectedSupplier: supplier, lastUpdated: new Date().toISOString() }));
    if (supplier) track('supplier_selected', { name: supplier.name, platform: supplier.platform, unitCost: supplier.unitCost });
  }, [persist]);

  const setActiveSupplierId = useCallback((id: string | null) => {
    persist(prev => ({ ...prev, activeSupplierId: id, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const addSupplierQuote = useCallback((quote: PipelineSupplier) => {
    persist(prev => {
      const existing = prev.supplierQuotes ?? [];
      const deduped  = existing.filter(q => q.name !== quote.name);
      return {
        ...prev,
        supplierQuotes: [...deduped, quote].slice(-5), // keep up to 5 quotes
        lastUpdated: new Date().toISOString(),
      };
    });
  }, [persist]);

  const removeSupplierQuote = useCallback((name: string) => {
    persist(prev => ({
      ...prev,
      supplierQuotes: (prev.supplierQuotes ?? []).filter(q => q.name !== name),
      lastUpdated: new Date().toISOString(),
    }));
  }, [persist]);

  const updateSupplierQuote = useCallback((name: string, updates: Partial<PipelineSupplier>) => {
    persist(prev => ({
      ...prev,
      supplierQuotes: (prev.supplierQuotes ?? []).map(q =>
        q.name === name ? { ...q, ...updates } : q,
      ),
      lastUpdated: new Date().toISOString(),
    }));
  }, [persist]);

  const setCostModel = useCallback((model: PipelineCostModel | null) => {
    persist(prev => ({ ...prev, costModel: model, lastUpdated: new Date().toISOString() }));
    if (model) track('cost_model_built', { netProfit: model.netProfit, marginPct: model.marginPct, roiPct: model.roiPct });
    else track('cost_model_cleared');
  }, [persist]);

  const setBrandData = useCallback((brand: PipelineBrandData | null) => {
    persist(prev => ({ ...prev, brandData: brand, lastUpdated: new Date().toISOString() }));
    if (brand) track('brand_data_saved', { brandName: brand.brandName });
  }, [persist]);

  const setReconInsights = useCallback((insights: PipelineReconInsights | null) => {
    persist(prev => ({ ...prev, reconInsights: insights, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const setSourcingStrategy = useCallback((strategy: PipelineSourcingStrategy | null) => {
    persist(prev => ({ ...prev, sourcingStrategy: strategy, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const setFreightEstimate = useCallback((estimate: PipelineFreightEstimate | null) => {
    persist(prev => ({ ...prev, freightEstimate: estimate, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const exportPipeline = useCallback(async () => {
    const raw = await AsyncStorage.getItem(PIPELINE_KEY);
    return raw ?? '{}';
  }, []);

  const clearPipeline = useCallback(() => {
    persist(() => ({ ...INITIAL, lastUpdated: new Date().toISOString() }));
    track('pipeline_cleared');
  }, [persist]);

  const trackPipelineEvent = useCallback(async (event: string, data?: Record<string, unknown>) => {
    if (__DEV__) console.log('[Pipeline]', event, data);
    try {
      const raw    = await AsyncStorage.getItem(EVENTS_KEY);
      const events = (raw ? safeParseJSON<unknown[]>(raw) : null) ?? [];
      events.push({ event, data, ts: new Date().toISOString() });
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-200)));
    } catch {}
  }, []);

  const completedStages = useMemo<string[]>(() => [
    state.activeNiche      ? 'niche'     : null,
    state.activeProduct    ? 'validate'  : null,
    state.selectedSupplier ? 'sourcing'  : null,
    state.costModel        ? 'costs'     : null,
    state.brandData        ? 'brand'     : null,
  ].filter(Boolean) as string[], [
    state.activeNiche,
    state.activeProduct,
    state.selectedSupplier,
    state.costModel,
    state.brandData,
  ]);

  const contextValue = useMemo<PipelineContextValue>(() => ({
    ...state,
    loaded,
    completedStages,
    setActiveNiche,
    setActiveProduct,
    setSelectedSupplier,
    setActiveSupplierId,
    addSupplierQuote,
    removeSupplierQuote,
    updateSupplierQuote,
    setCostModel,
    setBrandData,
    setReconInsights,
    setSourcingStrategy,
    setFreightEstimate,
    clearPipeline,
    trackPipelineEvent,
    exportPipeline,
  }), [
    state, loaded, completedStages,
    setActiveNiche, setActiveProduct, setSelectedSupplier, setActiveSupplierId,
    addSupplierQuote, removeSupplierQuote, updateSupplierQuote,
    setCostModel, setBrandData, setReconInsights, setSourcingStrategy, setFreightEstimate,
    clearPipeline, trackPipelineEvent, exportPipeline,
  ]);

  return (
    <PipelineContext.Provider value={contextValue}>
      {children}
    </PipelineContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePipeline(): PipelineContextValue {
  return useContext(PipelineContext);
}
