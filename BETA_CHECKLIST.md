# Siftly Beta Checklist

Use this before every TestFlight / internal beta build.

---

## 1. Security & Config

- [ ] `EXPO_PUBLIC_DEV_BYPASS=false` in `.env` (and EAS secrets)
- [ ] `EXPO_PUBLIC_API_KEY` is the production Railway key (not a dev key)
- [ ] Backend rate limiting is active (verify in Railway logs)
- [ ] Supabase JWT validation is enforced on authenticated routes
- [ ] Sentry DSN is set and `debug: false` for production builds
- [ ] No hardcoded secrets or API keys in source files (`grep -r "sk-" src/`)

---

## 2. Subscription & Paywalls

- [ ] RevenueCat sandbox mode OFF for production builds
- [ ] All three tiers restore correctly after uninstall + reinstall
- [ ] Paywall appears when quota is exhausted (test with explorer tier)
- [ ] Upgrade flow completes and tier upgrades in-app without restart
- [ ] Explorer quota limits enforced (3 research, 1 supplier, 1 brand)
- [ ] Launch Pack gating works (features behind `launchPackPurchased`)

---

## 3. Pipeline State

- [ ] All 5 pipeline stages persist across app restarts (AsyncStorage)
- [ ] `completedStages` array updates correctly after each stage
- [ ] `clearPipeline` Alert fires before clearing
- [ ] LaunchDecisionScreen score reflects current pipeline state
- [ ] Pipeline banner shows on CopilotScreen when data exists

---

## 4. Financial Engine

- [ ] `buildCostModel` outputs correct `netProfit`, `marginPct`, `roiPct`
- [ ] Landed cost = unitCost + freightPerUnit (not including Amazon fees)
- [ ] Net profit = sellingPrice × 0.70 - landedCost (after both fee types)
- [ ] Score thresholds: AVOID <40, HOLD 40+, TEST 60+, LAUNCH 80+
- [ ] Referral fee (15%) and FBA fee (15%) are applied in all calculations

---

## 5. Core Screens

- [ ] NicheResearchScreen: search returns results, keyword metrics populate
- [ ] ResearchWorkspaceScreen: ASIN lookup, Amazon search, and market mode all work
- [ ] SourcingLogisticsScreen: empty state shows when no product selected
- [ ] SourcingLogisticsScreen: supplier quote comparison table renders
- [ ] BrandStudioScreen: label workspace disclaimer visible
- [ ] LaunchDecisionScreen: action buttons navigate to correct tabs
- [ ] CopilotScreen: PipelineContextBanner shows when pipeline has data
- [ ] FBAGlossaryModal: opens, filters by category, search works

---

## 6. Storage Migration

- [ ] `siftly_migration_v1_done` key exists after first launch
- [ ] Subscription keys (`fba_tier_v3`, `fba_usage_v3`) are untouched
- [ ] Old data (saved products, calculations) accessible in new `siftly_*` keys

---

## 7. Analytics

- [ ] `siftly_analytics_v1` key populated after funnel events
- [ ] `track()` calls do not throw or block UI thread
- [ ] Events include: niche_selected, product_selected, supplier_selected, cost_model_built, brand_data_saved

---

## 8. UI & Design

- [ ] No raw hex colors in any screen (all DS tokens)
- [ ] Dark mode: no invisible text (check DS.bgCanvas vs DS.textPrimary contrast)
- [ ] All modals close correctly (no stuck modals)
- [ ] Quota bars render and disappear for operator tier (unlimited)
- [ ] All `TouchableOpacity` elements have `hitSlop` or minimum 44px touch target

---

## 9. Error Handling

- [ ] API failures show user-facing error messages (not raw JSON)
- [ ] Network offline: screens degrade gracefully (no crashes)
- [ ] Sentry capturing errors in production build (verify in dashboard)
- [ ] ErrorBoundary wraps all stack screens

---

## 10. Build

- [ ] `npx tsc --noEmit` exits with 0 errors
- [ ] No `console.error` or unhandled promise rejections in Metro logs
- [ ] EAS build completes without warnings about missing native modules
- [ ] iOS: tested on iPhone 14 (small) and iPhone 16 Pro Max (large)
- [ ] Android: tested on Pixel 6 equivalent (API 33+)
