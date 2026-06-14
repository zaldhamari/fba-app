// ─── Launch Decision types ────────────────────────────────────────────────────
//
// NOTE (2026-06): The launch-decision *engine* (computeLaunchDecision,
// computeLaunchReadiness, computeCapitalEstimate, defaultCapitalInputs) was
// removed — none of it had callers. The live decision path is the
// productIntelligence chain (useProductIntelligence → simulateDecision).
//
// Only LaunchAdvisorSnapshot (and the types it composes) remained in use, by
// LaunchScreen, which reads a persisted snapshot. Those types are preserved here.
// The full prior implementation is recoverable from git history (pre-cleanup
// commit) and the source backup tarball. See DEAD_CODE_REMOVED.md.

export type LaunchDecision = 'GO' | 'TEST' | 'WAIT' | 'NO-GO';

export interface LaunchDecisionResult {
  decision:   LaunchDecision;
  summary:    string;
  reasons:    string[];
  confidence: 'High' | 'Medium' | 'Low';
}

export interface ReadinessItem {
  label:   string;
  done:    boolean;
  points:  number;
  action?: string;
}

export interface LaunchReadinessResult {
  score:        number; // 0–100
  items:        ReadinessItem[];
  missingSteps: string[];
  nextActions:  string[];
}

// Persisted snapshot — written by the launch advisor, read by LaunchScreen so the
// home screen can display the verdict without re-running the computation chain.
export interface LaunchAdvisorSnapshot {
  decision:      LaunchDecisionResult;
  readiness:     LaunchReadinessResult;
  riskScore:     number;
  riskLevel:     string;
  productTitle:  string;
  computedAt:    string;   // ISO date string
  checklistPct?: number;
}
