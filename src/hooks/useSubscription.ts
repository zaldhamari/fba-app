import { useState, useEffect, useCallback, useReducer, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import {
  getCustomerInfo,
  getPackageForTier,
  purchasePackage,
  restoreRC,
  tierFromCustomerInfo,
} from '../lib/revenuecat';

const SecureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return AsyncStorage.getItem(key);
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.setItem(key, value); return; }
    try { await SecureStore.setItemAsync(key, value); } catch { /* keychain unavailable */ }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { await AsyncStorage.removeItem(key); return; }
    try { await SecureStore.deleteItemAsync(key); } catch { /* already absent */ }
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type Tier = 'explorer' | 'builder' | 'operator';
export type Feature = 'research' | 'suppliers' | 'keywords' | 'brands';

export interface UsageData {
  month: string; // 'YYYY-MM' — auto-resets when month changes
  research: number;
  suppliers: number;
  keywords: number;
  brands: number;
}

// ─── Limits ────────────────────────────────────────────────────────────────────

export const MONTHLY_LIMITS: Record<Tier, Record<Feature, number>> = {
  explorer: { research: 5,    suppliers: 1,    keywords: 0,    brands: 1    },
  builder:  { research: 50,   suppliers: 20,   keywords: 20,   brands: 5    },
  operator: { research: 9999, suppliers: 9999, keywords: 9999, brands: 9999 },
};

export const SAVE_LIMITS: Record<Tier, number> = {
  explorer: 0,
  builder:  10,
  operator: 9999,
};

// ─── Pricing ───────────────────────────────────────────────────────────────────

export const PLANS = {
  explorer: { name: 'Explorer', monthly: 0,     annual: 0,      annualMonthly: 0     },
  builder:  { name: 'Builder',  monthly: 17.99, annual: 119.99, annualMonthly: 10.00 },
  operator: { name: 'Operator', monthly: 39.99, annual: 289.00, annualMonthly: 24.08 },
} as const;

export const LAUNCH_PACK_PRICE = 79;

export const PLAN_FEATURES: Record<Tier, string[]> = {
  explorer: [
    '5 product searches / month',
    '1 supplier search / month',
    '1 AI brand kit',
    'Full profit calculator',
    'Full Co-Pilot journey',
    'Launch checklist',
  ],
  builder: [
    'Discover opportunities — 50 searches/mo',
    'Source suppliers — 20 searches/mo',
    'Keyword intelligence — 20 searches/mo',
    'Brand kits & listings — 5/mo',
    'Save up to 10 opportunities',
    'Supplier outreach templates',
    'Opportunity scoring',
    'All 9 calculator modes',
  ],
  operator: [
    'Unlimited opportunity discovery',
    'Unlimited supplier sourcing',
    'Unlimited keyword intelligence',
    'Unlimited brand kits & listings',
    'Unlimited opportunity vault',
    'Priority AI generation',
    'Export data to CSV',
    'Everything in Builder',
  ],
};

// ─── Dev bypass (preview builds only — must be false in all shipped builds) ────

const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS === 'true';

// ─── TEMP: TestFlight — paywalls disabled for all testers ──────────────────────
// Forces every user onto the operator tier (unlimited usage, all features
// unlocked), skipping RevenueCat entitlement checks entirely. Set to false to
// restore normal subscription gating before public release.
const PAYWALLS_DISABLED = true;

// ─── Runtime dev unlock (persists in AsyncStorage, toggled via secret gesture) ─

const RUNTIME_DEV_KEY = 'siftly_dev_unlock_v1';
let _runtimeDevMode = false;
const _devListeners = new Set<() => void>();

// Only restore the dev unlock in dev/debug builds — never in production bundles.
// Prevents a stored '1' from a prior dev build activating dev mode in a TestFlight
// or App Store build on the same device.
if (__DEV__) {
  SecureStorage.getItem(RUNTIME_DEV_KEY).then(v => {
    if (v !== null) {
      if (v === '1') { _runtimeDevMode = true; _devListeners.forEach(fn => fn()); }
      return;
    }
    // One-time migration from AsyncStorage → SecureStore
    AsyncStorage.getItem(RUNTIME_DEV_KEY).then(legacy => {
      if (legacy === '1') {
        _runtimeDevMode = true;
        SecureStorage.setItem(RUNTIME_DEV_KEY, '1');
        AsyncStorage.removeItem(RUNTIME_DEV_KEY);
        _devListeners.forEach(fn => fn());
      }
    });
  });
}

