# Siftly — Build Plan (Correctness → Trust → Simplicity → Speed)

Synthesis of two reviews: the strategy/PMF view (ChatGPT) and the implementation/code
view (Claude). Both converged on the same order of operations. This plan operationalizes
that, grounded in the actual codebase.

**Guiding principle:** `Correct → Trusted → Used → Paid`. Don't add features until the
verdict engine is something users consistently rely on instead of double-checking in
Helium10 / Jungle Scout. The moat is the recommendation, not the feature count.

---

## Decision Zero — Who is Siftly for? (answer before Phase 3)

This is the single biggest unanswered question, and it changes the UX work downstream:

- **Beginner-first:** simplicity, guidance, opinionated/obvious flow, AI explanations.
  Implies the Product Workspace + "one giant Analyze action" direction.
- **Expert-first:** ProfitLab depth, advanced metrics, density acceptable.
  Implies keeping the powerful tools, just better organized.

Recommendation: **beginner-acquisition, expert-retention** — onboard beginners with an
opinionated single workflow, but keep the depth reachable (Advanced sections) so experts
don't churn. You don't have to answer fully now, but Phases 3–5 need this decided.

---

## Phase 0 — Already done this session (foundation laid)

Correctness/safety already shipped and verified (tsc 0, tests green, all reversible via git + backup):
- Verdict-engine bug fixed: margin-risk read "Low" for every product (percentage vs fraction).
- FBA fee unified into one canonical weight-based function (cost model ↔ freight now agree).
- Fixed: supplier-label dead branch, usage-counter double-fire, free-limit 5-vs-7 mismatch,
  CSV injection, paywall ISO-date, wasted AI call on the 402 path.
- ~900 lines of dead engine code removed (documented + retrievable).
- Test safety net: 43-assertion suite + `npm run check` + CI workflow.
- Accessibility (chrome, images, research flow), color tokens (328→168 raw hex), haptics,
  expo-image caching, react-hooks lint.
- Nav: 6→5 tabs, 3 dead "Launch" buttons fixed, currency invariant documented (no bug).

---

## Phase 1 — CORRECTNESS (the foundation; do before launch)

The verdict can't be trusted if the math is wrong. Highest priority.

1. **Audit the live verdict engine end-to-end.** `useProductIntelligence` →
   `buildProductIntelligence` → `simulateDecision`. We fixed margin-risk; review the rest
   of the scoring inputs (demand, competition, sourcing difficulty, freight sensitivity)
   for unit mismatches and threshold sanity. *Owner: Claude. Risk: low (logic only).*
2. **Pin the verdict with golden tests.** Build a regression suite of ~15 known
   products (clear LAUNCH / TEST / AVOID cases) → assert the engine returns the expected
   verdict + reasons. This prevents silent verdict drift forever. *Owner: Claude.*
3. **Hook tests via jest-expo.** The worst bugs lived in `useSubscription` / `useVault`,
   not pure logic. Add component/hook tests for gating, increment, vault save-limit,
   allowance. *Owner: Claude (needs jest-expo install on a machine that can reach Expo).*
4. **API contract tests.** Assert the shapes of `/research/amazon`, `/product/data`,
   `/ai/analyze-product` responses so a backend change can't silently break the client.
5. **Sales-estimate model review.** The review-rate proxy (~3%, months-on-market) is a
   rough model. Document its assumptions and decide whether to keep, refine, or gate it
   behind a confidence label. *Owner: you + Claude (product call).*
6. **FBA fee fidelity.** The unified fee is a US weight-schedule approximation. Decide
   whether to wire a real per-product fee lookup (you have `api.calculateFBA`) for the
   committed cost model. *Owner: you (product call) + Claude.*

**Gate to Phase 2:** golden verdict suite green, hook tests in place, no known engine bugs.

---

## Phase 2 — TRUST (make users believe the verdict)

Correct math is necessary but not sufficient; users must *see* why to trust it.

