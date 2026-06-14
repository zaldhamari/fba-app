import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_DONE_KEY = 'siftly_migration_v1_done';

// Keys that must NOT be renamed — they are read by RevenueCat / subscription hooks
// and renaming would silently break tier detection for existing installs.
const SKIP_KEYS = new Set([
  'fba_tier_v3',
  'fba_usage_v3',
  'fba_device_id',
  'fba_launch_pack_v1',
]);

// Maps old fba_* keys → new siftly_* keys (data-only, never subscription state).
const MIGRATION_MAP: Record<string, string> = {
  'fba_saved_products':           'siftly_saved_products_v1',
  'fba_analyze_usage_v1':         'siftly_analyze_usage_v1',
  'fba_analyze_cache_v1':         'siftly_analyze_cache_v1',
  'fba_recent_market_v1':         'siftly_recent_market_v1',
  'fba_recent_lookup_v1':         'siftly_recent_lookup_v1',
  'fba_recent_supplier_v1':       'siftly_recent_supplier_v1',
  'fba_saved_calculations_v1':    'siftly_saved_calculations_v1',
  'fba_launch_checklist':         'siftly_launch_checklist_v1',
  'fba_feasibility_product_v1':   'siftly_feasibility_product_v1',
  'fba_feasibility_supplier_v1':  'siftly_feasibility_supplier_v1',
  'fba_saved_feasibility_v1':     'siftly_saved_feasibility_v1',
  'fba_currency_v1':              'siftly_currency_v1',
  'fba_marketplace_v1':           'siftly_marketplace_v1',
  'fba_fx_rates_v1':              'siftly_fx_rates_v1',
  'fba_fx_ts_v1':                 'siftly_fx_ts_v1',
  'fba_onboarding_v3':            'siftly_onboarding_v1',
};

export async function runStorageMigration(): Promise<void> {
  try {
    const done = await AsyncStorage.getItem(MIGRATION_DONE_KEY);
    if (done === 'true') return;

    const entries = await AsyncStorage.multiGet(Object.keys(MIGRATION_MAP));
    const writes: [string, string][] = [];

    for (const [oldKey, value] of entries) {
      if (!value) continue;
      if (SKIP_KEYS.has(oldKey)) continue;
      const newKey = MIGRATION_MAP[oldKey];
      if (!newKey) continue;

      // Only copy if new key not already populated (don't overwrite fresh installs).
      const existing = await AsyncStorage.getItem(newKey);
      if (!existing) {
        writes.push([newKey, value]);
      }
    }

    if (writes.length > 0) {
      await AsyncStorage.multiSet(writes);
    }

    await AsyncStorage.setItem(MIGRATION_DONE_KEY, 'true');

    if (__DEV__) {
      console.log(`[StorageMigration] Migrated ${writes.length} keys`);
    }
  } catch (err) {
    if (__DEV__) console.warn('[StorageMigration] Error:', err);
  }
}
