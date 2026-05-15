import React, {
  createContext, useContext, useState, useEffect,
  useCallback, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../constants/storage';
import type { FeasibilityProduct } from '../lib/feasibility';

interface ActiveProductContextValue {
  activeProduct: FeasibilityProduct | null;
  setActiveProduct: (product: FeasibilityProduct | null) => void;
  /** Re-reads from storage — call after another screen may have written it */
  refreshActiveProduct: () => Promise<void>;
}

const ActiveProductContext = createContext<ActiveProductContextValue>({
  activeProduct: null,
  setActiveProduct: () => {},
  refreshActiveProduct: async () => {},
});

export function ActiveProductProvider({ children }: { children: ReactNode }) {
  const [activeProduct, setActiveProductState] = useState<FeasibilityProduct | null>(null);

  const load = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEYS.feasibilityProduct);
      if (raw) setActiveProductState(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const setActiveProduct = useCallback((product: FeasibilityProduct | null) => {
    setActiveProductState(product);
    if (product) {
      AsyncStorage.setItem(STORAGE_KEYS.feasibilityProduct, JSON.stringify(product)).catch(() => {});
    } else {
      AsyncStorage.removeItem(STORAGE_KEYS.feasibilityProduct).catch(() => {});
    }
  }, []);

  return (
    <ActiveProductContext.Provider value={{ activeProduct, setActiveProduct, refreshActiveProduct: load }}>
      {children}
    </ActiveProductContext.Provider>
  );
}

export function useActiveProduct(): ActiveProductContextValue {
  return useContext(ActiveProductContext);
}
