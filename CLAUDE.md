# Siftly — Claude Code Working Guide

## What this app is
Amazon FBA product research and launch assistant. Users scan products, run profit calculations, get AI-powered feasibility analysis, manage a vault of winning products, and get launch advice. iOS + Android (React Native with Expo).

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Expo SDK 55, React Native 0.83 |
| Language | TypeScript |
| Navigation | React Navigation (Stack + Bottom Tabs) — NOT Expo Router |
| State | React Context + custom hooks (no Zustand) |
| Backend | Railway — `https://fba-backend-production-6c44.up.railway.app/api` |
| Auth + DB | Supabase (`src/lib/supabase.ts`) |
| Subscriptions | RevenueCat (`src/lib/revenuecat.ts`) |
| AI | Claude API via backend (not called directly from app) |
| Error tracking | Sentry |
| Both platforms | iOS + Android |

---

## Project Structure

```
App.tsx                 Entry — providers, Sentry, RevenueCat init
src/
  screens/              One file per screen
    research/           Research workspace sub-components
  components/           Shared UI
    ds/                 DS components (AppCard, Buttons, EmptyState, etc.)
  navigation/
    RootNavigator.tsx   Auth gate → TabNavigator or AuthScreen
    TabNavigator.tsx    Bottom tabs (Copilot, Research, Profit, Brand, LaunchPad)
  hooks/                useAuth, useSubscription, useVault, useBuilderSession, etc.
  lib/                  Supabase, RevenueCat, feasibility logic, risk assessment
  services/
    api.ts              All backend calls (POST to Railway)
    sync.ts             Supabase sync
  theme/
    ds.ts               DS tokens (DS object — single source of truth)
    colors.ts           Legacy colors (backward compat only)
    shadows.ts          Shadow presets
    spacing.ts          Spacing scale
    typography.ts       Font definitions
  types/                TypeScript types per domain
  context/              CurrencyContext, ActiveProductContext
  data/                 Static data (freight companies, launch phases)
  utils/                seoEnrichment, shippingCalcs
  constants/            storage keys, marketplace profiles, legal content
```

---

## Tabs (Bottom Navigation)

| Tab | Screen | Purpose |
|---|---|---|
| Copilot | CopilotScreen | AI chat assistant |
| Research | ResearchWorkspaceScreen | Product search + analysis |
| Profit | ProfitLabScreen | FBA profit calculator |
| Brand | BrandStudioScreen | Brand name / logo tools |
| LaunchPad | BuilderScreen | Launch plan builder |

---

## Design System — always use DS tokens from `src/theme/ds.ts`

```ts
import { DS } from '../theme/ds';
// or for individual tokens:
import { DS_ACCENT, DS_BG_CANVAS, DS_TEXT_PRIMARY } from '../theme/ds';
```

### Key tokens
| Purpose | Token | Value |
|---|---|---|
| App background | `DS.bgCanvas` | #F5F7FF |
| Card background | `DS.bgCard` | #FFFFFF |
| Elevated bg | `DS.bgElevated` | #EEF2FA |
| Primary brand | `DS.accent` | #2563EB (blue) |
| Primary text | `DS.textPrimary` | #0D1B4B |
| Secondary text | `DS.textSecondary` | #5C6B8A |
| Muted text | `DS.textMuted` | #8196B0 |
| Border | `DS.border` | #E6ECFF |
| Success | `DS.success` | #10B981 |
| Warning | `DS.warning` | #F59E0B |
| Danger | `DS.danger` | #EF4444 |
| Gold/premium | `DS.gold` | #B45309 |

### Radius tokens (use these, not hardcoded numbers)
```ts
DS.radiusCard   = 24
DS.radiusHero   = 28
DS.radiusButton = 14
DS.radiusInput  = 14
DS.radiusChip   = 8
DS.radiusBadge  = 999
```

### Spacing tokens
```ts
DS.pagePadding = 20
DS.cardPadding = 20
DS.sectionGap  = 20
DS.cardGap     = 12
DS.rowGap      = 8
```

### Shadows — import from `src/theme/shadows.ts`
```ts
import { Shadows } from '../theme/shadows';
style={[styles.card, Shadows.card]}
```

---

## API pattern — all backend calls go through `src/services/api.ts`

```ts
// Never call fetch directly from screens — use api.ts functions
import { analyzeProduct, searchProducts } from '../services/api';
```

Backend is Railway. API key is `EXPO_PUBLIC_API_KEY` env var.

---

## Auth pattern
```ts
import { useAuth } from '../hooks/useAuth';
const { user, signIn, signOut } = useAuth();
```
Auth state gates the entire app in `RootNavigator.tsx`.

---

## Subscription / paywall pattern
```ts
import { useSubscription } from '../hooks/useSubscription';
const { isPro, offerings } = useSubscription();
```
Show `PaywallModal` for gated features. Never hardcode access control.

---

## Navigation pattern (React Navigation — NOT Expo Router)
```ts
import { useNavigation } from '@react-navigation/native';
const navigation = useNavigation();
navigation.navigate('FeasibilityReport', { productId });
navigation.goBack();
```

---

## DS Components — use from `src/components/ds/`
AppCard, Buttons, EmptyState, InputField, LoadingSkeleton, MetricCard, SectionHeader, StatusBadge

---

## Rules — follow exactly

1. **No raw hex colors** — always use DS tokens
2. **No raw numbers for radius/spacing** — use DS tokens
3. **No comments** unless the WHY is non-obvious
4. **No Expo Router** — this app uses React Navigation
5. **No direct fetch calls from screens** — use `src/services/api.ts`
6. **No new abstractions** unless the task explicitly requires it
7. **No features beyond the task**
8. **Wrap new screens in ErrorBoundary** when adding to navigator

---

## What NOT to do
- Don't use Expo Router (this is React Navigation)
- Don't call the Railway API directly from screens — go through `api.ts`
- Don't use raw colors — DS tokens only
- Don't use hardcoded radius/spacing numbers — DS tokens
- Don't add platform-specific code without wrapping in `Platform.select`
