import { useState, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../services/api';
import { VaultEntry, VaultStatus, AnalysisSnapshot } from '../types/vault';
import { supabase } from '../lib/supabase';
import { pushVaultEntry, deleteVaultEntry, pullVault } from '../services/sync';

const VAULT_KEY        = 'fba_vault_v2';
const LEGACY_KEY       = 'fba_saved_products';
const LEGACY_CACHE_KEY = 'fba_analyze_cache_v1';

// Merge local + cloud by updatedAt — never silently drops data.
function mergeVault(local: VaultEntry[], cloud: VaultEntry[]): VaultEntry[] {
  const map = new Map<string, VaultEntry>();
  for (const e of local) map.set(e.asin, e);
  for (const e of cloud) {
    const existing = map.get(e.asin);
    if (!existing || new Date(e.updatedAt) >= new Date(existing.updatedAt)) {
      map.set(e.asin, e);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

function syncEntry(userId: string, entry: VaultEntry) {
  pushVaultEntry(userId, entry);
}

export function useVault() {
  const [entries, setEntries] = useState<VaultEntry[]>([]);
  const [vaultLoaded, setVaultLoaded] = useState(false);
  const userIdRef = useRef<string | null>(null);

  // Mirror of `entries` for mutators to read synchronously. Lets us compute the
  // next state and run side effects (storage + cloud sync) exactly once, outside
  // the setState updater — updaters must stay pure or they double-fire under
  // StrictMode / concurrent rendering and duplicate network writes.
  const entriesRef = useRef<VaultEntry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);

  function commit(next: VaultEntry[]) {
    entriesRef.current = next;
    setEntries(next);
    AsyncStorage.setItem(VAULT_KEY, JSON.stringify(next));
  }

  // Keep userIdRef current via auth state listener — fires immediately with existing session
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      userIdRef.current = session?.user.id ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        // Fast path: render from local cache immediately
        const raw = await AsyncStorage.getItem(VAULT_KEY);
        const local: VaultEntry[] = raw ? JSON.parse(raw) : [];
        if (local.length > 0) setEntries(local);
        setVaultLoaded(true);

        // Then merge from cloud if signed in
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const cloud = await pullVault(session.user.id);
          const merged = mergeVault(local, cloud);
          // Only update state + storage if merged differs from local
          if (merged.length !== local.length || cloud.some(c => {
            const l = local.find(e => e.asin === c.asin);
            return !l || new Date(c.updatedAt) > new Date(l.updatedAt);
          })) {
            setEntries(merged);
            await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(merged));
          }
          return;
        }

        if (raw) return;

        // Migrate from legacy storage on first run
        const [legacyRaw, cacheRaw] = await Promise.all([
          AsyncStorage.getItem(LEGACY_KEY),
          AsyncStorage.getItem(LEGACY_CACHE_KEY),
        ]);
        if (!legacyRaw) return;
        const legacyProducts: Product[] = JSON.parse(legacyRaw);
        const cache: Record<string, AnalysisSnapshot> = cacheRaw ? JSON.parse(cacheRaw) : {};
        const now = new Date().toISOString();
        const migrated: VaultEntry[] = legacyProducts.map(p => ({
          asin: p.asin,
          product: p,
          analysis: cache[p.asin] ?? null,
          status: 'researching' as VaultStatus,
          note: '',
          marketplace: 'US',
          currency: 'USD',
          savedAt: now,
          updatedAt: now,
        }));
        setEntries(migrated);
        await AsyncStorage.setItem(VAULT_KEY, JSON.stringify(migrated));
      } catch { /* ignore corrupt storage */ }
    })();
  }, []);

  const addEntry = useCallback((
    product: Product,
    analysis: AnalysisSnapshot | null,
    marketplace: string,
    currency: string,
    saveLimit: number = 9999,
  ): { success: boolean; reason?: string } => {
    const prev = entriesRef.current;
    const now = new Date().toISOString();
    const isUpdate = prev.some(e => e.asin === product.asin);
    // Enforce save limit only for new entries, not updates to existing ones
    if (!isUpdate && prev.length >= saveLimit) {
      return { success: false, reason: 'save_limit_reached' };
    }
    let entry: VaultEntry;
    let next: VaultEntry[];
    if (isUpdate) {
      next = prev.map(e =>
        e.asin === product.asin
          ? { ...e, analysis: analysis ?? e.analysis, updatedAt: now }
          : e,
      );
      entry = next.find(e => e.asin === product.asin)!;
    } else {
      entry = { asin: product.asin, product, analysis, status: 'researching', note: '', marketplace, currency, savedAt: now, updatedAt: now };
      next = [entry, ...prev];
    }
    commit(next);
    const uid = userIdRef.current;
    if (uid) syncEntry(uid, entry);
    return { success: true };
  }, []);

  const removeEntry = useCallback((asin: string) => {
    const next = entriesRef.current.filter(e => e.asin !== asin);
    commit(next);
    const uid = userIdRef.current;
    if (uid) deleteVaultEntry(uid, asin);
  }, []);

  const updateStatus = useCallback((asin: string, status: VaultStatus) => {
    const next = entriesRef.current.map(e =>
      e.asin === asin ? { ...e, status, updatedAt: new Date().toISOString() } : e,
    );
    commit(next);
    const updated = next.find(e => e.asin === asin);
    const uid = userIdRef.current;
    if (updated && uid) syncEntry(uid, updated);
  }, []);

  const updateNote = useCallback((asin: string, note: string) => {
    const next = entriesRef.current.map(e =>
      e.asin === asin ? { ...e, note, updatedAt: new Date().toISOString() } : e,
    );
    commit(next);
    const updated = next.find(e => e.asin === asin);
    const uid = userIdRef.current;
    if (updated && uid) syncEntry(uid, updated);
  }, []);

  const updateAnalysis = useCallback((asin: string, analysis: AnalysisSnapshot) => {
    const next = entriesRef.current.map(e =>
      e.asin === asin ? { ...e, analysis, updatedAt: new Date().toISOString() } : e,
    );
    commit(next);
    const updated = next.find(e => e.asin === asin);
    const uid = userIdRef.current;
    if (updated && uid) syncEntry(uid, updated);
  }, []);

  function hasEntry(asin: string) {
    return entries.some(e => e.asin === asin);
  }

  function getEntry(asin: string) {
    return entries.find(e => e.asin === asin) ?? null;
  }

  function exportCSV(): string {
    // Quote + escape, and neutralize spreadsheet formula injection by prefixing
    // any cell that starts with = + - @ (or tab/CR) with a single quote.
    const cell = (raw: unknown): string => {
      let v = raw == null ? '' : String(raw);
      if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
      return `"${v.replace(/"/g, '""')}"`;
    };
    const header = 'Title,ASIN,Verdict,Confidence,Status,Price,Competition,Marketplace,Currency,Saved Date,Note';
    const rows = entries.map(e => [
      cell(e.product.title),
      cell(e.asin),
      cell(e.analysis?.verdict ?? ''),
      cell(e.analysis?.confidence ?? ''),
      cell(e.status),
      cell(e.product.price ?? ''),
      cell(e.product.competition),
      cell(e.marketplace),
      cell(e.currency),
      cell(e.savedAt.slice(0, 10)),
      cell(e.note ?? ''),
    ].join(','));
    return [header, ...rows].join('\n');
  }

  return {
    entries,
    vaultLoaded,
    addEntry,
    removeEntry,
    updateStatus,
    updateNote,
    updateAnalysis,
    hasEntry,
    getEntry,
    exportCSV,
  };
}
