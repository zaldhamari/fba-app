# Siftly — App Store Readiness

Pre-submission checklist for App Store (iOS) and Google Play (Android).

---

## App Store (iOS)

### Metadata
- [ ] App name: "Siftly" (15 chars or fewer — App Store limit: 30)
- [ ] Subtitle: clear value prop, ≤30 chars
- [ ] Description: 4000 chars max, no markdown, no competitor names
- [ ] Keywords: 100 chars, comma-separated, no spaces after commas
- [ ] Privacy Policy URL: hosted and accessible
- [ ] Support URL: accessible
- [ ] App category: Business or Shopping

### Screenshots
- [ ] 6.9" iPhone screenshots (required): 1290×2796px
- [ ] 6.5" iPhone screenshots: 1242×2688px
- [ ] iPad Pro 12.9" screenshots (if iPad-compatible)
- [ ] Screenshots show core value: niche search → product → supplier → costs → launch
- [ ] No placeholder or mock data visible in screenshots

### App Review
- [ ] Demo account credentials provided (reviewer account): `demo@siftly.app`
- [ ] App works without location permission
- [ ] No web scraping of competitor apps or Amazon violations
- [ ] In-app purchases configured in App Store Connect and match RevenueCat products
- [ ] Restore purchases button present in Paywall (required by App Store guidelines)
- [ ] Subscription terms clearly disclosed before purchase (price, duration, renewal)
- [ ] Subscription management deep-links to iOS Settings

### Technical
- [ ] Minimum iOS version set correctly in `app.json` (≥15.1 recommended)
- [ ] Entitlements file correct for in-app purchases
- [ ] Privacy manifest (`PrivacyInfo.xcprivacy`) lists all API usage reasons
- [ ] No `UIWebView` usage
- [ ] No deprecated APIs flagged by Xcode

---

## Google Play (Android)

### Metadata
- [ ] App title: "Siftly" (50 chars max)
- [ ] Short description: ≤80 chars
- [ ] Full description: ≤4000 chars
- [ ] Privacy Policy URL matches App Store URL

### Screenshots & Assets
- [ ] Phone screenshots: 1080×1920px minimum, up to 8
- [ ] Feature graphic: 1024×500px
- [ ] App icon: 512×512px PNG (no alpha)

### Billing
- [ ] Google Play Billing Library integrated via RevenueCat
- [ ] All subscription SKUs published in Google Play Console
- [ ] Subscription acknowledgement handled (RevenueCat handles this)

### Policy Compliance
- [ ] No collection of sensitive user data beyond what's declared
- [ ] Data Safety form completed in Play Console
- [ ] Target API level ≥ 34 (Android 14) — required from Aug 2024

---

## Shared Pre-Submission

- [ ] All Beta Checklist items complete (see `BETA_CHECKLIST.md`)
- [ ] Version number and build number incremented from last release
- [ ] `EXPO_PUBLIC_DEV_BYPASS=false` confirmed in EAS production profile
- [ ] Sentry release linked to this version (`release: appVersion`)
- [ ] No debug logs exposed to users
- [ ] EULA / Terms of Service in-app (Legal screen) up to date
- [ ] Crash-free rate ≥ 99% on TestFlight / Internal track before promoting

---

## RevenueCat Pre-Submission

- [ ] Production app user IDs linked (not sandbox)
- [ ] Entitlements map correctly: explorer / builder / operator
- [ ] Webhook configured for subscription events (if using Supabase sync)
- [ ] Pricing matches what was approved in App Store Connect / Play Console

---

## Launch Sequence

1. Submit to TestFlight → 5 external testers → 48hr feedback window
2. Fix P0/P1 bugs from feedback
3. Submit to App Store Review (expect 1–3 business days)
4. Soft launch: US only, monitor Sentry for crash spikes
5. Expand to CA, UK, AU after 7-day stability window
