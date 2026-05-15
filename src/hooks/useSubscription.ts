import { useState, useEffect, useCallback } from 'react';
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
  explorer: { research: 3,    suppliers: 1,    keywords: 0,    brands: 1    },
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
    '3 product searches / month',
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

// ─── Dev bypass (preview builds only — stripped from production) ───────────────

const DEV_BYPASS = process.env.EXPO_PUBLIC_DEV_BYPASS === 'true';

// ─── Keys ──────────────────────────────────────────────────────────────────────

const KEYS = {
  tier:               'fba_tier_v3',
  usage:              'fba_usage_v3',
  onboardingDone:     'fba_onboarding_v3',
  deviceId:           'fba_device_id',
  launchPackPurchased:'fba_launch_pack_v1',
};

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

  useEffect(() => {
    if (DEV_BYPASS) {
      setTier('operator');
      setLoaded(true);
      return;
    }
    loadState();
    checkRCEntitlements();
  }, []);

  async function loadState() {
    let did = await SecureStorage.getItem(KEYS.deviceId);
    if (!did) {
      did = 'dev_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      await SecureStorage.setItem(KEYS.deviceId, did);
    }
    const [savedTier, savedUsage, ob, lp] = await Promise.all([
      AsyncStorage.getItem(KEYS.tier),
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

  // Verify subscription status against RevenueCat on every cold start.
  // Always writes back — handles both upgrades AND expired subscriptions.
  // The catch block is the only path that trusts local cache (offline / RC not configured).
  async function checkRCEntitlements() {
    try {
      const info   = await getCustomerInfo();
      const rcTier = tierFromCustomerInfo(info);
      await AsyncStorage.setItem(KEYS.tier, rcTier);
      setTier(rcTier);
    } catch {
      // RC unavailable (offline or not yet configured) — trust local cache
    }
  }

  // ─── Internal: write tier to local storage ─────────────────────────────────

  const unlock = useCallback(async (newTier: Tier) => {
    await AsyncStorage.setItem(KEYS.tier, newTier);
    setTier(newTier);
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
    setUsage(reset);
    await AsyncStorage.setItem(KEYS.usage, JSON.stringify(reset));
  }, [unlock]);

  const restorePurchases = useCallback(async (): Promise<void> => {
    if (DEV_BYPASS) return;
    const customerInfo = await restoreRC();
    const newTier = tierFromCustomerInfo(customerInfo);
    if (newTier !== 'explorer') {
      await unlock(newTier);
    }
  }, [unlock]);

  // ─── Usage tracking ────────────────────────────────────────────────────────

  const remaining = useCallback((feature: Feature): number => {
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
    setUsage(prev => {
      const base = prev.month === currentMonth() ? prev : freshUsage();
      const next: UsageData = { ...base, [feature]: (base[feature] ?? 0) + 1 };
      AsyncStorage.setItem(KEYS.usage, JSON.stringify(next));
      // Cloud sync (inline to avoid circular import with sync.ts)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!session?.user) return;
        supabase.from('usage_counts').upsert(
          { user_id: session.user.id, data: next, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' },
        ).then(() => {});
      });
      return next;
    });
  }, []);

  const purchaseLaunchPack = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.launchPackPurchased, 'true');
    setLP(true);
  }, []);

  const completeOnboarding = useCallback(async () => {
    await AsyncStorage.setItem(KEYS.onboardingDone, 'true');
    setOnboardingDone(true);
  }, []);

  return {
    tier, usage, loaded, onboardingDone, launchPackPurchased,
    isOperator: tier === 'operator',
    isBuilder:  tier === 'builder' || tier === 'operator',
    isFree:     tier === 'explorer',
    limits:     MONTHLY_LIMITS[tier],
    can, remaining, increment,
    unlock, purchasePlan, restorePurchases,
    purchaseLaunchPack, completeOnboarding,
  };
}
