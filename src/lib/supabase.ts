import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL  = 'https://dpokfcobmyxnufuudlkh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRwb2tmY29ibXl4bnVmdXVkbGtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMTQ4MTIsImV4cCI6MjA5Mzc5MDgxMn0.igo1b-0GiO5Lupb0VaXrPr6bKaZ3ada62BxElTHK8MQ';

// SecureStore adapter — same pattern already used in useSubscription
const storage = {
  getItem:    (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.getItem(key)) : SecureStore.getItemAsync(key),
  setItem:    (key: string, value: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.setItem(key, value)) : SecureStore.setItemAsync(key, value),
  removeItem: (key: string) =>
    Platform.OS === 'web' ? Promise.resolve(localStorage.removeItem(key)) : SecureStore.deleteItemAsync(key),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
