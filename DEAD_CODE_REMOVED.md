# Dead-code removal — 2026-06

This note records orphaned modules removed during the logic audit, and how to get
them back if anything ever depends on them.

## What was removed

All three modules below had **zero callers** in the app. The live decision path is
the `productIntelligence` chain (`useProductIntelligence` → `buildProductIntelligence`
→ `simulateDecision`); these were leftovers from a prior architecture.

| File | Before | After | Change |
|---|---|---|---|
| `src/lib/riskAssessment.ts` | 402 lines | **deleted** | No importers anywhere. `computeRiskAssessment`, `riskLevelFromScore`, and all risk types were unreferenced. |
| `src/lib/feasibility.ts` | 275 lines | ~22 lines | Reduced to the `FeasibilityProduct` **type** only — the one symbol still imported (by `src/context/ActiveProductContext.tsx`). Removed `computeFeasibility`, the per-marketplace FBA fee schedules (`_usaFee`…`_saFee`, `estimateFBAFee`), `deriveVerdict`, `buildVerdictReason`, and the unused result/input types. |
| `src/lib/launchDecision.ts` | 296 lines | ~46 lines | Reduced to `LaunchAdvisorSnapshot` and the types it composes (`LaunchDecisionResult`, `LaunchReadinessResult`, `LaunchDecision`, `ReadinessItem`) — used by `src/screens/LaunchScreen.tsx`. Removed `computeLaunchDecision`, `computeLaunchReadiness`, `computeCapitalEstimate`, `defaultCapitalInputs`, and `CapitalInputs`/`CapitalBreakdown`/`SourcingContext`. |

Roughly **~900 lines** of unreachable code removed. The two live consumers
(`ActiveProductContext`, `LaunchScreen`) import only types, and those types were
preserved in place, so their import paths are unchanged.

The corresponding tests (feasibility verdicts, risk levels, capital estimate) were
removed from `tests/pure-logic.test.cjs`; the live money-path coverage
(financialEngine, smartSearch, sourcingStrategy) remains.

## Verification

- `tsc --noEmit` → 0 errors (no dangling references).
- `npm test` → all pass.

## How to retrieve if needed

1. **Git history.** The full prior implementations exist in the commit history.
   The working tree immediately before this cleanup was at commit `ae0dd4d6`
   (plus uncommitted working changes). Use:
   - `git log -- src/lib/riskAssessment.ts` to find the last commit containing it, then
   - `git show <commit>:src/lib/riskAssessment.ts > src/lib/riskAssessment.ts` to restore.
2. **Source backup tarball.** A full snapshot was taken just before the audit:
   `siftly-backup-20260610-071706.tar.gz` (saved to your outputs/Downloads). It
   contains the original `feasibility.ts`, `launchDecision.ts`, and
   `riskAssessment.ts` in full.

## Why this is safe

The decision engine the app actually runs (`productIntelligence` / `simulateDecision`)
was untouched. The margin-risk unit bug fixed during the same audit
(`marginPct` compared against `0.55`/`0.35` instead of `55`/`35`) was in that live
path — see `useProductIntelligence.ts` / `useDecisionSimulation.ts`.
