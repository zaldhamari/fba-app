export const STORAGE_KEYS = {
  // Subscription / usage
  tier:                'fba_tier_v3',
  usage:               'fba_usage_v3',
  onboardingDone:      'fba_onboarding_v3',
  deviceId:            'fba_device_id',
  launchPackPurchased: 'fba_launch_pack_v1',

  // Currency / marketplace
  currency:    'fba_currency_v1',
  marketplace: 'fba_marketplace_v1',
  fxRates:     'fba_fx_rates_v1',
  fxRatesTs:   'fba_fx_ts_v1',

  // Research
  savedProducts:  'fba_saved_products',
  analyzeUsage:   'fba_analyze_usage_v1',
  analyzeCache:   'fba_analyze_cache_v1',

  // Saved calculations (Profit Lab)
  savedCalculations: 'fba_saved_calculations_v1',

  // Co-Pilot
  journey: 'fba_journey_v5',

  // Launch checklist
  launchChecklist: 'fba_launch_checklist',
} as const;
