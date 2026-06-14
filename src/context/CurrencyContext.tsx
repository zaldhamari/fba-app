import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CurrencyCode = 'USD' | 'CAD' | 'GBP' | 'EUR' | 'AED' | 'SAR';
export type MarketplaceId = 'US' | 'CA' | 'UK' | 'DE' | 'AE' | 'SA';

export interface CurrencyInfo {
  code: CurrencyCode;
  symbol: string;         // used in price display: $, £, €, C$, AED, SAR
  selectorSymbol: string; // shown in the selector pill only
  flag: string;
  name: string;
}

export interface Marketplace {
  id: MarketplaceId;
  name: string;
  flag: string;
  currency: CurrencyCode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  USD: { code: 'USD', symbol: '$',     selectorSymbol: '$',    flag: '🇺🇸', name: 'US Dollar'       },
  CAD: { code: 'CAD', symbol: 'C$',    selectorSymbol: 'C$',   flag: '🇨🇦', name: 'Canadian Dollar' },
  GBP: { code: 'GBP', symbol: '£',     selectorSymbol: '£',    flag: '🇬🇧', name: 'British Pound'   },
  EUR: { code: 'EUR', symbol: '€',     selectorSymbol: '€',    flag: '🇪🇺', name: 'Euro'            },
  AED: { code: 'AED', symbol: 'AED ',  selectorSymbol: 'د.إ',  flag: '🇦🇪', name: 'UAE Dirham'      },
  SAR: { code: 'SAR', symbol: 'SAR ',  selectorSymbol: 'ر.س',  flag: '🇸🇦', name: 'Saudi Riyal'     },
};

export const MARKETPLACES: Marketplace[] = [
  { id: 'US', name: 'Amazon US',      flag: '🇺🇸', currency: 'USD' },
  { id: 'CA', name: 'Amazon Canada',  flag: '🇨🇦', currency: 'CAD' },
  { id: 'UK', name: 'Amazon UK',      flag: '🇬🇧', currency: 'GBP' },
  { id: 'DE', name: 'Amazon EU',      flag: '🇪🇺', currency: 'EUR' },
  { id: 'AE', name: 'Amazon UAE',     flag: '🇦🇪', currency: 'AED' },
  { id: 'SA', name: 'Amazon Saudi',   flag: '🇸🇦', currency: 'SAR' },
];

// Hardcoded fallback rates (USD base). Used if network is unavailable.
// These are approximate and the live fetch will override them.
const FALLBACK_RATES: Record<string, number> = {
  USD: 1, CAD: 1.37, GBP: 0.79, EUR: 0.92,
  AED: 3.67, SAR: 3.75,
};

const CURRENCY_KEY    = 'fba_currency_v1';
const MARKETPLACE_KEY = 'fba_marketplace_v1';
const RATES_KEY       = 'fba_fx_rates_v1';
const RATES_TS_KEY    = 'fba_fx_ts_v1';
const RATES_TTL_MS    = 24 * 60 * 60 * 1000; // 24 h
const RATES_URL       = 'https://open.er-api.com/v6/latest/USD';

// ─── Context shape ────────────────────────────────────────────────────────────

export interface CurrencyContextValue {
  currency: CurrencyCode;
  marketplace: MarketplaceId;
  rates: Record<string, number>;
  symbol: string;
  flag: string;
  info: CurrencyInfo;

  /** Format a USD amount into the selected currency string, e.g. "AED 109.99" */
  fmt: (usdAmount: number, decimals?: number) => string;
  /** Format an amount already in local currency, just adds the symbol */
  fmtLocal: (localAmount: number, decimals?: number) => string;
  /** Convert USD → selected currency */
  fromUSD: (usd: number) => number;
  /** Convert selected currency → USD */
  toUSD: (local: number) => number;

  setCurrency: (code: CurrencyCode) => void;
  setMarketplace: (id: MarketplaceId) => void;
}

// ─── Defaults (used before load) ─────────────────────────────────────────────