1. **Transparency on every number.** Show the assumptions inline ("est. from ~3% review
   rate, 18mo on market"), confidence bands instead of false-precision point values, and
   let users override the inputs that matter (real selling price, real FBA fee, category
   referral rate). This is the biggest trust lever and almost nobody in the category does it.
2. **"Why this verdict" everywhere.** You already produce `reasons[]` — surface them
   prominently on the verdict, with the top 2–3 drivers and the one risk that could flip it.
3. **Validation / backtest.** Run the engine against a set of known winners and known
   flops; publish the hit-rate to yourself first, then to users ("right on N of last M").
   This is what converts "a tool I try" into "a tool I rely on." *Owner: you + Claude.*

**This is the phase ChatGPT correctly called the real moat. Spend real time here.**

---

## Phase 3 — SIMPLICITY (UX consolidation; needs Decision Zero + a device)

Reduce decisions, increase confidence. All visual — verify on a simulator as we go.

1. **Hide the legacy Builder** (`LaunchPad`/BuilderScreen). Dead-weight that muddies the
   recommended path. *Low risk, do early.*
2. **Merge Niche + Research** into one Research workspace (sub-tabs: Products / Niches /
   Competitors). Already staged from the nav pass. *Medium effort, device-verified.*
3. **Home leads with the primary action.** One prominent "Analyze a product" entry +
   Recent Analyses (your vault already backs this) + the Copilot entry (already the Home
   tab). Strip dashboard clutter. *Note the discovery user — keep a "find a niche" path for
   "I don't know what to sell yet."*
4. **ProfitLab → Advanced section.** Move low-engagement tools behind "Advanced." **Do
   this only after you have usage analytics** — don't guess which tools to demote.

**Gate:** Decision Zero answered; each change eyeballed on device.

---

## Phase 4 — SPEED (perceived performance; your weakest usability link)

1. **Skeletons over spinners.** You have `LoadingSkeleton` but only 1 screen uses it vs 8
   bare spinners. Wire skeletons into search/analyze/results. *Mechanical, device-verify.*
2. **Stream the AI verdict** token-by-token so something appears in 1–2s instead of a
   15–25s blank spinner. *Needs backend support.*
3. **Cache analyzed products locally** so re-opening is instant AND doesn't burn a free
   lookup. Directly boosts both speed and free-tier value. *Owner: Claude, with care.*

---

## Phase 5 — v2 NORTH STAR: Product Workspace (post-launch)

One unified per-product view: enter a product once → demand / competition / profit /
supplier scores → one verdict + reasons, no tab-switching. **This is the right destination**
and your `PipelineContext` + `useProductIntelligence` already hold the unified per-product
state — the data model is largely built; it's the UI that's spread across tabs.

**But do NOT start this before launch.** It's a ground-up navigation rewrite, not a
"simplification" — framing it as a tidy-up is the one place the strategy review is wrong.
Ship, get ~20 real beginners using it, let their behavior drive the workspace design.

---

## Cross-cutting — TestFlight gating (yours, in parallel)

These block the beta and only you can do them:
- Set EAS secrets: `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `EXPO_PUBLIC_SENTRY_DSN`.
- Backend migrations: apply `0001` → deploy → apply `0002`.
- On-device money-path smoke test (see `PRE_TESTFLIGHT_CHECKLIST.md`).

---

## Sequencing summary

```
NOW (pre-TestFlight):   Phase 1 (correctness) ── highest priority
                        + Phase 2 start (transparency/why) where safe
                        + cheap Phase 3 wins (hide Builder)
                        + your TestFlight gating items

AT A DEVICE:            Phase 3 (merge, home, ProfitLab) + Phase 4 (skeletons/cache)

POST-LAUNCH (v2):       Phase 5 (Product Workspace), driven by real user behavior
```

**The one sentence to remember:** reorganizing tabs around a verdict users don't yet
trust just makes the wrong answer easier to find. Earn correctness and trust first —
everything else compounds off that.
