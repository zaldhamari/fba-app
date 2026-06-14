import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL  = process.env.EXPO_PUBLIC_SUPABASE_URL  ?? '';
const SUPABASE_ANON = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// SecureStore adapter with graceful fallback for locked-device Keychain errors.
// iOS throws "User interaction is not allowed" when the app is launched from a
// background context (e.g. notification tap on lock screen) before first unlock.
// Returning null from getItem lets Supabase treat it as "no session" and
// re-establish auth once the device is unlocked — safe and correct behaviour.
const storage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return localStorage.getItem(key);
    try { return await SecureStore.getItemAsync(key); } catch { return null; }
  },
  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.setItem(key, value); return; }
    try { await SecureStore.setItemAsync(key, value); } catch { /* keychain unavailable — skip */ }
  },
  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') { localStorage.removeItem(key); return; }
    try { await SecureStore.deleteItemAsync(key); } catch { /* keychain unavailable — skip */ }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});
