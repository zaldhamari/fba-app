// ─── Feasibility types ────────────────────────────────────────────────────────
//
// NOTE (2026-06): The feasibility *engine* (computeFeasibility, the per-marketplace
// FBA fee schedules, and the verdict logic) was removed — it had no callers. The
// live decision path is the productIntelligence chain (useProductIntelligence →
// simulateDecision). Only the FeasibilityProduct type remained in use, by
// ActiveProductContext, so that is all this file now exports.
//
// The full prior implementation is recoverable from git history (pre-cleanup
// commit) and the source backup tarball. See DEAD_CODE_REMOVED.md.

export interface FeasibilityProduct {
  id:           string;
  name:         string;
  price:        number | null;
  rating:       number | null;
  reviewCount:  number | null;
  competition:  'Low' | 'Medium' | 'High';
  url?:         string;
  savedAt:      string; // ISO timestamp
}
