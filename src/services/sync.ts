/**
 * Fire-and-forget cloud sync.
 * All functions are safe to call without await — errors are swallowed so they
 * never block or crash the local-first flow.
 */
import { supabase } from '../lib/supabase';
import { VaultEntry } from '../types/vault';
import { UsageData } from '../hooks/useSubscription';

// ─── Vault ────────────────────────────────────────────────────────────────────

export async function pushVaultEntry(userId: string, entry: VaultEntry) {
  try {
    await supabase.from('vault').upsert({
      user_id:    userId,
      asin:       entry.asin,
      data:       entry,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,asin' });
  } catch {}
}

export async function deleteVaultEntry(userId: string, asin: string) {
  try {
    await supabase.from('vault').delete().match({ user_id: userId, asin });
  } catch {}
}

export async function pullVault(userId: string): Promise<VaultEntry[]> {
  try {
    const { data, error } = await supabase
      .from('vault')
      .select('data')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
    if (error || !data) return [];
    return data.map((row: { data: VaultEntry }) => row.data);
  } catch {
    return [];
  }
}

// ─── Journey (Co-Pilot progress) ─────────────────────────────────────────────

export async function pushJourney(userId: string, completedSteps: string[]) {
  try {
    await supabase.from('journey').upsert({
      user_id:         userId,
      completed_steps: completedSteps,
      updated_at:      new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch {}
}

export async function pullJourney(userId: string): Promise<string[]> {
  try {
    const { data, error } = await supabase
      .from('journey')
      .select('completed_steps')
      .eq('user_id', userId)
      .single();
    if (error || !data) return [];
    return data.completed_steps ?? [];
  } catch {
    return [];
  }
}

// ─── Usage counts ─────────────────────────────────────────────────────────────

export async function pushUsage(userId: string, usage: UsageData) {
  try {
    await supabase.from('usage_counts').upsert({
      user_id:    userId,
      data:       usage,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  } catch {}
}

// ─── AI Analysis history ──────────────────────────────────────────────────────

export async function pushAnalysis(userId: string, asin: string, productName: string, data: object) {
  try {
    const { error } = await supabase.from('analyses').upsert(
      { user_id: userId, asin, product_name: productName, data, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,asin' },
    );
    if (error && __DEV__) console.warn('[sync] pushAnalysis failed:', error.code, error.message);
  } catch (e) {
    if (__DEV__) console.warn('[sync] pushAnalysis network error:', e);
  }
}

// ─── Full pull on login ───────────────────────────────────────────────────────

export async function pullAllUserData(userId: string) {
  const [vault, journey] = await Promise.all([
    pullVault(userId),
    pullJourney(userId),
  ]);
  return { vault, journey };
}
