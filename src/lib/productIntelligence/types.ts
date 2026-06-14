// ── Canonical Product Intelligence Types ─────────────────────────────────────
// Single source of truth for all intelligence signals across Siftly.
// Every screen reads from ProductIntelligenceProfile — nothing computes independently.

import type { SourcingIntelligenceResult } from '../sourcing/sourcingIntelligence';

// ── Core scalars ───────────────────────────────────────────────────────────────

export type IntelligenceConfidence = 'High' | 'Medium' | 'Low' | 'Unknown';

export type SellerFitLevel = 'BeginnerSafe' | 'Intermediate' | 'AdvancedOnly' | 'UnsafeForSeller';

export type IntelligenceDomain =
  | 'certification'
  | 'returns'
  | 'freight'
  | 'supplier'
  | 'cashflow'
  | 'negotiation'
  | 'survivability'
  | 'sellerFit';

// ── Action item ───────────────────────────────────────────────────────────────

export interface IntelligenceAction {
  id:       string;               // deduplication key (e.g. 'freight-confirm')
  action:   string;               // imperative sentence: "Get confirmed freight quote"
  domain:   IntelligenceDomain;
  priority: 1 | 2 | 3 | 4 | 5;   // 1 = highest severity
  why:      string;               // WHY this action exists (inputs that triggered it)
  trigger:  string;               // WHICH specific data point triggered it
}

// ── Missing input item ────────────────────────────────────────────────────────

export interface MissingInput {
  field:  string;               // e.g. "Confirmed freight per unit"
  domain: IntelligenceDomain;
  impact: string;               // what is unknown/inaccurate as a result
  tab?:   'Sourcing' | 'Profit' | 'Research' | 'Niche' | 'Brand';
}

// ── Per-domain intelligence block ─────────────────────────────────────────────
// Every domain exposes the same shape, enabling generic UI rendering.

export interface DomainIntelligence {
  domain:                    IntelligenceDomain;
  level:                     string;   // domain-specific: 'Complex', 'High', 'Stable', etc.
  score:                     number;   // 0–100
  confidence:                IntelligenceConfidence;
  headline:                  string;   // one-line summary for UI display
  explainability:            string;   // WHY: "Complex because product has Bluetooth..."
  topCauses:                 string[]; // up to 3 root causes driving the score
  actionableRecommendations: string[]; // up to 3 specific things to do
  missingInputs:             string[]; // what data would improve this assessment
  estimatedInputs:           string[]; // inputs that are estimated, not confirmed
}

// ── Seller fit ────────────────────────────────────────────────────────────────

export interface SellerFit {
  level:       SellerFitLevel;
  label:       string;
  score:       number;         // 0–100 fit score (100 = perfectly safe)
  reasons:     string[];       // WHY this fit level was assigned
  blockers:    string[];       // specific blockers (what makes it risky/advanced)
  suggestions: string[];       // what the seller can do to improve fit
}

// ── The unified profile ───────────────────────────────────────────────────────

export interface ProductIntelligenceProfile {
  productTitle:   string;
  computedAt:     string;  // ISO timestamp

  // Overall health
  overallScore:           number;
  overallLabel:           'Strong' | 'Viable' | 'Marginal' | 'Risky' | 'Unknown';
  overallConfidence:      IntelligenceConfidence;
  overallExplainability:  string;  // WHY the label — built from top causes

  // Per-domain (every screen reads these)
  domains: {
    certification: DomainIntelligence;
    returns:       DomainIntelligence;
    freight:       DomainIntelligence;
    supplier:      DomainIntelligence;
    cashflow:      DomainIntelligence;
    negotiation:   DomainIntelligence;
    survivability: DomainIntelligence;
    sellerFit:     DomainIntelligence;
  };

  // Seller fit (standalone — also mirrored into domains.sellerFit)
  sellerFit: SellerFit;

  // Centralized, deduplicated, ranked signals
  topRisks:     IntelligenceAction[];  // max 5
  topActions:   IntelligenceAction[];  // max 5
  missingInputs: MissingInput[];       // all missing, deduplicated

  // Pre-built Copilot context string (used by CopilotScreen — no re-computation)
  copilotContext: string;

  // Raw engine results — consumed by screens that need specific fields
  // Never re-run these engines directly; read from raw instead.
  raw: {
    sourcing: SourcingIntelligenceResult;
  };
}
