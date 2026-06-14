// ─── Environment Variable Audit ───────────────────────────────────────────────
//
// EXPO_PUBLIC_* variables are compiled into the JS bundle and are readable by
// anyone who extracts the app binary. Classify every variable here so the risk
// is explicit and documented.
//
// SAFE TO EXPOSE (designed to be public):
//   EXPO_PUBLIC_RC_KEY_IOS      — RevenueCat public key (client-only)
//   EXPO_PUBLIC_RC_KEY_ANDROID  — RevenueCat public key (client-only)
//   EXPO_PUBLIC_SENTRY_DSN      — Sentry DSN (designed for client bundles)
//
// REQUIRES BACKEND PROTECTION (shared secret — not a per-user token):
//   EXPO_PUBLIC_API_KEY         — Railway gateway key. The backend MUST enforce:
//                                 1. Rate limiting per IP / per user
//                                 2. Supabase JWT validation on authenticated routes
//                                 3. Usage quotas to prevent abuse
//                                 A shared key alone is not sufficient security.
//
// MUST NEVER BE TRUE IN PRODUCTION:
//   EXPO_PUBLIC_DEV_BYPASS      — Disables all paywalls. Set false before any build
//                                 shipped to users (TestFlight, App Store, Play Store).

const REQUIRED_VARS = [
  {
    key:   'EXPO_PUBLIC_SUPABASE_URL',
    label: 'Supabase project URL',
    hint:  'Supabase dashboard → Project → Settings → API → Project URL',
  },
  {
    key:   'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    label: 'Supabase anon key',
    hint:  'Supabase dashboard → Project → Settings → API → Project API keys → anon/public',
  },
  {
    key:   'EXPO_PUBLIC_API_KEY',
    label: 'Railway API key',
    hint:  'Railway dashboard → your service → Variables → API_KEY',
  },
  {
    key:   'EXPO_PUBLIC_RC_KEY_IOS',
    label: 'RevenueCat iOS key',
    hint:  'RevenueCat dashboard → Apps → iOS app → Public API key',
  },
  {
    key:   'EXPO_PUBLIC_RC_KEY_ANDROID',
    label: 'RevenueCat Android key',
    hint:  'RevenueCat dashboard → Apps → Android app → Public API key',
  },
  {
    key:   'EXPO_PUBLIC_SENTRY_DSN',
    label: 'Sentry DSN',
    hint:  'sentry.io → Project → Settings → Client Keys (DSN)',
  },
] as const;

function isEmpty(val: string | undefined): boolean {
  return !val || val.startsWith('REPLACE_WITH') || val === '';
}

export function validateConfig(): void {
  const bypassEnabled = process.env.EXPO_PUBLIC_DEV_BYPASS === 'true';

  if (bypassEnabled) {
    const severity = __DEV__ ? 'warn' : 'error';
    const msg =
      '[Siftly] SECURITY: EXPO_PUBLIC_DEV_BYPASS=true — all paywalls bypassed and tier forced to Operator. ' +
      'This MUST be false in any build shipped to users. ' +
      'If this appears in a production bundle, 100% of subscription revenue is lost.';

    if (severity === 'error') {
      // Not __DEV__ and bypass is on — this is a misconfigured production build.
      // Log loudly but do not throw (throwing would crash on-device with no
      // recovery path). Sentry will capture the console.error automatically.
      console.error(msg);
    } else {
      console.warn(msg);
    }
  }

  const missing = REQUIRED_VARS.filter(c => isEmpty(process.env[c.key]));
  if (missing.length === 0) {
    if (__DEV__) {
      const mode = bypassEnabled ? 'DEV (bypass ON)' : 'DEV';
      console.log(`[Siftly] Env OK — mode: ${mode}`);
    }
    return;
  }

  if (__DEV__) {
    const lines = missing.map(c => `  • ${c.label} (${c.key})\n    → ${c.hint}`);
    console.warn(
      `[Siftly] ${missing.length} env var(s) missing — some features will be disabled:\n` +
      lines.join('\n'),
    );
  }
}

// ── Runtime bypass flag ────────────────────────────────────────────────────────
// Use this instead of reading the env var directly in screens, so there is one
// canonical place to override the behaviour in tests.

export const DEV_BYPASS_ENABLED = process.env.EXPO_PUBLIC_DEV_BYPASS === 'true';
