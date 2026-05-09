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
  const missing = CHECKS.filter(c => isEmpty(process.env[c.key]));
  if (missing.length === 0) return;

  const lines = missing.map(c => `  • ${c.label} (${c.key})\n    → ${c.hint}`);
  console.warn(
    `[Config] ${missing.length} env var(s) not set — some features will be disabled:\n` +
    lines.join('\n'),
  );
}
