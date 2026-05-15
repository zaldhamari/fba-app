import { useState, useEffect } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthState {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
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

  deleteAccount: () =>
    supabase.rpc('delete_user'),

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