const DEFAULT_CTX: CurrencyContextValue = {
  currency: 'USD', marketplace: 'US', rates: FALLBACK_RATES,
  symbol: '$', flag: '🇺🇸', info: CURRENCIES.USD,
  fmt: (usd, d = 2) => `$${usd.toFixed(d)}`,
  fmtLocal: (v, d = 2) => `$${v.toFixed(d)}`,
  fromUSD: (x) => x, toUSD: (x) => x,
  setCurrency: () => {}, setMarketplace: () => {},
};

const CurrencyContext = createContext<CurrencyContextValue>(DEFAULT_CTX);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency,    setCurrencyState]    = useState<CurrencyCode>('USD');
  const [marketplace, setMarketplaceState] = useState<MarketplaceId>('US');
  const [rates,       setRates]            = useState<Record<string, number>>(FALLBACK_RATES);

  // Ref so callbacks always see the latest rates without re-creating
  const ratesRef = useRef(rates);
  ratesRef.current = rates;

  useEffect(() => {
    (async () => {
      const [c, m, r, ts] = await Promise.all([
        AsyncStorage.getItem(CURRENCY_KEY),
        AsyncStorage.getItem(MARKETPLACE_KEY),
        AsyncStorage.getItem(RATES_KEY),
        AsyncStorage.getItem(RATES_TS_KEY),
      ]);
      if (c && CURRENCIES[c as CurrencyCode]) setCurrencyState(c as CurrencyCode);
      if (m && MARKETPLACES.some(mp => mp.id === m)) setMarketplaceState(m as MarketplaceId);
      if (r) {
        try { setRates(prev => ({ ...prev, ...JSON.parse(r) })); } catch {}
      }
      const age = ts ? Date.now() - parseInt(ts, 10) : Infinity;
      if (age > RATES_TTL_MS) fetchRates();
    })();
  }, []);

  async function fetchRates() {
    try {
      const res  = await fetch(RATES_URL, { signal: AbortSignal.timeout(8000) });
      const json = await res.json();
      if (json.result === 'success' && json.rates) {
        setRates(prev => ({ ...prev, ...json.rates }));
        await AsyncStorage.setItem(RATES_KEY, JSON.stringify(json.rates));
        await AsyncStorage.setItem(RATES_TS_KEY, String(Date.now()));
      }
    } catch { /* keep fallback */ }
  }

  const setCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    AsyncStorage.setItem(CURRENCY_KEY, code);
  }, []);

  const setMarketplace = useCallback((id: MarketplaceId) => {
    const mp = MARKETPLACES.find(m => m.id === id);
    setMarketplaceState(id);
    AsyncStorage.setItem(MARKETPLACE_KEY, id);
    if (mp) {
      setCurrencyState(mp.currency);
      AsyncStorage.setItem(CURRENCY_KEY, mp.currency);
    }
  }, []);

  const safeCurrency = CURRENCIES[currency] ? currency : 'USD';
  const rate     = rates[safeCurrency] ?? FALLBACK_RATES[safeCurrency] ?? 1;
  const info     = CURRENCIES[safeCurrency];
  const fromUSD  = useCallback((usd: number) => {
    const r = ratesRef.current[safeCurrency] ?? FALLBACK_RATES[safeCurrency] ?? 1;
    return usd * r;
  }, [safeCurrency]);
  const toUSD    = useCallback((local: number) => {
    const r = ratesRef.current[safeCurrency] ?? FALLBACK_RATES[safeCurrency] ?? 1;
    return r ? local / r : local; // guard divide-by-zero on a bad rate
  }, [safeCurrency]);
  const fmt      = useCallback((usd: number, decimals = 2) =>
    `${info.symbol}${(usd * rate).toFixed(decimals)}`,
  [rate, info]);
  const fmtLocal = useCallback((local: number, decimals = 2) =>
    `${info.symbol}${local.toFixed(decimals)}`,
  [info]);

  return (
    <CurrencyContext.Provider value={{
      currency: safeCurrency as typeof currency, marketplace, rates, symbol: info.symbol, flag: info.flag, info,
      fmt, fmtLocal, fromUSD, toUSD, setCurrency, setMarketplace,
    }}>
      {children}
    </CurrencyContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCurrency(): CurrencyContextValue {
  return useContext(CurrencyContext);
}
