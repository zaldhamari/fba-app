export const STORAGE_KEYS = {
  // Subscription / usage
  // NOTE: fba_tier_v3 and fba_tier_verified_at_v1 live in SecureStore, not AsyncStorage.
  // They are managed exclusively by useSubscription.ts and cleared via SecureStore.deleteItemAsync.
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
  savedProducts:          'fba_saved_products',
  analyzeUsage:           'fba_analyze_usage_v1',
  analyzeCache:           'fba_analyze_cache_v1',
  recentMarketSearches:   'fba_recent_market_v1',
  recentLookupSearches:   'fba_recent_lookup_v1',
  recentSupplierSearches: 'fba_recent_supplier_v1',

  // Saved calculations (Profit Lab)
  savedCalculations: 'fba_saved_calculations_v1',

  // Launch checklist
  launchChecklist: 'fba_launch_checklist',

  // Feasibility Check
  feasibilityProduct:  'fba_feasibility_product_v1',
  feasibilitySupplier: 'fba_feasibility_supplier_v1',
  savedFeasibility:    'fba_saved_feasibility_v1',

  // SEO Keywords
  savedKeywords: 'siftly_saved_keywords_v1',

  // Freight Company Search
  freightSelection: 'siftly_freight_selection_v1',

  // Review Intelligence
  reviewIntelligence: 'siftly_review_intelligence_v1',

  // Feasibility Report tags
  feasibilityTags: 'siftly_feasibility_tags_v1',

  // Launch Advisor snapshot (persisted decision for home screen)
  launchAdvisorSnapshot: 'siftly_launch_advisor_snapshot_v1',

  // Brand Studio generated asset history
  brandHistory: 'siftly_brand_history_v1',

  // Seller profile (drives research defaults)
  sellerProfile: 'siftly_seller_profile_v1',

  // Saved research searches
  savedSearches: 'siftly_saved_searches_v1',

  // Builder Mode pipeline sessions
  builderSessions: 'siftly_builder_sessions_v1',

  // Winner Vault (published completed builds)
  winnerVault: 'siftly_winner_vault_v1',

  // Dynamic sourcing tasks injected into Launch Plan
  sourcingTasks: 'siftly_sourcing_tasks_v1',
} as const;
