import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL  = 'https://dpokfcobmyxnufuudlkh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb2tmY29ibXl4bnVmdXVkbGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMTQ4MTIsImV4cCI6MjA5Mzc5MDgxMn0.igo1b-0GiO5Lupb0VaXrPr6bKaZ3ada62BxElTHK8MQ';

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
