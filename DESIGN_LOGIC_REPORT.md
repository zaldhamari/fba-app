# Design & Logic Report — Profit Lab + Feasibility Check
_Siftly FBA App · Generated 2026-05-12_

---

## 1. What Exists Today

### Profit Lab (`ProfitLabScreen.tsx`)
- 5-tab bottom navigator entry point — the "Calculate" tab
- 9 calculators in a 3×3 tile grid: FBA Profit, Landed Cost, Break-even, PPC/ACoS, Freight, Duties, Reorder Point, ROI, Unit Economics
- All calculations are pure client-side math (no API call)
- Has a "Feasibility Check" banner at the top that navigates to `FeasibilityCheck` stack screen

### Feasibility Check (`CalculatorScreen.tsx`)
- Stack screen — accessible only via the ProfitLab banner
- Originally a 12-mode tab hub (`fees | landed | freight | cashflow | ppc | breakeven | scenario | ranking | reorder | simulate | bsr | feasibility`)
- Only the `feasibility` tab is the intended destination — all other 11 modes are orphaned and unreachable from current navigation
- Feasibility tab has 7 sequential sections: Amazon Product · Supplier · Adjustable Inputs · Financial Summary · Verdict · Risk Assessment · Top Risk Factors · Decision Impact Note · Minimum Launch Capital · Launch Readiness · Launch Decision · Assumptions

---

## 2. Critical Issues

### 2A — Orphaned Calculator Modes in CalculatorScreen
**Problem**: CalculatorScreen has 11 calculator modes (FeesTab, LandedTab, BSRTab, etc.) that are unreachable. There is no tab bar in the navigation — users land on the Feasibility tab with no way to switch to other modes.

**Impact**: Dead code. Creates confusion if ever revisited. The old `FeesTab` also calls the backend API, unlike ProfitLab which is pure client-side, so two divergent fee calculators exist in the codebase.

**Fix options**:
- Strip CalculatorScreen down to Feasibility-only (remove all other tab modes and the tab switching logic)
- Or remove CalculatorScreen entirely and rebuild Feasibility as a clean standalone screen

---

### 2B — Duplicate FBA Fee Logic
**Problem**: Two separate FBA fee systems exist:

| Location | Method | Fee source |
|---|---|---|
| `CalculatorScreen` → `FeesTab` | API call to backend `/api/calculate-fba` | Server-side, up to date |
| `ProfitLabScreen` → `FBAWorkspace` | Client-side math with `US_FEE_TIERS` hardcoded | Hardcoded tiers, static |
| `computeFeasibility()` in `feasibility.ts` | Client-side estimate (15% referral + weight-based FBA est.) | Different formula again |

Three different fee structures = three different profit numbers for the same product.

**Impact**: A user who runs FBA Profit in ProfitLab and then runs Feasibility Check on the same product will get different numbers with no explanation.

**Fix**: Unify fee logic. Either always call the API, or derive a single client-side formula that all three use consistently.

---