export async function toggleDevMode(): Promise<boolean> {
  // No-op in production builds — only works when running under Metro (__DEV__ === true).
  if (!__DEV__) return false;
  _runtimeDevMode = !_runtimeDevMode;
  await SecureStorage.setItem(RUNTIME_DEV_KEY, _runtimeDevMode ? '1' : '0');
  _devListeners.forEach(fn => fn());
  return _runtimeDevMode;
}

// Safety: crash loudly in development if bypass is accidentally left on for a
// production-like build (EAS build, TestFlight, Play Store). __DEV__ is false
// for all EAS/production builds, so this will surface the mistake before release.
if (DEV_BYPASS && !__DEV__) {
  throw new Error(
    '[Siftly] EXPO_PUBLIC_DEV_BYPASS=true in a production build. ' +
    'Set it to false before building for TestFlight or the App Store.',
  );
}

// ─── Keys ──────────────────────────────────────────────────────────────────────

const KEYS = {
  tier:               'fba_tier_v3',
  tierVerifiedAt:     'fba_tier_verified_at_v1', // ISO timestamp of last successful RC check
  usage:              'fba_usage_v3',
  onboardingDone:     'fba_onboarding_v3',
  deviceId:           'fba_device_id',
  launchPackPurchased:'fba_launch_pack_v1',
};

