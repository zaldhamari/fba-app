# Siftly — Pre-TestFlight Checklist

One pass through this and you're ready to upload. Items are ordered; check them off top to bottom.
Anything marked **[you only]** can't be done from a sandbox — it needs your machine, device, or accounts.

---

## 1. Code config (do before building)

- [ ] **Replace Sentry placeholders** in `app.json` — swap `REPLACE_WITH_YOUR_SENTRY_ORG_SLUG` and
      `REPLACE_WITH_YOUR_SENTRY_PROJECT_SLUG` for your real org/project. Set `SENTRY_AUTH_TOKEN`
      in your build env so source maps upload (otherwise crash reports won't symbolicate). **[you only]**
- [ ] **Set `EXPO_PUBLIC_SENTRY_DSN`** in the production build env (EAS secret).
- [ ] **Install the native polish** (one rebuild, which you're doing anyway):
      `npx expo install expo-haptics expo-image` — then ping me to wire haptics into the DS buttons
      and swap the product `<Image>`s to `expo-image` (caching + placeholders). **[you only to install]**
- [ ] **Bump `ios.buildNumber`** in `app.json` for each new upload (starts at 1).

## 2. Verify the build is clean

- [ ] `npm run check` — must pass (tsc + lint + 49 tests). Green = logic, types, and hex guardrail OK.
- [ ] Confirm `EXPO_PUBLIC_DEV_BYPASS=false` in the **production** EAS profile (already set — just confirm).
- [ ] Confirm no dev-only unlock ships: the runtime dev unlock is `__DEV__`-gated, so it's inert in
      release builds — no action, just be aware.

## 3. Backend (apply before the build talks to prod)

- [ ] Apply migration **`0001`** (adds the `increment_keepa_free_usage(text, date)` overload + grants) to Supabase.
- [ ] Deploy the updated `fba-assistant` backend.
- [ ] After it's healthy, apply migration **`0002`** (drops the old single-arg function).
- [ ] Sanity-check the free-allowance endpoint returns `limit: 5` and `resets_on` = first of next month (UTC).

## 4. On-device smoke test (the part that certifies the 9) **[you only]**

Money path — test on a real device with a TestFlight/dev build:

- [ ] **Spike trap:** search "garlic press" → Analyze → amber "⚠ Possible one-time spike" warning shows
      **above** the verdict card.
- [ ] **Free gate:** as an explorer account, confirm the allowance bar reads "N of 5 free lookups used
      this month" and increments on each real-ASIN Analyze.
- [ ] **Paywall at N+1:** on the 6th lookup, paywall slides up with "You've used all your free product
      lookups this month." and "Your free lookups reset on **Jul 1**." (formatted, not raw ISO).
- [ ] **Dismiss:** "Maybe later" closes the paywall; search results + selected product survive.
- [ ] **Paid hides bar:** switch to a builder/operator account → allowance bar gone.
- [ ] **Purchases (sandbox):** buy a plan via RevenueCat sandbox → tier unlocks, usage resets. Then
      "Restore purchases" on a fresh install restores the tier.
- [ ] **Vault:** save a product, change status, add a note, delete — confirm it persists and syncs
      (this exercises the H2 state-updater fix; watch that usage counts don't double-increment).
- [ ] **Export CSV** (operator) opens cleanly in Excel/Sheets with no formula-injection weirdness.
- [ ] **Account deletion** and **Manage Subscription** links both work (Apple requires these).
- [ ] **Cold launch** 5×: no crashes; Sentry receives a test event.

## 5. Accessibility spot-check **[you only]**

- [ ] Turn on **VoiceOver** (iOS) and tab through Home → Research → Profit. Header buttons, tab bar,
      currency selector, product images, and verdict cards should all announce meaningfully.
      (Global chrome + Research flow are done; deeper screens still have some unlabeled text buttons —
      not blockers, screen readers read their visible text.)

## 6. App Store Connect **[you only]**

- [ ] Complete the **Privacy questionnaire** — declare email (account) + usage analytics + the data
      Sentry/RevenueCat/Supabase collect. (App-level `PrivacyInfo.xcprivacy` is already correct.)
- [ ] App name, subtitle, screenshots (6.7" + 6.5" required), description, keywords, support URL,
      privacy-policy URL (you have a Legal screen — make sure the hosted URL matches).
- [ ] Set the **subscription products** in App Store Connect to match RevenueCat (Builder/Operator,
      monthly + annual) and confirm pricing.
- [ ] Encryption: `ITSAppUsesNonExemptEncryption=false` is already set — no export-compliance prompt.

## 7. Build & upload

- [ ] `eas build -p ios --profile production`
- [ ] `eas submit -p ios --latest` (or upload the `.ipa` via Transporter).
- [ ] Add internal testers in TestFlight, ship the build, watch Sentry for the first session.

---

### Still open from this session (track separately)
- Native haptics + `expo-image` wiring (after you run the install in step 1).
- List virtualization for Research/Vault (perf with large result sets) — needs device verification.
- 168 off-palette colors → DS tokens or new tokens (design decision, not a blocker).
- Deeper-screen accessibility labels (text buttons; low priority).

### Health snapshot at handoff
`tsc` clean · `npm test` 49/49 · raw-hex lint baseline 168 (was 328) · money-path bugs fixed & logic-verified.