### 2C — No Back Button on Feasibility Check Screen
**Problem**: `RootNavigator` registers `FeasibilityCheck` with `headerShown: false` and no gesture config. The screen has no back button in its own UI. Once a user navigates in, they are stranded unless they know to swipe from the left edge (iOS native swipe-back still works, but it's invisible).

**Fix**: Add a back button to the FeasibilityTab render, or enable the header with a custom back button, or add a `gestureEnabled: true` note in the screen options.

---

### 2D — Design Token Split (Old Theme vs DS)
**Problem**: CalculatorScreen imports from the old theme system (`../theme` → `colors`, `spacing`, `radius`) while ProfitLabScreen uses the Siftly DS (`DS.indigo`, `DS.bgCard`, etc.). Inside CalculatorScreen, the FeasibilityTab even uses raw hex strings (`#7C3AED`, `#DC2626`) directly instead of either system.

**Impact**: Visual inconsistency. The Feasibility Check screen looks different from every other screen in the app. Cards, buttons, input fields, and text all use different visual weights.

**Fix**: Migrate CalculatorScreen to use only DS tokens. Replace all `colors.X`, `spacing.X`, `radius.X` and raw hex strings.

---

### 2E — Feasibility Data Flow Is Fragile and Invisible
**Problem**: Feasibility requires:
1. An Amazon product saved from the Research screen
2. A supplier attached from the Suppliers screen

Both are stored in AsyncStorage and loaded on mount. If neither is saved, the user sees two empty-state cards with instructions to go to other tabs. There is no in-app navigation shortcut — just text.

**Impact**: A new user who lands on Feasibility Check has no idea why it's empty. The onboarding moment is broken. Users with partial data (product but no supplier) see the Feasibility pipeline with `$0` supplier cost, which triggers a meaningless WAIT decision.

**Fix options**:
- Add tappable empty states with navigation actions (`navigation.navigate('Research')`)
- Show a clear "incomplete" banner that lists exactly what is missing before showing the pipeline at all
- Do not render any section below Financial Summary until both product AND supplier are saved

---

### 2F — ProfitLab FBA Defaults Are Misleading
**Problem**: `FBA_DEFAULTS` in ProfitLabScreen pre-fills the form with:
```
sellingPrice: '24.49', productCost: '5.20', freight: '2.10',
fbaFees: '4.50', referralFee: '3.67', duties: '0.73',
packaging: '0.45', unitsOrdered: '500'
```
These look like real numbers and produce a real-looking result without the user entering anything. New users may trust this output as a real calculation of their product.

**Fix**: Either clear all defaults, or make it visually obvious these are example values (e.g. a "EXAMPLE DATA" banner until the user touches any field).

---

### 2G — Capital Estimator Relies on Supplier MOQ from AsyncStorage
**Problem**: `computeCapitalEstimate` multiplies `savedSupplier.moq` by unit cost to get inventory cost. But `moq` is parsed from Alibaba/supplier API data, which is not always reliable or in consistent units (sometimes it's a string like "50-100 pieces").

**Impact**: Total launch capital figures may be significantly wrong if MOQ is stored incorrectly.

**Fix**: Display the MOQ used in the calculation in the capital breakdown table so users can spot and correct it.

---

## 3. Logic Issues

### 3A — Feasibility Fee Estimate vs Real FBA Fees
`computeFeasibility()` estimates FBA fees as:
```
referralFee = sellingPrice × 0.15
fbaFee      = weight-based estimate (not size-tier accurate)
```
The real FBA fee depends on size tier (standard vs oversize), which requires dimensions. Feasibility only takes weight as input — no dimensions — so the FBA fee estimate can be materially off for bulky or oversize products.

**Fix**: Either require dimensions as an input, or add a disclaimer that FBA fee is estimated and link to ProfitLab's FBA calculator for a more accurate figure.

---

### 3B — Go/No-Go Priority 0 Triggers Too Early
Current Priority 0: if `missingFields.length >= 2` → always return WAIT.

This blocks the decision engine even when both product and supplier are saved but one field is null for a legitimate reason (e.g. price is missing because the product was saved before the API returned pricing). The threshold of ≥2 missing fields is correct for the no-data case, but the list of what counts as a "missing field" includes things the user cannot control.

**Fix**: Distinguish between user-controllable missing fields (supplier cost, product price) vs system-missing fields. Only block on the user-controllable ones.

---

### 3C — Launch Readiness "Feasibility Complete" Always Shows as Incomplete
The readiness item "Feasibility Check complete" is marked done only if `result !== null`. But `result` is always computed when product + supplier exist — there is no explicit "run" step. So this item is either always done or always not done depending on whether data is loaded, not on whether the user has actually reviewed the results.

**Fix**: Add a local state flag `[feasibilityReviewed, setFeasibilityReviewed]` that the user explicitly triggers (e.g. "I've reviewed this" button), or track a timestamp in AsyncStorage.

---

### 3D — Checklist % Uses ALL_IDS.length = 35 But May Diverge
`ALL_IDS` is imported from `../data/launchPhases.ts` and used as the denominator for checklist progress. If new items are added to `launchPhases.ts` in the future, the percentage will silently change, potentially breaking the "≥50% checklist" readiness gate.

**Fix**: Document this dependency explicitly. Consider deriving the percentage inside the checklist module and exporting it, rather than recalculating it in two places.

---

## 4. Design / UX Issues

### 4A — Feasibility Check Has Too Many Sections
Current section order in one scroll:
1. Amazon Product
2. Supplier
3. Adjustable Inputs
4. Financial Summary
5. Verdict
6. Risk Assessment
7. Top Risk Factors
8. Decision Impact Note
9. Minimum Launch Capital (with 3 editable fields)
10. Launch Readiness
11. Launch Decision
12. Assumptions

This is 12 sections in one scrollable screen. The user must scroll very far to reach the final Launch Decision — which is what they actually want to see.

**Fix options**:
- Move the Launch Decision to the top (hero position) and collapse the supporting sections below
- Use an accordion/collapsible card pattern for the detail sections
- Split into two sub-screens: "Analysis" (Feasibility + Risk) and "Decision" (Capital + Readiness + Go/No-Go)

---

### 4B — Feasibility Banner in ProfitLab Is Below the Fold
The banner sits between the CalcSelector grid and the active workspace. The CalcSelector grid is 3×3 tiles — it takes up significant vertical space. On smaller devices, the banner may not be visible without scrolling, especially when the FBA calculator (default) renders a large workspace below it.

**Fix**: Move the banner to above the CalcSelector, or make it part of the pinned header.

---

### 4C — Empty State Instructions Are Dead Ends
Both empty cards say:
> "Go to Research → Market Search, find a product, then tap 'Save for Feasibility Check'."
> "Go to Research → Suppliers, find a supplier, then tap 'Attach to Feasibility Check'."

The user must physically navigate themselves. On a real device this means: close this screen (swipe back) → tap Research tab → do the search → come back.

**Fix**: Add a "Go to Research" button that navigates directly there:
```tsx
<TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'Research' })}>
```

---

### 4D — Section Labels Use Two Different Systems
- FeasibilityTab section labels: plain `Text` with `feas.sectionLabel` style (old theme-derived)
- ProfitLabScreen: uses `AppCard` + `SectionHeader` DS components

The Feasibility screen does not use `AppCard` wrappers for most of its content — it uses raw `View` with manual border and padding. This means it looks visually lighter/flatter than the rest of the app.

---

### 4E — The "Save Feasibility Check" Button Has No Visible UI Entry Point
`saveFeasibilityCheck()` is defined and implemented in the FeasibilityTab but there is no button rendering it in the current JSX (it may have been removed or not yet wired up in the render path).

**Fix**: Add a save button at the bottom of the results section or in the Launch Decision card.

---

## 5. Summary — Priority Fix List

| # | Issue | Effort | Impact |
|---|---|---|---|
| 1 | Add back button to Feasibility Check screen | Low | Critical UX |
| 2 | Move Feasibility banner above CalcSelector grid | Low | High UX |
| 3 | Strip orphaned tab modes from CalculatorScreen | Medium | Code health |
| 4 | Add direct navigation buttons to empty states | Low | High UX |
| 5 | Unify FBA fee logic (3 different formulas → 1) | High | Data accuracy |
| 6 | Migrate CalculatorScreen to DS tokens | Medium | Visual consistency |
| 7 | Move Launch Decision to hero position | Medium | Core UX |
| 8 | Mark ProfitLab FBA defaults as "example data" | Low | Trust / accuracy |
| 9 | Show MOQ in capital breakdown | Low | Transparency |
| 10 | Fix "Feasibility Complete" readiness item logic | Low | Logic accuracy |

---

## 6. Recommended Architecture Going Forward

```
Tab: Calculate → ProfitLabScreen (calculators only, no feasibility logic)
  └─ Banner → FeasibilityCheck (stack screen, feasibility only)
       ├─ Header with back button
       ├─ Hero: Launch Decision (GO / TEST / WAIT / NO-GO)
       ├─ Collapsible: Financial Summary + Verdict
       ├─ Collapsible: Risk Assessment
       ├─ Collapsible: Capital Estimator
       └─ Collapsible: Launch Readiness

CalculatorScreen — strip to FeasibilityTab only, rename file to FeasibilityScreen.tsx
ProfitLabScreen — keep all 9 calculators, unify fee formula with feasibility.ts
```

This gives users the answer (decision) at the top, with details available on demand, and eliminates the dual fee logic problem by making ProfitLab and Feasibility share the same calculation path.
