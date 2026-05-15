const CHECKS = [
  {
    key: 'EXPO_PUBLIC_API_KEY',
    label: 'Railway API key',
    hint: 'Railway dashboard → your service → Variables → API_KEY',
  },
  {
    key: 'EXPO_PUBLIC_RC_KEY_IOS',
    label: 'RevenueCat iOS key',
    hint: 'RevenueCat dashboard → Apps → iOS app → Public API key',
  },
  {
    key: 'EXPO_PUBLIC_RC_KEY_ANDROID',
    label: 'RevenueCat Android key',
    hint: 'RevenueCat dashboard → Apps → Android app → Public API key',
  },
  {
    key: 'EXPO_PUBLIC_SENTRY_DSN',
    label: 'Sentry DSN',
    hint: 'sentry.io → Project → Settings → Client Keys (DSN)',
  },
] as const;

function isEmpty(val: string | undefined): boolean {
  if (!val) return true;
  return val.startsWith('REPLACE_WITH') || val === '';
}

export function validateConfig(): void {
  // DEV_BYPASS must never be true in a production build.
  // Note: eas.json production profile hardcodes this to "false", so this check
  // mainly catches local dev runs and CI misconfiguration. We log but never throw
  // because dev/preview EAS profiles legitimately run with __DEV__=false + bypass=true.
  if (process.env.EXPO_PUBLIC_DEV_BYPASS === 'true') {
    const msg =
      '[Config] WARNING: EXPO_PUBLIC_DEV_BYPASS=true — all paywalls bypassed. ' +
      'Set it to false before shipping to the App Store.';
    console.warn(msg);
  }

  const missing = CHECKS.filter(c => isEmpty(process.env[c.key]));
  if (missing.length === 0) return;

  if (__DEV__) {
    const lines = missing.map(c => `  • ${c.label} (${c.key})\n    → ${c.hint}`);
    console.warn(
      `[Config] ${missing.length} env var(s) not set — some features will be disabled:\n` +
      lines.join('\n'),
    );
  }
}