// Grace period before a cached paid tier expires when RC is unreachable offline.
// 7 days gives subscribers a full week without connectivity before being degraded.
const TIER_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function freshUsage(): UsageData {
  return { month: currentMonth(), research: 0, suppliers: 0, keywords: 0, brands: 0 };
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

export function useSubscription() {
  const [tier, setTier]                           = useState<Tier>('explorer');
  const [usage, setUsage]                         = useState<UsageData>(freshUsage());
  const [onboardingDone, setOnboardingDone]       = useState<boolean | null>(null);
  const [launchPackPurchased, setLP]              = useState(false);
  const [loaded, setLoaded]                       = useState(false);
  const [subscriptionStale, setSubscriptionStale] = useState(false);
  const [, forceUpdate]                           = useReducer(x => x + 1, 0);

  // Synchronous mirror of `usage` so increment/sync can compute the next value and
  // persist it exactly once, outside the setState updater (updaters must be pure).
  const usageRef = useRef(usage);
  useEffect(() => { usageRef.current = usage; }, [usage]);

  useEffect(() => {
    _devListeners.add(forceUpdate);
    return () => { _devListeners.delete(forceUpdate); };
  }, []);

  useEffect(() => {
    const overrideTier = process.env.EXPO_PUBLIC_OVERRIDE_TIER as Tier | undefined;
    if (DEV_BYPASS || _runtimeDevMode || overrideTier || PAYWALLS_DISABLED) {
      setTier(overrideTier ?? 'operator');
      setLoaded(true);
      return;
    }
    // loadState() first so cached tier is visible immediately, then
    // checkRCEntitlements() overrides with authoritative RC result (or degrades
    // stale tier). Sequential ensures degradation cannot be undone by loadState
    // completing after checkRCEntitlements.
    loadState().then(() => checkRCEntitlements()).then(() => syncUsageFromCloud());
  }, [_runtimeDevMode]);

  async function loadState() {
    let did = await SecureStorage.getItem(KEYS.deviceId);
    if (!did) {
      did = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await SecureStorage.setItem(KEYS.deviceId, did);
    }
    // Tier: read from SecureStore; migrate from AsyncStorage on first run after this update
    let savedTier = await SecureStorage.getItem(KEYS.tier);
    if (!savedTier) {
      const legacy = await AsyncStorage.getItem(KEYS.tier).catch(() => null);
      if (legacy) {
        await SecureStorage.setItem(KEYS.tier, legacy);
        await AsyncStorage.removeItem(KEYS.tier).catch(() => {});
        savedTier = legacy;
      }
    }
    // tierVerifiedAt: same migration path
    const secureVerifiedAt = await SecureStorage.getItem(KEYS.tierVerifiedAt);
    if (!secureVerifiedAt) {
      const legacy = await AsyncStorage.getItem(KEYS.tierVerifiedAt).catch(() => null);
      if (legacy) {
        await SecureStorage.setItem(KEYS.tierVerifiedAt, legacy);
        await AsyncStorage.removeItem(KEYS.tierVerifiedAt).catch(() => {});
      }
    }

    const [savedUsage, ob, lp] = await Promise.all([
      AsyncStorage.getItem(KEYS.usage),
      AsyncStorage.getItem(KEYS.onboardingDone),
      AsyncStorage.getItem(KEYS.launchPackPurchased),
    ]);
    setTier((savedTier as Tier) || 'explorer');
    setOnboardingDone(ob === 'true');
    setLP(lp === 'true');
    if (savedUsage) {
      try {
        const parsed: UsageData = JSON.parse(savedUsage);
        setUsage(parsed.month === currentMonth() ? parsed : freshUsage());
      } catch { setUsage(freshUsage()); }
    }
    setLoaded(true);
  }

  // ── Entitlement flow ────────────────────────────────────────────────────────
  //
  // Tier is stored in three layers, checked in priority order:
  //
  //   1. RevenueCat (authoritative)  — checked on every cold start via getCustomerInfo()
  //   2. AsyncStorage (fba_tier_v3)  — cache written after every successful RC check
  //   3. Offline grace period        — if RC is unreachable and cache is < 7 days old,
  //                                    trust the cache. If older, degrade to explorer.
  //
  // Tier is written to AsyncStorage in:
  //   - checkRCEntitlements()  on cold start (after successful RC fetch)
  //   - unlock()               after a purchase or manual admin unlock
  //
  // tier_verified_at (fba_tier_verified_at_v1) is written only on a successful RC
  // response. It is the single source of truth for offline cache freshness.

  async function checkRCEntitlements(): Promise<boolean> {
    try {
      const info   = await getCustomerInfo();
      const rcTier = tierFromCustomerInfo(info);
      const now    = new Date().toISOString();
      await Promise.all([
        SecureStorage.setItem(KEYS.tier, rcTier),
        SecureStorage.setItem(KEYS.tierVerifiedAt, now),
      ]);
      setTier(rcTier);
      setSubscriptionStale(false);
      return true;
    } catch {
      // RC unavailable — trust local cache within the grace period.
      // Read tierVerifiedAt directly from SecureStore to avoid a race with loadState().
      const verifiedAt = await SecureStorage.getItem(KEYS.tierVerifiedAt);
      if (verifiedAt) {
        const ageMs = Date.now() - new Date(verifiedAt).getTime();
        if (ageMs > TIER_EXPIRY_MS) {
          // Cached entitlement is stale — degrade to explorer until RC is reachable.
          await SecureStorage.setItem(KEYS.tier, 'explorer');
          setTier('explorer');
          setSubscriptionStale(true);
        }
      }
      // If no tierVerifiedAt exists the app has never verified — keep explorer (default).
      return false;
    }
  }

  // ─── Sync usage from Supabase — prevents reinstall / multi-device abuse ───────
  // Takes the maximum of local and server counts so an upgrade never resets usage.

  async function syncUsageFromCloud() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      const { data } = await supabase
        .from('usage_counts')
        .select('data')
        .eq('user_id', session.user.id)
        .single();
      if (!data?.data) return;
      const server = data.data as UsageData;
      if (server.month !== currentMonth()) return;
      const local = usageRef.current.month === currentMonth() ? usageRef.current : freshUsage();
      const merged: UsageData = {
        month:     currentMonth(),
        research:  Math.max(local.research,  server.research  ?? 0),
        suppliers: Math.max(local.suppliers, server.suppliers ?? 0),
        keywords:  Math.max(local.keywords,  server.keywords  ?? 0),
        brands:    Math.max(local.brands,    server.brands    ?? 0),
      };
      usageRef.current = merged;
      setUsage(merged);
      AsyncStorage.setItem(KEYS.usage, JSON.stringify(merged));
    } catch { /* network error — use local counts */ }
  }

  // ─── Internal: write tier to local storage ─────────────────────────────────

  const unlock = useCallback(async (newTier: Tier) => {
    const now = new Date().toISOString();
    await Promise.all([
      SecureStorage.setItem(KEYS.tier, newTier),
      SecureStorage.setItem(KEYS.tierVerifiedAt, now),
    ]);
    setTier(newTier);
    setSubscriptionStale(false);
  }, []);

  // ─── Public: purchase via RevenueCat ───────────────────────────────────────

  const purchasePlan = useCallback(async (t: Tier, _isAnnual: boolean): Promise<void> => {
    if (DEV_BYPASS) {
      await unlock(t);
      return;
    }
    const pkg = await getPackageForTier(t, _isAnnual);
    if (!pkg) throw new Error('Product unavailable. Check your connection and try again.');
    const customerInfo = await purchasePackage(pkg);
    const newTier = tierFromCustomerInfo(customerInfo);
    await unlock(newTier);
    const reset = freshUsage();
    usageRef.current = reset;
    setUsage(reset);
    await AsyncStorage.setItem(KEYS.usage, JSON.stringify(reset));
  }, [unlock]);

  // Returns the restored tier so callers can show the right feedback.
  // 'explorer' means no active subscription was found.
  const restorePurchases = useCallback(async (): Promise<Tier> => {
    if (DEV_BYPASS) return tier;
    const customerInfo = await restoreRC();
    const restoredTier = tierFromCustomerInfo(customerInfo);
    if (restoredTier !== 'explorer') {
      await unlock(restoredTier);
    }
    return restoredTier;
  }, [unlock, tier]);

  // ─── Usage tracking ────────────────────────────────────────────────────────

  const remaining = useCallback((feature: Feature): number => {
    if (DEV_BYPASS || _runtimeDevMode) return 999;
    const limit = MONTHLY_LIMITS[tier][feature];
    if (limit === 0) return 0;
    return Math.max(0, limit - (usage[feature] ?? 0));
  }, [tier, usage]);

  const can = useCallback((feature: string): boolean => {
    const featureMap: Record<string, Feature | 'saves' | null> = {
      research: 'research', supplier: 'suppliers', suppliers: 'suppliers',
      keywords: 'keywords', brand: 'brands', brands: 'brands',
      calculator: null, trends: null, opportunity: null,
      feasibility: null, // available on builder+ (non-explorer) — checked separately via tier
      saves: 'saves',
    };
    // feasibility is locked for explorer regardless of usage
    if (feature === 'feasibility') return tier !== 'explorer';
    const mapped = featureMap[feature];
    if (mapped === undefined) return tier !== 'explorer';
    if (mapped === null) return true;
    if (mapped === 'saves') return SAVE_LIMITS[tier] > 0;
    return remaining(mapped as Feature) > 0;
  }, [tier, remaining]);

  const increment = useCallback(async (feature: Feature) => {
    const base = usageRef.current.month === currentMonth() ? usageRef.current : freshUsage();
    const next: UsageData = { ...base, [feature]: (base[feature] ?? 0) + 1 };
    usageRef.current = next;
    setUsage(next);
    AsyncStorage.setItem(KEYS.usage, JSON.stringify(next));
    // Cloud sync (inline to avoid circular import with sync.ts)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await supabase.from('usage_counts').upsert(
      { user_id: session.user.id, data: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  }, []);

  // Launch Pack IAP is not yet configured in RevenueCat.
  // Throwing here ensures no code path can silently grant access before the
  // real product exists. LaunchPackModal guards this behind a disabled CTA.
  const purchaseLaunchPack = useCallback(async () => {
    throw new Error('Launch Pack is not yet available. Check back in an upcoming update.');
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.onboardingDone, 'true');
    setOnboardingDone(true);
  }, []);

  const isDevMode = DEV_BYPASS || _runtimeDevMode;

  return {
    tier, usage, loaded, onboardingDone, launchPackPurchased,
    // true when RC was unreachable at startup AND the cached tier is > 7 days stale.
    // Use this to show a "Refresh subscription" prompt in the settings modal.
    subscriptionStale,
    isOperator: tier === 'operator' || isDevMode,
    isBuilder:  tier === 'builder' || tier === 'operator' || isDevMode,
    isFree:     tier === 'explorer' && !isDevMode,
    limits:     MONTHLY_LIMITS[isDevMode ? 'operator' : tier],
    devMode:    isDevMode,
    can, remaining, increment,
    unlock, purchasePlan, restorePurchases,
    purchaseLaunchPack, completeOnboarding,
    refreshSubscription: checkRCEntitlements,
    syncUsage: syncUsageFromCloud,
  };
}
