import React, {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PIPELINE_KEY = 'siftly_pipeline_v1';
const EVENTS_KEY   = 'siftly_events_v1';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface PipelineNiche {
  keyword:      string;
  marketplace:  string;
  verdictLabel: string;
  score:        number;
}

export interface PipelineProduct {
  title:    string;
  asin?:    string;
  price:    number;
  reviews:  number;
  rating:   number;
  url?:     string;
}

export interface PipelineSupplier {
  name:      string;
  platform:  string;
  unitCost:  number;
  moq:       number;
  url?:      string;
  score?:    number;
  grade?:    string;
}

// ── State ─────────────────────────────────────────────────────────────────────

interface PipelineState {
  activeNiche:      PipelineNiche    | null;
  activeProduct:    PipelineProduct  | null;
  selectedSupplier: PipelineSupplier | null;
  lastUpdated:      string;
}

const INITIAL: PipelineState = {
  activeNiche:      null,
  activeProduct:    null,
  selectedSupplier: null,
  lastUpdated:      '',
};

// ── Context shape ─────────────────────────────────────────────────────────────

interface PipelineContextValue extends PipelineState {
  loaded:              boolean;
  completedStages:     string[];
  setActiveNiche:      (niche: PipelineNiche | null) => void;
  setActiveProduct:    (product: PipelineProduct | null) => void;
  setSelectedSupplier: (supplier: PipelineSupplier | null) => void;
  clearPipeline:       () => void;
  trackEvent:          (event: string, data?: Record<string, unknown>) => void;
}

const PipelineContext = createContext<PipelineContextValue>({
  ...INITIAL,
  loaded:              false,
  completedStages:     [],
  setActiveNiche:      () => {},
  setActiveProduct:    () => {},
  setSelectedSupplier: () => {},
  clearPipeline:       () => {},
  trackEvent:          () => {},
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function PipelineProvider({ children }: { children: ReactNode }) {
  const [state,  setState]  = useState<PipelineState>(INITIAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(PIPELINE_KEY)
      .then(raw => { if (raw) setState(JSON.parse(raw)); })
      .finally(() => setLoaded(true));
  }, []);

  const persist = useCallback((updater: (prev: PipelineState) => PipelineState) => {
    setState(prev => {
      const next = updater(prev);
      AsyncStorage.setItem(PIPELINE_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const setActiveNiche = useCallback((niche: PipelineNiche | null) => {
    persist(prev => ({ ...prev, activeNiche: niche, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const setActiveProduct = useCallback((product: PipelineProduct | null) => {
    persist(prev => ({ ...prev, activeProduct: product, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const setSelectedSupplier = useCallback((supplier: PipelineSupplier | null) => {
    persist(prev => ({ ...prev, selectedSupplier: supplier, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const clearPipeline = useCallback(() => {
    persist(() => ({ ...INITIAL, lastUpdated: new Date().toISOString() }));
  }, [persist]);

  const trackEvent = useCallback(async (event: string, data?: Record<string, unknown>) => {
    if (__DEV__) console.log('[Pipeline]', event, data);
    try {
      const raw    = await AsyncStorage.getItem(EVENTS_KEY);
      const events = raw ? JSON.parse(raw) : [];
      events.push({ event, data, ts: new Date().toISOString() });
      await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-200)));
    } catch {}
  }, []);

  const completedStages: string[] = [
    state.activeNiche      ? 'niche'     : null,
    state.activeProduct    ? 'validate'  : null,
    state.selectedSupplier ? 'suppliers' : null,
  ].filter(Boolean) as string[];

  return (
    <PipelineContext.Provider value={{
      ...state,
      loaded,
      completedStages,
      setActiveNiche,
      setActiveProduct,
      setSelectedSupplier,
      clearPipeline,
      trackEvent,
    }}>
      {children}
    </PipelineContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function usePipeline(): PipelineContextValue {
  return useContext(PipelineContext);
}
