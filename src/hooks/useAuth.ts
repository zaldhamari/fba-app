import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

// If getSession() hangs (expired token + no network), unblock Splash after this delay.
const SESSION_TIMEOUT_MS = 5_000;

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timeoutId = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, SESSION_TIMEOUT_MS);

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!cancelled) setSession(session);
      })
      .catch(() => {})
      .finally(() => {
        clearTimeout(timeoutId);
        if (!cancelled) setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setSession(session);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export const authActions = {
  signUp: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),

  signIn: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signOut: () =>
    supabase.auth.signOut(),

  resetPassword: (email: string) =>
    supabase.auth.resetPasswordForEmail(email),

  resendVerification: (email: string) =>
    supabase.auth.resend({ type: 'signup', email }),

  deleteAccount: async () => {
    const { error } = await supabase.rpc('delete_user');
    // supabase.rpc returns { data, error } — it does not throw on Postgres errors.
    // Re-throw so AppHeader's catch block can surface the message to the user.
    if (error) throw new Error(error.message ?? 'Account deletion failed on the server.');
  },

  // OAuth uses the app's registered URL scheme (siftly://) so iOS/Android
  // redirect back after browser auth. The deep link is processed in App.tsx
  // via Linking + supabase.auth.exchangeCodeForSession().
  // Supabase dashboard must allow: siftly://auth/callback in Redirect URLs.
  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'siftly://auth/callback', skipBrowserRedirect: true },
    }),

  signInWithApple: () =>
    supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: 'siftly://auth/callback', skipBrowserRedirect: true },
    }),

};
